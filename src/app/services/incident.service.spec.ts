import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { IncidentService } from './incident.service';

describe('IncidentService', () => {
  let service: IncidentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [IncidentService],
    });

    service = TestBed.inject(IncidentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('should map GitHub issues into incident items', () => {
    let result: any[] = [];

    service.getIncidents().subscribe((incidents) => {
      result = incidents;
    });

    const req = http.expectOne((request) =>
      request.url === 'https://api.github.com/repos/dcfaight/amazon-angular-workshop/issues'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('labels')).toBe('incident');

    req.flush([
      {
        id: 1,
        number: 42,
        title: 'Checkout failing in prod',
        body: 'Mitigation in progress. PR: https://github.com/dcfaight/amazon-angular-workshop/pull/12',
        state: 'open',
        html_url: 'https://github.com/dcfaight/amazon-angular-workshop/issues/42',
        created_at: '2026-05-11T10:00:00Z',
        updated_at: '2026-05-11T10:05:00Z',
        closed_at: null,
        labels: [
          { name: 'incident' },
          { name: 'sev1' },
          { name: 'mitigating' },
          { name: 'customer-impact' },
          { name: 'needs-postmortem' },
        ],
        assignees: [{ login: 'oncall-app' }],
      },
    ]);

    expect(result.length).toBe(1);
    expect(result[0].severity).toBe('sev1');
    expect(result[0].status).toBe('mitigating');
    expect(result[0].hasCustomerImpact).toBeTrue();
    expect(result[0].references[0].type).toBe('pull-request');
    expect(result[0].owner).toBe('oncall-app');
    expect(result[0].needsPostmortem).toBeTrue();
  });

  it('should filter out pull request items returned by GitHub issues API', () => {
    let result: any[] = [];

    service.getIncidents().subscribe((incidents) => {
      result = incidents;
    });

    const req = http.expectOne((request) => request.url.includes('/issues'));
    req.flush([
      {
        id: 1,
        number: 42,
        title: 'Incident issue',
        body: '',
        state: 'open',
        html_url: 'https://github.com/dcfaight/amazon-angular-workshop/issues/42',
        created_at: '2026-05-11T10:00:00Z',
        updated_at: '2026-05-11T10:05:00Z',
        closed_at: null,
        labels: ['incident', 'sev3'],
      },
      {
        id: 2,
        number: 43,
        title: 'PR masquerading in issues endpoint',
        body: '',
        state: 'open',
        html_url: 'https://github.com/dcfaight/amazon-angular-workshop/issues/43',
        created_at: '2026-05-11T10:00:00Z',
        updated_at: '2026-05-11T10:05:00Z',
        closed_at: null,
        labels: ['incident', 'sev2'],
        pull_request: { url: 'https://api.github.com/repos/dcfaight/amazon-angular-workshop/pulls/43' },
      },
    ]);

    expect(result.length).toBe(1);
    expect(result[0].number).toBe(42);
  });

  it('should resolve status as resolved when issue is closed without resolved label', () => {
    let status = '';

    service.getIncidents().subscribe((incidents) => {
      status = incidents[0].status;
    });

    const req = http.expectOne((request) => request.url.includes('/issues'));
    req.flush([
      {
        id: 99,
        number: 99,
        title: 'Recovered incident',
        body: '',
        state: 'closed',
        html_url: 'https://github.com/dcfaight/amazon-angular-workshop/issues/99',
        created_at: '2026-05-11T10:00:00Z',
        updated_at: '2026-05-11T10:05:00Z',
        closed_at: '2026-05-11T11:00:00Z',
        labels: ['incident'],
      },
    ]);

    expect(status).toBe('resolved');
  });

  it('should propagate GitHub API errors', () => {
    let didError = false;

    service.getIncidents().subscribe({
      next: () => {
        fail('expected error');
      },
      error: () => {
        didError = true;
      },
    });

    const req = http.expectOne((request) => request.url.includes('/issues'));
    req.flush('rate limited', { status: 403, statusText: 'Forbidden' });

    expect(didError).toBeTrue();
  });
});
