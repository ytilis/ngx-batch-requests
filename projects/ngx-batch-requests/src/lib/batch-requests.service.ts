import { Injectable, Optional } from '@angular/core';
import {
  HttpHandler,
  HttpRequest,
  HttpEvent,
  HttpClient,
  HttpResponse,
  HttpHeaders,
  HttpEventType,
  HttpParams
} from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { bufferTime, filter } from 'rxjs/operators';
import {
  BOUNDARY,
  CONTENT_ID, CONTENT_ID_PREFIX_TEMPLATE,
  CONTENT_TYPE,
  CONTENT_TYPE_BATCH, CONTENT_TYPE_HTTP,
  CONTENT_TYPE_MIXED,
  DOUBLE_DASH, EMPTY_STRING,
  HTTP_VERSION_1_1, NEW_LINE, SPACE, XSSI_PREFIX
} from './batch-constants';
import { BatchRequestsConfigService } from './batch-requests.config.service';

@Injectable({
  providedIn: 'root'
})
export class BatchRequestsService {
  private batcher: Observable<BatchStreamObject>;
  private requestObserver: Subject<BatchStreamObject>;

  private readonly headers: HttpHeaders;
  private readonly params: HttpParams | null;
  private withCredentials = false;

  constructor(
    private httpClient: HttpClient,
    @Optional()
    private config: BatchRequestsConfigService = new BatchRequestsConfigService()
  ) {
    this.requestObserver = new Subject<BatchStreamObject>();
    this.batcher = this.requestObserver;

    this.headers = new HttpHeaders({
      [CONTENT_TYPE]: `${CONTENT_TYPE_MIXED}${BOUNDARY}`
    });

    const defaultOptions = config.defaultRequestOptions;
    if (defaultOptions.headers) {
      defaultOptions.headers.keys().forEach((k, _) => {
        this.headers.append(k, defaultOptions.headers.get(k));
      });
    }

    if (defaultOptions.params) {
      this.params = defaultOptions.params;
    }

    if (defaultOptions.withCredentials) {
      this.withCredentials = defaultOptions.withCredentials;
    }

    this.batcher
      .pipe(
        bufferTime(
          config.bufferTimeSpan,
          null,
          config.bufferMaxSize,
        ),
        filter(arr => !!arr.length) // ensures we do not process empty arrays
      )
      .subscribe(arr => {
        // If only one request
        if (arr.length === 1) {
          const one = arr[0];
          one.next.handle(one.req).subscribe(
            update => {
              one.result.next(update);
            },
            error => {
              one.result.error(error);
            },
            () => {
              one.result.complete();
            }
          );
          return;
        }

        const batchRequest = this.batch(arr.map(n => n.req));
        this.httpClient
          .request<ArrayBuffer | Blob | FormData | string | null>(
            batchRequest
          )
          .subscribe(
            response => {
              if (response.type !== HttpEventType.Response) {
                return;
              }
              this.parse(response).forEach((r, i) => {
                arr[i].result.next(r);
                arr[i].result.complete();
              });
            },
            error => {
              throw error;
            },
            () => {}
          );
      });
  }

  addRequest(req: BatchStreamObject): Observable<HttpEvent<any>> {
    const result = new Subject<HttpEvent<any>>();
    this.requestObserver.next({ ...req, result });
    return result;
  }

