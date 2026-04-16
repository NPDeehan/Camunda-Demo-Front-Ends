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
