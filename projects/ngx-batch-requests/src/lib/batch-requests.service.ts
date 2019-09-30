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
import { BatchRequestsConfigService } from './batch-requests.config.service';

const XSSI_PREFIX = /^\)\]\}",?\n/;

@Injectable({
  providedIn: 'root'
})
export class BatchRequestsService {
  private static HTTP_VERSION_1_1 = 'HTTP/1.1';
  private static BOUNDARY = '1494052623884';
  private static MMM_CONTENT_TYPE = 'multipart/mixed; boundary=';
  private static MMM_CONTENT_TYPERESPONSE = 'multipart/batch; boundary=';
  private static H_CONTENT_ID = 'Content-ID';
  public static H_CONTENT_TYPE = 'Content-Type';
  private static H_CONTENT_ID_PREFIX_TEMPLATE = '<b29c5de2-0db4-490b-b421-6a51b598bd22+{i}>';
  private static DOUBLE_DASH = '--';
  private static NEW_LINE = '\r\n';
  private static EMPTY_STRING = '';
  private static SPACE = ' ';

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
      [BatchRequestsService.H_CONTENT_TYPE]: `${BatchRequestsService.MMM_CONTENT_TYPE}${BatchRequestsService.BOUNDARY}`
    });

    const defaultOptions = config.getRequestOptions();
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
          config.getBuffTimeSpan(),
          null,
          config.getMaxBufferSize()
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

      bodyParts.push(BatchRequestsService.DOUBLE_DASH + BatchRequestsService.BOUNDARY);
      bodyParts.push(
        `${
          BatchRequestsService.H_CONTENT_TYPE
          }: application/http; msgtype=request`,
        `${
          BatchRequestsService.H_CONTENT_ID
          }: ${BatchRequestsService.H_CONTENT_ID_PREFIX_TEMPLATE.replace(
          '{i}',
          i.toString()
        )}`,
        BatchRequestsService.EMPTY_STRING
      );

      bodyParts.push(
        // tslint:disable-next-line:max-line-length
        `${r.method.toUpperCase()} ${urlParts.path}${urlParts.search} ${
          BatchRequestsService.HTTP_VERSION_1_1
          }`,
        `Host: ${urlParts.host}`,
        `Accept: application/json, text/plain, */*`
      );

      this.setDetectedContentType(r);

      r.headers.keys().forEach(key => {
        const header = `${key}: ${r.headers.getAll(key).join(',')}`;
        bodyParts.push(header);
      });

      bodyParts.push(BatchRequestsService.EMPTY_STRING);

      if (r.body) {
        bodyParts.push(r.serializeBody().toString());
      }

      bodyParts.push(BatchRequestsService.EMPTY_STRING);
    });

    bodyParts.push(
      BatchRequestsService.DOUBLE_DASH +
      BatchRequestsService.BOUNDARY +
      BatchRequestsService.DOUBLE_DASH
    );

    return new HttpRequest(
      this.config.batchMethod(),
      this.config.batchPath(),
      bodyParts.join(BatchRequestsService.NEW_LINE),
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
    const contentTypeHeaderValue = response.headers.get(
      BatchRequestsService.H_CONTENT_TYPE
    );
    // tslint:disable-next-line:no-null-keyword
    if (
      contentTypeHeaderValue == null ||
      contentTypeHeaderValue.indexOf(
        BatchRequestsService.MMM_CONTENT_TYPERESPONSE
      ) === -1
    ) {
      throw new Error(
        'A batched repsonse must contain a content-type: multipart/mixed; boundary header'
      );
    }

    const boundary = contentTypeHeaderValue
      .split(BatchRequestsService.MMM_CONTENT_TYPERESPONSE)[1]
      .replace(/"/g, BatchRequestsService.EMPTY_STRING);

    return response.body
      .toString()
      .split(BatchRequestsService.DOUBLE_DASH + boundary)
      .filter(part => {
        return (
          part !== BatchRequestsService.EMPTY_STRING &&
          part !== BatchRequestsService.DOUBLE_DASH + BatchRequestsService.NEW_LINE &&
          !!(part && part.trim())
        );
      })
      .map(part => {
        // splitting by two new lines gets
        // 1. The batch content type header
        // 2. The actual response http + headers
        // 3. The response body (if any)
        const batchedParts = part.split(
          BatchRequestsService.NEW_LINE + BatchRequestsService.NEW_LINE
        );
        const headers = new HttpHeaders();
        let status: number;
        let statusText: string;
        let body = batchedParts[2];

        batchedParts[1]
          .split(BatchRequestsService.NEW_LINE)
          .forEach((header, i) => {
            const lineParts = header.split(BatchRequestsService.SPACE);
            if (i === 0) {
              status = parseInt(lineParts[1], 10);
              statusText = lineParts
                .slice(2)
                .join(BatchRequestsService.SPACE);
            } else {
              headers.append(
                lineParts[0].replace(
                  ':',
                  BatchRequestsService.EMPTY_STRING
                ),
                header.substring(
                  header.indexOf(BatchRequestsService.SPACE) + 1
                )
              );
            }
          });

        // implicitly strip a potential XSSI prefix.
        if (body !== undefined && body.length > 0) {
          body = body.replace(XSSI_PREFIX, BatchRequestsService.EMPTY_STRING);
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
      req.headers.get(BatchRequestsService.H_CONTENT_TYPE) != null
    ) {
      return;
    }

    req.headers.append(
      BatchRequestsService.H_CONTENT_TYPE,
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
