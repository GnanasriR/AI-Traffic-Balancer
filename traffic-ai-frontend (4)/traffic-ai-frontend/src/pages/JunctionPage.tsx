import React, { useState } from 'react';
import { useSignalSync } from '../hooks/useSignalSync';
import { SimCanvas } from '../components/SimCanvas';
import { DIRS, DIRNAME } from '../services/signalsyncEngine';
import type { PageId } from '../components/Shell';
import type { Direction } from '../types/signalsync';

interface JunctionPageProps {
  onNavigate: (page: PageId) => void;
}

const ALL_12_MOVEMENTS: {
  from: string;
  to: string;
  fromCode: Direction;
  toCode: Direction;
  type: string;
  key: string;
}[] = [
  { from: 'South', to: 'North', fromCode: 'S', toCode: 'N', type: 'Straight (Through)', key: 'S->N' },
  { from: 'South', to: 'East',  fromCode: 'S', toCode: 'E', type: 'Right Turn',          key: 'S->E' },
  { from: 'South', to: 'West',  fromCode: 'S', toCode: 'W', type: 'Left Turn',           key: 'S->W' },

  { from: 'North', to: 'South', fromCode: 'N', toCode: 'S', type: 'Straight (Through)', key: 'N->S' },
  { from: 'North', to: 'West',  fromCode: 'N', toCode: 'W', type: 'Right Turn',          key: 'N->W' },
  { from: 'North', to: 'East',  fromCode: 'N', toCode: 'E', type: 'Left Turn',           key: 'N->E' },

  { from: 'East',  to: 'West',  fromCode: 'E', toCode: 'W', type: 'Straight (Through)', key: 'E->W' },
  { from: 'East',  to: 'North', fromCode: 'E', toCode: 'N', type: 'Right Turn',          key: 'E->N' },
  { from: 'East',  to: 'South', fromCode: 'E', toCode: 'S', type: 'Left Turn',           key: 'E->S' },

  { from: 'West',  to: 'East',  fromCode: 'W', toCode: 'E', type: 'Straight (Through)', key: 'W->E' },
  { from: 'West',  to: 'South', fromCode: 'W', toCode: 'S', type: 'Right Turn',          key: 'W->S' },
  { from: 'West',  to: 'North', fromCode: 'W', toCode: 'N', type: 'Left Turn',           key: 'W->N' },
];

