import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type { CustomFormPageProps } from '../../types/demo';
import {
  getProcessDefinitionKey,
  startProcessInstance,
  getProcessInstanceVariables,
  getAgentContext,
  listActiveProcessInstances,
  countActiveUserTasksForProcess,
} from '../../api/processApi';
import type { ActiveProcessInstance, AgentContext } from '../../api/processApi';
import './MissionLaunchPage.css';

type MissionInstance = ActiveProcessInstance & { missionKey?: string };

// ── Types ──────────────────────────────────────────────────────────────────

interface FleetShip {
  name: string;
}

interface ShipMetrics {
  missions: number | 'loading';
  tasks: number | 'loading';
}

interface ShipInfo {
  name: string;
  class: string;
  status: string;
}

interface ShipSystems {
  hull_integrity: number;
  shields: number;
  engine_power: number;
  life_support: number;
  weapons_online: boolean;
  shields_online: boolean;
}

interface Navigation {
  current_location: string;
  destination: string;
  speed_km_s: number;
  eta_hours: number;
}

interface Crew {
  total: number;
  active: number;
  injured: number;
  inactive_but_healthy: number;
}

interface CargoItem {
  item: string;
  tons: number;
}

interface Cargo {
  capacity_tons: number;
  used_tons: number;
  manifest: CargoItem[];
}

interface Fuel {
  current_percent: number;
}

interface Alert {
  level: 'info' | 'warning' | 'critical';
  message: string;
}

interface ShipStatus {
  ship: ShipInfo;
  systems: ShipSystems;
  navigation: Navigation;
  crew: Crew;
  cargo: Cargo;
  fuel: Fuel;
  alerts: Alert[];
}

type Phase = 'fleet' | 'ship' | 'loading' | 'console';

// ── localStorage helpers ───────────────────────────────────────────────────

const FLEET_KEY = 'ahf-fleet-ships';

function loadFleetShips(): FleetShip[] {
  try {
    const raw = localStorage.getItem(FLEET_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFleetShips(ships: FleetShip[]) {
  localStorage.setItem(FLEET_KEY, JSON.stringify(ships));
}

// ── Poll helpers ───────────────────────────────────────────────────────────

interface PollResult {
  shipStatus: ShipStatus;
  missionKey: string | null;
}

async function pollForShipStatus(
  processInstanceKey: string,
  maxAttempts = 20,
): Promise<PollResult> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const vars = await getProcessInstanceVariables(processInstanceKey);
      if (vars.shipStatus) return {
        shipStatus: vars.shipStatus as ShipStatus,
        missionKey: (vars.missionKey as string) ?? null,
      };
    } catch {
      // transient error — keep polling
    }
  }
  throw new Error('Ship systems did not respond within the allotted window. Please retry.');
}

