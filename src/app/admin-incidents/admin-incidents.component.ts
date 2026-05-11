import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { IncidentItem } from '../models/incident';
import { IncidentService } from '../services/incident.service';
import { ToastService } from '../services/toast.service';

type IncidentQueueFilter = 'all' | 'open' | 'critical' | 'customer-impact';

@Component({
  selector: 'app-admin-incidents',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
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

  constructor(
    private incidentService: IncidentService,
    private toastService: ToastService
  ) {}

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