export const JunctionPage: React.FC<JunctionPageProps> = ({ onNavigate: _onNavigate }) => {
  const { snapshot, command } = useSignalSync();
  const s = snapshot;
  const ph = s?.phase;
  const emergency = s?.emergency;

  const [selectedMovement, setSelectedMovement] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleDemandChange = (dir: Direction, val: number) => {
    command('demand', { dir, value: val });
  };

  const handleSelectScenario = (scId: string, scName: string) => {
    command('scenario', { scenario: scId });
    showToast(`Traffic Scenario Activated: ${scName}`);
  };

  const handleReportEmergency = (dir: Direction) => {
    command('emergency', { dir });
    const isActive = emergency?.active && emergency.dir === dir;
    showToast(
      isActive
        ? `Emergency preemption cancelled for ${DIRNAME[dir]} approach`
        : `[ALERT] Emergency Preemption Requested: Priority clearing for ${DIRNAME[dir]} approach`
    );
  };

  const handleDispatchAmbulance = (dir?: Direction | 'RANDOM') => {
    command('dispatch_ambulance', { dir: dir || 'RANDOM' });
    if (dir && dir !== 'RANDOM') {
      showToast(`[AMBULANCE DISPATCHED] Emergency Medical Unit approaching on ${DIRNAME[dir]} approach`);
    } else {
      showToast(`[AMBULANCE DISPATCHED] Emergency Medical Unit dispatched on random approach`);
    }
  };

  const handleToggleIncident = (dir: Direction) => {
    command('toggle_incident', { dir });
    const isArmIncident = s?.incident?.active && s.incident.dir === dir;
    showToast(
      isArmIncident
        ? `Incident cleared on ${DIRNAME[dir]} approach — all lanes restored`
        : `[INCIDENT ACTIVATED] Collision simulated on ${DIRNAME[dir]} approach (Lane 1 Blocked)`
    );
  };

  return (
    <>
      {toastMsg && <div className="toast">{toastMsg}</div>}

      {/* ── 1. Emergency Preemption Control Toolbar ────────────────── */}
      <div
        className="card pad"
        style={{
          background: emergency?.active ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface)',
          borderColor: emergency?.active ? '#EF4444' : 'var(--line)',
        }}
      >
        <div className="between" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div className="row" style={{ gap: '8px' }}>
              <span className="tag r" style={{ fontSize: '11px', fontWeight: 700 }}>EVP</span>
              <strong style={{ fontSize: '14.5px' }}>Emergency Vehicle Preemption (EVP) &amp; Ambulance Dispatch</strong>
            </div>
            <p className="muted" style={{ fontSize: '12px', marginTop: '2px' }}>
              Deploys a high-speed emergency ambulance vehicle with flashing sirens and automatically clears conflicting phases to open an exclusive green wave.
            </p>
          </div>

          {/* Quick Preemption Buttons per Approach */}
          <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="btn small"
              style={{
                background: '#DC2626',
                borderColor: '#B91C1C',
                color: '#fff',
                fontWeight: 700,
              }}
              onClick={() => handleDispatchAmbulance('RANDOM')}
            >
              <span>🚑 Dispatch Ambulance (Random Approach)</span>
            </button>
            {DIRS.map((d) => {
              const isArmEmergency = emergency?.active && emergency.dir === d;
              return (
                <button
                  key={d}
                  className={`btn small ${isArmEmergency ? '' : 'ghost'}`}
                  style={{
                    background: isArmEmergency ? '#DC2626' : undefined,
                    borderColor: isArmEmergency ? '#B91C1C' : undefined,
                    color: isArmEmergency ? '#fff' : undefined,
                    fontWeight: 600,
                  }}
                  onClick={() => (isArmEmergency ? handleReportEmergency(d) : handleDispatchAmbulance(d))}
                >
                  <span>{isArmEmergency ? 'Cancel Preemption' : `Dispatch (${DIRNAME[d]})`}</span>
                </button>
              );
            })}
          </div>
        </div>

        {emergency?.active && emergency.dir && (
          <div
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              background: '#FEE2E2',
              borderRadius: '6px',
              color: '#991B1B',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              <strong>PREEMPTION ACTIVE:</strong> Emergency Ambulance en-route on <strong>{DIRNAME[emergency.dir]} approach</strong> ({Math.ceil(emergency.remaining)}s remaining) &mdash; Green corridor held open.
            </span>
            <button
              className="btn small"
              style={{ background: '#DC2626', padding: '3px 8px', fontSize: '11px' }}
              onClick={() => handleReportEmergency(emergency.dir!)}
            >
              Cancel Preemption
            </button>
          </div>
        )}
      </div>

      {/* ── 2. Incident & Collision Simulation Toolbar ────────────────── */}
      <div
        className="card pad"
        style={{
          background: s?.incident?.active ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface)',
          borderColor: s?.incident?.active ? '#EF4444' : 'var(--line)',
        }}
      >
        <div className="between" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div className="row" style={{ gap: '8px' }}>
              <span className="tag r" style={{ fontSize: '11px', fontWeight: 700 }}>INCIDENT</span>
              <strong style={{ fontSize: '14.5px' }}>Accident &amp; Roadway Lane Blockage Simulation</strong>
            </div>
            <p className="muted" style={{ fontSize: '12px', marginTop: '2px' }}>
              Simulates a physical multi-vehicle collision. Vehicles stop strictly behind safety cones; dispatch ambulance to clear or respond.
            </p>
          </div>

          <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            {DIRS.map((d) => {
              const isArmIncident = s?.incident?.active && s.incident.dir === d;
              return (
                <button
                  key={d}
                  className={`btn small ${isArmIncident ? '' : 'ghost'}`}
                  style={{
                    background: isArmIncident ? '#DC2626' : undefined,
                    borderColor: isArmIncident ? '#B91C1C' : undefined,
                    color: isArmIncident ? '#fff' : undefined,
                    fontWeight: 600,
                  }}
                  onClick={() => handleToggleIncident(d)}
                >
                  <span>{isArmIncident ? 'Clear Incident' : `Simulate ${DIRNAME[d]} Accident`}</span>
                </button>
              );
            })}
          </div>
        </div>

        {s?.incident?.active && (
          <div
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              background: '#FEE2E2',
              borderRadius: '6px',
              color: '#991B1B',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span>
              <strong>ACCIDENT ACTIVE:</strong> Two collided vehicles blocking Lane 1 on <strong>{DIRNAME[s.incident.dir]} approach</strong>. Vehicles queuing strictly behind cones.
            </span>
            <div className="row" style={{ gap: '6px' }}>
              <button
                className="btn small"
                style={{ background: '#2563EB', padding: '3px 10px', fontSize: '11px', color: '#fff' }}
                onClick={() => handleDispatchAmbulance(s.incident!.dir)}
              >
                Dispatch Ambulance
              </button>
              <button
                className="btn small"
                style={{ background: '#DC2626', padding: '3px 10px', fontSize: '11px', color: '#fff' }}
                onClick={() => handleToggleIncident(s.incident!.dir)}
              >
                Clear Accident
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Simulation Canvas (480px) with Active Movement Highlight ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="panelhead">
          <div className="row" style={{ gap: '10px' }}>
            <strong style={{ fontSize: '15px' }}>Junction J1 &mdash; Gandhipuram Central</strong>
            {selectedMovement && (
              <span className="tag b" style={{ fontSize: '11px' }}>
                Highlighting Path: {selectedMovement}
              </span>
            )}
          </div>
          <div className="row" style={{ gap: '8px' }}>
            <span className="tag g">{ph?.shortLabel || 'Phase Active'}</span>
          </div>
        </div>

        <div style={{ padding: '14px', background: 'var(--surface-2, #F7F9FA)', display: 'flex', justifyContent: 'center' }}>
          <SimCanvas highlightMovement={selectedMovement} style={{ width: '100%', maxWidth: '1050px' }} />
        </div>

        {/* Live Arm Telemetry Bar with Anomaly Alert Badges */}
        <div className="stage-foot" style={{ borderTop: '1px solid var(--line-2)' }}>
          {DIRS.map((d) => {
            const a = s?.approaches[d];
            const isGreen = ph?.state === 'green' && ph.activeArm === d;
            const isYellow = ph?.state === 'yellow' && ph.activeArm === d;
            const statusClass = isGreen ? 'tag g' : isYellow ? 'tag a' : 'tag r';
            const statusText = isGreen ? 'GREEN' : isYellow ? 'YELLOW' : 'RED';
            const demandVpm = s?.control?.demand?.[d] ?? 0;
            return (
              <div key={d}>
                <div className="between">
                  <div className="k" style={{ fontWeight: 600 }}>
                    {DIRNAME[d]} Approach
                  </div>
                  <span className={statusClass} style={{ fontSize: '10px' }}>
                    {statusText}
                  </span>
                </div>
                <div className="row" style={{ gap: '8px', alignItems: 'baseline' }}>
                  <div className="num v" style={{ fontSize: '26px' }}>
                    {a?.queue ?? 0}
                  </div>
                  <span className="muted" style={{ fontSize: '11px' }}>waiting</span>
                  {a?.anomaly && (
                    <span
                      className="tag r pulse"
                      style={{ fontSize: '9px', padding: '1px 6px' }}
                      title={a.anomalyReason || 'Unusual congestion spike'}
                    >
                      Surge Anomaly
                    </span>
                  )}
                  {s?.incident?.active && s.incident.dir === d && (
                    <span
                      className="tag r"
                      style={{ fontSize: '9px', padding: '1px 6px', fontWeight: 700 }}
                      title="Lane 1 blocked by accident"
                    >
                      ACCIDENT (Lane 1 Blocked)
                    </span>
                  )}
                </div>
                <div className="muted" style={{ fontSize: '11.5px' }}>
                  On road: <strong>{a?.count ?? 0}</strong> veh &middot; Wait:{' '}
                  <strong>{(a?.wait ?? 0).toFixed(0)}</strong>s &middot; Demand:{' '}
                  <strong>{demandVpm}</strong> vpm
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. Explainability Panel ("Why this plan?") ──────────────── */}
      <div className="card">
        <div className="panelhead">
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Why this plan? (AI Explainability)</h3>
            <p className="muted" style={{ fontSize: '12px', marginTop: '2px' }}>
              Real-time feature attribution showing the top driving factors behind the current green split allocation.
            </p>
          </div>
          <span className="tag g" style={{ fontSize: '11px' }}>
            &check; Model Reasoning Live
          </span>
        </div>
        <div className="pad" style={{ paddingTop: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {(s?.explain || []).map((item, idx) => {
              const absImpact = Math.abs(item.impact);
              const barColor = item.positive ? 'var(--green-live, #1F9D62)' : 'var(--red, #C7413F)';
              return (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--surface-2)',
                    borderRadius: '8px',
                    border: '1px solid var(--line-2)',
                  }}
                >
                  <div className="between">
                    <strong style={{ fontSize: '13.5px' }}>{item.feature}</strong>
                    <span
                      className={item.positive ? 'tag g' : 'tag r'}
                      style={{ fontSize: '11px', fontWeight: 700 }}
                    >
                      {item.positive ? `+${item.impact}% Split Boost` : `${item.impact}% Split Reduced`}
                    </span>
                  </div>
                  <div className="between" style={{ marginTop: '8px', fontSize: '12.5px' }}>
                    <span className="muted">{item.value}</span>
                    <span className="muted">{item.reason}</span>
                  </div>
                  <div className="meter" style={{ margin: '8px 0 2px', height: '6px' }}>
                    <i style={{ width: `${Math.min(100, absImpact * 2)}%`, background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 6. Interactive Movements & Permissions Matrix Table ────── */}
      <div className="card">
        <div className="panelhead">
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Live Indian 12-Movement Signal State Matrix</h3>
            <p className="muted" style={{ fontSize: '12px', marginTop: '2px' }}>
              Click any row below to visually project that path on the canvas and inspect conflict safety rules.
            </p>
          </div>
          <div className="row" style={{ gap: '10px' }}>
            {selectedMovement && (
              <button className="btn ghost small" onClick={() => setSelectedMovement(null)}>
                Clear Path Highlight
              </button>
            )}
            <div className="phaseclock">
              <span className="num t" style={{ fontSize: '30px' }}>
                {Math.ceil(ph?.remaining ?? 0)}
              </span>
              <span className="muted" style={{ fontSize: '12px' }}>
                s in current stage
              </span>
            </div>
          </div>
        </div>

        <div className="pad" style={{ paddingTop: '8px' }}>
          <div
            className="between"
            style={{
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '14px',
              padding: '12px 14px',
              background: 'var(--surface-2)',
              borderRadius: '8px',
            }}
          >
            <div className="row" style={{ gap: '8px' }}>
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background:
                    ph?.state === 'green'
                      ? 'var(--green-live)'
                      : ph?.state === 'yellow'
                      ? 'var(--amber)'
                      : 'var(--red)',
                  display: 'inline-block',
                }}
              />
              <strong style={{ fontSize: '15px' }}>{ph?.label}</strong>
            </div>
            <div className="row" style={{ gap: '14px', fontSize: '12.5px' }}>
              <span>
                Indian Split-Phasing: <strong>1 Arm at a Time (100% Conflict-Free)</strong>
              </span>
            </div>
          </div>

          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Movement</th>
                  <th>Type</th>
                  <th>Signal Status</th>
                  <th>Conflict Guarantee</th>
                  <th>Demo Action</th>
                </tr>
              </thead>
              <tbody>
                {ALL_12_MOVEMENTS.map((m) => {
                  const isArmGreen = ph?.state === 'green' && ph.activeArm === m.fromCode;
                  const isSelected = selectedMovement === m.key;

                  let statusBadge: React.ReactNode;
                  let reason: React.ReactNode;

                  if (isArmGreen) {
                    statusBadge = (
                      <span className="tag g" style={{ fontWeight: 600 }}>
                        &check; Green Flow
                      </span>
                    );
                    reason = (
                      <span style={{ color: 'var(--green)' }}>
                        Active Stage &mdash; Full right-of-way. All other 3 arms held on RED. Zero clash.
                      </span>
                    );
                  } else {
                    statusBadge = <span className="tag r">&cross; STOP ON RED</span>;
                    if (ph?.state === 'yellow' && ph.activeArm === m.fromCode) {
                      reason = (
                        <span className="muted">
                          Yellow clearance &mdash; only clearing vehicles finish; stopped vehicles stay held.
                        </span>
                      );
                    } else if (ph?.state === 'allred') {
                      reason = <span className="muted">All-Red safety clearance interval.</span>;
                    } else {
                      reason = (
                        <span className="muted">
                          Strictly held behind white stop line on RED while {DIRNAME[ph?.activeArm || 'S']} arm clears.
                        </span>
                      );
                    }
                  }

                  const bg = isSelected
                    ? 'rgba(37, 99, 235, 0.12)'
                    : isArmGreen
                    ? 'rgba(31, 157, 98, 0.06)'
                    : undefined;

                  return (
                    <tr
                      key={m.key}
                      style={{
                        background: bg,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onClick={() => setSelectedMovement(isSelected ? null : m.key)}
                    >
                      <td>
                        <strong>{m.from}</strong>
                      </td>
                      <td>{m.to}</td>
                      <td>
                        <code style={{ background: isSelected ? '#DBEAFE' : undefined }}>{m.key}</code>
                      </td>
                      <td>{m.type}</td>
                      <td>{statusBadge}</td>
                      <td style={{ fontSize: '12.5px' }}>{reason}</td>
                      <td>
                        <button
                          className={`btn small ${isSelected ? '' : 'ghost'}`}
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMovement(isSelected ? null : m.key);
                          }}
                        >
                          {isSelected ? 'Inspecting' : 'Show Trajectory'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divider" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            <div>
              <div className="lbl">Stage 1 (South Arm)</div>
              <div className="num" style={{ fontSize: '20px' }}>
                {ph?.plan.S ?? 22}s
              </div>
            </div>
            <div>
              <div className="lbl">Stage 2 (North Arm)</div>
              <div className="num" style={{ fontSize: '20px' }}>
                {ph?.plan.N ?? 24}s
              </div>
            </div>
            <div>
              <div className="lbl">Stage 3 (East Arm)</div>
              <div className="num" style={{ fontSize: '20px' }}>
                {ph?.plan.E ?? 18}s
              </div>
            </div>
            <div>
              <div className="lbl">Stage 4 (West Arm)</div>
              <div className="num" style={{ fontSize: '20px' }}>
                {ph?.plan.W ?? 16}s
              </div>
            </div>
            <div>
              <div className="lbl">Total Cycle</div>
              <div className="num" style={{ fontSize: '20px' }}>
                {ph?.plan.cycle ?? 98}s
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Telemetry Table & Arrival Rate Sliders ─────────────────── */}
      <div className="two">
        <div className="card">
          <div className="panelhead">
            <h3>Approach Sensor Readings</h3>
            <span className="muted">telemetry with anomaly watch</span>
          </div>
          <div className="scroll-x pad" style={{ paddingTop: '4px' }}>
            <table>
              <thead>
                <tr>
                  <th>Approach</th>
                  <th>Vehicles</th>
                  <th>Queue</th>
                  <th>Wait</th>
                  <th>Speed</th>
                  <th>Density</th>
                  <th>Congestion</th>
                  <th>Trend</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {DIRS.map((d) => {
                  const a = s?.approaches[d];
                  if (!a) return null;
                  const isGreen = ph?.state === 'green' && ph.activeArm === d;
                  const tagClass = a.level === 'HIGH' ? 'tag r' : a.level === 'MEDIUM' ? 'tag a' : 'tag g';
                  return (
                    <tr key={d}>
                      <td>
                        <div className="row" style={{ gap: '6px' }}>
                          <strong>{DIRNAME[d]}</strong>
                          {a.anomaly && (
                            <span
                              className="dot pulse"
                              style={{ background: '#DC2626' }}
                              title={a.anomalyReason}
                            />
                          )}
                        </div>
                      </td>
                      <td className="num">{a.count}</td>
                      <td className="num">
                        {a.queue}
                        {a.anomaly && (
                          <span style={{ color: '#DC2626', fontSize: '10px', marginLeft: '4px' }}>
                            ▲ Surge
                          </span>
                        )}
                      </td>
                      <td className="num">{a.wait.toFixed(1)}s</td>
                      <td className="num">{a.speed.toFixed(0)} km/h</td>
                      <td>
                        {(() => {
                          const densPct = Math.min(100, Math.max(0, Math.round((a.density > 1.0 ? a.density / 100.0 : a.density) * 100)));
                          return (
                            <span className="meter" style={{ display: 'inline-block', width: '60px' }}>
                              <i
                                style={{
                                  width: `${densPct}%`,
                                  background: 'var(--green)',
                                }}
                              />
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        <span className={tagClass}>{a.level}</span>
                      </td>
                      <td className="muted">{a.trend}</td>
                      <td>
                        <span className={isGreen ? 'tag g' : 'tag r'}>
                          {isGreen ? 'Green' : 'Red'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Arrival Rate Demand & Scenarios */}
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <div className="panelhead">
              <div>
                <h3>Traffic Demand &amp; Scenarios</h3>
                <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                  Inject asymmetric flows to test adaptive green balancing
                </div>
              </div>
              <span className="tag b" style={{ fontSize: '10px' }}>
                {s?.control?.scenario ?? 'ASYMMETRIC'}
              </span>
            </div>

            {/* Scenario Quick Presets */}
            <div className="pad" style={{ paddingBottom: '8px' }}>
              <span className="lbl" style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                Traffic Flow Presets:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                <button
                  className="btn sub"
                  style={{
                    fontSize: '11px',
                    padding: '6px 8px',
                    textAlign: 'left',
                    borderColor: s?.control?.scenario === 'ASYMMETRIC_CORRIDOR' ? 'var(--blue)' : undefined,
                    background: s?.control?.scenario === 'ASYMMETRIC_CORRIDOR' ? 'rgba(42, 91, 215, 0.08)' : undefined
                  }}
                  onClick={() => handleSelectScenario('ASYMMETRIC_CORRIDOR', 'Asymmetric Rush (East Heavy Inbound)')}
                  title="East 60 VPM (Heavy), North 45 VPM (Medium-Heavy), South 22 VPM, West 10 VPM (Light)"
                >
                  ⚡ <strong>Asymmetric Rush</strong>
                  <div style={{ fontSize: '9.5px', color: 'var(--muted)' }}>East 60 · West 10 VPM</div>
                </button>
                <button
                  className="btn sub"
                  style={{
                    fontSize: '11px',
                    padding: '6px 8px',
                    textAlign: 'left',
                    borderColor: s?.control?.scenario === 'NORTH_SOUTH_ARTERIAL' ? 'var(--blue)' : undefined,
                    background: s?.control?.scenario === 'NORTH_SOUTH_ARTERIAL' ? 'rgba(42, 91, 215, 0.08)' : undefined
                  }}
                  onClick={() => handleSelectScenario('NORTH_SOUTH_ARTERIAL', 'N-S Highway Corridor')}
                  title="North 58 VPM, South 54 VPM, East 12 VPM, West 10 VPM"
                >
                  🚗 <strong>N-S Highway</strong>
                  <div style={{ fontSize: '9.5px', color: 'var(--muted)' }}>N/S 58 · E/W 10 VPM</div>
                </button>
                <button
                  className="btn sub"
                  style={{
                    fontSize: '11px',
                    padding: '6px 8px',
                    textAlign: 'left',
                    borderColor: s?.control?.scenario === 'EAST_WEST_SURGE' ? 'var(--blue)' : undefined,
                    background: s?.control?.scenario === 'EAST_WEST_SURGE' ? 'rgba(42, 91, 215, 0.08)' : undefined
                  }}
                  onClick={() => handleSelectScenario('EAST_WEST_SURGE', 'East-West Tidal Commute')}
                  title="East 65 VPM, West 50 VPM, North 12 VPM, South 12 VPM"
                >
                  🌆 <strong>East-West Surge</strong>
                  <div style={{ fontSize: '9.5px', color: 'var(--muted)' }}>E/W 65 · N/S 12 VPM</div>
                </button>
                <button
                  className="btn sub"
                  style={{
                    fontSize: '11px',
                    padding: '6px 8px',
                    textAlign: 'left',
                    borderColor: s?.control?.scenario === 'BALANCED' ? 'var(--blue)' : undefined,
                    background: s?.control?.scenario === 'BALANCED' ? 'rgba(42, 91, 215, 0.08)' : undefined
                  }}
                  onClick={() => handleSelectScenario('BALANCED', 'Balanced Off-Peak')}
                  title="Symmetric 25 VPM across all arms"
                >
                  ⚖️ <strong>Balanced Off-Peak</strong>
                  <div style={{ fontSize: '9.5px', color: 'var(--muted)' }}>Equal 25 VPM each</div>
                </button>
              </div>
            </div>

            {/* Per-Approach Arrival Rate Sliders */}
            <div className="pad" style={{ paddingTop: '4px' }}>
              <div className="divider" style={{ margin: '4px 0 10px' }} />
              <span className="lbl" style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                Per-Approach Arrival Rate Sliders (Vehicles / Minute):
              </span>
              {DIRS.map((d) => {
                const curVal = s?.control.demand[d] ?? 30;
                const flowType = curVal >= 55 ? 'Heavy Corridor' : curVal >= 35 ? 'Moderate' : curVal >= 18 ? 'Collector' : 'Light Side';
                const flowColor = curVal >= 55 ? 'var(--red, #C7413F)' : curVal >= 35 ? 'var(--amber, #C8860D)' : curVal >= 18 ? 'var(--blue, #2A5BD7)' : 'var(--green-live, #1F9D62)';
                return (
                  <div key={d} style={{ marginTop: '8px' }}>
                    <div className="between" style={{ fontSize: '12px' }}>
                      <span className="lbl">
                        <strong>{DIRNAME[d]}</strong>
                        <span style={{ fontSize: '10.5px', color: flowColor, marginLeft: '6px', fontWeight: 600 }}>
                          [{flowType}]
                        </span>
                      </span>
                      <span className="num" style={{ fontSize: '12px', color: flowColor }}>
                        {Math.round(curVal)} veh/min
                      </span>
                    </div>
                    <input
                      type="range"
                      className="slider"
                      min={5}
                      max={80}
                      step={1}
                      value={curVal}
                      onChange={(e) => handleDemandChange(d, parseFloat(e.target.value))}
                    />
                  </div>
                );
              })}
            </div>
            <div className="pad" style={{ paddingTop: 0 }}>
              <p className="muted" style={{ fontSize: '11px', lineHeight: 1.4, margin: 0 }}>
                💡 <strong>Why Asymmetry Matters:</strong> Fixed-time signals allocate equal green to empty and congested roads, causing massive delay. The Adaptive AI allocates green proportionally, gapping out early on light roads to prioritize heavy queues.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
