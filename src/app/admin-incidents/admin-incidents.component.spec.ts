import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminIncidentsComponent } from './admin-incidents.component';
import { IncidentService } from '../services/incident.service';
import { ToastService } from '../services/toast.service';
import { IncidentItem } from '../models/incident';

describe('AdminIncidentsComponent', () => {
  let component: AdminIncidentsComponent;
  let fixture: ComponentFixture<AdminIncidentsComponent>;
  let incidentService: jasmine.SpyObj<IncidentService>;
  let toastService: jasmine.SpyObj<ToastService>;

  const mockIncidents: IncidentItem[] = [
    {
      id: 1,
      number: 101,
      title: 'Checkout outage',
      body: 'Investigating elevated 500 rates.',
      state: 'open',
      status: 'mitigating',
      severity: 'sev1',
      labels: ['incident', 'sev1', 'mitigating', 'customer-impact'],
      hasCustomerImpact: true,
      createdAt: '2026-05-11T11:00:00Z',
      updatedAt: '2026-05-11T11:05:00Z',
      closedAt: null,
      issueUrl: 'https://github.com/dcfaight/amazon-angular-workshop/issues/101',
      references: [
        {
          type: 'pull-request',
          url: 'https://github.com/dcfaight/amazon-angular-workshop/pull/201',
        },
      ],
      assignees: ['oncall-app'],
      owner: 'oncall-app',
      needsPostmortem: true,
    },
    {
      id: 2,
      number: 102,
      title: 'Search latency recovered',
      body: 'Issue resolved after cache warm-up.',
      state: 'closed',
      status: 'resolved',
      severity: 'sev3',
      labels: ['incident', 'sev3', 'resolved'],
      hasCustomerImpact: false,
      createdAt: '2026-05-11T09:00:00Z',
      updatedAt: '2026-05-11T10:00:00Z',
      closedAt: '2026-05-11T10:00:00Z',
      issueUrl: 'https://github.com/dcfaight/amazon-angular-workshop/issues/102',
      references: [
        {
          type: 'commit',
          url: 'https://github.com/dcfaight/amazon-angular-workshop/commit/abc1234',
        },
      ],
      assignees: [],
      owner: null,
      needsPostmortem: false,
    },
  ];

  beforeEach(async () => {
    localStorage.clear();

    incidentService = jasmine.createSpyObj<IncidentService>('IncidentService', ['getIncidents']);
    toastService = jasmine.createSpyObj<ToastService>('ToastService', ['show']);

    incidentService.getIncidents.and.returnValue(of(mockIncidents));

    await TestBed.configureTestingModule({
      imports: [AdminIncidentsComponent],
      providers: [
        provideRouter([]),
        { provide: IncidentService, useValue: incidentService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminIncidentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load incidents on init', () => {
    expect(incidentService.getIncidents).toHaveBeenCalled();
    expect(component.incidents.length).toBe(2);
    expect(component.loading).toBeFalse();
    expect(component.lastRefreshedAt).not.toBeNull();
  });

  it('should compute summary metrics', () => {
    expect(component.openIncidents).toBe(1);
    expect(component.criticalIncidents).toBe(1);
    expect(component.customerImpactIncidents).toBe(1);
    expect(component.resolvedIncidents).toBe(1);
  });

  it('should default to all incidents before selecting a filter', () => {
    expect(component.activeFilter).toBe('all');
    expect(component.filteredIncidents.length).toBe(2);
  });

  it('should filter to open incidents only', () => {
    component.setFilter('open');

    expect(component.isFilterActive('open')).toBeTrue();
    expect(component.filteredIncidents.length).toBe(1);
    expect(component.filteredIncidents[0].status).not.toBe('resolved');
  });

  it('should filter to customer-impact incidents only', () => {
    component.setFilter('customer-impact');

    expect(component.filteredIncidents.length).toBe(1);
    expect(component.filteredIncidents[0].hasCustomerImpact).toBeTrue();
  });

  it('should return css classes for severity and status badges', () => {
    expect(component.getSeverityClass(mockIncidents[0])).toBe('severity-pill sev1');
    expect(component.getStatusClass(mockIncidents[0])).toBe('status-pill mitigating');
  });

  it('should return typed references for PR and commit links', () => {
    const prLink = component.getReferenceByType(mockIncidents[0], 'pull-request');
    const commitLink = component.getReferenceByType(mockIncidents[1], 'commit');

    expect(prLink).toContain('/pull/201');
    expect(commitLink).toContain('/commit/abc1234');
  });

  it('should return null when requested reference type is not present', () => {
    const commitLink = component.getReferenceByType(mockIncidents[0], 'commit');
    expect(commitLink).toBeNull();
  });

  it('should surface an error and toast when queue load fails', () => {
    incidentService.getIncidents.and.returnValue(throwError(() => new Error('rate limited')));

    component.loadIncidents();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBe('Unable to load incidents from GitHub right now.');
    expect(toastService.show).toHaveBeenCalledWith('Failed to load incident queue.');
  });

  it('should track incidents by id', () => {
    expect(component.trackByIncidentId(0, mockIncidents[0])).toBe(1);
  });

  it('should toggle timeline expansion by incident id', () => {
    expect(component.expandedIncident).toBeNull();

    component.toggleTimeline(1);
    expect(component.expandedIncident).toBe(1);

    component.toggleTimeline(1);
    expect(component.expandedIncident).toBeNull();
  });

  it('should persist and restore owner assignments', async () => {
    component.assignOwner(1, 'platform-lead');
    expect(component.getOwner(mockIncidents[0])).toBe('platform-lead');

    const anotherFixture = TestBed.createComponent(AdminIncidentsComponent);
    const anotherComponent = anotherFixture.componentInstance;
    anotherFixture.detectChanges();
    await anotherFixture.whenStable();

    expect(anotherComponent.getOwner(mockIncidents[0])).toBe('platform-lead');
  });

  it('should persist and restore postmortem workflow state', async () => {
    component.startPostmortem(mockIncidents[0]);
    expect(component.getPostmortemState(mockIncidents[0])).toBe('in-progress');

    const anotherFixture = TestBed.createComponent(AdminIncidentsComponent);
    const anotherComponent = anotherFixture.componentInstance;
    anotherFixture.detectChanges();
    await anotherFixture.whenStable();

    expect(anotherComponent.getPostmortemState(mockIncidents[0])).toBe('in-progress');
  });

  it('should send and persist a notification entry', async () => {
    component.sendIncidentNotification(mockIncidents[0], 'slack');

    expect(component.notificationHistory.length).toBe(1);
    expect(component.notificationHistory[0].channel).toBe('slack');
    expect(component.notificationHistory[0].incidentNumber).toBe(101);
    expect(toastService.show).toHaveBeenCalledWith('SLACK notification queued for #101.');

    const anotherFixture = TestBed.createComponent(AdminIncidentsComponent);
    const anotherComponent = anotherFixture.componentInstance;
    anotherFixture.detectChanges();
    await anotherFixture.whenStable();

    expect(anotherComponent.notificationHistory.length).toBe(1);
    expect(anotherComponent.notificationHistory[0].channel).toBe('slack');
  });

  it('should clear notification history', () => {
    component.sendIncidentNotification(mockIncidents[0], 'teams');
    expect(component.notificationHistory.length).toBe(1);

    component.clearNotificationHistory();

    expect(component.notificationHistory.length).toBe(0);
    expect(toastService.show).toHaveBeenCalledWith('Notification history cleared.');
  });
});
