import { HttpErrorResponse, HttpResponse } from '@angular/common/http';

export const CONTENT_ID = 'Content-ID';
export const CONTENT_ID_PREFIX = 'b29c5de2-0db4-490b-b421-6a51b598bd22';
export const CONTENT_TYPE = 'Content-Type';
export const CONTENT_TYPE_HTTP = 'application/http; msgtype=request';
export const CONTENT_TYPE_MIXED = 'multipart/mixed; boundary=';
export const CONTENT_TYPE_BATCH = 'multipart/batch; boundary=';
export const CONTENT_TYPE_JSON = 'application/json; charset=utf-8';
export const BOUNDARY = '1494052623884';
export const DOUBLE_DASH = '--';
export const NEW_LINE = '\r\n';
export const EMPTY_STRING = '';
export const SPACE = ' ';
export const HTTP_VERSION_1_1 = 'HTTP/1.1';
export const XSSI_PREFIX = /^\)\]\}",?\n/;

export const hasContentTypeHeader = (response: HttpResponse<any> | HttpErrorResponse): boolean => {
  return response.headers
    && response.headers.has(CONTENT_TYPE);
};

export const isResponseBatch = (response: HttpResponse<any> | HttpErrorResponse): boolean => {
  return hasContentTypeHeader(response)
    && response.headers.get(CONTENT_TYPE).startsWith(CONTENT_TYPE_BATCH);
};

export const isResponseJson = (response: HttpResponse<any> | HttpErrorResponse): boolean => {
  return hasContentTypeHeader(response)
    && response.headers.get(CONTENT_TYPE).startsWith(CONTENT_TYPE_JSON);
};

export const numberIndex = (num, index) => {
  const len = Math.floor( Math.log(num) / Math.LN10 ) - index;
  return ( (num / Math.pow(10, len)) % 10) | 0;
};
