import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BATCH_REQUESTS_CONFIG, defaultBatchRequestsConfig } from './batch-requests.config';
import { BatchRequestsInterceptor } from './batch-requests.interceptor';
import { BatchRequestsService } from './batch-requests.service';

@NgModule({
  declarations: [],
  imports: [],
  exports: [],
  providers: [
    BatchRequestsService,
    { provide: HTTP_INTERCEPTORS, useClass: BatchRequestsInterceptor, multi: true },
    {
      provide: BATCH_REQUESTS_CONFIG,
      useValue: defaultBatchRequestsConfig,
    },
  ]
})
export class BatchRequestsModule { }
