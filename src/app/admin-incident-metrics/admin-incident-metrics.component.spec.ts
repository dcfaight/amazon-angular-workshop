import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminIncidentMetricsComponent } from './admin-incident-metrics.component';
import { IncidentService } from '../services/incident.service';

describe('AdminIncidentMetricsComponent', () => {
  let component: AdminIncidentMetricsComponent;
  let fixture: ComponentFixture<AdminIncidentMetricsComponent>;
  let incidentService: jasmine.SpyObj<IncidentService>;

  beforeEach(async () => {
    incidentService = jasmine.createSpyObj<IncidentService>('IncidentService', ['getIncidents']);
    incidentService.getIncidents.and.returnValue(
      of([
        {
          id: 1,
          number: 1,
          title: 'Open checkout outage',
          body: '',
          state: 'open',
          status: 'mitigating',
          severity: 'sev1',
          labels: ['incident', 'sev1'],
          hasCustomerImpact: true,
          createdAt: '2026-05-11T10:00:00Z',
          updatedAt: '2026-05-11T10:30:00Z',
          closedAt: null,
          issueUrl: 'https://github.com/dcfaight/amazon-angular-workshop/issues/1',
          references: [],
          assignees: ['oncall-app'],
          owner: 'oncall-app',
          needsPostmortem: true,
        },
        {
          id: 2,
          number: 2,
          title: 'Resolved image issue',
          body: '',
          state: 'closed',
          status: 'resolved',
          severity: 'sev3',
          labels: ['incident', 'sev3'],
          hasCustomerImpact: false,
          createdAt: '2026-05-11T08:00:00Z',
          updatedAt: '2026-05-11T09:00:00Z',
          closedAt: '2026-05-11T09:00:00Z',
          issueUrl: 'https://github.com/dcfaight/amazon-angular-workshop/issues/2',
          references: [],
          assignees: [],
          owner: null,
          needsPostmortem: false,
        },
      ])
    );

    await TestBed.configureTestingModule({
      imports: [AdminIncidentMetricsComponent],
      providers: [provideRouter([]), { provide: IncidentService, useValue: incidentService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminIncidentMetricsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load metrics', () => {
    expect(component).toBeTruthy();
    expect(component.totalIncidents).toBe(2);
    expect(component.openIncidents).toBe(1);
    expect(component.resolvedIncidents).toBe(1);
  });

  it('should compute mttr from resolved incidents', () => {
    expect(component.mttrHours).toBeCloseTo(1, 2);
  });

  it('should handle load errors', () => {
    incidentService.getIncidents.and.returnValue(throwError(() => new Error('failed')));
    component.loadMetrics();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBe('Unable to load incident metrics right now.');
  });

  it('should return zero metrics when no incidents exist', () => {
    incidentService.getIncidents.and.returnValue(of([]));
    component.loadMetrics();

    expect(component.totalIncidents).toBe(0);
    expect(component.ownerCoveragePercent).toBe(0);
    expect(component.mttrHours).toBe(0);
    expect(component.oldestOpenIncidents.length).toBe(0);
  });

  it('should return zero mttr when no incidents are resolved', () => {
    incidentService.getIncidents.and.returnValue(
      of([
        {
          id: 9,
          number: 9,
          title: 'Open sev2 incident',
          body: '',
          state: 'open',
          status: 'open',
          severity: 'sev2',
          labels: ['incident', 'sev2'],
          hasCustomerImpact: true,
          createdAt: '2026-05-11T10:00:00Z',
          updatedAt: '2026-05-11T10:05:00Z',
          closedAt: null,
          issueUrl: 'https://github.com/dcfaight/amazon-angular-workshop/issues/9',
          references: [],
          assignees: [],
          owner: null,
          needsPostmortem: true,
        },
      ])
    );

    component.loadMetrics();

    expect(component.mttrHours).toBe(0);
    expect(component.openIncidents).toBe(1);
  });
});
