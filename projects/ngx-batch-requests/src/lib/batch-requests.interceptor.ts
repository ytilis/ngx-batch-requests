import {
  HttpInterceptor,
  HttpEvent,
  HttpRequest,
  HttpHandler
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { Inject, Injectable } from '@angular/core';
import defaultsDeep from 'lodash.defaultsdeep';

import { CONTENT_TYPE, CONTENT_TYPE_MIXED } from './utils';
import { BATCH_REQUESTS_CONFIG, defaultBatchRequestsConfig } from './batch-requests.config';
import { BatchRequestsService } from './batch-requests.service';

@Injectable()
export class BatchRequestsInterceptor implements HttpInterceptor {
  constructor(
    private batchService: BatchRequestsService,
    @Inject( BATCH_REQUESTS_CONFIG ) public config,
  ) {
    this.config = defaultsDeep(config, defaultBatchRequestsConfig);
  }

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
