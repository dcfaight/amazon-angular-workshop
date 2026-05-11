import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { IncidentTimelineComponent } from './incident-timeline.component';
import { IncidentService } from '../services/incident.service';
import { By } from '@angular/platform-browser';

const mockEvents = [
  {
    id: 1,
    event: 'labeled',
    actor: { login: 'alice', avatar_url: '', html_url: 'https://github.com/alice' },
    created_at: '2026-05-11T10:00:00Z',
    label: { name: 'sev1' },
  },
  {
    id: 2,
    event: 'closed',
    actor: { login: 'bob', avatar_url: '', html_url: 'https://github.com/bob' },
    created_at: '2026-05-11T11:00:00Z',
  },
];

const mockComments = [
  {
    id: 10,
    user: { login: 'carol', avatar_url: '', html_url: 'https://github.com/carol' },
    body: 'Investigating now.',
    created_at: '2026-05-11T10:05:00Z',
    updated_at: '2026-05-11T10:05:00Z',
    html_url: 'https://github.com/comment/10',
  },
];

describe('IncidentTimelineComponent', () => {
  let component: IncidentTimelineComponent;
  let fixture: ComponentFixture<IncidentTimelineComponent>;
  let incidentService: jasmine.SpyObj<IncidentService>;

  beforeEach(async () => {
    incidentService = jasmine.createSpyObj<IncidentService>('IncidentService', [
      'getIncidentEvents',
      'getIncidentComments',
    ]);
    incidentService.getIncidentEvents.and.returnValue(of(mockEvents));
    incidentService.getIncidentComments.and.returnValue(of(mockComments));

    await TestBed.configureTestingModule({
      imports: [IncidentTimelineComponent],
      providers: [
        { provide: IncidentService, useValue: incidentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentTimelineComponent);
    component = fixture.componentInstance;
    component.issueNumber = 123;
  });

  it('should create and load events/comments', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component.loading).toBeFalse();
    expect(component.events.length).toBe(2);
    expect(component.comments.length).toBe(1);
    const timeline = fixture.debugElement.query(By.css('.timeline-list'));
    expect(timeline).toBeTruthy();
  });

  it('should show loading state', () => {
    component.loading = true;
    fixture.detectChanges();
    const loading = fixture.debugElement.query(By.css('.timeline-loading'));
    expect(loading).toBeTruthy();
  });

  it('should show error state', async () => {
    incidentService.getIncidentEvents.and.returnValue(throwError(() => new Error('fail')));
    incidentService.getIncidentComments.and.returnValue(of([]));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.error).toBeTruthy();
    const error = fixture.debugElement.query(By.css('.timeline-error'));
    expect(error).toBeTruthy();
  });

  it('should show empty state if no events/comments', async () => {
    incidentService.getIncidentEvents.and.returnValue(of([]));
    incidentService.getIncidentComments.and.returnValue(of([]));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const empty = fixture.debugElement.query(By.css('.timeline-empty'));
    expect(empty).toBeTruthy();
  });
});
