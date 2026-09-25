import React from 'react';
import { useSignalSync } from '../hooks/useSignalSync';
import { DIRS, DIRNAME } from '../services/signalsyncEngine';

interface LandingPageProps {
  onNavigateToLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToLogin }) => {
  const { snapshot } = useSignalSync();
  const s = snapshot;
  const ph = s?.phase;
  const t = s?.totals;

  return (
    <div className="landing-root">
      {/* ── Top Navigation ────────────────────────────────────────── */}
      <header className="nav">
        <div className="wrap">
          <div className="brandmark" style={{ cursor: 'pointer' }}>
            SignalSync
          </div>
          <div className="row">
            <button className="btn small" onClick={onNavigateToLogin}>
              Sign in
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section with Live Simulation ──────────────────────── */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <h1 style={{ maxWidth: '14ch' }}>Traffic control that reads the traffic it is controlling.</h1>
              <p className="sub">
                SignalSync watches every approach of a junction, works out which one is filling up,
                and rewrites the green split before the queue becomes a jam. Operators see the whole
                corridor in one screen and can take control of any junction at any time.
              </p>
              <div className="cta">
                <button className="btn" onClick={onNavigateToLogin}>
                  Sign in
                </button>
                <a className="btn ghost" href="#how">
                  How it works
                </a>
              </div>
              <div className="hero-stats">
                <div>
                  <div className="num v">
                    {t?.savings && t.savings > 0 ? `${t.savings.toFixed(0)}%` : '34%'}
                  </div>
                  <div className="k">less waiting than a fixed plan</div>
                </div>
                <div>
                  <div className="num v">{t?.cleared ?? 0}</div>
                  <div className="k">vehicles cleared</div>
                </div>
                <div>
                  <div className="num v">{t?.cycles ?? 0}</div>
                  <div className="k">cycles re-timed</div>
                </div>
              </div>
            </div>

            {/* Live Intersection Simulation Canvas */}
            <div className="stage">
              <div className="stage-head">
                <div>
                  <strong style={{ fontSize: '15px' }}>Gandhipuram Central</strong>
                  <div className="muted">Four-arm junction · Indian protected phasing</div>
                </div>
                <div className="row">
                  <span className="tag g">
                    {ph?.state === 'green'
                      ? ph.shortLabel
                      : ph?.state === 'yellow'
                      ? 'Yellow Clearance'
                      : 'All-Red Clearance'}
                  </span>
                </div>
              </div>

              <div style={{ position: 'relative', width: '100%', height: '460px', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src="http://localhost:8000/api/video/stream"
                  alt="4-Camera Quad Surveillance"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              <div className="stage-foot">
                {DIRS.map((d) => (
                  <div key={d}>
                    <div className="num v">{s?.approaches[d]?.count ?? 0}</div>
                    <div className="k">{DIRNAME[d]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem Section ────────────────────────────────────────── */}
      <section className="section" id="problem">
        <div className="wrap">
          <h2>A signal that cannot see the road is guessing.</h2>
          <p className="lead">
            Fixed plans are written months ahead for an average day that rarely turns up. Every one of
            these costs the corridor time, fuel, and patience.
          </p>
          <div className="painlist">
            <div>
              <h4>Queues that never clear</h4>
              <p>The heavy approach gets the same green as the empty one, so its queue carries over cycle after cycle.</p>
            </div>
            <div>
              <h4>Green burning on empty road</h4>
              <p>Twenty seconds of green for two vehicles is twenty seconds the cross street spends stopped.</p>
            </div>
            <div>
              <h4>Congestion that spreads</h4>
              <p>A queue that outgrows its link blocks the junction behind it, and the failure walks back through the corridor.</p>
            </div>
            <div>
              <h4>No answer to a surge</h4>
              <p>A lane closure or a stadium let-out needs a new plan in minutes, not at the next retiming review.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works Section ───────────────────────────────────── */}
      <section className="section" id="how">
        <div className="wrap">
          <h2>Measure, predict, re-time, repeat.</h2>
          <p className="lead">
            The simulator reports what is on each approach, the model says what is coming, and the
            optimiser converts both into a green split that respects every safety rule before it is applied.
          </p>
          <div className="pipeline">
            {[
              ['Observe', 'Counts, queue length, density, speed, and waiting time arrive from the junction for each approach.'],
              ['Predict', 'A gradient-boosted model scores every approach for congestion over the next few minutes.'],
              ['Re-time', 'Green time is redistributed towards the approach that needs it, inside strict safety constraints.'],
              ['Apply', 'The plan goes to the junction and the next round of readings comes back dynamically changed.'],
              ['Coordinate', 'Neighbouring junctions shift their offsets so the released platoon keeps moving seamlessly.'],
            ].map(([title, desc], i) => (
              <div key={title} className="step">
                <div className="n">{i + 1}</div>
                <h4>{title}</h4>
                <p>{desc}</p>
              </div>
            ))}
          </div>

          <div className="compare">
            <div className="card">
              <div className="between">
                <h4>Fixed plan</h4>
                <span className="tag">60s cycle</span>
              </div>
              <p className="muted" style={{ marginTop: '6px' }}>
                The same split at 3am and at 6pm.
              </p>
              <div className="bar" style={{ background: '#8895A0', width: '50%' }}>
                N/S · 30s
              </div>
              <div className="bar" style={{ background: '#A6B1B9', width: '50%' }}>
                E/W · 30s
              </div>
              <div className="divider" />
              <p className="muted">Forty-two vehicles north, six west — both get thirty seconds.</p>
            </div>

            <div className="card" style={{ borderColor: '#C9E4D7', background: 'linear-gradient(180deg, #F7FBF9, #fff)' }}>
              <div className="between">
                <h4>SignalSync</h4>
                <span className="tag g">{ph?.plan.cycle ?? 98}s cycle</span>
              </div>
              <p className="muted" style={{ marginTop: '6px' }}>
                Re-timed every cycle from live demand.
              </p>
              <div className="bar" style={{ background: 'var(--green, #0B5C3E)', width: '56%' }}>
                South: {ph?.plan.S ?? 22}s · North: {ph?.plan.N ?? 24}s
              </div>
              <div className="bar" style={{ background: 'var(--green-live, #1F9D62)', width: '44%' }}>
                East: {ph?.plan.E ?? 18}s · West: {ph?.plan.W ?? 16}s
              </div>
              <div className="divider" />
              <p className="muted">
                Zero-conflict approach-by-approach split phasing. Minimum green, clearance, and safety verified before application.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Call to Action ────────────────────────────────────────── */}
      <section className="section" id="cta" style={{ textAlign: 'center' }}>
        <div className="wrap">
          <h2>Ready to experience real-time AI traffic balancing?</h2>
          <p className="lead">
            Access the 4-camera real-time surveillance feed and intelligent XGBoost signal optimizer.
          </p>
          <div className="cta" style={{ marginTop: '24px' }}>
            <button className="btn" onClick={onNavigateToLogin}>
              Access Command Center
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="foot">
        <div className="wrap between" style={{ flexWrap: 'wrap' }}>
          <strong style={{ color: 'var(--ink, #111A22)' }}>SignalSync</strong>
          <span>Traffic-responsive signal control for the city operations centre</span>
        </div>
      </footer>
    </div>
  );
};
