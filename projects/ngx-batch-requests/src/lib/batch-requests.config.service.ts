import { HttpHeaders, HttpParams, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable()
export class BatchRequestsConfigService {

  constructor() {
  }

  get batchUrl(): string {
    return '/api/$batch';
  }

  batchMethod(): 'POST' | 'PUT' | 'PATCH' {
    return 'POST';
  }

  getBuffTimeSpan(): number {
    return 0;
  }

  getMaxBufferSize(): number {
    return 0;
  }

  getRequestOptions(): {
    headers?: HttpHeaders
    params?: HttpParams
    withCredentials?: boolean
  } {
    return {
      withCredentials: false
    };
  }

  shouldBatch(_: HttpRequest<any>): boolean {
    return true;
  }
}
