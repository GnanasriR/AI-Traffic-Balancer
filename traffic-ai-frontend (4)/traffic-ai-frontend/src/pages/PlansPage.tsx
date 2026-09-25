import React, { useState } from 'react';
import { useSignalSync } from '../hooks/useSignalSync';
import { IcoAlert, IcoCheck } from '../components/Icons';

export const PlansPage: React.FC = () => {
  const { snapshot, command } = useSignalSync();
  const s = snapshot;
  const cfg = s?.control.cfg || { minGreen: 10, maxGreen: 50, yellow: 3, allRed: 1.5, maxCycle: 140 };

  const [minGreen, setMinGreen] = useState(cfg.minGreen);
  const [maxGreen, setMaxGreen] = useState(cfg.maxGreen);
  const [yellow, setYellow] = useState(cfg.yellow);
  const [maxCycle, setMaxCycle] = useState(cfg.maxCycle);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleToggleAdaptive = () => {
    command('adaptive', { on: !s?.control.adaptive });
    showToast(!s?.control.adaptive ? 'Adaptive Stage Timing enabled' : 'Fixed Stage Timers enabled');
  };

  const handleApplyConstraints = () => {
    command('constraints', { minGreen, maxGreen, yellow, maxCycle });
    showToast('Constraints sent to the junction controller');
  };

  const handleResetConstraints = () => {
    setMinGreen(10);
    setMaxGreen(50);
    setYellow(3);
    setMaxCycle(140);
    command('constraints', { minGreen: 10, maxGreen: 50, yellow: 3, maxCycle: 140 });
    showToast('Constraints reset to defaults');
  };

  return (
    <>
      {toastMsg && <div className="toast">{toastMsg}</div>}

      <div className="between" style={{ flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '21px' }}>Signal plans</h3>
          <p className="muted">A plan is only sent to the junction if it satisfies every safety constraint below.</p>
        </div>
        <div className="row">
          <span className="lbl">Adaptive Stage Timing</span>
          <button
            className={`switch ${s?.control.adaptive ? 'on' : ''}`}
            onClick={handleToggleAdaptive}
            aria-label="Toggle adaptive stage timing"
          >
            <i />
          </button>
        </div>
      </div>

      <div className="two">
        <div className="card">
          <div className="panelhead">
            <h3>Fixed plan against the plan in force</h3>
            <span className="muted">this cycle</span>
          </div>
          <div className="pad">
            <div className="lbl">Fixed 60-second plan</div>
            <div className="bar" style={{ background: '#8895A0', width: '50%' }}>
              N/S · 30s
            </div>
            <div className="bar" style={{ background: '#A6B1B9', width: '50%' }}>
              E/W · 30s
            </div>
            <div className="divider" />
            <div className="lbl">Indian 4-Stage Plan in force ({s?.phase.plan.cycle ?? 98}s cycle)</div>
            {(() => {
              const planS = s?.phase.plan.S ?? 22;
              const planN = s?.phase.plan.N ?? 24;
              const planE = s?.phase.plan.E ?? 18;
              const planW = s?.phase.plan.W ?? 16;
              const totalGreen = Math.max(1, planS + planN + planE + planW);
              const pctS = Math.max(10, Math.round((planS / totalGreen) * 100));
              const pctN = Math.max(10, Math.round((planN / totalGreen) * 100));
              const pctE = Math.max(10, Math.round((planE / totalGreen) * 100));
              const pctW = Math.max(10, 100 - pctS - pctN - pctE);
              return (
                <div style={{ display: 'flex', gap: '3px', borderRadius: '6px', overflow: 'hidden', margin: '6px 0 10px' }}>
                  <div className="bar" style={{ background: '#0B5C3E', width: `${pctS}%`, margin: 0 }} title={`Stage 1 South: ${planS}s`}>
                    S: {planS}s ({pctS}%)
                  </div>
                  <div className="bar" style={{ background: '#10B981', width: `${pctN}%`, margin: 0 }} title={`Stage 2 North: ${planN}s`}>
                    N: {planN}s ({pctN}%)
                  </div>
                  <div className="bar" style={{ background: '#3B82F6', width: `${pctE}%`, margin: 0 }} title={`Stage 3 East: ${planE}s`}>
                    E: {planE}s ({pctE}%)
                  </div>
                  <div className="bar" style={{ background: '#8B5CF6', width: `${pctW}%`, margin: 0 }} title={`Stage 4 West: ${planW}s`}>
                    W: {planW}s ({pctW}%)
                  </div>
                </div>
              );
            })()}
            <div className="divider" />
            <div className="kpis" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="kpi" style={{ border: 0, padding: 0 }}>
                <div className="k">Average wait now</div>
                <div className="num v">
                  <span>{s?.totals.avgWait ? s.totals.avgWait.toFixed(1) : '0'}</span>
                  <small>s</small>
                </div>
              </div>
              <div className="kpi" style={{ border: 0, padding: 0 }}>
                <div className="k">Modelled under fixed timing</div>
                <div className="num v" style={{ color: 'var(--muted)' }}>
                  <span>{s?.totals.baselineWait ? s.totals.baselineWait.toFixed(1) : '0'}</span>
                  <small>s</small>
                </div>
              </div>
            </div>
            <div className="tag g" style={{ marginTop: '12px' }}>
              {s?.totals.savings && s.totals.savings > 0
                ? `${s.totals.savings.toFixed(0)}% wait time saved`
                : 'Measuring baseline'}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="panelhead">
            <h3>Safety constraints</h3>
            <button className="btn ghost small" onClick={handleResetConstraints}>
              Reset
            </button>
          </div>
          <div className="pad" style={{ paddingTop: '6px' }}>
            <div style={{ marginTop: '14px' }}>
              <div className="between">
                <span className="lbl">Minimum green</span>
                <span className="num">{minGreen}s</span>
              </div>
              <input
                className="slider"
                type="range"
                min={6}
                max={25}
                value={minGreen}
                onChange={(e) => setMinGreen(parseInt(e.target.value, 10))}
              />
            </div>

            <div style={{ marginTop: '14px' }}>
              <div className="between">
                <span className="lbl">Maximum green</span>
                <span className="num">{maxGreen}s</span>
              </div>
              <input
                className="slider"
                type="range"
                min={30}
                max={90}
                value={maxGreen}
                onChange={(e) => setMaxGreen(parseInt(e.target.value, 10))}
              />
            </div>

            <div style={{ marginTop: '14px' }}>
              <div className="between">
                <span className="lbl">Clearance time (Yellow)</span>
                <span className="num">{yellow}s</span>
              </div>
              <input
                className="slider"
                type="range"
                min={2}
                max={6}
                value={yellow}
                onChange={(e) => setYellow(parseInt(e.target.value, 10))}
              />
            </div>

            <div style={{ marginTop: '14px' }}>
              <div className="between">
                <span className="lbl">Maximum cycle</span>
                <span className="num">{maxCycle}s</span>
              </div>
              <input
                className="slider"
                type="range"
                min={60}
                max={180}
                value={maxCycle}
                onChange={(e) => setMaxCycle(parseInt(e.target.value, 10))}
              />
            </div>

            <div className="divider" />
            <p className="muted" style={{ fontSize: '12.5px' }}>
              Fairness rule: No approach is held at minimum green for more than two consecutive cycles,
              however light its demand.
            </p>
            <button
              className="btn"
              style={{ marginTop: '14px', width: '100%', justifyContent: 'center' }}
              onClick={handleApplyConstraints}
            >
              Send to junction
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="panelhead">
          <h3>Plan history</h3>
          <span className="muted">most recent first</span>
        </div>
        <div>
          {(!s?.events || !s.events.length) ? (
            <div className="pad muted">No decisions yet. The first plan lands at the end of this cycle.</div>
          ) : (
            s.events.map((e, idx) => (
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
    </>
  );
};
