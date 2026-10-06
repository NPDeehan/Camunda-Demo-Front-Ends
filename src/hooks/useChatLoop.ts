import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listActiveUserTasks,
  getUserTaskVariable,
  completeUserTask,
  getProcessInstanceState,
} from '../api/processApi';
import { CamundaApiError } from '../api/camundaClient';

export interface ChatMessage {
  role: 'agent' | 'user';
  content: string;
}

export type ChatStatus =
  | 'polling'
  | 'agent-replied'
  | 'sending'
  | 'ended'
  | 'error';

export interface ChatLoopConfig {
  taskDefinitionId: string;
  answerVariable: string;
  replyVariable: string;
  pollIntervalMs?: number;
}

/** What was in flight when the loop failed, so retry() can pick up from there */
type Failure = { kind: 'poll' } | { kind: 'send'; text: string };

export function useChatLoop(processInstanceKey: string, config: ChatLoopConfig) {
  const { taskDefinitionId, answerVariable, replyVariable, pollIntervalMs = 2000 } = config;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('polling');
  const [activeTaskKey, setActiveTaskKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [retryable, setRetryable] = useState(false);

  const activeRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSeenActiveRef = useRef(false);
  const seenTaskKeysRef = useRef<Set<string>>(new Set());
  const failureRef = useRef<Failure | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const fail = useCallback((e: unknown, failure: Failure) => {
    failureRef.current = failure;
    setError((e as Error).message);
    setErrorStatus(e instanceof CamundaApiError ? e.status : null);
    setRetryable(e instanceof CamundaApiError && e.transient);
    setStatus('error');
  }, []);

  const poll = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      const tasks = await listActiveUserTasks(processInstanceKey, [taskDefinitionId]);
      if (!activeRef.current) return;

      const freshTasks = tasks.filter(t => !seenTaskKeysRef.current.has(t.userTaskKey));

      if (freshTasks.length > 0) {
        const task = freshTasks[0];
        seenTaskKeysRef.current.add(task.userTaskKey);
        let raw: unknown;
        try {
          raw = await getUserTaskVariable(task.userTaskKey, answerVariable);
        } catch (e) {
          // Let the retry see this task again rather than silently skipping it
          seenTaskKeysRef.current.delete(task.userTaskKey);
          throw e;
        }
        if (!activeRef.current) return;

        const answer = typeof raw === 'string' ? raw : (raw != null ? JSON.stringify(raw) : null);

        if (!answer) {
          seenTaskKeysRef.current.delete(task.userTaskKey);
          timerRef.current = setTimeout(poll, pollIntervalMs);
          return;
        }

        setActiveTaskKey(task.userTaskKey);
        setMessages(prev => [...prev, { role: 'agent', content: answer }]);
        setStatus('agent-replied');
        // Keep polling so we detect process termination while waiting for user input.
        // seenTaskKeysRef prevents re-displaying this task.
        timerRef.current = setTimeout(poll, pollIntervalMs * 3);
        return;
      }

      const instance = await getProcessInstanceState(processInstanceKey);
      if (!activeRef.current) return;

      if (instance?.state === 'ACTIVE') {
        hasSeenActiveRef.current = true;
      }

      const isDone =
        hasSeenActiveRef.current &&
        (!instance ||
          instance.state === 'COMPLETED' ||
          instance.state === 'CANCELED' ||
          instance.state === 'TERMINATED');

      if (isDone) {
        setStatus('ended');
        return;
      }

      timerRef.current = setTimeout(poll, pollIntervalMs);
    } catch (e) {
      if (activeRef.current) fail(e, { kind: 'poll' });
    }
  }, [processInstanceKey, taskDefinitionId, answerVariable, pollIntervalMs, fail]);

  useEffect(() => {
    activeRef.current = true;
    poll();
    return () => {
      activeRef.current = false;
      clearTimer();
    };
  }, [poll]);

  /** Completes the open task with the user's text, then resumes polling. */
  const completeAndResume = useCallback(
    async (taskKey: string, text: string, isRetry: boolean) => {
      setStatus('sending');
      try {
        await completeUserTask(taskKey, { [replyVariable]: text });
      } catch (e) {
        // On a retry, a 404/409 usually means the earlier attempt did go through
        // (the gateway failed after Camunda processed it). Carry on and let polling decide.
        const alreadyDone = isRetry && e instanceof CamundaApiError && (e.status === 404 || e.status === 409);
        if (!alreadyDone) {
          if (activeRef.current) fail(e, { kind: 'send', text });
          return;
        }
      }
      setActiveTaskKey(null);
      if (!activeRef.current) return;
      setStatus('polling');
      // Wait 3 s before polling — gives Camunda time to close the task
      timerRef.current = setTimeout(poll, 3000);
    },
    [replyVariable, poll, fail],
  );

  const sendReply = useCallback(
    async (text: string) => {
      if (status !== 'agent-replied' || !activeTaskKey) return;
      setMessages(prev => [...prev, { role: 'user', content: text }]);
      await completeAndResume(activeTaskKey, text, false);
    },
    [status, activeTaskKey, completeAndResume],
  );

  /** Resumes after a transient failure, from whichever step failed. */
  const retry = useCallback(async () => {
    const failure = failureRef.current;
    if (status !== 'error' || !failure) return;
    failureRef.current = null;
    setError(null);
    setErrorStatus(null);
    setRetryable(false);

    if (failure.kind === 'send' && activeTaskKey) {
      await completeAndResume(activeTaskKey, failure.text, true);
    } else if (activeTaskKey) {
      // Failed while waiting on the user — go back to accepting their reply
      setStatus('agent-replied');
      timerRef.current = setTimeout(poll, pollIntervalMs * 3);
    } else {
      setStatus('polling');
      poll();
    }
  }, [status, activeTaskKey, completeAndResume, poll, pollIntervalMs]);

  return { messages, status, sendReply, error, errorStatus, retryable, retry };
}
