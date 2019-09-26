import { TestBed } from '@angular/core/testing';

import { BatchRequestsService } from './batch-requests.service';

describe('BatchRequestsService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: BatchRequestsService = TestBed.get(BatchRequestsService);
    expect(service).toBeTruthy();
  });
});
