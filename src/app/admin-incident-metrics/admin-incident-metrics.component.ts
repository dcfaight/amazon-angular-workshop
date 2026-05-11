import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { IncidentItem } from '../models/incident';
import { IncidentService } from '../services/incident.service';

@Component({
  selector: 'app-admin-incident-metrics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-incident-metrics.component.html',
  styleUrl: './admin-incident-metrics.component.scss',
})
export class AdminIncidentMetricsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  incidents: IncidentItem[] = [];
  loading = true;
  errorMessage: string | null = null;

  constructor(private incidentService: IncidentService) {}

  ngOnInit(): void {
    this.loadMetrics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMetrics(): void {
    this.loading = true;
    this.errorMessage = null;

    this.incidentService
      .getIncidents()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (incidents) => {
          this.incidents = incidents;
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'Unable to load incident metrics right now.';
          this.loading = false;
        },
      });
  }

  get totalIncidents(): number {
    return this.incidents.length;
  }

  get openIncidents(): number {
    return this.incidents.filter((incident) => incident.status !== 'resolved').length;
  }

  get resolvedIncidents(): number {
    return this.incidents.filter((incident) => incident.status === 'resolved').length;
  }

  get mttrHours(): number {
    const resolvedWithDurations = this.incidents
      .filter((incident) => incident.closedAt)
      .map((incident) => this.getDurationHours(incident.createdAt, incident.closedAt as string))
      .filter((duration) => duration >= 0);

    if (!resolvedWithDurations.length) {
      return 0;
    }

    const totalDuration = resolvedWithDurations.reduce((sum, duration) => sum + duration, 0);
    return totalDuration / resolvedWithDurations.length;
  }

  get severityCounts(): Record<string, number> {
    return this.incidents.reduce<Record<string, number>>((counts, incident) => {
      counts[incident.severity] = (counts[incident.severity] ?? 0) + 1;
      return counts;
    }, {});
  }

  get ownerCoveragePercent(): number {
    if (!this.incidents.length) {
      return 0;
    }

    const owned = this.incidents.filter((incident) => !!incident.owner).length;
    return (owned / this.incidents.length) * 100;
  }

  get oldestOpenIncidents(): IncidentItem[] {
    return this.incidents
      .filter((incident) => incident.status !== 'resolved')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, 5);
  }

  private getDurationHours(startIso: string, endIso: string): number {
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    return ms / (1000 * 60 * 60);
  }
}
