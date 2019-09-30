import { HttpRequest, HttpHeaders, HttpParams } from '@angular/common/http';
import { InjectionToken } from '@angular/core';

export interface BatchRequestsConfig {
  bufferTimeSpan: number;
  bufferMaxSize: number;

  batchPath: string;
  batchMethod: 'POST' | 'PUT' | 'PATCH';

  defaultRequestOptions: {
    headers?: HttpHeaders
    params?: HttpParams
    withCredentials?: boolean
  };

  parseBody(body: string): any;

  shouldBatch(req: HttpRequest<any>): boolean;
}

export const defaultBatchRequestsConfig = {
  bufferTimeSpan: 250,
  bufferMaxSize: 20,

  batchPath: '/api/$batch',
  batchMethod: 'POST',

  defaultRequestOptions: {
    withCredentials: true
  },

  parseBody: (body): any => JSON.parse(body),

  shouldBatch: (req): boolean => true,
};

export const BATCH_REQUESTS_CONFIG = new InjectionToken<BatchRequestsConfig>( null );

