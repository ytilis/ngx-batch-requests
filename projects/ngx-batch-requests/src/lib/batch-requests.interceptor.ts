import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BatchRequestsConfigService } from './batch-requests.config.service';
import { BatchRequestsService } from './batch-requests.service';

@Injectable()
export class BatchRequestsInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    if (!req.headers
      .get(BatchRequestsService.H_CONTENT_TYPE)) {
      return next.handle(req);
    }

    if (
      req.headers
        .get(BatchRequestsService.H_CONTENT_TYPE)
        .startsWith(BatchRequestsService.H_CONTENT_TYPE_MIXED) ||
      !this.config.shouldBatch(req)
    ) {
      return next.handle(req);
    }

    if (
      req.headers
        .get(BatchRequestsService.H_CONTENT_TYPE)
        .includes(BatchRequestsService.BOUNDARY)
    ) {
      return this.batchRequestsService.addRequest({req, next});
    }

    return next.handle(req);
  }

  constructor(
    private batchRequestsService: BatchRequestsService,
    private config: BatchRequestsConfigService
  ) {
  }
}
