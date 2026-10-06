import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getTopology,
  getActiveIncidents,
  countActiveInstances,
  countInstancesWithIncidents,
  countOpenUserTasks,
  countDeployedProcesses,
  countFailedJobs,
  countStartedSince,
  countCompletedSince,
} from './clusterMetricsApi';
import type { Count, Incident, Topology } from './clusterMetricsApi';

export type Metric<T> =
  | { status: 'loading' }
  | { status: 'ok'; value: T }
  | { status: 'error'; error: string };

export interface ClusterMetrics {
  topology: Metric<Topology>;
  incidents: Metric<{ count: Count; recent: Incident[] }>;
  activeInstances: Metric<Count>;
  instancesWithIncidents: Metric<Count>;
  openUserTasks: Metric<Count>;
  deployedProcesses: Metric<Count>;
  failedJobs: Metric<Count>;
  started24h: Metric<Count>;
  completed24h: Metric<Count>;
}

const LOADING: ClusterMetrics = {
  topology: { status: 'loading' },
  incidents: { status: 'loading' },
  activeInstances: { status: 'loading' },
  instancesWithIncidents: { status: 'loading' },
  openUserTasks: { status: 'loading' },
  deployedProcesses: { status: 'loading' },
  failedJobs: { status: 'loading' },
  started24h: { status: 'loading' },
  completed24h: { status: 'loading' },
};

function toMetric<T>(result: PromiseSettledResult<T>): Metric<T> {
  return result.status === 'fulfilled'
    ? { status: 'ok', value: result.value }
    : { status: 'error', error: (result.reason as Error)?.message ?? 'Request failed' };
}

/**
 * Fetches cluster health metrics in parallel and refreshes on an interval.
 * Each metric settles independently, so one failing call (e.g. missing
 * permissions) doesn't blank out the rest of the dashboard.
 */
export function useClusterMetrics(refreshIntervalMs = 30_000) {
  const [metrics, setMetrics] = useState<ClusterMetrics>(LOADING);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const activeRef = useRef(true);
  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    lastRunRef.current = Date.now();
    setRefreshing(true);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [
      topology,
      incidents,
      activeInstances,
      instancesWithIncidents,
      openUserTasks,
      deployedProcesses,
      failedJobs,
      started24h,
      completed24h,
    ] = await Promise.allSettled([
      getTopology(),
      getActiveIncidents(),
      countActiveInstances(),
      countInstancesWithIncidents(),
      countOpenUserTasks(),
      countDeployedProcesses(),
      countFailedJobs(),
      countStartedSince(since),
      countCompletedSince(since),
    ]);

    inFlightRef.current = false;
    if (!activeRef.current) return;

    setMetrics({
      topology: toMetric(topology),
      incidents: toMetric(incidents),
      activeInstances: toMetric(activeInstances),
      instancesWithIncidents: toMetric(instancesWithIncidents),
      openUserTasks: toMetric(openUserTasks),
      deployedProcesses: toMetric(deployedProcesses),
      failedJobs: toMetric(failedJobs),
      started24h: toMetric(started24h),
      completed24h: toMetric(completed24h),
    });
    setLastUpdated(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    activeRef.current = true;
    const first = setTimeout(refresh, 0);
    // No point polling a tab nobody is looking at — skip while hidden, catch up on return
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, refreshIntervalMs);
    const onVisibilityChange = () => {
      if (!document.hidden && Date.now() - lastRunRef.current >= refreshIntervalMs) refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      activeRef.current = false;
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh, refreshIntervalMs]);

  return { metrics, lastUpdated, refreshing, refresh };
}
