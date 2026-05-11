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

  it('should map additional severity, status, and reference type branches', () => {
    let result: any[] = [];

    service.getIncidents().subscribe((incidents) => {
      result = incidents;
    });

    const req = http.expectOne((request) => request.url.includes('/issues'));
    req.flush([
      {
        id: 10,
        number: 10,
        title: 'Acknowledged incident',
        body: 'Runbook: https://example.com/runbook/checkout',
        state: 'open',
        html_url: 'https://github.com/dcfaight/amazon-angular-workshop/issues/10',
        created_at: '2026-05-11T10:00:00Z',
        updated_at: '2026-05-11T10:05:00Z',
        closed_at: null,
        labels: [{ name: 'incident' }, { name: 'acknowledged' }, { name: 'sev2' }],
      },
      {
        id: 11,
        number: 11,
        title: 'Open unknown severity',
        body: 'Dashboard: https://grafana.example.com/incident/11',
        state: 'open',
        html_url: 'https://github.com/dcfaight/amazon-angular-workshop/issues/11',
        created_at: '2026-05-11T10:00:00Z',
        updated_at: '2026-05-11T10:05:00Z',
        closed_at: null,
        labels: [{ name: 'incident' }],
        assignees: [{ login: 'platform-lead' }],
      },
      {
        id: 12,
        number: 12,
        title: 'Resolved with sev4',
        body: 'Commit: https://github.com/dcfaight/amazon-angular-workshop/commit/abcdef12 and link https://example.com/other',
        state: 'closed',
        html_url: 'https://github.com/dcfaight/amazon-angular-workshop/issues/12',
        created_at: '2026-05-11T10:00:00Z',
        updated_at: '2026-05-11T10:05:00Z',
        closed_at: '2026-05-11T11:00:00Z',
        labels: [{ name: 'incident' }, { name: 'sev4' }, { name: 'resolved' }],
      },
    ]);

    expect(result.length).toBe(3);
    expect(result[0].severity).toBe('sev2');
    expect(result[0].status).toBe('acknowledged');
    expect(result[0].references[0].type).toBe('runbook');

    expect(result[1].severity).toBe('unknown');
    expect(result[1].status).toBe('open');
    expect(result[1].references[0].type).toBe('dashboard');
    expect(result[1].owner).toBe('platform-lead');

    expect(result[2].severity).toBe('sev4');
    expect(result[2].status).toBe('resolved');
    expect(result[2].references[0].type).toBe('commit');
    expect(result[2].references[1].type).toBe('other');
  });

  it('should fetch incident events and comments for a specific issue', () => {
    let events: any[] = [];
    let comments: any[] = [];

    service.getIncidentEvents(101).subscribe((value) => {
      events = value;
    });

    service.getIncidentComments(101).subscribe((value) => {
      comments = value;
    });

    const eventsReq = http.expectOne('https://api.github.com/repos/dcfaight/amazon-angular-workshop/issues/101/events');
    const commentsReq = http.expectOne('https://api.github.com/repos/dcfaight/amazon-angular-workshop/issues/101/comments');

    eventsReq.flush([{ id: 1, event: 'labeled', created_at: '2026-05-11T10:00:00Z' }]);
    commentsReq.flush([{ id: 1, body: 'Working on it', created_at: '2026-05-11T10:01:00Z' }]);

    expect(events.length).toBe(1);
    expect(comments.length).toBe(1);
  });

  it('should patch assignees for an incident with auth headers', () => {
    service.updateIncidentAssignees(42, ['oncall-app'], 'ghp_token').subscribe();

    const req = http.expectOne('https://api.github.com/repos/dcfaight/amazon-angular-workshop/issues/42');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ assignees: ['oncall-app'] });
    expect(req.request.headers.get('Authorization')).toBe('Bearer ghp_token');

    req.flush({});
  });

  it('should add and remove labels with auth headers', () => {
    service.addIncidentLabel(42, 'needs-postmortem', 'ghp_token').subscribe();
    service.removeIncidentLabel(42, 'needs-postmortem', 'ghp_token').subscribe();

    const addReq = http.expectOne('https://api.github.com/repos/dcfaight/amazon-angular-workshop/issues/42/labels');
    expect(addReq.request.method).toBe('POST');
    expect(addReq.request.body).toEqual({ labels: ['needs-postmortem'] });
    expect(addReq.request.headers.get('Authorization')).toBe('Bearer ghp_token');
    addReq.flush({});

    const removeReq = http.expectOne('https://api.github.com/repos/dcfaight/amazon-angular-workshop/issues/42/labels/needs-postmortem');
    expect(removeReq.request.method).toBe('DELETE');
    expect(removeReq.request.headers.get('Authorization')).toBe('Bearer ghp_token');
    removeReq.flush({});
  });
});
