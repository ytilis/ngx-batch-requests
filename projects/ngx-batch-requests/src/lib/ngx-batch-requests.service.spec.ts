import { TestBed } from '@angular/core/testing';

import { NgxBatchRequestsService } from './ngx-batch-requests.service';

describe('NgxBatchRequestsService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: NgxBatchRequestsService = TestBed.get(NgxBatchRequestsService);
    expect(service).toBeTruthy();
  });
});
