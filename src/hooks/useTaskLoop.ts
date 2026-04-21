import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listActiveUserTasks,
  getUserTaskForm,
  getProcessInstanceVariables,
  completeUserTask,
  getProcessInstanceState,
  type UserTask,
} from '../api/processApi';
import type { TaskLoopConfig } from '../types/demo';

export type TaskLoopState =
  | { status: 'polling' }
  | { status: 'task-active'; task: UserTask; formSchema: Record<string, unknown>; variables: Record<string, unknown> }
  | { status: 'completing' }
  | { status: 'done' }
  | { status: 'error'; message: string };

export function useTaskLoop(
  processInstanceKey: string,
  config: TaskLoopConfig = {}
) {
  const { pollIntervalMs = 2000, taskDefinitionIds } = config;
  const [state, setState] = useState<TaskLoopState>({ status: 'polling' });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);
  // Only declare "done" once we've seen the instance as ACTIVE at least once,
  // preventing a false-positive on the first poll before Camunda indexes the instance.
  const hasSeenActiveRef = useRef(false);
  // Client-side guard: keys of tasks we've already completed so we never re-show them
  // even if the API is slow to update their state.
  const completedTaskKeysRef = useRef<Set<string>>(new Set());

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const poll = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      const tasks = await listActiveUserTasks(processInstanceKey, taskDefinitionIds);

      if (!activeRef.current) return;

      const freshTasks = tasks.filter(t => !completedTaskKeysRef.current.has(t.userTaskKey));

      if (freshTasks.length > 0) {
        const task = freshTasks[0];
        const [formResponse, variables] = await Promise.all([
          getUserTaskForm(task.userTaskKey),
          getProcessInstanceVariables(processInstanceKey),
        ]);
        if (!activeRef.current) return;
        const schema = JSON.parse(formResponse.schema) as Record<string, unknown>;
        setState({ status: 'task-active', task, formSchema: schema, variables });
        return;
      }

      // No active tasks — check if process has finished
      const instance = await getProcessInstanceState(processInstanceKey);
      if (!activeRef.current) return;

      if (instance?.state === 'ACTIVE') {
        hasSeenActiveRef.current = true;
      }

      // Only treat missing/completed instance as done once we've confirmed it was ACTIVE.
      // On the first poll the instance may not be indexed yet, so null ≠ finished.
      const isDone =
        hasSeenActiveRef.current &&
        (!instance ||
          instance.state === 'COMPLETED' ||
          instance.state === 'CANCELED' ||
          instance.state === 'TERMINATED');

      if (isDone) {
        setState({ status: 'done' });
        return;
      }

      // Still starting up or still running — poll again after interval
      timerRef.current = setTimeout(poll, pollIntervalMs);
    } catch (e) {
      if (activeRef.current) {
        setState({ status: 'error', message: (e as Error).message });
      }
    }
  }, [processInstanceKey, pollIntervalMs, taskDefinitionIds]);

  useEffect(() => {
    activeRef.current = true;
    poll();
    return () => {
      activeRef.current = false;
      clearTimer();
    };
  }, [poll]);

  const completeTask = useCallback(
    async (variables: Record<string, unknown>) => {
      if (state.status !== 'task-active') return;
      setState({ status: 'completing' });
      try {
        await completeUserTask(state.task.userTaskKey, variables);
        completedTaskKeysRef.current.add(state.task.userTaskKey);
        if (!activeRef.current) return;
        setState({ status: 'polling' });
        // Wait 3 s before polling — gives Camunda time to close the task
        // so we don't immediately re-fetch the same one.
        timerRef.current = setTimeout(poll, 3000);
      } catch (e) {
        if (activeRef.current) {
          setState({ status: 'error', message: (e as Error).message });
        }
      }
    },
    [state, poll]
  );

  return { state, completeTask };
}
