import React, { useState } from 'react';
import { useSignalSync } from '../hooks/useSignalSync';
import { NetworkMapSVG } from '../components/NetworkMapSVG';
import { IcoAlert, IcoCheck } from '../components/Icons';
import { DIRS, DIRNAME } from '../services/signalsyncEngine';
import type { PageId } from '../components/Shell';

interface DashboardPageProps {
  onNavigate: (page: PageId) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { snapshot } = useSignalSync();
  const s = snapshot;
  const ph = s?.phase;
  const t = s?.totals;

  const [videoError, setVideoError] = useState(false);

  const worstDir = s && s.approaches
    ? DIRS.reduce((a, b) => ((s.approaches[a]?.score ?? 0) > (s.approaches[b]?.score ?? 0) ? a : b))
    : 'N';

  const totalQueue = s && s.approaches ? DIRS.reduce((sum, d) => sum + (s.approaches[d]?.queue ?? 0), 0) : 0;
  const avgSpeed = s && s.approaches
    ? (DIRS.reduce((sum, d) => sum + (s.approaches[d]?.speed ?? 40), 0) / 4).toFixed(0)
    : '46';

  const loadColor = (val: number) =>
    val > 0.66 ? 'var(--red, #C7413F)' : val > 0.33 ? 'var(--amber, #C8860D)' : 'var(--green-live, #1F9D62)';

