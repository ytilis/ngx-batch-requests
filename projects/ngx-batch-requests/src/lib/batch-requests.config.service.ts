import { Injectable } from '@angular/core';
import { HttpRequest, HttpHeaders, HttpParams } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class BatchRequestsConfigService {
  bufferTimeSpan = 250;
  bufferMaxSize = 20;

  batchPath = '/api/batch';
  batchMethod: 'POST' | 'PUT' | 'PATCH' = 'POST';

  defaultRequestOptions: {
    headers?: HttpHeaders
    params?: HttpParams
    withCredentials?: boolean
  } = {
    withCredentials: true
  };

  parseBody = (body: string): any => JSON.parse(body);

  shouldBatch = (req: HttpRequest<any>): boolean => true;
}
