import { NgModule } from '@angular/core';
import { BATCH_REQUESTS_CONFIG, defaultBatchRequestsConfig } from './batch-requests.config';
import { BatchRequestsService } from './batch-requests.service';

@NgModule({
  declarations: [],
  imports: [],
  exports: [],
  providers: [
    BatchRequestsService,
    {
      provide: BATCH_REQUESTS_CONFIG,
      useValue: defaultBatchRequestsConfig,
    },
  ]
})
export class BatchRequestsModule { }
