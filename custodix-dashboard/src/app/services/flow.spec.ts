import { TestBed } from '@angular/core/testing';

import { Flow } from './flow';

describe('Flow', () => {
  let service: Flow;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Flow);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
