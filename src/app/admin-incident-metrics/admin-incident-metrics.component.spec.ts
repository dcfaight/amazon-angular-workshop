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
});