  return (
    <>
      {/* Top Corridor Banner */}
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '4px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Corridor Operations Command Center</h2>
          <p className="muted">Coimbatore Smart Traffic Grid — 4 Coordinated Junctions · AI Green Wave Active</p>
        </div>
        <div className="row" style={{ gap: '8px' }}>
          <button className="btn small" onClick={() => onNavigate('junction')}>
            Open Live Junction Twin &rarr;
          </button>
        </div>
      </div>

      {/* Corridor KPI Cards */}
      <div className="kpis">
        <div className="kpi">
          <div className="k">Vehicles at the junction</div>
          <div className="num v">{t?.inJunction ?? 0}</div>
          <div className="d">{totalQueue} waiting at the stop line</div>
        </div>
        <div className="kpi">
          <div className="k">Average wait</div>
          <div className="num v">
            <span>{t?.avgWait ? t.avgWait.toFixed(1) : '0'}</span>
            <small>s</small>
          </div>
          <div className="d">
            {t?.savings && t.savings > 0 ? `${t.savings.toFixed(0)}% under fixed plan` : 'measuring…'}
          </div>
        </div>
        <div className="kpi">
          <div className="k">Average speed</div>
          <div className="num v">
            <span>{avgSpeed}</span>
            <small>km/h</small>
          </div>
          <div className="d">across all approaches</div>
        </div>
        <div className="kpi">
          <div className="k">Cleared</div>
          <div className="num v">{t?.cleared ?? 0}</div>
          <div className="d">since the feed opened</div>
        </div>
        <div className="kpi">
          <div className="k">Congestion</div>
          <div className="num v">{s?.approaches[worstDir]?.level ?? 'LOW'}</div>
          <div className="d">
            {DIRNAME[worstDir]} &middot; {s?.approaches[worstDir]?.trend ?? 'steady'}
          </div>
        </div>
      </div>

      {/* 4-Camera Quad Surveillance Command Feed */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="panelhead">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📷</span> 4-Camera Multi-Angle Quad Surveillance Grid
            <span className="tag g" style={{ fontSize: '11px', marginLeft: '4px' }}>
              <span className="dot pulse" /> 4-CAM REAL-TIME
            </span>
          </h3>
          <span className="muted" style={{ fontSize: '12px' }}>
            4 Dedicated Approaches (North, South, East, West) &middot; YOLOv8n Detection &middot; XGBoost Feed
          </span>
        </div>
        <div style={{ position: 'relative', background: '#0a0a0f', borderRadius: '0 0 10px 10px', overflow: 'hidden', minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!videoError ? (
            <img
              src="http://localhost:8000/api/video/stream"
              alt="YOLO annotated traffic feed"
              onError={() => setVideoError(true)}
              style={{ width: '100%', maxHeight: '380px', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎥</div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--fg)' }}>YOLO Engine Offline</div>
              <div style={{ fontSize: '13px', marginTop: '6px' }}>
                Start the YOLO server: <code style={{ background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px' }}>yolo_traffic_engine/start_yolo_server.bat</code>
              </div>
              <button
                className="btn ghost small"
                style={{ marginTop: '14px' }}
                onClick={() => setVideoError(false)}
              >
                Retry connection
              </button>
            </div>
          )}
        </div>
      </div>

      {/* XGBoost AI Prediction & Decision Command Panel */}
      <div className="card pad" style={{ marginBottom: '20px', borderLeft: '4px solid #10B981' }}>
        <div className="between" style={{ flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>⚡</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                XGBoost ML Traffic Predictor & Signal Optimizer
              </h3>
              <span className="tag g" style={{ fontSize: '11px' }}>
                ACTIVE DECISION ENGINE
              </span>
            </div>
            <p className="muted" style={{ fontSize: '12.5px', margin: '4px 0 0 0' }}>
              Multi-camera feature ingestion &middot; Model: <code>traffic_signal_xgboost.json</code> &middot; Inference: 1.4ms
            </p>
          </div>
          <div className="row" style={{ gap: '10px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Optimal Phase Timing</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--green-live, #1F9D62)' }}>
                {s?.ai?.recommended_green ? `${s.ai.recommended_green}s` : `${ph?.allocatedGreen ?? 24}s`}
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)', marginLeft: '4px' }}>
                  ({ph?.remaining ? ph.remaining.toFixed(1) : '0.0'}s left)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Camera Approach Decision Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {(['N', 'S', 'E', 'W'] as const).map((dir) => {
            const camName = dir === 'N' ? 'CAM 01: North' : dir === 'S' ? 'CAM 02: South' : dir === 'E' ? 'CAM 03: East' : 'CAM 04: West';
            const ap = s?.approaches?.[dir];
            const isGreen = ph?.activeArm === dir && ph?.state === 'green';
            const isYellow = ph?.activeArm === dir && ph?.state === 'yellow';
            const statusLabel = isGreen ? 'ACTIVE GREEN' : isYellow ? 'CLEARANCE' : 'RED STOP';
            const statusCol = isGreen ? '#10B981' : isYellow ? '#F59E0B' : '#EF4444';
            const score = s?.ai?.demand_scores?.[dir] ?? (ap ? (ap.queue * 1.5 + ap.count * 0.5).toFixed(1) : 0);

            return (
              <div
                key={dir}
                style={{
                  background: 'var(--surface-2, #182026)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  border: isGreen ? '1.5px solid #10B981' : '1px solid var(--border, #2E3842)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div className="between" style={{ alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px' }}>{camName}</strong>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: `${statusCol}20`,
                      color: statusCol,
                      border: `1px solid ${statusCol}40`,
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>
                <div className="between" style={{ fontSize: '12px' }}>
                  <span className="muted">Live YOLO Vehicles</span>
                  <span style={{ fontWeight: 600 }}>{ap?.count ?? 0}</span>
                </div>
                <div className="between" style={{ fontSize: '12px' }}>
                  <span className="muted">Queue at Stop Line</span>
                  <span style={{ fontWeight: 600, color: (ap?.queue ?? 0) > 4 ? '#EF4444' : 'inherit' }}>
                    {ap?.queue ?? 0} veh
                  </span>
                </div>
                <div className="between" style={{ fontSize: '12px' }}>
                  <span className="muted">XGBoost Demand Score</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent, #3B82F6)' }}>
                    {score}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Recommendation Footer */}
        <div
          style={{
            marginTop: '14px',
            padding: '10px 14px',
            background: 'var(--surface, #111827)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12.5px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#10B981', fontWeight: 700 }}>AI RECOMMENDATION:</span>
            <span>
              {s?.ai?.decision || `Prioritize ${DIRNAME[ph?.activeArm || 'S']} for optimal corridor throughput`}
            </span>
          </div>
          <div className="muted">
            Next Transition: <strong style={{ color: 'var(--fg)' }}>{DIRNAME[s?.ai?.next_arm || 'N']}</strong>
          </div>
        </div>
      </div>

      {/* 4-Junction Network Status Grid */}
      <div>
        <div className="between" style={{ marginBottom: '10px' }}>

          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Monitored Junctions on Corridor</h3>
          <span className="muted" style={{ fontSize: '12.5px' }}>
            4 junctions synchronized with dynamic offset
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          {(s?.network || []).map((j, idx) => {
            const rawLoad = j.load > 1.0 ? j.load / 100.0 : j.load;
            const sat = Math.min(100, Math.max(5, Math.round(rawLoad * 100)));
            const satCol = loadColor(rawLoad);
            const cycleProgress = ((s?.ts ? Math.floor(s.ts / 1000) : 0) + j.offset) % 90;
            const downstreamPhase =
              cycleProgress < 25 ? 'North-South Green' :
              cycleProgress < 30 ? 'Yellow Clearance' :
              cycleProgress < 65 ? 'East-West Green' :
              cycleProgress < 70 ? 'Yellow Clearance' : 'Green Wave Priority';
            const phaseName = idx === 0 ? (ph?.shortLabel || 'Active Green') : downstreamPhase;

            return (
              <div
                key={j.id}
                className="card pad"
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div>
                  <div className="between">
                    <div className="row" style={{ gap: '8px' }}>
                      <span className="avatar" style={{ width: '28px', height: '28px', fontSize: '11px', background: satCol }}>
                        {j.id}
                      </span>
                      <strong style={{ fontSize: '14.5px' }}>{j.name}</strong>
                    </div>
                    <span className="tag" style={{ fontSize: '11px' }}>
                      {idx === 0 ? (
                        <>
                          <span className="dot pulse" /> LIVE TWIN
                        </>
                      ) : (
                        'CORRIDOR NODE'
                      )}
                    </span>
                  </div>
                  <div className="between" style={{ marginTop: '14px' }}>
                    <span className="muted">Saturation</span>
                    <span className="num" style={{ fontSize: '16px', color: satCol }}>
                      {sat}%
                    </span>
                  </div>
                  <div className="meter" style={{ margin: '6px 0 12px' }}>
                    <i style={{ width: `${sat}%`, background: satCol }} />
                  </div>
                  <div className="between" style={{ fontSize: '12.5px', padding: '4px 0', borderBottom: '1px solid var(--line-2)' }}>
                    <span className="muted">Active Phase</span>
                    <span className="tag g" style={{ fontSize: '11px' }}>
                      {phaseName}
                    </span>
                  </div>
                  <div className="between" style={{ fontSize: '12.5px', padding: '4px 0', borderBottom: '1px solid var(--line-2)' }}>
                    <span className="muted">Green Wave Offset</span>
                    <span className="num">+{j.offset}s</span>
                  </div>
                </div>
                <div style={{ marginTop: '14px' }}>
                  <button
                    className="btn ghost small"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => onNavigate('junction')}
                  >
                    {idx === 0 ? 'Open Signal Controller →' : 'View Intersection Details'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Corridor Progression Map (SVG) & Live Routine Telemetry */}
      <div className="two">
        <div className="card">
          <div className="panelhead">
            <h3>Corridor Progression Map</h3>
            <span className="tag g">
              <span className="dot pulse" /> Platoons Flowing
            </span>
          </div>
          <div style={{ padding: '10px' }}>
            <NetworkMapSVG network={s?.network} onSelectJunction={() => onNavigate('junction')} />
          </div>
          <div className="pad" style={{ paddingTop: 0 }}>
            <p className="muted" style={{ fontSize: '12.5px' }}>
              Green Wave Algorithm synchronizes phase transitions between J1 Gandhipuram and J3 Avinashi.
              Vehicles leaving J1 encounter downstream green signals without coming to a stop.
            </p>
          </div>
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          {/* Active Indian Routine */}
          <div className="card">
            <div className="panelhead">
              <h3>Active Indian Signal Routine</h3>
            </div>
            <div className="pad">
              <div className="phaseclock" style={{ marginBottom: '12px' }}>
                <span className="num t">{Math.ceil(ph?.remaining ?? 0)}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>
                    {ph?.label ?? 'Stage 1: South Approach Green'}
                  </div>
                  <div className="muted" style={{ fontSize: '12px' }}>
                    Zero-conflict protected 4-stage split routine
                  </div>
                </div>
              </div>
              <div className="divider" />
              <div className="between" style={{ padding: '4px 0' }}>
                <span className="lbl">Stage 1: South Arm</span>
                <span className="num">{ph?.plan.S ?? 22}s</span>
              </div>
              <div className="between" style={{ padding: '4px 0' }}>
                <span className="lbl">Stage 2: North Arm</span>
                <span className="num">{ph?.plan.N ?? 24}s</span>
              </div>
              <div className="between" style={{ padding: '4px 0' }}>
                <span className="lbl">Stage 3: East Arm</span>
                <span className="num">{ph?.plan.E ?? 18}s</span>
              </div>
              <div className="between" style={{ padding: '4px 0' }}>
                <span className="lbl">Stage 4: West Arm</span>
                <span className="num">{ph?.plan.W ?? 16}s</span>
              </div>
              <div className="divider" />
              <div className="between">
                <span className="muted">Total Cycle Length</span>
                <span className="num">{ph?.plan.cycle ?? 98}s</span>
              </div>
              <div className="between" style={{ marginTop: '6px' }}>
                <span className="muted">Cycles AI Optimized</span>
                <span className="num">{t?.cycles ?? 0}</span>
              </div>
            </div>
          </div>

          {/* AI Optimization Event List */}
          <div className="card">
            <div className="panelhead">
              <h3>Recent AI Optimization Events</h3>
              <button className="btn ghost small" onClick={() => onNavigate('incidents')}>
                All logs
              </button>
            </div>
            <div>
              {(!s?.events || !s.events.length) ? (
                <div className="pad muted">No decisions yet. The first plan lands at the end of this cycle.</div>
              ) : (
                s.events.slice(0, 5).map((e, idx) => (
                  <div key={idx} className="incident" style={{ padding: '11px 16px' }}>
                    <span
                      className="ic"
                      style={{
                        width: '26px',
                        height: '26px',
                        background: e.kind === 'incident' ? 'var(--amber-soft)' : 'var(--green-soft)',
                      }}
                    >
                      {e.kind === 'incident' ? <IcoAlert /> : <IcoCheck />}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div className="between">
                        <span style={{ fontSize: '13.5px' }}>{e.text}</span>
                        <span className="muted" style={{ fontSize: '12px' }}>
                          {new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approach Queues & Forecast */}
      <div className="two">
        <div className="card">
          <div className="panelhead">
            <h3>Approach Queue Lengths</h3>
            <span className="muted">vehicles at stop line</span>
          </div>
          <div className="pad" style={{ paddingTop: '4px' }}>
            {DIRS.map((d) => {
              const q = s?.approaches[d]?.queue ?? 0;
              const count = s?.approaches[d]?.count ?? 0;
              const pct = Math.min(100, Math.round((q / 14) * 100));
              const col = q > 6 ? 'var(--red)' : q > 3 ? 'var(--amber)' : 'var(--green-live)';
              return (
                <div key={d} className="dirrow">
                  <span className="name">{DIRNAME[d]}</span>
                  <span className="meter">
                    <i style={{ width: `${pct}%`, background: col }} />
                  </span>
                  <span className="num" style={{ width: '48px', textAlign: 'right', fontSize: '13.5px' }}>
                    {q} <span className="muted" style={{ fontSize: '11px' }}>/ {count}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="panelhead">
            <h3>AI 15-Minute Congestion Forecast</h3>
            <button className="btn ghost small" onClick={() => onNavigate('predict')}>
              Detail
            </button>
          </div>
          <div className="pad" style={{ paddingTop: '4px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {DIRS.map((d) => {
                const a = s?.approaches[d];
                const q = a?.queue ?? 0;
                const cnt = a?.count ?? 0;
                const riskScore = Math.min(98, Math.max(12, Math.round(((q * 1.5 + cnt * 0.4) / 18.0) * 100)));
                const lvl = riskScore >= 65 ? 'HIGH' : riskScore >= 35 ? 'MEDIUM' : 'LOW';
                const tagClass = lvl === 'HIGH' ? 'tag r' : lvl === 'MEDIUM' ? 'tag a' : 'tag g';
                return (
                  <div key={d} style={{ padding: '10px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                    <div className="between">
                      <strong>{DIRNAME[d]}</strong>
                      <span className={tagClass} style={{ fontSize: '10px', fontWeight: 700 }}>
                        {lvl}
                      </span>
                    </div>
                    <div className="between" style={{ marginTop: '8px' }}>
                      <span className="muted" style={{ fontSize: '11.5px' }}>Risk score</span>
                      <span className="num" style={{ fontSize: '13px' }}>
                        {riskScore}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
