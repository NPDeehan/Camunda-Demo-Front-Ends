import { camundaFetch } from '../../api/camundaClient';

/** Read-only proxy route to the monitored cluster (MONITOR_CAMUNDA_* in .env) */
const MONITOR_BASE = '/api/monitor';

/** All dashboard calls go to the monitored cluster, not the cluster running the agent. */
function monitorFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return camundaFetch<T>(path, options, MONITOR_BASE);
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Count {
  total: number;
  /** True when Camunda capped totalItems — the real number is higher */
  capped: boolean;
}

export interface TopologyPartition {
  partitionId: number;
  role: string;
  health: string;
}

export interface TopologyBroker {
  nodeId: number;
  host: string;
  port: number;
  version: string;
  partitions: TopologyPartition[];
}

export interface Topology {
  brokers: TopologyBroker[];
  clusterSize: number;
  partitionsCount: number;
  replicationFactor: number;
  gatewayVersion: string;
}

export interface Incident {
  incidentKey: string;
  processDefinitionId: string;
  processInstanceKey: string;
  errorType: string;
  errorMessage: string;
  elementId: string;
  creationTime: string;
}

export interface MonitorInfo {
  region: string | null;
  clusterId: string | null;
  host?: string;
  /** False when MONITOR_CAMUNDA_* isn't set and the proxy falls back to the agent's cluster */
  dedicated: boolean;
}

interface SearchResponse<T> {
  items: T[];
  page: { totalItems: number; hasMoreTotalItems?: boolean };
}

// ── Calls ──────────────────────────────────────────────────────────────────

/** Runs a search with limit 1 and returns only the total match count. */
async function countOf(path: string, filter: Record<string, unknown>): Promise<Count> {
  const result = await monitorFetch<SearchResponse<unknown>>(path, {
    method: 'POST',
    body: JSON.stringify({ filter, page: { limit: 1 } }),
  });
  return { total: result.page.totalItems, capped: !!result.page.hasMoreTotalItems };
}

export function getMonitorInfo(): Promise<MonitorInfo> {
  return monitorFetch<MonitorInfo>('/_info');
}

export function getTopology(): Promise<Topology> {
  return monitorFetch<Topology>('/topology');
}

export async function getActiveIncidents(limit = 5): Promise<{ count: Count; recent: Incident[] }> {
  const result = await monitorFetch<SearchResponse<Incident>>('/incidents/search', {
    method: 'POST',
    body: JSON.stringify({
      filter: { state: 'ACTIVE' },
      sort: [{ field: 'creationTime', order: 'DESC' }],
      page: { limit },
    }),
  });
  return {
    count: { total: result.page.totalItems, capped: !!result.page.hasMoreTotalItems },
    recent: result.items,
  };
}

export const countActiveInstances = () =>
  countOf('/process-instances/search', { state: 'ACTIVE' });

export const countInstancesWithIncidents = () =>
  countOf('/process-instances/search', { state: 'ACTIVE', hasIncident: true });

export const countOpenUserTasks = () =>
  countOf('/user-tasks/search', { state: 'CREATED' });

export const countDeployedProcesses = () =>
  countOf('/process-definitions/search', { isLatestVersion: true });

export const countFailedJobs = () =>
  countOf('/jobs/search', { state: 'FAILED' });

export const countStartedSince = (since: string) =>
  countOf('/process-instances/search', { startDate: { $gte: since } });

export const countCompletedSince = (since: string) =>
  countOf('/process-instances/search', { state: 'COMPLETED', endDate: { $gte: since } });
