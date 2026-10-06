import type { ClusterMetrics } from './useClusterMetrics';
import type { Count, Topology } from './clusterMetricsApi';

export type Tone = 'neutral' | 'good' | 'warn' | 'bad';

export const Q_INCIDENTS = 'What are the current incidents and what caused them?';
export const Q_INCIDENT_INSTANCES = 'Which process instances are stuck with incidents?';
export const Q_FAILED_JOBS = 'Which jobs have failed recently and why?';
export const Q_TOPOLOGY = 'Check the cluster topology — are any partitions unhealthy, and why?';

const DEFAULT_SUGGESTIONS = [
  'Give me a health summary of the cluster',
  'Which processes have the most active instances?',
  'What processes are deployed on this cluster?',
  Q_INCIDENTS,
];

export function formatCount(c: Count): string {
  return `${c.total.toLocaleString()}${c.capped ? '+' : ''}`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export interface PartitionSummary {
  partitionId: number;
  health: 'healthy' | 'unhealthy' | 'dead' | 'no-leader';
}

/** Collapses the per-broker view into one health status per partition (taken from its leader). */
export function summarisePartitions(topology: Topology): PartitionSummary[] {
  const byId = new Map<number, PartitionSummary>();
  for (const broker of topology.brokers) {
    for (const p of broker.partitions) {
      if (p.role.toLowerCase() === 'leader') {
        byId.set(p.partitionId, {
          partitionId: p.partitionId,
          health: p.health.toLowerCase() as PartitionSummary['health'],
        });
      } else if (!byId.has(p.partitionId)) {
        byId.set(p.partitionId, { partitionId: p.partitionId, health: 'no-leader' });
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.partitionId - b.partitionId);
}

export interface Issue {
  id: string;
  tone: 'warn' | 'bad';
  text: string;
  /** Question to hand to the agent; absent when there is nothing useful to ask (e.g. data unavailable) */
  question?: string;
}

export interface Assessment {
  tone: 'loading' | 'good' | 'warn' | 'bad';
  issues: Issue[];
}

/**
 * Reduces the raw metrics to one overall verdict. Only topology, incidents and failed jobs
 * count towards it — the other tiles are activity figures, not health signals.
 */
export function assess(m: ClusterMetrics): Assessment {
  const signals = [m.topology, m.incidents, m.failedJobs];
  if (signals.every(s => s.status === 'loading')) return { tone: 'loading', issues: [] };

  const issues: Issue[] = [];

  if (m.topology.status === 'ok') {
    const partitions = summarisePartitions(m.topology.value);
    const down = partitions.filter(p => p.health === 'dead' || p.health === 'no-leader').length;
    const unhealthy = partitions.filter(p => p.health === 'unhealthy').length;
    if (down > 0) {
      issues.push({
        id: 'partitions-down',
        tone: 'bad',
        text: `${down} ${plural(down, 'partition is', 'partitions are')} down or has no leader`,
        question: Q_TOPOLOGY,
      });
    } else if (unhealthy > 0) {
      issues.push({
        id: 'partitions-unhealthy',
        tone: 'warn',
        text: `${unhealthy} ${plural(unhealthy, 'partition is', 'partitions are')} unhealthy`,
        question: Q_TOPOLOGY,
      });
    }
  } else if (m.topology.status === 'error') {
    issues.push({ id: 'topology-unavailable', tone: 'warn', text: 'Cluster topology unavailable' });
  }

  if (m.incidents.status === 'ok') {
    const incidents = m.incidents.value.count;
    if (incidents.total > 0) {
      const affected =
        m.instancesWithIncidents.status === 'ok' && m.instancesWithIncidents.value.total > 0
          ? ` in ${formatCount(m.instancesWithIncidents.value)} ${plural(m.instancesWithIncidents.value.total, 'instance', 'instances')}`
          : '';
      issues.push({
        id: 'incidents',
        tone: 'bad',
        text: `${formatCount(incidents)} active ${plural(incidents.total, 'incident', 'incidents')}${affected}`,
        question: Q_INCIDENTS,
      });
    }
  } else if (m.incidents.status === 'error') {
    issues.push({ id: 'incidents-unavailable', tone: 'warn', text: 'Incident data unavailable' });
  }

  if (m.failedJobs.status === 'ok') {
    if (m.failedJobs.value.total > 0) {
      issues.push({
        id: 'failed-jobs',
        tone: 'warn',
        text: `${formatCount(m.failedJobs.value)} failed ${plural(m.failedJobs.value.total, 'job', 'jobs')}`,
        question: Q_FAILED_JOBS,
      });
    }
  } else if (m.failedJobs.status === 'error') {
    issues.push({ id: 'jobs-unavailable', tone: 'warn', text: 'Failed-job data unavailable' });
  }

  if (issues.some(i => i.tone === 'bad')) return { tone: 'bad', issues };
  if (issues.length > 0) return { tone: 'warn', issues };
  // Nothing wrong so far, but don't declare all-clear while a signal is still loading
  if (signals.some(s => s.status === 'loading')) return { tone: 'loading', issues };
  return { tone: 'good', issues };
}

/** Starter questions for the chat — anything currently wrong goes first. */
export function buildSuggestions(m: ClusterMetrics): string[] {
  const out: string[] = [];
  if (m.incidents.status === 'ok' && m.incidents.value.count.total > 0) out.push(Q_INCIDENTS);
  if (m.failedJobs.status === 'ok' && m.failedJobs.value.total > 0) out.push(Q_FAILED_JOBS);
  if (m.topology.status === 'ok' && summarisePartitions(m.topology.value).some(p => p.health !== 'healthy')) {
    out.push(Q_TOPOLOGY);
  }
  for (const q of DEFAULT_SUGGESTIONS) {
    if (out.length < 4 && !out.includes(q)) out.push(q);
  }
  return out.slice(0, 4);
}
