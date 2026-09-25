import React from 'react';
import { useSignalSync } from '../hooks/useSignalSync';
import { NetworkMapSVG } from '../components/NetworkMapSVG';
import { NETWORK } from '../services/signalsyncEngine';
import type { PageId } from '../components/Shell';

interface CorridorPageProps {
  onNavigate: (page: PageId) => void;
}

export const CorridorPage: React.FC<CorridorPageProps> = ({ onNavigate }) => {
  const { snapshot } = useSignalSync();
  const s = snapshot;

  const loadColor = (f: number) =>
    f > 0.66 ? 'var(--red, #C7413F)' : f > 0.33 ? 'var(--amber, #C8860D)' : 'var(--green-live, #1F9D62)';

  return (
    <>
      <div className="between" style={{ flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '21px' }}>Corridor</h3>
          <p className="muted">Offsets are coordinated so a platoon leaving J1 meets green downstream.</p>
        </div>
        <span className="tag g">
          <span className="dot pulse" /> Green wave active
        </span>
      </div>

      <div className="two">
        <div className="card" style={{ padding: '10px' }}>
          <NetworkMapSVG network={s?.network} onSelectJunction={() => onNavigate('junction')} />
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <div className="panelhead">
              <h3>Junctions</h3>
              <span className="muted">saturation</span>
            </div>
            <div className="pad" style={{ paddingTop: '4px' }}>
              {(s?.network || NETWORK).map((j) => {
                const rawLoad = j.load > 1.0 ? j.load / 100.0 : j.load;
                const sat = Math.min(100, Math.max(5, Math.round(rawLoad * 100)));
                return (
                  <div key={j.id} className="dirrow">
                    <span className="name" style={{ width: 'auto', flex: '0 0 118px' }}>
                      {j.id} · {j.name.split(' ')[0]}
                    </span>
                    <span className="meter">
                      <i style={{ width: `${sat}%`, background: loadColor(rawLoad) }} />
                    </span>
                    <span className="num" style={{ width: '44px', textAlign: 'right', fontSize: '13.5px' }}>
                      {sat}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="panelhead">
              <h3>Corridor offsets</h3>
            </div>
            <div className="pad">
              <p className="muted">
                J1 releases at t=0. Each junction downstream turns green as the platoon reaches it, so
                the corridor clears in a single pass.
              </p>
              <div className="divider" />
              {NETWORK.map((j) => (
                <div
                  key={j.id}
                  className="between"
                  style={{ padding: '7px 0', borderBottom: '1px solid var(--line-2)' }}
                >
                  <span className="lbl">
                    {j.id} · {j.name}
                  </span>
                  <span className="num">+{j.offset}s</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