  private batch(requests: HttpRequest<any>[]): HttpRequest<any> {
    const bodyParts = [];

    requests.forEach((r, i) => {
      const urlParts = this.getUrlParts(r.urlWithParams);

      bodyParts.push(DOUBLE_DASH + BOUNDARY);
      bodyParts.push(
        `${CONTENT_TYPE}: ${CONTENT_TYPE_HTTP}`,
        `${CONTENT_ID}: ${CONTENT_ID_PREFIX_TEMPLATE.replace(
          '{i}',
          i.toString()
        )}`,
        EMPTY_STRING
      );

      bodyParts.push(
        // tslint:disable-next-line:max-line-length
        `${r.method.toUpperCase()} ${urlParts.path}${urlParts.search} ${HTTP_VERSION_1_1}`,
        `Host: ${urlParts.host}`,
        `Accept: application/json, text/plain, */*`
      );

      this.setDetectedContentType(r);

      r.headers.keys().forEach(key => {
        const header = `${key}: ${r.headers.getAll(key).join(',')}`;
        bodyParts.push(header);
      });

      bodyParts.push(EMPTY_STRING);

      if (r.body) {
        bodyParts.push(r.serializeBody().toString());
      }

      bodyParts.push(EMPTY_STRING);
    });

    bodyParts.push(DOUBLE_DASH + BOUNDARY + DOUBLE_DASH);

    return new HttpRequest(
      this.config.batchMethod,
      this.config.batchPath,
      bodyParts.join(NEW_LINE),
      {
        headers: this.headers,
        params: this.params,
        withCredentials: this.withCredentials,
        responseType: 'text'
      }
    );
  }

  public parse(
    response: HttpResponse<ArrayBuffer | Blob | FormData | string | null>
  ): HttpResponse<any>[] {
    const contentTypeHeaderValue = response.headers.get(CONTENT_TYPE);
    // tslint:disable-next-line:no-null-keyword
    if (
      contentTypeHeaderValue == null ||
      contentTypeHeaderValue.indexOf(CONTENT_TYPE_BATCH) === -1
    ) {
      throw new Error(
        `A batched response must contain a ${CONTENT_TYPE}: ${CONTENT_TYPE_MIXED} header`
      );
    }

    const boundary = contentTypeHeaderValue
      .split(CONTENT_TYPE_BATCH)[1]
      .replace(/"/g, EMPTY_STRING);

    return response.body
      .toString()
      .split(DOUBLE_DASH + boundary)
      .filter(part => {
        return (
          part !== EMPTY_STRING &&
          part !== DOUBLE_DASH + NEW_LINE &&
          !!(part && part.trim())
        );
      })
      .map(part => {
        // splitting by two new lines gets
        // 1. The batch content type header
        // 2. The actual response http + headers
        // 3. The response body (if any)
        const batchedParts = part.split(
          NEW_LINE + NEW_LINE
        );
        const headers = new HttpHeaders();
        let status: number;
        let statusText: string;
        let body = batchedParts[2];

        batchedParts[1]
          .split(NEW_LINE)
          .forEach((header, i) => {
            const lineParts = header.split(SPACE);
            if (i === 0) {
              status = parseInt(lineParts[1], 10);
              statusText = lineParts
                .slice(2)
                .join(SPACE);
            } else {
              headers.append(
                lineParts[0].replace(
                  ':',
                  EMPTY_STRING
                ),
                header.substring(
                  header.indexOf(SPACE) + 1
                )
              );
            }
          });

        // implicitly strip a potential XSSI prefix.
        if (body !== undefined && body.length > 0) {
          body = body.replace(XSSI_PREFIX, EMPTY_STRING);
        }

        return new HttpResponse<any>({
          body: body && this.config.parseBody(body),
          headers,
          status,
          statusText
        });
      });
  }

  private getUrlParts(
    url: string
  ): { host: string; path: string; search: string } {
    const anchorElement = document.createElement('a');
    anchorElement.href = url;
    return {
      host: anchorElement.host,
      path: this.ensureLeadingBackSlash(anchorElement.pathname),
      search: anchorElement.search
    };
  }

  private setDetectedContentType(req: HttpRequest<any>) {
    // Skip if a custom Content-Type header is provided
    if (
      req.headers != null &&
      req.headers.get(CONTENT_TYPE) != null
    ) {
      return;
    }

    req.headers.append(
      CONTENT_TYPE,
      req.detectContentTypeHeader()
    );
  }

  private ensureLeadingBackSlash(path: string): string {
    return path[0] === '/' ? path : `/${path}`;
  }
}

interface BatchStreamObject {
  req: HttpRequest<any>;
  next: HttpHandler;
  result?: Subject<HttpEvent<any>>;
}