function getLastAssistantText(ctx: AgentContext): string | null {
  const messages = ctx.conversation?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant') {
      const textItem = msg.content?.find(c => c.type === 'text');
      if (textItem?.text) return textItem.text;
    }
  }
  return null;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Gauge({ label, value }: { label: string; value: number }) {
  const cls = value >= 80 ? 'good' : value >= 50 ? 'warn' : 'crit';
  return (
    <div className="mlp-gauge">
      <div className="mlp-gauge-header">
        <span className="mlp-gauge-label">{label}</span>
        <span className={`mlp-gauge-value mlp-gauge-value--${cls}`}>{value}%</span>
      </div>
      <div className="mlp-gauge-track">
        <div className={`mlp-gauge-fill mlp-gauge-fill--${cls}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function FuelBar({ value }: { value: number }) {
  const cls = value >= 80 ? 'good' : value >= 50 ? 'warn' : 'crit';
  return (
    <div className="mlp-fuel-bar-wrap">
      <div className="mlp-fuel-bar-track">
        <div className={`mlp-fuel-bar-fill mlp-fuel-bar-fill--${cls}`} style={{ height: `${value}%` }} />
      </div>
      <span className={`mlp-fuel-bar-label mlp-gauge-value--${cls}`}>{value}%</span>
    </div>
  );
}

function ConsolePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mlp-panel">
      <div className="mlp-panel-title">{title}</div>
      <div className="mlp-panel-body">{children}</div>
    </div>
  );
}

function AgentThoughtsPanel({ agentContext }: { agentContext: AgentContext | null }) {
  const [expanded, setExpanded] = useState(false);
  const text = agentContext ? getLastAssistantText(agentContext) : null;
  const preview = text
    ? text.split('\n').filter(l => l.trim()).slice(0, 3).join(' ').slice(0, 220)
    : null;

  return (
    <>
      <ConsolePanel title="SHIP COMPUTER THOUGHTS">
        {text && preview ? (
          <div className="mlp-thoughts-preview">
            <p className="mlp-thoughts-preview-text">{preview}{text.length > 220 ? '…' : ''}</p>
            <button className="mlp-thoughts-expand-btn" onClick={() => setExpanded(true)}>
              EXPAND ↗
            </button>
          </div>
        ) : (
          <p className="mlp-thoughts-idle">Awaiting ship computer response…</p>
        )}
      </ConsolePanel>

      {expanded && text && (
        <div className="mlp-thoughts-overlay" onClick={() => setExpanded(false)}>
          <div className="mlp-thoughts-modal" onClick={e => e.stopPropagation()}>
            <div className="mlp-thoughts-modal-header">
              <span className="mlp-thoughts-modal-title">SHIP COMPUTER THOUGHTS</span>
              <button className="mlp-thoughts-close-btn" onClick={() => setExpanded(false)}>✕ CLOSE</button>
            </div>
            <div className="mlp-thoughts-modal-body">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ShipConsole({
  data,
  missionKey,
  agentContext,
  onRefresh,
  refreshing,
}: {
  data: ShipStatus;
  missionKey: string | null;
  agentContext: AgentContext | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const cargoPercent = Math.round((data.cargo.used_tons / data.cargo.capacity_tons) * 100);

  return (
    <div className="mlp-console">
      <div className="mlp-console-header">
        <div className="mlp-console-ship-id">
          <span className="mlp-console-ship-name">{data.ship.name}</span>
          <span className="mlp-console-ship-class">{data.ship.class}</span>
          {missionKey && (
            <span className="mlp-console-mission-key">MISSION KEY: {missionKey}</span>
          )}
        </div>
        <div className="mlp-console-header-right">
          <button className="mlp-refresh-btn" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'REFRESHING…' : '↻ REFRESH TELEMETRY'}
          </button>
          <div className={`mlp-console-status mlp-console-status--${data.ship.status === 'operational' ? 'good' : 'warn'}`}>
            ● {data.ship.status.toUpperCase()}
          </div>
        </div>
      </div>

      <AgentThoughtsPanel agentContext={agentContext} />

      <div className="mlp-console-grid">
        <ConsolePanel title="DRIVE & COMBAT">
          <Gauge label="ENGINE POWER" value={data.systems.engine_power} />
          <Gauge label="FUEL" value={data.fuel.current_percent} />
          <div className="mlp-weapons-row">
            <span className="mlp-gauge-label">WEAPONS</span>
            <span className={`mlp-weapons-badge mlp-weapons-badge--${data.systems.weapons_online ? 'online' : 'offline'}`}>
              {data.systems.weapons_online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div className="mlp-weapons-row">
            <span className="mlp-gauge-label">SHIELDS</span>
            <span className={`mlp-weapons-badge mlp-weapons-badge--${data.systems.shields_online ? 'online' : 'offline'}`}>
              {data.systems.shields_online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </ConsolePanel>

        <ConsolePanel title="HULL & SUPPORT">
          <Gauge label="HULL INTEGRITY" value={data.systems.hull_integrity} />
          <Gauge label="SHIELDS" value={data.systems.shields} />
          <Gauge label="LIFE SUPPORT" value={data.systems.life_support} />
        </ConsolePanel>

        <ConsolePanel title="NAVIGATION">
          <div className="mlp-nav-grid">
            <span className="mlp-nav-label">LOCATION</span>
            <span className="mlp-nav-value">{data.navigation.current_location || '—'}</span>
            <span className="mlp-nav-label">DESTINATION</span>
            <span className="mlp-nav-value">{data.navigation.destination || '—'}</span>
            <span className="mlp-nav-label">SPEED</span>
            <span className="mlp-nav-value">{data.navigation.speed_km_s.toLocaleString()} km/s</span>
            <span className="mlp-nav-label">ETA</span>
            <span className="mlp-nav-value">{data.navigation.eta_hours > 0 ? `${data.navigation.eta_hours}h` : '—'}</span>
          </div>
        </ConsolePanel>

        <ConsolePanel title="CREW MANIFEST">
          <div className="mlp-crew-grid">
            <div className="mlp-crew-stat">
              <span className="mlp-crew-num">{data.crew.total}</span>
              <span className="mlp-crew-lbl">TOTAL</span>
            </div>
            <div className="mlp-crew-stat">
              <span className="mlp-crew-num mlp-gauge-value--good">{data.crew.active}</span>
              <span className="mlp-crew-lbl">ACTIVE</span>
            </div>
            <div className="mlp-crew-stat">
              <span className={`mlp-crew-num ${data.crew.injured > 0 ? 'mlp-gauge-value--warn' : ''}`}>
                {data.crew.injured}
              </span>
              <span className="mlp-crew-lbl">INJURED</span>
            </div>
            <div className="mlp-crew-stat">
              <span className={`mlp-crew-num ${data.crew.inactive_but_healthy > 0 ? 'mlp-gauge-value--warn' : ''}`}>
                {data.crew.inactive_but_healthy}
              </span>
              <span className="mlp-crew-lbl">INACTIVE</span>
            </div>
          </div>
        </ConsolePanel>

        <ConsolePanel title="CARGO MANIFEST">
          <div className="mlp-cargo-header">
            <span className="mlp-nav-label">CAPACITY USED</span>
            <span className="mlp-cargo-usage">
              <span className={`mlp-gauge-value--${cargoPercent >= 80 ? 'good' : cargoPercent >= 50 ? 'warn' : 'crit'}`}>
                {data.cargo.used_tons.toLocaleString()}
              </span>
              <span className="mlp-cargo-slash"> / </span>
              {data.cargo.capacity_tons.toLocaleString()} t ({cargoPercent}%)
            </span>
          </div>
          <div className="mlp-gauge-track mlp-cargo-bar">
            <div
              className={`mlp-gauge-fill mlp-gauge-fill--${cargoPercent >= 80 ? 'good' : cargoPercent >= 50 ? 'warn' : 'crit'}`}
              style={{ width: `${cargoPercent}%` }}
            />
          </div>
          <table className="mlp-cargo-table">
            <thead>
              <tr><th>ITEM</th><th>TONS</th><th>SHARE</th></tr>
            </thead>
            <tbody>
              {data.cargo.manifest.map((row, i) => (
                <tr key={i}>
                  <td>{row.item}</td>
                  <td>{row.tons.toLocaleString()}</td>
                  <td>{Math.round((row.tons / data.cargo.capacity_tons) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ConsolePanel>

        {data.alerts.length > 0 && (
          <ConsolePanel title="ACTIVE ALERTS">
            <div className="mlp-alerts">
              {data.alerts.map((a, i) => (
                <div key={i} className={`mlp-alert mlp-alert--${a.level}`}>
                  <span className="mlp-alert-badge">{a.level.toUpperCase()}</span>
                  <span className="mlp-alert-msg">{a.message}</span>
                </div>
              ))}
            </div>
          </ConsolePanel>
        )}
      </div>
    </div>
  );
}

// ── Fleet page ─────────────────────────────────────────────────────────────

function FleetPage({
  ships,
  shipMetrics,
  onAddShip,
  onSelectShip,
  onRemoveShip,
  onRefreshFleet,
  fleetRefreshing,
}: {
  ships: FleetShip[];
  shipMetrics: Record<string, ShipMetrics>;
  onAddShip: (name: string) => Promise<void>;
  onSelectShip: (name: string) => void;
  onRemoveShip: (name: string) => void;
  onRefreshFleet: () => void;
  fleetRefreshing: boolean;
}) {
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAdd = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setAdding(true);
    setAddError(null);
    try {
      await onAddShip(trimmed);
      setInput('');
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mlp-fleet-wrap">
      <div className="mlp-launch-hero">
        <div className="mlp-launch-badge">ALLIED HENNA FEDERATION</div>
        <h1 className="mlp-launch-title">FLEET COMMAND</h1>
        <p className="mlp-launch-sub">Federation Ship Registry</p>
      </div>

      <div className="mlp-fleet-add-panel">
        <div className="mlp-launch-form-header">
          <div>
            <span className="mlp-launch-form-title">ADD SHIP TO FLEET</span>
            <span className="mlp-launch-form-subtitle" style={{ display: 'block', marginTop: 4 }}>Enter the ship's process identifier</span>
          </div>
          {ships.length > 0 && (
            <button
              className="mlp-refresh-btn"
              onClick={onRefreshFleet}
              disabled={fleetRefreshing}
            >
              {fleetRefreshing ? 'SCANNING…' : '↻ REFRESH FLEET'}
            </button>
          )}
        </div>
        <div className="mlp-fleet-add-row">
          <input
            className="mlp-fleet-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !adding && handleAdd()}
            placeholder="e.g. Rocinante"
            disabled={adding}
          />
          <button
            className="mlp-fleet-add-btn"
            onClick={handleAdd}
            disabled={adding || !input.trim()}
          >
            {adding ? 'VERIFYING…' : 'ADD SHIP'}
          </button>
        </div>
        {addError && <div className="mlp-launch-error">{addError}</div>}
      </div>

      {ships.length === 0 ? (
        <div className="mlp-fleet-empty">No ships registered. Add a ship above to begin.</div>
      ) : (
        <div className="mlp-fleet-grid">
          {ships.map(ship => {
            const m = shipMetrics[ship.name];
            const scanning = !m || m.missions === 'loading';
            return (
              <div
                key={ship.name}
                className="mlp-ship-card"
                onClick={() => onSelectShip(ship.name)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && onSelectShip(ship.name)}
              >
                <div className="mlp-ship-card-header">
                  <span className="mlp-ship-card-name">{ship.name.toUpperCase()}</span>
                  <button
                    className="mlp-ship-card-remove"
                    onClick={e => { e.stopPropagation(); onRemoveShip(ship.name); }}
                    title="Remove from fleet"
                  >
                    ✕
                  </button>
                </div>
                <div className="mlp-ship-card-stats">
                  <div className="mlp-ship-card-stat">
                    <span className="mlp-ship-card-count">
                      {scanning ? '—' : m.missions}
                    </span>
                    <span className="mlp-ship-card-count-label">
                      {scanning ? 'SCANNING…' : 'ACTIVE MISSIONS'}
                    </span>
                  </div>
                  <div className="mlp-ship-card-stat-divider" />
                  <div className="mlp-ship-card-stat">
                    <span className="mlp-ship-card-count">
                      {scanning || m.tasks === 'loading' ? '—' : m.tasks}
                    </span>
                    <span className="mlp-ship-card-count-label">CREW WORK ORDERS</span>
                  </div>
                </div>
                <div className="mlp-ship-card-footer">
                  <span className="mlp-ship-card-arrow">MISSION CONTROL →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Ship mission control (per-ship landing) ────────────────────────────────

function ShipMissionControl({
  shipName,
  onLaunch,
  error,
  instances,
  instancesLoading,
  onSelectInstance,
}: {
  shipName: string;
  onLaunch: () => void;
  error: string | null;
  instances: MissionInstance[];
  instancesLoading: boolean;
  onSelectInstance: (key: string) => void;
}) {
  return (
    <div className="mlp-launch-wrap">
      <div className="mlp-launch-hero">
        <div className="mlp-launch-badge">ALLIED HENNA FEDERATION</div>
        <h1 className="mlp-launch-title">{shipName.toUpperCase()}</h1>
        <p className="mlp-launch-sub">Deep-Space Mission Command Interface</p>
      </div>

      <div className="mlp-launch-form">
        <div className="mlp-launch-form-header">
          <span className="mlp-launch-form-title">MISSION LAUNCH BRIEFING</span>
          <span className="mlp-launch-form-subtitle">Authorised mission commanders only</span>
        </div>
        {error && <div className="mlp-launch-error">{error}</div>}
        <button className="mlp-launch-btn" onClick={onLaunch}>
          INITIATE LAUNCH SEQUENCE
        </button>
      </div>

      <div className="mlp-missions-section">
        <div className="mlp-missions-header">
          <span className="mlp-missions-title">ACTIVE MISSIONS</span>
          {instancesLoading && <span className="mlp-missions-loading">SCANNING…</span>}
        </div>

        {!instancesLoading && instances.length === 0 && (
          <div className="mlp-missions-empty">No active missions detected</div>
        )}

        {instances.map(inst => (
          <button
            key={inst.processInstanceKey}
            className="mlp-mission-row"
            onClick={() => onSelectInstance(inst.processInstanceKey)}
          >
            <div className="mlp-mission-info">
              <span className="mlp-mission-key">
                {inst.missionKey ?? `MISSION ${inst.processInstanceKey.slice(-8).toUpperCase()}`}
              </span>
              {inst.startDate && (
                <span className="mlp-mission-date">
                  {new Date(inst.startDate).toLocaleString()}
                </span>
              )}
            </div>
            <span className="mlp-mission-arrow">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Loading screen ─────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="mlp-loading">
      <div className="mlp-loading-pulse">
        <div className="mlp-loading-dot" />
        <div className="mlp-loading-ring mlp-loading-ring--1" />
        <div className="mlp-loading-ring mlp-loading-ring--2" />
      </div>
      <p className="mlp-loading-title">INITIALIZING SHIP SYSTEMS</p>
      <p className="mlp-loading-sub">Polling onboard telemetry…</p>
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────

export default function MissionLaunchPage({ config }: CustomFormPageProps) {
  const [phase, setPhase] = useState<Phase>('fleet');
  const [fleetShips, setFleetShips] = useState<FleetShip[]>(loadFleetShips);
  const [shipMetrics, setShipMetrics] = useState<Record<string, ShipMetrics>>({});
  const [selectedShip, setSelectedShip] = useState<string | null>(null);

  const [shipStatus, setShipStatus] = useState<ShipStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instanceKey, setInstanceKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeInstances, setActiveInstances] = useState<MissionInstance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [missionKey, setMissionKey] = useState<string | null>(null);
  const [agentContext, setAgentContext] = useState<AgentContext | null>(null);
  const [fleetRefreshing, setFleetRefreshing] = useState(false);

  const fetchShipMetrics = async (ships: FleetShip[]) => {
    if (ships.length === 0) return;
    const initial: Record<string, ShipMetrics> = {};
    ships.forEach(s => { initial[s.name] = { missions: 'loading', tasks: 'loading' }; });
    setShipMetrics(initial);
    const result: Record<string, ShipMetrics> = {};
    await Promise.all(
      ships.map(async ship => {
        const [instances, tasks] = await Promise.allSettled([
          listActiveProcessInstances(ship.name),
          countActiveUserTasksForProcess(ship.name),
        ]);
        result[ship.name] = {
          missions: instances.status === 'fulfilled' ? instances.value.length : 0,
          tasks: tasks.status === 'fulfilled' ? tasks.value : 0,
        };
      })
    );
    setShipMetrics(result);
  };

  useEffect(() => {
    if (phase === 'fleet') {
      fetchShipMetrics(fleetShips);
    }
  }, [phase]);

  const handleAddShip = async (name: string) => {
    if (fleetShips.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`"${name}" is already registered in the fleet`);
    }
    await getProcessDefinitionKey(name);
    const updated = [...fleetShips, { name }];
    setFleetShips(updated);
    saveFleetShips(updated);
    setShipMetrics(prev => ({ ...prev, [name]: { missions: 'loading', tasks: 'loading' } }));
    const [instances, tasks] = await Promise.allSettled([
      listActiveProcessInstances(name),
      countActiveUserTasksForProcess(name),
    ]);
    setShipMetrics(prev => ({
      ...prev,
      [name]: {
        missions: instances.status === 'fulfilled' ? instances.value.length : 0,
        tasks: tasks.status === 'fulfilled' ? tasks.value : 0,
      },
    }));
  };

  const handleRemoveShip = (name: string) => {
    const updated = fleetShips.filter(s => s.name !== name);
    setFleetShips(updated);
    saveFleetShips(updated);
    setShipMetrics(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleRefreshFleet = async () => {
    if (fleetRefreshing) return;
    setFleetRefreshing(true);
    const staleNames: string[] = [];
    const result: Record<string, ShipMetrics> = {};
    await Promise.all(
      fleetShips.map(async ship => {
        try {
          await getProcessDefinitionKey(ship.name);
          const [instances, tasks] = await Promise.allSettled([
            listActiveProcessInstances(ship.name),
            countActiveUserTasksForProcess(ship.name),
          ]);
          result[ship.name] = {
            missions: instances.status === 'fulfilled' ? instances.value.length : 0,
            tasks: tasks.status === 'fulfilled' ? tasks.value : 0,
          };
        } catch {
          staleNames.push(ship.name);
        }
      })
    );
    setShipMetrics(result);
    if (staleNames.length > 0) {
      const updated = fleetShips.filter(s => !staleNames.includes(s.name));
      setFleetShips(updated);
      saveFleetShips(updated);
    }
    setFleetRefreshing(false);
  };

  const handleSelectShip = (name: string) => {
    setSelectedShip(name);
    setError(null);
    setPhase('ship');
    fetchActiveInstancesForShip(name);
  };

  const fetchActiveInstancesForShip = async (processId: string) => {
    setInstancesLoading(true);
    try {
      const items = await listActiveProcessInstances(processId);
      const enriched = await Promise.all(
        items.map(async inst => {
          try {
            const vars = await getProcessInstanceVariables(inst.processInstanceKey);
            return { ...inst, missionKey: (vars.missionKey as string) ?? undefined };
          } catch {
            return inst;
          }
        })
      );
      setActiveInstances(enriched);
    } catch {
      // non-fatal
    } finally {
      setInstancesLoading(false);
    }
  };

  const handleLaunch = async () => {
    if (!selectedShip) return;
    setError(null);
    setPhase('loading');
    try {
      const defKey = await getProcessDefinitionKey(selectedShip);
      const instance = await startProcessInstance(defKey, {});
      setInstanceKey(instance.processInstanceKey);
      const [result, ctx] = await Promise.all([
        pollForShipStatus(instance.processInstanceKey),
        getAgentContext(instance.processInstanceKey),
      ]);
      setShipStatus(result.shipStatus);
      setMissionKey(result.missionKey);
      setAgentContext(ctx);
      setPhase('console');
    } catch (e) {
      setError((e as Error).message);
      setPhase('ship');
      if (selectedShip) fetchActiveInstancesForShip(selectedShip);
    }
  };

  const handleSelectInstance = async (key: string) => {
    setError(null);
    setPhase('loading');
    setInstanceKey(key);
    try {
      const [vars, ctx] = await Promise.all([
        getProcessInstanceVariables(key),
        getAgentContext(key),
      ]);
      setAgentContext(ctx);
      if (vars.shipStatus) {
        setShipStatus(vars.shipStatus as ShipStatus);
        setMissionKey((vars.missionKey as string) ?? null);
        setPhase('console');
      } else {
        const result = await pollForShipStatus(key);
        setShipStatus(result.shipStatus);
        setMissionKey(result.missionKey);
        setPhase('console');
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase('ship');
    }
  };

  const handleRefresh = async () => {
    if (!instanceKey || refreshing) return;
    setRefreshing(true);
    try {
      const [vars, ctx] = await Promise.all([
        getProcessInstanceVariables(instanceKey),
        getAgentContext(instanceKey),
      ]);
      if (vars.shipStatus) setShipStatus(vars.shipStatus as ShipStatus);
      if (vars.missionKey) setMissionKey(vars.missionKey as string);
      setAgentContext(ctx);
    } catch {
      // silently ignore transient errors
    } finally {
      setRefreshing(false);
    }
  };

  const handleBackToFleet = () => {
    setPhase('fleet');
    setSelectedShip(null);
    setActiveInstances([]);
    setError(null);
  };

  const handleBackToShip = () => {
    setPhase('ship');
    setShipStatus(null);
    setInstanceKey(null);
    setMissionKey(null);
    setAgentContext(null);
    if (selectedShip) fetchActiveInstancesForShip(selectedShip);
  };

  let navBack: React.ReactNode;
  if (phase === 'console') {
    navBack = (
      <button className="mlp-nav-back mlp-nav-back-btn" onClick={handleBackToShip}>
        ← Active Missions
      </button>
    );
  } else if (phase === 'ship' || phase === 'loading') {
    navBack = (
      <button className="mlp-nav-back mlp-nav-back-btn" onClick={handleBackToFleet}>
        ← Fleet
      </button>
    );
  } else {
    navBack = <Link to="/" className="mlp-nav-back">← Demo Hub</Link>;
  }

  return (
    <div className="mlp-root">
      <nav className="mlp-nav">
        <img src={config.branding.logo} alt="Allied Henna Federation" className="mlp-nav-logo" />
        {navBack}
      </nav>

      <main className="mlp-main">
        {phase === 'fleet' && (
          <FleetPage
            ships={fleetShips}
            shipMetrics={shipMetrics}
            onAddShip={handleAddShip}
            onSelectShip={handleSelectShip}
            onRemoveShip={handleRemoveShip}
            onRefreshFleet={handleRefreshFleet}
            fleetRefreshing={fleetRefreshing}
          />
        )}
        {phase === 'ship' && selectedShip && (
          <ShipMissionControl
            shipName={selectedShip}
            onLaunch={handleLaunch}
            error={error}
            instances={activeInstances}
            instancesLoading={instancesLoading}
            onSelectInstance={handleSelectInstance}
          />
        )}
        {phase === 'loading' && <LoadingScreen />}
        {phase === 'console' && shipStatus && (
          <ShipConsole
            data={shipStatus}
            missionKey={missionKey}
            agentContext={agentContext}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
        )}
      </main>
    </div>
  );
}
