import { Injectable } from '@angular/core';
import { HttpRequest, HttpHeaders, HttpParams } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class BatchRequestsConfigService {
  batchPath(): string {
    return '/api/batch';
  }
  batchMethod(): 'POST' | 'PUT' | 'PATCH' {
    return 'POST';
  }
  getBuffTimeSpan(): number {
    return 250;
  }

  getMaxBufferSize(): number {
    return 20;
  }

  getRequestOptions(): {
    headers?: HttpHeaders
    params?: HttpParams
    withCredentials?: boolean
  } {
    return {
      withCredentials: true
    };
  }

  parseBody(body: string): any {
    return JSON.parse(body);
  }

  shouldBatch(_: HttpRequest<any>): boolean {
    return true;
  }
}
