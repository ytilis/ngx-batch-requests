import { Inject, Injectable, Optional } from '@angular/core';
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
import defaultsDeep from 'lodash.defaultsdeep';

import {
  BOUNDARY,
  CONTENT_ID, CONTENT_ID_PREFIX,
  CONTENT_TYPE,
  CONTENT_TYPE_BATCH, CONTENT_TYPE_HTTP,
  CONTENT_TYPE_MIXED,
  DOUBLE_DASH, EMPTY_STRING,
  HTTP_VERSION_1_1, NEW_LINE, SPACE, XSSI_PREFIX
} from './utils';
import { BATCH_REQUESTS_CONFIG, defaultBatchRequestsConfig } from './batch-requests.config';

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
    @Inject( BATCH_REQUESTS_CONFIG ) public config,
  ) {
    this.config = defaultsDeep(config, defaultBatchRequestsConfig);

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
        filter(queue => !!queue.length) // ensures we do not process empty arrays
      )
      .subscribe(queue => {
        // If only one request
        if (queue.length === 1) {
          const one = queue[0];
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

        const requests = queue.map(n => n.req);
        const batchRequest = this.batch(requests);
        this.httpClient
          .request<ArrayBuffer | Blob | FormData | string | null>(
            batchRequest
          )
          .subscribe(
            response => {
              if (response.type !== HttpEventType.Response) {
                return;
              }

              this.parse(response, requests).forEach((res, i) => {
                queue[i].result.next(res);
                queue[i].result.complete();
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

    requests.forEach((req, id) => {
      const urlParts = this.getUrlParts(req.urlWithParams);

      bodyParts.push(DOUBLE_DASH + BOUNDARY);
      bodyParts.push(
        `${CONTENT_TYPE}: ${CONTENT_TYPE_HTTP}`,
        `${CONTENT_ID}: <${CONTENT_ID_PREFIX}+${id}>`,
        EMPTY_STRING
      );

      bodyParts.push(
        // tslint:disable-next-line:max-line-length
        `${req.method.toUpperCase()} ${urlParts.path}${urlParts.search} ${HTTP_VERSION_1_1}`,
        `Host: ${urlParts.host}`,
        `Accept: application/json, text/plain, */*`
      );

      this.setDetectedContentType(req);

      req.headers.keys().forEach(key => {
        const header = `${key}: ${req.headers.getAll(key).join(',')}`;
        bodyParts.push(header);
      });

      bodyParts.push(EMPTY_STRING);

      if (req.body) {
        bodyParts.push(req.serializeBody().toString());
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
    response: HttpResponse<ArrayBuffer | Blob | FormData | string | null>,
    requests: HttpRequest<any>[],
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
      .map((part, requestIndex) => {
        // splitting by two new lines gets
        // 1. The batch content type header
        // 2. The actual response http + headers
        // 3. The response body (if any)
        const batchedParts = part.split(NEW_LINE + NEW_LINE);
        let headers = new HttpHeaders();
        let status: number;
        let statusText: string;
        let body = batchedParts[2];

        batchedParts[1]
          .split(NEW_LINE)
          .forEach((header, i) => {
            if (i === 0) {
              const [protocol, statusCode, ...statusTextArray] = header.split(SPACE);
              status = parseInt(statusCode, 10);
              statusText = statusTextArray.join(SPACE);
            } else {
              const [key, value] = header.split(': ');
              headers = headers.append(key, value);
            }
          });

        // implicitly strip a potential XSSI prefix.
        if (body !== undefined && body.length > 0) {
          body = body.replace(XSSI_PREFIX, EMPTY_STRING);
        }

        return this.config.parseResponse(
          new HttpResponse<any>({
            body,
            headers,
            status,
            statusText
          }),
          requests[requestIndex],
        );
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
