import { NgModule } from '@angular/core';
import { RxNgZoneSchedulerModule } from 'ngx-rxjs-zone-scheduler';
import { BATCH_REQUESTS_CONFIG, defaultBatchRequestsConfig } from './batch-requests.config';
import { BatchRequestsService } from './batch-requests.service';

@NgModule({
  declarations: [],
  imports: [
    RxNgZoneSchedulerModule,
  ],
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
