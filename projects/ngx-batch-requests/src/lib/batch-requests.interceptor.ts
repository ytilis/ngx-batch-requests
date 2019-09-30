import {
  HttpInterceptor,
  HttpEvent,
  HttpRequest,
  HttpHandler
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { CONTENT_TYPE, CONTENT_TYPE_MIXED } from './batch-constants';
import { BatchRequestsConfigService } from './batch-requests.config.service';
import { BatchRequestsService } from './batch-requests.service';

@Injectable()
export class BatchRequestsInterceptor implements HttpInterceptor {
  constructor(
    private batchService: BatchRequestsService,
    private config: BatchRequestsConfigService
  ) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const contentType = req.headers.get(CONTENT_TYPE);

    if (contentType && contentType.startsWith(CONTENT_TYPE_MIXED) || !this.config.shouldBatch(req)) {
      return next.handle(req);
    }

    return this.batchService.addRequest({req, next});
  }
}
