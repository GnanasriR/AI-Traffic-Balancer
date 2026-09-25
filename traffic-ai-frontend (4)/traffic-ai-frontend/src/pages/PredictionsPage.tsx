import React, { useState, useEffect } from 'react';
import { useSignalSync } from '../hooks/useSignalSync';
import { AreaChartSVG } from '../components/AreaChartSVG';
import { DIRS, DIRNAME } from '../services/signalsyncEngine';
import { predictionApi, type PredictionItem } from '../services/predictionService';

const DIR_MAP: Record<string, string> = {
  N: 'NORTH',
  S: 'SOUTH',
  E: 'EAST',
  W: 'WEST',
};

export const PredictionsPage: React.FC = () => {
  const { snapshot, history } = useSignalSync();
  const s = snapshot;
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const fetchPredictions = async () => {
      try {
        const live = await predictionApi.getLivePredictions();
        if (!mounted) return;
        if (live && live.length > 0) {
          setPredictions(live);
          setIsBackendOnline(true);
        } else {
          setIsBackendOnline(false);
        }
      } catch {
        if (mounted) setIsBackendOnline(false);
      }
    };

    fetchPredictions();
    const interval = setInterval(fetchPredictions, 2500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const weights = [
    ['Queue length', 31],
    ['Vehicle count', 24],
    ['Waiting time', 17],
    ['Density', 12],
    ['Upstream departures', 9],
    ['Time of day', 7],
  ];

  return (
    <>
      <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '21px', margin: 0 }}>Congestion Forecast & Model Predictions</h3>
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
              {isBackendOnline ? '● Optimizer Prediction Model Online (Port 8082)' : '○ Simulation Telemetry Derived'}
            </span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {isBackendOnline
              ? 'Proactive 15 & 30-minute queue surge predictions powered by the Java Optimizer Service and Python physics engine.'
              : 'Estimating arrival queues and approach congestion risk from continuous simulation telemetry.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
        {DIRS.map((d) => {
          const a = s?.approaches[d];
          const backendPred = predictions.find((p) => p.approach === DIR_MAP[d]);

          let sc: number;
          let trend: string;
          let pred15: number;
          let pred30: number;
          let rec: string | null = null;

          if (backendPred) {
            sc = Math.min(99, Math.max(12, Math.round(backendPred.congestionSeverityIndex * 100)));
            trend = backendPred.trendDirection.replace(/_/g, ' ').toLowerCase();
            pred15 = backendPred.predictedQueue15Min;
            pred30 = backendPred.predictedQueue30Min;
            rec = backendPred.recommendation;
          } else {
            const q = a?.queue ?? 0;
            const cnt = a?.count ?? 0;
            sc = Math.min(98, Math.max(12, Math.round(((q * 1.5 + cnt * 0.4) / 18.0) * 100)));
            trend = a?.trend || (q > 4 ? 'rising' : 'steady');
            pred15 = Math.round(q + (q * 0.45 + 1.2) * 2.8);
            pred30 = Math.round(q + (q * 0.45 + 1.2) * 7.0);
          }

          // Ensure level badge strictly matches the risk percentage score
          const lvl = sc >= 65 ? 'HIGH' : sc >= 35 ? 'MEDIUM' : 'LOW';
          const tagClass = lvl === 'HIGH' ? 'tag r' : lvl === 'MEDIUM' ? 'tag a' : 'tag g';
          const col = sc >= 65 ? 'var(--red, #C7413F)' : sc >= 35 ? 'var(--amber, #C8860D)' : 'var(--green-live, #1F9D62)';

          return (
            <div key={d} className="card pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="between">
                  <strong>{DIRNAME[d]} Approach</strong>
                  <span className={tagClass} style={{ fontWeight: 700 }}>
                    {lvl}
                  </span>
                </div>
                <div className="between" style={{ marginTop: '16px' }}>
                  <span className="muted">Congestion Risk</span>
                  <span className="num" style={{ fontSize: '24px', color: col }}>
                    {sc}%
                  </span>
                </div>
                <div className="meter" style={{ margin: '8px 0 12px' }}>
                  <i style={{ width: `${sc}%`, background: col }} />
                </div>
                <div className="between" style={{ fontSize: '12px', padding: '3px 0' }}>
                  <span className="muted">Forecast Trend</span>
                  <span className="lbl" style={{ textTransform: 'capitalize' }}>{trend}</span>
                </div>
                <div className="between" style={{ fontSize: '12px', padding: '3px 0' }}>
                  <span className="muted">Current Queue</span>
                  <span className="num">{a?.queue ?? backendPred?.currentQueue ?? 0} veh</span>
                </div>
                <div className="between" style={{ fontSize: '12px', padding: '3px 0' }}>
                  <span className="muted">15-Min Forecast</span>
                  <span className="num" style={{ color: pred15 > (a?.queue ?? 0) ? '#DC2626' : undefined, fontWeight: 600 }}>
                    {pred15} veh
                  </span>
                </div>
                <div className="between" style={{ fontSize: '12px', padding: '3px 0' }}>
                  <span className="muted">30-Min Forecast</span>
                  <span className="num">{pred30} veh</span>
                </div>
              </div>

              {rec && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '6px 8px',
                    background: 'var(--surface-2)',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: 'var(--muted)',
                    lineHeight: 1.3,
                  }}
                  title={rec}
                >
                  <strong style={{ color: 'var(--ink)' }}>AI Action:</strong> {rec.split(':')[0]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="two">
        <div className="card">
          <div className="panelhead">
            <h3>Queue length trend</h3>
            <span className="muted">observed over time</span>
          </div>
          <div className="pad">
            <AreaChartSVG data={history} dataKey="queue" color="var(--red, #C7413F)" height={180} />
          </div>
        </div>

        <div className="card">
          <div className="panelhead">
            <h3>What drives the score</h3>
            <span className="muted">feature weight</span>
          </div>
          <div className="pad" style={{ paddingTop: '6px' }}>
            {weights.map(([k, v]) => (
              <div key={k as string} className="dirrow">
                <span className="name" style={{ width: 'auto', flex: '0 0 152px', fontWeight: 400, fontSize: '13px' }}>
                  {k}
                </span>
                <span className="meter">
                  <i style={{ width: `${Math.min(100, (v as number) * 3)}%`, background: 'var(--blue, #2A5BD7)' }} />
                </span>
                <span className="num" style={{ width: '38px', textAlign: 'right', fontSize: '13.5px' }}>
                  {v}%
                </span>
              </div>
            ))}
            <div className="divider" />
            <div className="between">
              <span className="muted">Prediction Model</span>
              <span>Optimizer Service (CSI Engine) + XGBoost</span>
            </div>
            <div className="between" style={{ marginTop: '6px' }}>
              <span className="muted">Horizon</span>
              <span>15 min &amp; 30 min Proactive Split</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
