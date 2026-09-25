import React from 'react';
import type { HistoryPoint } from '../types/signalsync';

interface AreaChartSVGProps {
  data: HistoryPoint[];
  dataKey: 'veh' | 'queue' | 'wait' | 'spd';
  color: string;
  height?: number;
}

export const AreaChartSVG: React.FC<AreaChartSVGProps> = ({
  data,
  dataKey,
  color,
  height = 160,
}) => {
  if (data.length < 2) {
    return (
      <div className="muted" style={{ padding: '30px 0', textAlign: 'center' }}>
        Waiting for the next snapshots…
      </div>
    );
  }

  const w = 640;
  const pad = { l: 30, r: 8, t: 12, b: 18 };
  const vals = data.map((d) => d[dataKey]);
  const max = Math.max(...vals, 1) * 1.15;
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  const X = (i: number) => pad.l + (i / (data.length - 1)) * iw;
  const Y = (v: number) => pad.t + ih - (v / max) * ih;

  const line = data
    .map((d, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(d[dataKey]).toFixed(1)}`)
    .join('');

  const id = 'chart-' + dataKey;
  const ticks = [0, 0.5, 1].map((fr) => {
    const v = max * fr;
    const y = Y(v);
    return (
      <g key={fr}>
        <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--line-2, #EEF1F4)" />
        <text x={4} y={y + 4} fontSize={10} fill="var(--muted, #74838F)">
          {Math.round(v)}
        </text>
      </g>
    );
  });

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.24} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {ticks}
      <path
        d={`${line}L${X(data.length - 1).toFixed(1)},${pad.t + ih}L${pad.l},${pad.t + ih}Z`}
        fill={`url(#${id})`}
      />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <circle
        cx={X(data.length - 1)}
        cy={Y(vals[vals.length - 1])}
        r={3.5}
        fill={color}
      />
    </svg>
  );
};
