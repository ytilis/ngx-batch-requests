import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { HttpJsonParseError } from '@angular/common/http/src/response';

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

export const isContentTypeBatch = (response: HttpResponse<any> | HttpErrorResponse): boolean => {
  return hasContentTypeHeader(response)
    && response.headers.get(CONTENT_TYPE).startsWith(CONTENT_TYPE_BATCH);
};

export const isContentTypeJson = (response: HttpResponse<any> | HttpErrorResponse): boolean => {
  return hasContentTypeHeader(response)
    && response.headers.get(CONTENT_TYPE).startsWith(CONTENT_TYPE_JSON);
};

// We're basically just mimicking the logic in Angular's HttpXhrBackend
// @see: https://github.com/angular/angular/blob/5ae9b76a9b8618ebe0e734532c576e6d38ba72cd/packages/common/http/src/xhr.ts#L180
export const parseResponseLikeAngular = (req, status, statusText, headers, body) => {
  const url = req.urlWithParams || undefined;
  let ok = status >= 200 && status < 300;

  // Check whether the body needs to be parsed as JSON (in many cases the browser
  // will have done that already).
  if (req.responseType === 'json' && typeof body === 'string') {
    // Save the original body, before attempting XSSI prefix stripping.
    const originalBody = body;

    if (body.length > 0) {
      // implicitly strip a potential XSSI prefix.
      body = body.replace(XSSI_PREFIX, EMPTY_STRING);

      // Trim trailing newlines
      body = body.trim();
    }

    try {
      // Attempt the parse. If it fails, a parse error should be delivered to the user.
      body = body !== '' ? JSON.parse(body) : null;
    } catch (error) {
      // Since the JSON.parse failed, it's reasonable to assume this might not have been a
      // JSON response. Restore the original body (including any XSSI prefix) to deliver
      // a better error response.
      body = originalBody;

      // If this was an error request to begin with, leave it as a string, it probably
      // just isn't JSON. Otherwise, deliver the parsing error to the user.
      if (ok) {
        // Even though the response status was 2xx, this is still an error.
        ok = false;
        // The parse error contains the text of the body that failed to parse.
        body = { error, text: body } as HttpJsonParseError;
      }
    }
  }

  if (ok) {
    return {
      ok,
      response: new HttpResponse<any>({
        body,
        headers,
        status,
        statusText,
        url,
      }),
    };
  } else {
    return {
      ok,
      response: new HttpErrorResponse({
        error: body,
        headers,
        status,
        statusText,
        url,
      }),
    };
  }
};
