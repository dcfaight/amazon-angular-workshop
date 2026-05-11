import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  IncidentItem,
  IncidentReference,
  IncidentSeverity,
  IncidentWorkflowStatus,
} from '../models/incident';

interface GithubIssueLabel {
  name?: string;
}

interface GithubIssueRecord {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: Array<string | GithubIssueLabel>;
  pull_request?: unknown;
}

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly owner = environment.github.incidentRepoOwner;
  private readonly repo = environment.github.incidentRepoName;
  private readonly issuesUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/issues`;

  constructor(private http: HttpClient) {}

  getIncidents(): Observable<IncidentItem[]> {
    return this.http
      .get<GithubIssueRecord[]>(this.issuesUrl, {
        params: {
          state: 'all',
          labels: 'incident',
          sort: 'created',
          direction: 'desc',
          per_page: '100',
        },
      })
      .pipe(
        map((records) =>
          records
            .filter((record) => !record.pull_request)
            .map((record) => this.mapIncident(record))
        )
      );
  }

  private mapIncident(record: GithubIssueRecord): IncidentItem {
    const labels = this.extractLabels(record.labels);
    const body = record.body ?? '';

    return {
      id: record.id,
      number: record.number,
      title: record.title,
      body,
      state: record.state,
      status: this.resolveStatus(labels, record.state),
      severity: this.resolveSeverity(labels),
      labels,
      hasCustomerImpact: labels.includes('customer-impact'),
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      closedAt: record.closed_at,
      issueUrl: record.html_url,
      references: this.extractReferences(body),
    };
  }

  private extractLabels(input: Array<string | GithubIssueLabel>): string[] {
    return input
      .map((label) => (typeof label === 'string' ? label : label.name ?? ''))
      .filter(Boolean)
      .map((label) => label.toLowerCase());
  }

  private resolveSeverity(labels: string[]): IncidentSeverity {
    if (labels.includes('sev1')) {
      return 'sev1';
    }

    if (labels.includes('sev2')) {
      return 'sev2';
    }

    if (labels.includes('sev3')) {
      return 'sev3';
    }

    if (labels.includes('sev4')) {
      return 'sev4';
    }

    return 'unknown';
  }

  private resolveStatus(
    labels: string[],
    state: 'open' | 'closed'
  ): IncidentWorkflowStatus {
    if (labels.includes('mitigating')) {
      return 'mitigating';
    }

    if (labels.includes('acknowledged')) {
      return 'acknowledged';
    }

    if (labels.includes('resolved') || state === 'closed') {
      return 'resolved';
    }

    return 'open';
  }

  private extractReferences(body: string): IncidentReference[] {
    const matches = body.match(/https?:\/\/[^\s)]+/g) ?? [];
    return matches.map((url) => ({
      type: this.resolveReferenceType(url),
      url,
    }));
  }

  private resolveReferenceType(url: string): IncidentReference['type'] {
    if (/\/pull\/\d+$/i.test(url)) {
      return 'pull-request';
    }

    if (/\/commit\/[0-9a-f]{7,}$/i.test(url)) {
      return 'commit';
    }

    if (/dashboard|grafana|datadog|cloudwatch/i.test(url)) {
      return 'dashboard';
    }

    if (/runbook|wiki|confluence/i.test(url)) {
      return 'runbook';
    }

    return 'other';
  }
}
