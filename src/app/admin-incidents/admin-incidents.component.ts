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
type NotificationChannel = 'slack' | 'teams';

interface IncidentNotificationEntry {
  id: number;
  incidentNumber: number;
  channel: NotificationChannel;
  message: string;
  sentAt: string;
}

@Component({
  selector: 'app-admin-incidents',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, IncidentTimelineComponent],
  templateUrl: './admin-incidents.component.html',
  styleUrl: './admin-incidents.component.scss',
})
export class AdminIncidentsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly ownerStorageKey = 'incident-owner-overrides';
  private readonly postmortemStorageKey = 'incident-postmortem-states';
  private readonly notificationStorageKey = 'incident-notification-history';

  incidents: IncidentItem[] = [];
  loading = true;
  errorMessage: string | null = null;
  lastRefreshedAt: Date | null = null;
  activeFilter: IncidentQueueFilter = 'all';
  expandedIncident: number | null = null;
  notificationHistory: IncidentNotificationEntry[] = [];
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
    if (owner === 'unassigned') {
      this.localOwners.delete(incidentId);
    } else {
      this.localOwners.set(incidentId, owner);
    }

    this.persistOwnerState();
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
    this.persistPostmortemState();
    this.toastService.show(`Postmortem started for #${incident.number}.`);
  }

  completePostmortem(incident: IncidentItem): void {
    this.localPostmortemStates.set(incident.id, 'completed');
    this.persistPostmortemState();
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

  sendIncidentNotification(incident: IncidentItem, channel: NotificationChannel): void {
    const owner = this.getOwner(incident);
    const message =
      `[${incident.severity.toUpperCase()}] #${incident.number} ${incident.title} | ` +
      `status: ${incident.status} | owner: ${owner}`;

    const entry: IncidentNotificationEntry = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      incidentNumber: incident.number,
      channel,
      message,
      sentAt: new Date().toISOString(),
    };

    this.notificationHistory = [entry, ...this.notificationHistory].slice(0, 20);
    this.persistNotificationHistory();
    this.toastService.show(`${channel.toUpperCase()} notification queued for #${incident.number}.`);
  }

  clearNotificationHistory(): void {
    this.notificationHistory = [];
    this.persistNotificationHistory();
    this.toastService.show('Notification history cleared.');
  }

  ngOnInit(): void {
    this.loadPersistedWorkflowState();
    this.loadPersistedNotifications();
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

  private loadPersistedWorkflowState(): void {
    this.localOwners.clear();
    this.localPostmortemStates.clear();

    this.loadPersistedOwners();
    this.loadPersistedPostmortemStates();
  }

  private loadPersistedOwners(): void {
    try {
      const raw = localStorage.getItem(this.ownerStorageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, string>;
      Object.entries(parsed).forEach(([incidentId, owner]) => {
        const numericId = Number(incidentId);
        if (!Number.isNaN(numericId) && owner) {
          this.localOwners.set(numericId, owner);
        }
      });
    } catch {
      this.localOwners.clear();
    }
  }

  private loadPersistedPostmortemStates(): void {
    try {
      const raw = localStorage.getItem(this.postmortemStorageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, PostmortemWorkflowState>;
      Object.entries(parsed).forEach(([incidentId, state]) => {
        const numericId = Number(incidentId);
        if (!Number.isNaN(numericId) && state) {
          this.localPostmortemStates.set(numericId, state);
        }
      });
    } catch {
      this.localPostmortemStates.clear();
    }
  }

  private persistOwnerState(): void {
    const entries = Object.fromEntries(this.localOwners.entries());
    localStorage.setItem(this.ownerStorageKey, JSON.stringify(entries));
  }

  private persistPostmortemState(): void {
    const entries = Object.fromEntries(this.localPostmortemStates.entries());
    localStorage.setItem(this.postmortemStorageKey, JSON.stringify(entries));
  }

  private loadPersistedNotifications(): void {
    try {
      const raw = localStorage.getItem(this.notificationStorageKey);
      if (!raw) {
        this.notificationHistory = [];
        return;
      }

      const parsed = JSON.parse(raw) as IncidentNotificationEntry[];
      this.notificationHistory = Array.isArray(parsed) ? parsed.slice(0, 20) : [];
    } catch {
      this.notificationHistory = [];
    }
  }

  private persistNotificationHistory(): void {
    localStorage.setItem(this.notificationStorageKey, JSON.stringify(this.notificationHistory));
  }
}
