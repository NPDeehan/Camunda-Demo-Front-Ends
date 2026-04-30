import { camundaFetch } from './camundaClient';

export interface StartFormResponse {
  formKey: string;
  schema: string;
}

export interface ProcessInstanceResponse {
  processInstanceKey: string;
  processDefinitionKey: string;
  processDefinitionId: string;
  version: number;
}

export interface UserTask {
  userTaskKey: string;
  elementId: string;
  name: string;
  processInstanceKey: string;
  formKey?: string;
}

export interface UserTaskFormResponse {
  formKey: string;
  schema: string;
}

export interface ProcessInstanceState {
  processInstanceKey: string;
  state: 'ACTIVE' | 'COMPLETED' | 'CANCELED' | 'TERMINATED';
}

export async function getProcessDefinitionKey(
  bpmnProcessId: string
): Promise<string> {
  const result = await camundaFetch<{
    items: Array<{ processDefinitionKey: string; processDefinitionId: string; version: number }>;
  }>('/process-definitions/search', {
    method: 'POST',
    body: JSON.stringify({
      filter: { processDefinitionId: bpmnProcessId, isLatestVersion: true },
      page: { limit: 1 },
    }),
  });
  if (!result.items.length) {
    throw new Error(`Process "${bpmnProcessId}" not found in Camunda`);
  }
  return result.items[0].processDefinitionKey;
}

export async function getStartForm(
  processDefinitionKey: string
): Promise<StartFormResponse> {
  return camundaFetch<StartFormResponse>(
    `/process-definitions/${processDefinitionKey}/form`
  );
}

export async function startProcessInstance(
  processDefinitionKey: string,
  variables: Record<string, unknown>
): Promise<ProcessInstanceResponse> {
  return camundaFetch<ProcessInstanceResponse>(
    `/process-instances`,
    {
      method: 'POST',
      body: JSON.stringify({ processDefinitionKey, variables }),
    }
  );
}

export async function listActiveUserTasks(
  processInstanceKey: string,
  elementIds?: string[]
): Promise<UserTask[]> {
  const result = await camundaFetch<{ items: UserTask[] }>('/user-tasks/search', {
    method: 'POST',
    body: JSON.stringify({
      filter: { processInstanceKey, state: 'CREATED' },
      page: { limit: 10 },
    }),
  });
  if (elementIds && elementIds.length > 0) {
    return result.items.filter(t => elementIds.includes(t.elementId));
  }
  return result.items;
}

export async function getUserTaskForm(
  userTaskKey: string
): Promise<UserTaskFormResponse> {
  return camundaFetch<UserTaskFormResponse>(`/user-tasks/${userTaskKey}/form`);
}

export async function completeUserTask(
  userTaskKey: string,
  variables: Record<string, unknown>
): Promise<void> {
  await camundaFetch<null>(`/user-tasks/${userTaskKey}/completion`, {
    method: 'POST',
    body: JSON.stringify({ variables }),
  });
}

export async function getProcessInstanceVariables(
  processInstanceKey: string
): Promise<Record<string, unknown>> {
  const result = await camundaFetch<{ items: Array<{ name: string; value: string }> }>(
    '/variables/search',
    {
      method: 'POST',
      body: JSON.stringify({
        filter: { processInstanceKey },
        page: { limit: 100 },
      }),
    }
  );
  return Object.fromEntries(
    result.items.map(({ name, value }) => {
      try {
        return [name, JSON.parse(value)];
      } catch {
        return [name, value];
      }
    })
  );
}

export async function getProcessInstanceState(
  processInstanceKey: string
): Promise<ProcessInstanceState | null> {
  const result = await camundaFetch<{ items: ProcessInstanceState[] }>(
    '/process-instances/search',
    {
      method: 'POST',
      body: JSON.stringify({
        filter: { processInstanceKey },
        page: { limit: 1 },
      }),
    }
  );
  return result.items[0] ?? null;
}

export interface ActiveProcessInstance {
  processInstanceKey: string;
  startDate?: string;
}

export interface AgentContextMessage {
  role: string;
  content?: Array<{ type: string; text?: string }>;
}

export interface AgentContext {
  state?: string;
  conversation?: {
    messages?: AgentContextMessage[];
  };
}

export async function getAgentContext(
  processInstanceKey: string
): Promise<AgentContext | null> {
  const result = await camundaFetch<{
    items: Array<{ name: string; value: string; variableKey: string; isTruncated?: boolean }>;
  }>('/variables/search', {
    method: 'POST',
    body: JSON.stringify({
      filter: { processInstanceKey, name: 'agentContext' },
      page: { limit: 1 },
    }),
  });

  const item = result.items[0];
  if (!item) return null;

  let rawValue = item.value;

  if (item.isTruncated) {
    const full = await camundaFetch<{ value: string }>(`/variables/${item.variableKey}`);
    rawValue = full.value;
  }

  try {
    return JSON.parse(rawValue) as AgentContext;
  } catch {
    return null;
  }
}

export async function countActiveUserTasksForProcess(
  bpmnProcessId: string
): Promise<number> {
  const processDefinitionKey = await getProcessDefinitionKey(bpmnProcessId);
  const result = await camundaFetch<{ items: unknown[] }>('/user-tasks/search', {
    method: 'POST',
    body: JSON.stringify({
      filter: { processDefinitionKey, state: 'CREATED' },
      page: { limit: 100 },
    }),
  });
  return result.items.length;
}

export async function listActiveProcessInstances(
  processDefinitionId: string
): Promise<ActiveProcessInstance[]> {
  const result = await camundaFetch<{ items: ActiveProcessInstance[] }>(
    '/process-instances/search',
    {
      method: 'POST',
      body: JSON.stringify({
        filter: { processDefinitionId, state: 'ACTIVE' },
        page: { limit: 50 },
      }),
    }
  );
  return result.items;
}
