import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listActiveUserTasks,
  getUserTaskVariable,
  completeUserTask,
  getProcessInstanceState,
} from '../api/processApi';

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

export function useChatLoop(processInstanceKey: string, config: ChatLoopConfig) {
  const { taskDefinitionId, answerVariable, replyVariable, pollIntervalMs = 2000 } = config;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('polling');
  const [activeTaskKey, setActiveTaskKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSeenActiveRef = useRef(false);
  // Guard: track task keys we've already surfaced so we never re-show them
  const seenTaskKeysRef = useRef<Set<string>>(new Set());

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const poll = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      const tasks = await listActiveUserTasks(processInstanceKey, [taskDefinitionId]);
      if (!activeRef.current) return;

      const freshTasks = tasks.filter(t => !seenTaskKeysRef.current.has(t.userTaskKey));

      if (freshTasks.length > 0) {
        const task = freshTasks[0];
        seenTaskKeysRef.current.add(task.userTaskKey);
        const raw = await getUserTaskVariable(task.userTaskKey, answerVariable);
        if (!activeRef.current) return;

        const answer = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '');

        setActiveTaskKey(task.userTaskKey);
        setMessages(prev => [...prev, { role: 'agent', content: answer }]);
        setStatus('agent-replied');
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
      if (activeRef.current) {
        setError((e as Error).message);
        setStatus('error');
      }
    }
  }, [processInstanceKey, taskDefinitionId, answerVariable, pollIntervalMs]);

  useEffect(() => {
    activeRef.current = true;
    poll();
    return () => {
      activeRef.current = false;
      clearTimer();
    };
  }, [poll]);

  const sendReply = useCallback(
    async (text: string) => {
      if (status !== 'agent-replied' || !activeTaskKey) return;
      setStatus('sending');
      setMessages(prev => [...prev, { role: 'user', content: text }]);
      try {
        await completeUserTask(activeTaskKey, { [replyVariable]: text });
        setActiveTaskKey(null);
        if (!activeRef.current) return;
        setStatus('polling');
        // Wait 3 s before polling — gives Camunda time to close the task
        timerRef.current = setTimeout(poll, 3000);
      } catch (e) {
        if (activeRef.current) {
          setError((e as Error).message);
          setStatus('error');
        }
      }
    },
    [status, activeTaskKey, replyVariable, poll],
  );

  return { messages, status, sendReply, error };
}
