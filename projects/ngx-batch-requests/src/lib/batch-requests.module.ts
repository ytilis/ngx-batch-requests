import { NgModule } from '@angular/core';
import { BatchRequestsConfigService } from './batch-requests.config.service';
import { BatchRequestsService } from './batch-requests.service';

@NgModule({
  declarations: [],
  imports: [],
  exports: [],
  providers: [
    BatchRequestsService,
    BatchRequestsConfigService
  ]
})
export class BatchRequestsModule { }
