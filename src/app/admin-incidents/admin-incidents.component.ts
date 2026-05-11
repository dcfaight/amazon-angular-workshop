import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { IncidentItem } from '../models/incident';
import { IncidentService } from '../services/incident.service';
import { ToastService } from '../services/toast.service';
import { IncidentTimelineComponent } from './incident-timeline.component';

type IncidentQueueFilter = 'all' | 'open' | 'critical' | 'customer-impact';
type PostmortemWorkflowState = 'not-started' | 'in-progress' | 'completed';

@Component({
  selector: 'app-admin-incidents',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, IncidentTimelineComponent],
  templateUrl: './admin-incidents.component.html',
  styleUrl: './admin-incidents.component.scss',
})
export class AdminIncidentsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  incidents: IncidentItem[] = [];
  loading = true;
  errorMessage: string | null = null;
  lastRefreshedAt: Date | null = null;
  activeFilter: IncidentQueueFilter = 'all';
  expandedIncident: number | null = null;
  readonly availableOwners = ['oncall-app', 'platform-lead', 'payments-sme', 'checkout-owner'];
  private readonly localOwners = new Map<number, string>();
  private readonly localPostmortemStates = new Map<number, PostmortemWorkflowState>();

  constructor(
    private incidentService: IncidentService,
    private toastService: ToastService
  ) {}

  toggleTimeline(incidentId: number): void {
    this.expandedIncident = this.expandedIncident === incidentId ? null : incidentId;
  }

  assignOwner(incidentId: number, owner: string): void {
    this.localOwners.set(incidentId, owner);
    this.toastService.show(`Owner assigned: ${owner}`);
  }

  getOwner(incident: IncidentItem): string {
    return this.localOwners.get(incident.id) ?? incident.owner ?? 'unassigned';
  }

  getPostmortemState(incident: IncidentItem): PostmortemWorkflowState {
    if (!incident.needsPostmortem) {
      return 'completed';
    }

    return this.localPostmortemStates.get(incident.id) ?? 'not-started';
  }

  startPostmortem(incident: IncidentItem): void {
    this.localPostmortemStates.set(incident.id, 'in-progress');
    this.toastService.show(`Postmortem started for #${incident.number}.`);
  }

  completePostmortem(incident: IncidentItem): void {
    this.localPostmortemStates.set(incident.id, 'completed');
    this.toastService.show(`Postmortem completed for #${incident.number}.`);
  }

  getPostmortemIssueUrl(incident: IncidentItem): string {
    const title = encodeURIComponent(`[Postmortem] Incident #${incident.number}: ${incident.title}`);
    const body = encodeURIComponent(
      `## Incident\n${incident.issueUrl}\n\n## Summary\n\n## Root Cause\n\n## Action Items\n- [ ]\n`
    );

    return `https://github.com/dcfaight/amazon-angular-workshop/issues/new?title=${title}&body=${body}`;
  }

  getOwnershipClass(incident: IncidentItem): string {
    return this.getOwner(incident) === 'unassigned' ? 'owner-pill unassigned' : 'owner-pill assigned';
  }

  getPostmortemClass(incident: IncidentItem): string {
    return `postmortem-pill ${this.getPostmortemState(incident)}`;
  }

  ngOnInit(): void {
    this.loadIncidents();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadIncidents(): void {
    this.loading = true;
    this.errorMessage = null;

    this.incidentService
      .getIncidents()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (incidents) => {
          this.incidents = incidents;
          this.lastRefreshedAt = new Date();
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'Unable to load incidents from GitHub right now.';
          this.loading = false;
          this.toastService.show('Failed to load incident queue.');
        },
      });
  }

  get openIncidents(): number {
    return this.incidents.filter((incident) => incident.status !== 'resolved').length;
  }

  get criticalIncidents(): number {
    return this.incidents.filter(
      (incident) =>
        (incident.severity === 'sev1' || incident.severity === 'sev2') &&
        incident.status !== 'resolved'
    ).length;
  }

  get customerImpactIncidents(): number {
    return this.incidents.filter(
      (incident) => incident.hasCustomerImpact && incident.status !== 'resolved'
    ).length;
  }

  get resolvedIncidents(): number {
    return this.incidents.filter((incident) => incident.status === 'resolved').length;
  }

  get filteredIncidents(): IncidentItem[] {
    switch (this.activeFilter) {
      case 'open':
        return this.incidents.filter((incident) => incident.status !== 'resolved');
      case 'critical':
        return this.incidents.filter(
          (incident) =>
            (incident.severity === 'sev1' || incident.severity === 'sev2') &&
            incident.status !== 'resolved'
        );
      case 'customer-impact':
        return this.incidents.filter(
          (incident) => incident.hasCustomerImpact && incident.status !== 'resolved'
        );
      default:
        return this.incidents;
    }
  }

  setFilter(filter: IncidentQueueFilter): void {
    this.activeFilter = filter;
  }

  isFilterActive(filter: IncidentQueueFilter): boolean {
    return this.activeFilter === filter;
  }

  getStatusClass(incident: IncidentItem): string {
    return `status-pill ${incident.status}`;
  }

  getSeverityClass(incident: IncidentItem): string {
    return `severity-pill ${incident.severity}`;
  }

  getReferenceByType(incident: IncidentItem, type: 'pull-request' | 'commit'): string | null {
    return incident.references.find((reference) => reference.type === type)?.url ?? null;
  }

  trackByIncidentId(_index: number, incident: IncidentItem): number {
    return incident.id;
  }
}
