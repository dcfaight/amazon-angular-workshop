import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { IncidentService } from '../services/incident.service';

@Component({
  selector: 'app-incident-timeline',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './incident-timeline.component.html',
  styleUrl: './incident-timeline.component.scss',
})
export class IncidentTimelineComponent implements OnInit {
  @Input() issueNumber!: number;
  events: any[] = [];
  comments: any[] = [];
  loading = true;
  error: string | null = null;

  constructor(private incidentService: IncidentService) {}

  ngOnInit(): void {
    this.loading = true;
    this.error = null;
    Promise.all([
      this.incidentService.getIncidentEvents(this.issueNumber).toPromise(),
      this.incidentService.getIncidentComments(this.issueNumber).toPromise(),
    ])
      .then(([events, comments]) => {
        this.events = events ?? [];
        this.comments = comments ?? [];
        this.loading = false;
      })
      .catch(() => {
        this.error = 'Failed to load timeline.';
        this.loading = false;
      });
  }
}
