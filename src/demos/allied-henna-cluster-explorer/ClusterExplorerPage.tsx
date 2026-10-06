import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CustomFormPageProps } from '../../types/demo';
import { getProcessDefinitionKey, startProcessInstance } from '../../api/processApi';
import { useChatLoop } from '../../hooks/useChatLoop';
import { useClusterMetrics } from './useClusterMetrics';
import type { ClusterMetrics, Metric } from './useClusterMetrics';
import { getMonitorInfo } from './clusterMetricsApi';
import type { Count, MonitorInfo, Topology } from './clusterMetricsApi';
import {
  Q_FAILED_JOBS,
  Q_INCIDENTS,
  Q_INCIDENT_INSTANCES,
  assess,
  buildSuggestions,
  formatCount,
  summarisePartitions,
} from './clusterStatus';
import type { Assessment, Tone } from './clusterStatus';
import './ClusterExplorerPage.css';

const LOGO = '/logos/allied-henna-cluster.svg';
const AGENT_LABEL = 'Cluster Agent';
const REFRESH_INTERVAL_MS = 30_000;

const CHAT_CONFIG = {
  taskDefinitionId: 'DisplayAnswerToUser',
  answerVariable: 'answertoUser',
  replyVariable: 'followupQuestion',
};

type Tab = 'health' | 'agent';

