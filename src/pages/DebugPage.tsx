import { useState } from 'react';
import { camundaFetch } from '../api/camundaClient';

type StepResult = {
  label: string;
  request: unknown;
  response: unknown;
  error?: string;
};

export default function DebugPage() {
  const [processInstanceKey, setProcessInstanceKey] = useState('');
  const [elementId, setElementId] = useState('Activity_0ab94rm');
  const [variableName, setVariableName] = useState('agentContext');
  const [results, setResults] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!processInstanceKey.trim()) return;
    setRunning(true);
    setResults([]);
    const steps: StepResult[] = [];

    // Step 1: element-instances/search
    const step1Request = {
      filter: { processInstanceKey: processInstanceKey.trim(), elementId: elementId.trim() },
      page: { limit: 5 },
    };
    try {
      const resp = await camundaFetch<unknown>('/element-instances/search', {
        method: 'POST',
        body: JSON.stringify(step1Request),
      });
      steps.push({ label: 'POST /element-instances/search', request: step1Request, response: resp });
    } catch (e) {
      steps.push({ label: 'POST /element-instances/search', request: step1Request, response: null, error: String(e) });
      setResults([...steps]);
      setRunning(false);
      return;
    }

    const el1 = steps[0].response as { items?: Record<string, unknown>[] };
    const firstItem = el1?.items?.[0];

    if (!firstItem) {
      setResults([...steps]);
      setRunning(false);
      return;
    }

    // Step 2: variables/search using every plausible key field from the element instance
    const candidateKeys = ['elementInstanceKey', 'key', 'flowNodeInstanceKey', 'instanceKey']
      .map(field => ({ field, value: firstItem[field] }))
      .filter(({ value }) => value !== undefined);

    for (const { field, value } of candidateKeys) {
      const req = {
        filter: { scopeKey: value, name: variableName.trim() },
        page: { limit: 1 },
      };
      try {
        const resp = await camundaFetch<unknown>('/variables/search', {
          method: 'POST',
          body: JSON.stringify(req),
        });
        steps.push({ label: `POST /variables/search  (scopeKey from "${field}")`, request: req, response: resp });
      } catch (e) {
        steps.push({ label: `POST /variables/search (scopeKey from "${field}")`, request: req, response: null, error: String(e) });
      }
    }

    // Step 3: also try scoping by processInstanceKey directly (as baseline)
    const baselineReq = {
      filter: { processInstanceKey: processInstanceKey.trim(), name: variableName.trim() },
      page: { limit: 1 },
    };
    try {
      const resp = await camundaFetch<unknown>('/variables/search', {
        method: 'POST',
        body: JSON.stringify(baselineReq),
      });
      steps.push({ label: 'POST /variables/search (baseline: processInstanceKey only)', request: baselineReq, response: resp });
    } catch (e) {
      steps.push({ label: 'POST /variables/search (baseline)', request: baselineReq, response: null, error: String(e) });
    }

    setResults([...steps]);
    setRunning(false);
  };

  return (
    <div style={{ fontFamily: 'monospace', padding: 32, background: '#02060F', minHeight: '100vh', color: '#8eb4d4' }}>
      <h1 style={{ color: '#00C8FF', letterSpacing: '0.15em', fontSize: '1rem', marginBottom: 24 }}>
        API DEBUG CONSOLE
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, marginBottom: 24 }}>
        <label style={{ fontSize: '0.7rem', letterSpacing: '0.12em', opacity: 0.6 }}>PROCESS INSTANCE KEY</label>
        <input
          value={processInstanceKey}
          onChange={e => setProcessInstanceKey(e.target.value)}
          placeholder="e.g. 6755399516440546"
          style={{ background: '#0A1628', border: '1px solid #0d3058', color: '#c8e4f8', padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.85rem', borderRadius: 3 }}
        />
        <label style={{ fontSize: '0.7rem', letterSpacing: '0.12em', opacity: 0.6 }}>ELEMENT ID</label>
        <input
          value={elementId}
          onChange={e => setElementId(e.target.value)}
          style={{ background: '#0A1628', border: '1px solid #0d3058', color: '#c8e4f8', padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.85rem', borderRadius: 3 }}
        />
        <label style={{ fontSize: '0.7rem', letterSpacing: '0.12em', opacity: 0.6 }}>VARIABLE NAME</label>
        <input
          value={variableName}
          onChange={e => setVariableName(e.target.value)}
          style={{ background: '#0A1628', border: '1px solid #0d3058', color: '#c8e4f8', padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.85rem', borderRadius: 3 }}
        />
        <button
          onClick={run}
          disabled={running || !processInstanceKey.trim()}
          style={{ marginTop: 8, padding: '10px 0', background: 'transparent', border: '1px solid #00C8FF', color: '#00C8FF', fontFamily: 'monospace', fontSize: '0.78rem', letterSpacing: '0.15em', cursor: 'pointer', borderRadius: 3 }}
        >
          {running ? 'RUNNING…' : 'RUN TESTS'}
        </button>
      </div>

      {results.map((r, i) => (
        <div key={i} style={{ marginBottom: 24, border: '1px solid #0d3058', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ background: '#070F1E', padding: '10px 16px', borderBottom: '1px solid #0d3058', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: r.error ? '#FF3B3B' : '#00C8FF', fontSize: '0.72rem', letterSpacing: '0.1em' }}>{r.label}</span>
            {r.error && <span style={{ color: '#FF3B3B', fontSize: '0.65rem' }}>ERROR</span>}
            {!r.error && (r.response as { items?: unknown[] })?.items?.length === 0 && (
              <span style={{ color: '#FFB300', fontSize: '0.65rem' }}>EMPTY ITEMS</span>
            )}
            {!r.error && (r.response as { items?: unknown[] })?.items?.length! > 0 && (
              <span style={{ color: '#00FF88', fontSize: '0.65rem' }}>✓ GOT RESULTS</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            <div style={{ padding: 16, borderRight: '1px solid #0d3058' }}>
              <div style={{ fontSize: '0.6rem', letterSpacing: '0.15em', opacity: 0.5, marginBottom: 8 }}>REQUEST</div>
              <pre style={{ margin: 0, fontSize: '0.72rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#8eb4d4' }}>
                {JSON.stringify(r.request, null, 2)}
              </pre>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: '0.6rem', letterSpacing: '0.15em', opacity: 0.5, marginBottom: 8 }}>RESPONSE</div>
              <pre style={{ margin: 0, fontSize: '0.72rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: r.error ? '#FF3B3B' : '#8eb4d4' }}>
                {r.error ?? JSON.stringify(r.response, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
