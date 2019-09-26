import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BatchRequestsConfigService } from './batch-requests.config.service';
import { BatchRequestsService } from './batch-requests.service';

@Injectable()
export class BatchRequestsInterceptor implements HttpInterceptor {

  constructor(
    private batchRequestsService: BatchRequestsService,
    private config: BatchRequestsConfigService
  ) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const contentType = req.headers.get(BatchRequestsService.H_CONTENT_TYPE);

    if ((contentType && contentType.startsWith(BatchRequestsService.H_CONTENT_TYPE_MIXED))
      || !this.config.shouldBatch(req)
    ) {
      return next.handle(req);
    }

    if ( !contentType || contentType.includes(BatchRequestsService.BOUNDARY) ) {
      return this.batchRequestsService.addRequest({req, next});
    }

    return next.handle(req);
  }
}
