import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxBatchRequestsComponent } from './ngx-batch-requests.component';

describe('NgxBatchRequestsComponent', () => {
  let component: NgxBatchRequestsComponent;
  let fixture: ComponentFixture<NgxBatchRequestsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxBatchRequestsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgxBatchRequestsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
