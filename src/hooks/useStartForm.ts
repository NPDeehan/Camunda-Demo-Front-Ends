import { useState, useEffect } from 'react';
import { getProcessDefinitionKey, getStartForm } from '../api/processApi';

export function useStartForm(
  processId: string,
  localSchema?: Record<string, unknown>
) {
  const [schema, setSchema] = useState<Record<string, unknown> | null>(
    localSchema || null
  );
  const [loading, setLoading] = useState(!localSchema);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (localSchema) return;

    let cancelled = false;
    (async () => {
      try {
        const key = await getProcessDefinitionKey(processId);
        if (cancelled) return;
        const formResponse = await getStartForm(key);
        if (cancelled) return;
        setSchema(JSON.parse(formResponse.schema));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [processId, localSchema]);

  return { schema, loading, error };
}
