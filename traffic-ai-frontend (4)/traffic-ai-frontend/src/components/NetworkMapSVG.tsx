import React from 'react';
import type { CorridorJunction } from '../types/signalsync';
import { NETWORK, LINKS } from '../services/signalsyncEngine';

interface NetworkMapSVGProps {
  network?: CorridorJunction[];
  onSelectJunction?: (id: string) => void;
  maxHeight?: number;
}

export const NetworkMapSVG: React.FC<NetworkMapSVGProps> = ({
  network = NETWORK,
  onSelectJunction,
  maxHeight = 440,
}) => {
  const w = 860;
  const h = 380;
  const pos: Record<string, [number, number]> = Object.fromEntries(
    network.map((j) => [j.id, [j.x + 40, j.y + 20]])
  );

  const loadColor = (f: number) =>
    f > 0.66 ? 'var(--red, #C7413F)' : f > 0.33 ? 'var(--amber, #C8860D)' : 'var(--green-live, #1F9D62)';

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ display: 'block', height: 'auto', maxHeight: `${maxHeight}px`, borderRadius: '12px' }}
    >
      <rect width={w} height={h} rx={12} fill="#F3F5F7" />

      {/* Road Links between Junctions */}
      {LINKS.map(([a, b], i) => {
        const [x1, y1] = pos[a] || [0, 0];
        const [x2, y2] = pos[b] || [0, 0];
        return (
          <g key={`${a}-${b}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D8DFE4" strokeWidth={16} strokeLinecap="round" />
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#fff"
              strokeWidth={2}
              strokeDasharray="10 12"
            />
            {[0, 1, 2].map((k) => (
              <circle key={k} r={5} fill="var(--green-live, #1F9D62)">
                <animateMotion
                  dur="4s"
                  begin={`${i * 0.9 + k * 1.3}s`}
                  repeatCount="indefinite"
                  path={`M${x1},${y1} L${x2},${y2}`}
                />
              </circle>
            ))}
          </g>
        );
      })}

      {/* Junction Nodes */}
      {network.map((j) => {
        const [x, y] = pos[j.id] || [0, 0];
        const rawLoad = j.load > 1.0 ? j.load / 100.0 : j.load;
        const sat = Math.min(100, Math.max(5, Math.round(rawLoad * 100)));
        const col = loadColor(rawLoad);
        return (
          <g
            key={j.id}
            className="jnode"
            transform={`translate(${x - 76}, ${y - 34})`}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectJunction?.(j.id)}
          >
            <rect
              className="jbox"
              width={152}
              height={68}
              rx={10}
              fill="#fff"
              stroke="var(--line, #E2E7EB)"
              strokeWidth={1.5}
            />
            <rect width={5} height={68} rx={2.5} fill={col} />
            <text x={16} y={25} fontSize={14} fontWeight={600} fill="var(--ink, #111A22)" fontFamily="Inter, sans-serif">
              {j.id} · {j.name.split(' ')[0]}
            </text>
            <text x={16} y={43} fontSize={11.5} fill="var(--muted, #74838F)" fontFamily="Inter, sans-serif">
              {j.name}
            </text>
            <text x={16} y={59} fontSize={11.5} fill={col} fontWeight={600} fontFamily="Inter, sans-serif">
              {sat}% saturation
            </text>
            <circle cx={134} cy={20} r={5} fill={col} />
          </g>
        );
      })}

      <text x={22} y={h - 18} fontSize={11.5} fill="var(--muted, #74838F)" fontFamily="Inter, sans-serif">
        Dots show platoons moving between junctions
      </text>
    </svg>
  );
};
