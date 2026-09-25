import React, { useState, useEffect } from 'react';
import { useSignalSync } from '../hooks/useSignalSync';
import { AreaChartSVG } from '../components/AreaChartSVG';
import { DIRS, DIRNAME } from '../services/signalsyncEngine';
import { analyticsApi, type AnalyticsSummary, type TrafficSession } from '../services/analyticsService';

export const AnalyticsPage: React.FC = () => {
  const { snapshot, history } = useSignalSync();
  const s = snapshot;
  const t = s?.totals;
  const [toastMsg, setToastMsg] = useState('');
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [sessions, setSessions] = useState<TrafficSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [backendMetrics, setBackendMetrics] = useState<AnalyticsSummary | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  useEffect(() => {
    let mounted = true;

    const pollBackend = async () => {
      try {
        const healthy = await analyticsApi.isHealthy();
        if (!mounted) return;
        setIsBackendOnline(healthy);

        if (healthy) {
          const [sessList, metrics] = await Promise.all([
            analyticsApi.getAllSessions(),
            analyticsApi.getMetrics(selectedSessionId || undefined)
          ]);
          if (mounted) {
            setSessions(sessList || []);
            setBackendMetrics(metrics);
          }
        }
      } catch {
        if (mounted) setIsBackendOnline(false);
      }
    };

    pollBackend();
    const interval = setInterval(pollBackend, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [selectedSessionId]);

  const worstDir = s
    ? DIRS.reduce((a, b) => (s.approaches[a].score > s.approaches[b].score ? a : b))
    : 'N';

  const totalQueue = s ? DIRS.reduce((sum, d) => sum + s.approaches[d].queue, 0) : 0;
  const avgSpeed = s
    ? (DIRS.reduce((sum, d) => sum + s.approaches[d].speed, 0) / 4).toFixed(0)
    : '46';

  const displaySavings = backendMetrics && backendMetrics.delayReductionPercentage > 0
    ? `${backendMetrics.delayReductionPercentage.toFixed(1)}%`
    : `${(t?.savings ?? 0).toFixed(0)}%`;

  const sessionStats = [
    ['Vehicles cleared', backendMetrics?.totalClearedVehicles ?? t?.cleared ?? 0],
    ['Average wait', `${(backendMetrics?.averageWaitTimeSeconds ?? t?.avgWait ?? 0).toFixed(1)}s`],
    ['Modelled fixed-plan wait', `${(t?.baselineWait ?? 0).toFixed(1)}s`],
    ['Waiting time saved (DB)', displaySavings],
    ['Cycles re-timed', backendMetrics?.completedCycles ?? t?.cycles ?? 0],
    ['Longest queue', `${s ? Math.max(...DIRS.map((d) => s.approaches[d].queue)) : 0} vehicles`],
  ];

  // ── 5. Evaluation / Report Export ────────────────────────────────
  const handleExportCSV = () => {
    if (isBackendOnline) {
      window.location.href = analyticsApi.getExportUrl('csv', selectedSessionId || undefined);
      showToast('Downloading database-backed analytics CSV report...');
      return;
    }
    if (!s) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const rows = [
      ['SignalSync Traffic Performance Report', dateStr],
      ['Junction', `${s.junction.id} — ${s.junction.name}`],
      ['Phasing Model', 'Situation 1 Indian Split-Phasing (Protected 4-Stage)'],
      ['Vehicles Cleared', t?.cleared ?? 0],
      ['Average Delay (s)', (t?.avgWait ?? 0).toFixed(2)],
      ['Fixed Baseline Delay (s)', (t?.baselineWait ?? 0).toFixed(2)],
      ['Wait Time Reduction (%)', `${(t?.savings ?? 0).toFixed(1)}%`],
      ['AI Cycles Optimized', t?.cycles ?? 0],
      [],
      ['Approach', 'Vehicle Count', 'Queue Length', 'Avg Wait (s)', 'Speed (km/h)', 'Congestion Score', 'Anomaly Flag'],
      ...DIRS.map((d) => {
        const scVal = s.approaches[d].score > 1.0 ? s.approaches[d].score / 500.0 : s.approaches[d].score;
        return [
          DIRNAME[d],
          s.approaches[d].count,
          s.approaches[d].queue,
          s.approaches[d].wait.toFixed(1),
          s.approaches[d].speed.toFixed(1),
          `${Math.min(100, Math.max(0, Math.round(scVal * 100)))}%`,
          s.approaches[d].anomaly ? 'YES (Surge)' : 'NO',
        ];
      }),
      [],
      ['Timestamp', 'In Junction', 'Queue', 'Average Wait', 'Speed'],
      ...history.map((h) => [
        new Date(h.ts).toISOString(),
        h.veh,
        h.queue,
        h.wait,
        h.spd,
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SignalSync_Evaluation_Report_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Evaluation CSV Report downloaded successfully');
  };

  const handleExportJSON = () => {
    if (isBackendOnline) {
      window.location.href = analyticsApi.getExportUrl('json', selectedSessionId || undefined);
      showToast('Downloading database-backed analytics JSON report...');
      return;
    }
    if (!s) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const exportData = {
      generatedAt: new Date().toISOString(),
      junction: s.junction,
      totals: s.totals,
      phasePlan: s.phase.plan,
      approaches: s.approaches,
      historySample: history,
      eventsLog: s.events,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `SignalSync_Session_Data_${dateStr}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Full Session JSON Report exported');
  };

  return (
    <>
      {toastMsg && <div className="toast">{toastMsg}</div>}

      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '21px', margin: 0 }}>Analytics & Session Evaluation</h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                background: isBackendOnline ? '#dcfce7' : '#fef3c7',
                color: isBackendOnline ? '#166534' : '#92400e',
                border: isBackendOnline ? '1px solid #bbf7d0' : '1px solid #fde68a',
              }}
            >
              {isBackendOnline ? '● Analytics Service Online (Port 8085)' : '○ Local Simulation Telemetry'}
            </span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {isBackendOnline
              ? `Real-time persistence active. Tracking session aggregates & approach metrics in Analytics DB.`
              : `Continuous telemetry streaming from Python simulation physics engine.`}
          </p>
        </div>

        <div className="row" style={{ gap: '8px', alignItems: 'center' }}>
          {isBackendOnline && sessions.length > 0 && (
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              style={{
                fontSize: '12px',
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid var(--line-2, #e2e8f0)',
                background: 'white',
              }}
            >
              <option value="">Live Active Session (Latest)</option>
              {sessions.map((sess) => (
                <option key={sess.sessionId} value={sess.sessionId}>
                  {sess.sessionId} ({sess.controlMode} - {sess.status})
                </option>
              ))}
            </select>
          )}

          <button className="btn ghost small" onClick={handleExportJSON}>
            Export JSON {isBackendOnline ? '(DB)' : 'Data'}
          </button>
          <button className="btn small" onClick={handleExportCSV}>
            <span>Export Report (CSV)</span>
          </button>
        </div>
      </div>

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

      <div className="two">
        <div className="card">
          <div className="panelhead">
            <h3>Average wait</h3>
            <span className="muted">seconds per vehicle</span>
          </div>
          <div className="pad">
            <AreaChartSVG data={history} dataKey="wait" color="var(--amber, #C8860D)" height={180} />
          </div>
        </div>

        <div className="card">
          <div className="panelhead">
            <h3>Approach speed</h3>
            <span className="muted">km/h</span>
          </div>
          <div className="pad">
            <AreaChartSVG data={history} dataKey="spd" color="var(--blue, #2A5BD7)" height={180} />
          </div>
        </div>
      </div>

      <div className="two">
        <div className="card">
          <div className="panelhead">
            <h3>Approach conditions</h3>
            <span className="muted">now</span>
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
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                {DIRS.map((d) => {
                  const a = s?.approaches[d];
                  if (!a) return null;
                  const tagClass = a.level === 'HIGH' ? 'tag r' : a.level === 'MEDIUM' ? 'tag a' : 'tag g';
                  return (
                    <tr key={d}>
                      <td>
                        <strong>{DIRNAME[d]}</strong>
                      </td>
                      <td className="num">{a.count}</td>
                      <td className="num">{a.queue}</td>
                      <td className="num">{a.wait.toFixed(1)}s</td>
                      <td className="num">{a.speed.toFixed(0)} km/h</td>
                      <td>
                        {(() => {
                          const densPct = Math.min(100, Math.max(0, Math.round((a.density > 1.0 ? a.density / 100.0 : a.density) * 100)));
                          return (
                            <span className="meter" style={{ display: 'inline-block', width: '50px' }}>
                              <i style={{ width: `${densPct}%`, background: 'var(--green)' }} />
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        <span className={tagClass}>{a.level}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="panelhead">
            <h3>Session totals & Project Evaluation</h3>
          </div>
          <div className="pad">
            {sessionStats.map(([k, v]) => (
              <div
                key={k as string}
                className="between"
                style={{ padding: '9px 0', borderBottom: '1px solid var(--line-2)' }}
              >
                <span className="lbl">{k}</span>
                <span className="num" style={{ fontSize: '15px' }}>
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
