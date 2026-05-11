export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4' | 'unknown';
export type IncidentWorkflowStatus = 'open' | 'acknowledged' | 'mitigating' | 'resolved';

export interface IncidentReference {
  type: 'pull-request' | 'commit' | 'dashboard' | 'runbook' | 'other';
  url: string;
}

export interface IncidentItem {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  status: IncidentWorkflowStatus;
  severity: IncidentSeverity;
  labels: string[];
  hasCustomerImpact: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  issueUrl: string;
  references: IncidentReference[];
  assignees: string[];
  owner: string | null;
  needsPostmortem: boolean;
}