/** A question pushed into the chat from the dashboard. `n` makes repeat clicks distinct. */
interface Prefill {
  text: string;
  n: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Turns a chat failure into plain language; never dumps a raw HTML error page on the user. */
function describeChatError(error: string | null, status: number | null): { headline: string; detail: string | null } {
  // camundaFetch messages look like "Camunda API error: 502 Bad Gateway — <html>…" — keep only the part before the body
  const detail = error ? error.split(' — ')[0] : null;
  if (status === 0 || status === 502 || status === 503 || status === 504) {
    return {
      headline: 'Lost contact with the Camunda cluster. This is usually temporary and your conversation is still running — try again.',
      detail,
    };
  }
  if (status === 404 || status === 409) {
    return {
      headline: 'The agent is no longer waiting for a reply — the session has probably timed out. Start a new conversation.',
      detail,
    };
  }
  return { headline: 'The conversation could not continue.', detail };
}

const TONE_ICON: Record<Exclude<Tone, 'neutral'> | 'loading', string> = {
  good: '✓',
  warn: '!',
  bad: '✕',
  loading: '…',
};

// ── Header ─────────────────────────────────────────────────────────────────

function Header({ title }: { title: string }) {
  return (
    <header className="ace-header">
      <img src={LOGO} alt="Allied Henna" className="ace-header-logo" />
      <span className="ace-header-title">{title}</span>
      <Link to="/" className="ace-header-back">← Hub</Link>
    </header>
  );
}

// ── Health panel ───────────────────────────────────────────────────────────

function MonitoredCluster() {
  const [info, setInfo] = useState<MonitorInfo | null>(null);

  useEffect(() => {
    let active = true;
    getMonitorInfo()
      .then(i => { if (active) setInfo(i); })
      .catch(() => { /* label is informational only */ });
    return () => { active = false; };
  }, []);

  if (!info) return null;
  const name = info.clusterId
    ? `${info.region} · ${info.clusterId.slice(0, 8)}`
    : info.host ?? 'unknown';
  return (
    <div className="ace-monitored">
      <span className="ace-monitored-label">Monitoring</span>
      <span className="ace-monitored-name" title={info.clusterId ?? info.host}>{name}</span>
      {!info.dedicated && (
        <span className="ace-badge ace-badge--warn" title="Set MONITOR_CAMUNDA_* in .env to monitor a different cluster">
          Same cluster as agent
        </span>
      )}
    </div>
  );
}

function RefreshStatus({
  lastUpdated,
  refreshing,
  onRefresh,
}: {
  lastUpdated: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  let text = 'Loading…';
  if (lastUpdated) {
    text = `Updated ${lastUpdated.toLocaleTimeString()}`;
    if (now !== null && !refreshing) {
      const secs = Math.max(0, Math.ceil((lastUpdated.getTime() + REFRESH_INTERVAL_MS - now) / 1000));
      text += ` · next in ${secs}s`;
    }
  }

  return (
    <div className="ace-refresh">
      <span className="ace-refresh-time">{text}</span>
      <button type="button" className="ace-refresh-btn" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}

function StatusBanner({ assessment, onAsk }: { assessment: Assessment; onAsk: (q: string) => void }) {
  const { tone, issues } = assessment;
  const title =
    tone === 'loading' ? 'Checking the cluster…'
    : tone === 'good' ? 'No problems detected'
    : `${issues.length} ${issues.length === 1 ? 'issue needs' : 'issues need'} attention`;

  return (
    <section className={`ace-banner ace-banner--${tone}`} role="status" aria-live="polite">
      <span className="ace-banner-icon" aria-hidden="true">{TONE_ICON[tone]}</span>
      <div className="ace-banner-main">
        <div className="ace-banner-title">{title}</div>
        {tone === 'good' && (
          <div className="ace-banner-sub">Based on partition health, incidents and failed jobs.</div>
        )}
        {issues.length > 0 && (
          <ul className="ace-banner-issues">
            {issues.map(issue => (
              <li key={issue.id}>
                <span className={`ace-dot ace-dot--${issue.tone}`} aria-hidden="true" />
                <span className="ace-banner-issue-text">{issue.text}</span>
                {issue.question && (
                  <button type="button" className="ace-ask" onClick={() => onAsk(issue.question!)}>
                    Ask agent
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function TopologyCard({ metric }: { metric: Metric<Topology> }) {
  if (metric.status === 'loading') {
    return (
      <section className="ace-card">
        <h3 className="ace-card-title">Cluster topology</h3>
        <div className="ace-skeleton ace-skeleton--block" />
      </section>
    );
  }
  if (metric.status === 'error') {
    return (
      <section className="ace-card">
        <h3 className="ace-card-title">Cluster topology</h3>
        <div className="ace-card-error">Topology unavailable — {metric.error}</div>
      </section>
    );
  }

  const topology = metric.value;
  const summary = summarisePartitions(topology);
  const partitionIds = summary.map(p => p.partitionId);
  const down = summary.filter(p => p.health === 'dead' || p.health === 'no-leader').length;
  const unhealthy = summary.filter(p => p.health === 'unhealthy').length;
  const tone: Tone = down > 0 ? 'bad' : unhealthy > 0 ? 'warn' : 'good';
  const badge =
    tone === 'good'
      ? `${summary.length}/${summary.length} partitions healthy`
      : `${down + unhealthy} of ${summary.length} partitions degraded`;

  return (
    <section className="ace-card">
      <div className="ace-card-head">
        <h3 className="ace-card-title">Cluster topology</h3>
        <span className={`ace-badge ace-badge--${tone}`}>
          <span aria-hidden="true">{TONE_ICON[tone]} </span>{badge}
        </span>
      </div>
      <div className="ace-topology-meta">
        {topology.clusterSize} {topology.clusterSize === 1 ? 'broker' : 'brokers'} · {topology.partitionsCount}{' '}
        {topology.partitionsCount === 1 ? 'partition' : 'partitions'} · replication {topology.replicationFactor} ·
        v{topology.gatewayVersion}
      </div>

      <div className="ace-grid-wrap">
        <div
          className="ace-grid"
          style={{ gridTemplateColumns: `max-content repeat(${partitionIds.length}, 2.4rem)` }}
          role="table"
          aria-label="Partition distribution across brokers"
        >
          <span />
          {partitionIds.map(id => (
            <span key={id} className="ace-grid-head">P{id}</span>
          ))}
          {[...topology.brokers].sort((a, b) => a.nodeId - b.nodeId).map(broker => (
            <Fragment key={broker.nodeId}>
              <span className="ace-grid-broker" title={`${broker.host}:${broker.port} · v${broker.version}`}>
                Broker {broker.nodeId}
              </span>
              {partitionIds.map(id => {
                const p = broker.partitions.find(x => x.partitionId === id);
                if (!p) return <span key={id} className="ace-cell ace-cell--none" />;
                const role = p.role.toLowerCase();
                const health = p.health.toLowerCase();
                return (
                  <span
                    key={id}
                    className={`ace-cell ace-cell--${role === 'leader' ? 'leader' : 'follower'} ace-cell--${health}`}
                    title={`Partition ${id} on broker ${broker.nodeId}: ${role}, ${health}`}
                  >
                    {role === 'leader' ? 'L' : 'F'}
                  </span>
                );
              })}
            </Fragment>
          ))}
        </div>
        <div className="ace-grid-legend">
          <span><b>L</b> leader</span>
          <span><b>F</b> follower</span>
          <span><i className="ace-legend-sw ace-legend-sw--healthy" /> healthy</span>
          <span><i className="ace-legend-sw ace-legend-sw--unhealthy" /> unhealthy</span>
          <span><i className="ace-legend-sw ace-legend-sw--dead" /> dead</span>
        </div>
      </div>
    </section>
  );
}

function CheckRow({
  label,
  metric,
  badTone,
  question,
  onAsk,
}: {
  label: string;
  metric: Metric<Count>;
  badTone: 'warn' | 'bad';
  question: string;
  onAsk: (q: string) => void;
}) {
  let tone: 'loading' | 'good' | 'warn' | 'bad' | 'unavailable' = 'loading';
  if (metric.status === 'error') tone = 'unavailable';
  if (metric.status === 'ok') tone = metric.value.total === 0 ? 'good' : badTone;

  return (
    <li className={`ace-check ace-check--${tone}`}>
      <span className="ace-check-icon" aria-hidden="true">
        {tone === 'unavailable' ? '–' : TONE_ICON[tone]}
      </span>
      <span className="ace-check-label">{label}</span>
      {metric.status === 'loading' && <span className="ace-skeleton ace-skeleton--inline" />}
      {metric.status === 'ok' && <span className="ace-check-value">{formatCount(metric.value)}</span>}
      {metric.status === 'error' && (
        <span className="ace-check-value ace-check-value--muted" title={metric.error}>Unavailable</span>
      )}
      {metric.status === 'ok' && metric.value.total > 0 && (
        <button type="button" className="ace-ask" onClick={() => onAsk(question)}>Ask agent</button>
      )}
    </li>
  );
}

function HealthChecksCard({ metrics, onAsk }: { metrics: ClusterMetrics; onAsk: (q: string) => void }) {
  const incidents = metrics.incidents;
  const incidentCount: Metric<Count> =
    incidents.status === 'ok' ? { status: 'ok', value: incidents.value.count } : incidents;
  const recent = incidents.status === 'ok' ? incidents.value.recent : [];

  return (
    <section className="ace-card">
      <h3 className="ace-card-title">Health checks</h3>
      <ul className="ace-checks">
        <CheckRow label="Active incidents" metric={incidentCount} badTone="bad" question={Q_INCIDENTS} onAsk={onAsk} />
        <CheckRow label="Instances with incidents" metric={metrics.instancesWithIncidents} badTone="bad" question={Q_INCIDENT_INSTANCES} onAsk={onAsk} />
        <CheckRow label="Failed jobs" metric={metrics.failedJobs} badTone="warn" question={Q_FAILED_JOBS} onAsk={onAsk} />
      </ul>

      {recent.length > 0 && (
        <>
          <h4 className="ace-subtitle">Most recent incidents</h4>
          <ul className="ace-incidents">
            {recent.map(inc => (
              <li key={inc.incidentKey}>
                <button
                  type="button"
                  className="ace-incident"
                  onClick={() =>
                    onAsk(`Tell me about incident ${inc.incidentKey} in process ${inc.processDefinitionId} — what went wrong and how do I fix it?`)
                  }
                >
                  <div className="ace-incident-top">
                    <span className="ace-incident-process">{inc.processDefinitionId}</span>
                    <span className="ace-incident-time">{timeAgo(inc.creationTime)}</span>
                  </div>
                  <div className="ace-incident-type">{inc.errorType} · {inc.elementId}</div>
                  <div className="ace-incident-msg">{inc.errorMessage}</div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function MetricTile({
  label,
  metric,
  hint,
  question,
  onAsk,
}: {
  label: string;
  metric: Metric<Count>;
  hint?: string;
  question: string;
  onAsk: (q: string) => void;
}) {
  return (
    <button
      type="button"
      className="ace-tile"
      onClick={() => onAsk(question)}
      aria-label={`${label}${hint ? ` (${hint})` : ''} — ask the agent about this`}
    >
      <span className="ace-tile-label">{label}{hint && <span className="ace-tile-hint"> · {hint}</span>}</span>
      {metric.status === 'loading' && <span className="ace-skeleton ace-skeleton--value" />}
      {metric.status === 'ok' && <span className="ace-tile-value">{formatCount(metric.value)}</span>}
      {metric.status === 'error' && (
        <span className="ace-tile-value ace-tile-value--muted" title={metric.error}>Unavailable</span>
      )}
      <span className="ace-tile-ask" aria-hidden="true">Ask agent →</span>
    </button>
  );
}

function HealthPanel({
  metrics,
  assessment,
  lastUpdated,
  refreshing,
  onRefresh,
  onAsk,
}: {
  metrics: ClusterMetrics;
  assessment: Assessment;
  lastUpdated: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
  onAsk: (q: string) => void;
}) {
  return (
    <div className="ace-metrics">
      <div className="ace-metrics-head">
        <div>
          <h2 className="ace-panel-title">Cluster health</h2>
          <MonitoredCluster />
        </div>
        <RefreshStatus lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={onRefresh} />
      </div>

      <StatusBanner assessment={assessment} onAsk={onAsk} />

      <h3 className="ace-section">Health</h3>
      <div className="ace-health">
        <TopologyCard metric={metrics.topology} />
        <HealthChecksCard metrics={metrics} onAsk={onAsk} />
      </div>

      <h3 className="ace-section">Workload</h3>
      <div className="ace-tiles">
        <MetricTile label="Active instances" metric={metrics.activeInstances} onAsk={onAsk}
          question="Which processes have the most active instances right now?" />
        <MetricTile label="Open user tasks" metric={metrics.openUserTasks} onAsk={onAsk}
          question="What user tasks are currently waiting to be worked on?" />
        <MetricTile label="Deployed processes" metric={metrics.deployedProcesses} onAsk={onAsk}
          question="What processes are deployed on this cluster?" />
      </div>

      <h3 className="ace-section">Throughput</h3>
      <div className="ace-tiles">
        <MetricTile label="Started" hint="last 24 h" metric={metrics.started24h} onAsk={onAsk}
          question="How many process instances were started in the last 24 hours, and for which processes?" />
        <MetricTile label="Completed" hint="last 24 h" metric={metrics.completed24h} onAsk={onAsk}
          question="How many process instances completed in the last 24 hours?" />
      </div>
    </div>
  );
}

// ── Chat panel ─────────────────────────────────────────────────────────────

function ChatSession({
  processInstanceKey,
  initialQuestion,
  prefill,
  onReset,
}: {
  processInstanceKey: string;
  initialQuestion: string;
  prefill: Prefill | null;
  onReset: () => void;
}) {
  const { messages, status, sendReply, error, errorStatus, retryable, retry } = useChatLoop(
    processInstanceKey,
    CHAT_CONFIG,
  );
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const [seenPrefill, setSeenPrefill] = useState(prefill);

  // Adopt a new prefill from the dashboard (state adjusted during render, not in an effect)
  if (prefill !== seenPrefill) {
    setSeenPrefill(prefill);
    if (prefill) setDraft(prefill.text);
  }

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || status !== 'agent-replied') return;
    setDraft('');
    await sendReply(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = status === 'agent-replied' && draft.trim().length > 0;
  const inputDisabled = status !== 'agent-replied';
  const finished = status === 'ended' || status === 'error';

  return (
    <div className="ace-chat">
      <div className="ace-messages">
        <div className="ace-bubble ace-bubble--user">
          <div className="ace-bubble-label">You</div>
          <div className="ace-bubble-body">{initialQuestion}</div>
        </div>
        {messages.map((msg, i) => (
          <div key={i} className={`ace-bubble ace-bubble--${msg.role}`}>
            <div className="ace-bubble-label">{msg.role === 'agent' ? AGENT_LABEL : 'You'}</div>
            <div className="ace-bubble-body">
              {msg.role === 'agent' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {(status === 'polling' || status === 'sending') && (
          <div className="ace-bubble ace-bubble--agent">
            <div className="ace-bubble-label">{AGENT_LABEL}</div>
            <div className="ace-bubble-body">
              <div className="ace-typing"><span /><span /><span /></div>
            </div>
          </div>
        )}

        {status === 'ended' && (
          <div className="ace-ended">This conversation has ended.</div>
        )}

        {status === 'error' && (() => {
          const { headline, detail } = describeChatError(error, errorStatus);
          return (
            <div className="ace-chat-error">
              {headline}
              {detail && <div className="ace-chat-error-detail">{detail}</div>}
            </div>
          );
        })()}

        <div ref={bottomRef} />
      </div>

      {finished ? (
        <div className="ace-input-row ace-input-row--center">
          {status === 'error' && retryable && (
            <button type="button" className="ace-send-btn" onClick={retry}>Retry</button>
          )}
          <button
            type="button"
            className={status === 'error' && retryable ? 'ace-secondary-btn' : 'ace-send-btn'}
            onClick={onReset}
          >
            New conversation
          </button>
        </div>
      ) : (
        <div className="ace-input-row">
          <textarea
            className="ace-textarea"
            placeholder={inputDisabled ? 'Waiting for the agent…' : 'Ask a follow-up… (Enter to send)'}
            value={draft}
            rows={2}
            disabled={inputDisabled}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="button" className="ace-send-btn" onClick={handleSend} disabled={!canSend}>
            Send
          </button>
        </div>
      )}
    </div>
  );
}

function ChatStart({
  processId,
  prefill,
  suggestions,
  onStarted,
}: {
  processId: string;
  prefill: Prefill | null;
  suggestions: string[];
  onStarted: (processInstanceKey: string, question: string) => void;
}) {
  const [question, setQuestion] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [seenPrefill, setSeenPrefill] = useState(prefill);

  // Adopt a new prefill from the dashboard (state adjusted during render, not in an effect)
  if (prefill !== seenPrefill) {
    setSeenPrefill(prefill);
    if (prefill) setQuestion(prefill.text);
  }

  const start = async (text: string) => {
    const q = text.trim();
    if (!q || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const defKey = await getProcessDefinitionKey(processId);
      const instance = await startProcessInstance(defKey, { question: q });
      onStarted(instance.processInstanceKey, q);
    } catch (e) {
      setStartError((e as Error).message);
      setStarting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      start(question);
    }
  };

  return (
    <div className="ace-start">
      <img src={LOGO} alt="" className="ace-start-logo" />
      <h3 className="ace-start-title">Ask about your cluster</h3>
      <p className="ace-start-desc">
        The Cluster Agent queries the Camunda REST API on your behalf. Click anything on the
        dashboard, or ask your own question.
      </p>
      <div className="ace-suggestions">
        {suggestions.map(s => (
          <button key={s} type="button" className="ace-suggestion" disabled={starting} onClick={() => start(s)}>
            {s}
          </button>
        ))}
      </div>
      <textarea
        className="ace-start-textarea"
        placeholder="What would you like to know?"
        value={question}
        rows={3}
        disabled={starting}
        onChange={e => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {startError && <div className="ace-start-error">{startError}</div>}
      <button
        type="button"
        className="ace-start-btn"
        onClick={() => start(question)}
        disabled={starting || !question.trim()}
      >
        {starting ? 'Starting…' : 'Ask the agent'}
      </button>
    </div>
  );
}

function ChatPanel({
  processId,
  prefill,
  suggestions,
  wide,
  onToggleWide,
  onSessionStart,
  onSessionEnd,
  onClearPrefill,
}: {
  processId: string;
  prefill: Prefill | null;
  suggestions: string[];
  wide: boolean;
  onToggleWide: () => void;
  onSessionStart: () => void;
  onSessionEnd: () => void;
  onClearPrefill: () => void;
}) {
  const [session, setSession] = useState<{ key: string; question: string } | null>(null);

  // A prefill is consumed once a conversation starts or is reset, so it doesn't reappear.
  const reset = () => {
    onClearPrefill();
    setSession(null);
    onSessionEnd();
  };

  return (
    <div className="ace-chat-panel">
      <div className="ace-chat-panel-head">
        <h2 className="ace-panel-title">{AGENT_LABEL}</h2>
        {session && (
          <div className="ace-chat-actions">
            <button
              type="button"
              className="ace-refresh-btn ace-wide-toggle"
              onClick={onToggleWide}
              aria-pressed={wide}
              title={wide ? 'Give the dashboard more room' : 'Give the chat more room'}
            >
              {wide ? 'Narrow chat' : 'Widen chat'}
            </button>
            <button type="button" className="ace-refresh-btn" onClick={reset}>
              New conversation
            </button>
          </div>
        )}
      </div>
      {session ? (
        <ChatSession
          key={session.key}
          processInstanceKey={session.key}
          initialQuestion={session.question}
          prefill={prefill}
          onReset={reset}
        />
      ) : (
        <ChatStart
          processId={processId}
          prefill={prefill}
          suggestions={suggestions}
          onStarted={(key, question) => {
            onClearPrefill();
            setSession({ key, question });
            onSessionStart();
          }}
        />
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ClusterExplorerPage({ config }: CustomFormPageProps) {
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [tab, setTab] = useState<Tab>('health');
  const [chatWide, setChatWide] = useState(false);
  const { metrics, lastUpdated, refreshing, refresh } = useClusterMetrics(REFRESH_INTERVAL_MS);

  const assessment = useMemo(() => assess(metrics), [metrics]);
  const suggestions = useMemo(() => buildSuggestions(metrics), [metrics]);

  // This page has its own header and fills the window, so hide the hub's bar and footer while it's open
  useEffect(() => {
    document.body.classList.add('ace-fullscreen');
    return () => document.body.classList.remove('ace-fullscreen');
  }, []);

  const ask = (text: string) => {
    setPrefill(prev => ({ text, n: (prev?.n ?? 0) + 1 }));
    setTab('agent'); // on narrow screens this switches to the chat; on wide ones both panels are already visible
  };

  const issueCount = assessment.issues.length;

  return (
    <div className="ace-page">
      <Header title={config.title} />

      <div className="ace-tabs" role="tablist" aria-label="Dashboard sections">
        <button type="button" role="tab" aria-selected={tab === 'health'}
          className={`ace-tab${tab === 'health' ? ' ace-tab--active' : ''}`} onClick={() => setTab('health')}>
          Health
          {issueCount > 0 && <span className={`ace-tab-badge ace-tab-badge--${assessment.tone}`}>{issueCount}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'agent'}
          className={`ace-tab${tab === 'agent' ? ' ace-tab--active' : ''}`} onClick={() => setTab('agent')}>
          Agent
        </button>
      </div>

      <div className={`ace-body${chatWide ? ' ace-body--wide' : ''}`} data-tab={tab}>
        <HealthPanel
          metrics={metrics}
          assessment={assessment}
          lastUpdated={lastUpdated}
          refreshing={refreshing}
          onRefresh={refresh}
          onAsk={ask}
        />
        <ChatPanel
          processId={config.processId}
          prefill={prefill}
          suggestions={suggestions}
          wide={chatWide}
          onToggleWide={() => setChatWide(w => !w)}
          onSessionStart={() => setChatWide(true)}
          onSessionEnd={() => setChatWide(false)}
          onClearPrefill={() => setPrefill(null)}
        />
      </div>
    </div>
  );
}
