// tslint:disable-next-line:max-line-length
import { HttpClient, HttpEvent, HttpEventType, HttpHandler, HttpHeaders, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { bufferTime, filter } from 'rxjs/operators';
import { BatchRequestsConfigService } from './batch-requests.config.service';

const XSSI_PREFIX = /^\)\]\}",?\n/;

@Injectable({
  providedIn: 'root'
})
export class BatchRequestsService {
  public static readonly HEADERS_CONTENT_TYPE_BATCH: HttpHeaders = new HttpHeaders({ 'Content-Type': 'batch' });
  public static readonly H_CONTENT_TYPE = 'Content-Type';
  public static readonly H_CONTENT_TYPE_VALUE = 'application/ld+json';
  public static readonly H_CONTENT_TYPE_MIXED = 'multipart/mixed';
  public static readonly BOUNDARY = 'batch';
  private static readonly MMM_CONTENT_TYPE = 'multipart/mixed;boundary=';
  private static readonly MMM_CONTENT_TYPERESPONSE = 'multipart/batch;';
  private static readonly DOUBLE_DASH = '--';
  private static readonly NEW_LINE = '\n';
  private static readonly EMPTY_STRING = '';
  private static readonly SPACE = ' ';

  private batcher: Observable<BatchStreamObject>;
  private requestObserver: Subject<BatchStreamObject>;

  private headers: HttpHeaders;
  private params: HttpParams | null;
  private withCredentials = false;

  constructor(
    private httpClient: HttpClient,
    private config: BatchRequestsConfigService
  ) {
    this.init();
  }

  private init() {
    this.requestObserver = new Subject<BatchStreamObject>();
    this.batcher = this.requestObserver.asObservable();

    this.headers = new HttpHeaders({
      [BatchRequestsService.H_CONTENT_TYPE]: `${BatchRequestsService.MMM_CONTENT_TYPE}${BatchRequestsService.BOUNDARY}`
    });

    const defaultOptions = this.config.getRequestOptions();
    if (defaultOptions.headers) {
      defaultOptions.headers.keys().forEach((key, _) => {
        this.headers.append(key, defaultOptions.headers.get(key));
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
          this.config.getBuffTimeSpan(),
          0,
          this.config.getMaxBufferSize(),
        ),
        filter(arr => !!arr.length)
      )
      .subscribe(arr => {
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
              this.parse(response).forEach((responseBatched, i) => {
                arr[i].result.next(responseBatched);
                arr[i].result.complete();
              });
            },
            error => {
              throw error;
            },
            () => { }
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

    requests.forEach((request) => {
      const urlParts = this.getUrlParts(request.urlWithParams);

      bodyParts.push(BatchRequestsService.DOUBLE_DASH + BatchRequestsService.BOUNDARY);
      bodyParts.push(BatchRequestsService.EMPTY_STRING);
      bodyParts.push(
        `${request.method.toUpperCase()} ${urlParts.path}${urlParts.search}`,
        `Host: ${urlParts.host}`,
        `Accept: ${BatchRequestsService.H_CONTENT_TYPE_VALUE}`
      );

      bodyParts.push(`${BatchRequestsService.H_CONTENT_TYPE}: ${BatchRequestsService.H_CONTENT_TYPE_VALUE}`);

      if (request.body) {
        bodyParts.push(request.serializeBody().toString());
      }
    });

    bodyParts.push(BatchRequestsService.DOUBLE_DASH + BatchRequestsService.BOUNDARY);

    return new HttpRequest(
      this.config.batchMethod(),
      this.config.batchUrl,
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
    if (
      contentTypeHeaderValue == null ||
      contentTypeHeaderValue.indexOf(
        BatchRequestsService.MMM_CONTENT_TYPERESPONSE
      ) === -1
    ) {
      throw new Error(
        `A batched response must contain a Content-type: ${BatchRequestsService.H_CONTENT_TYPE_MIXED}; boundary header`
      );
    }

    return response.body
      .toString()
      .split(BatchRequestsService.DOUBLE_DASH + BatchRequestsService.BOUNDARY)
      .filter(part => {
        return (
          part !== BatchRequestsService.EMPTY_STRING &&
          part !== BatchRequestsService.DOUBLE_DASH + BatchRequestsService.NEW_LINE &&
          !!(part && part.trim())
        );
      })
      .map(part => {
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
          body,
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

  private ensureLeadingBackSlash(path: string): string {
    return path[0] === '/' ? path : `/${path}`;
  }
}

interface BatchStreamObject {
  req: HttpRequest<any>;
  next: HttpHandler;
  result?: Subject<HttpEvent<any>>;
}

