import React from 'react';
import type { JunctionStatus, DirectionData, SignalPhase } from '../services/trafficData';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Clock, Car, Gauge } from 'lucide-react';

// ── Signal Light Component ───────────────────────────────────────
const SignalLight: React.FC<{ phase: SignalPhase; size?: 'sm' | 'md' | 'lg' }> = ({ phase, size = 'md' }) => {
  const sizes = { sm: 'w-3 h-3', md: 'w-4 h-4', lg: 'w-5 h-5' };
  const dotSize = sizes[size];

  const lights: SignalPhase[] = ['RED', 'YELLOW', 'GREEN'];
  const activeColors: Record<SignalPhase, string> = {
    RED: 'bg-red-500 shadow-red-500/60',
    YELLOW: 'bg-amber-400 shadow-amber-400/60',
    GREEN: 'bg-emerald-500 shadow-emerald-500/60',
  };
  const inactiveColors: Record<SignalPhase, string> = {
    RED: 'bg-red-200/40',
    YELLOW: 'bg-amber-200/40',
    GREEN: 'bg-emerald-200/40',
  };

  return (
    <div className="flex flex-col items-center space-y-1 bg-slate-800 p-1.5 rounded-lg border border-slate-700">
      {lights.map(l => (
        <div
          key={l}
          className={`${dotSize} rounded-full transition-all duration-300 ${
            phase === l
              ? `${activeColors[l]} shadow-lg`
              : inactiveColors[l]
          }`}
        />
      ))}
    </div>
  );
};

// ── Direction Phase Card ─────────────────────────────────────────
const PhaseCard: React.FC<{ data: DirectionData }> = ({ data }) => {
  const dirIcon = {
    NORTH: ArrowUp,
    SOUTH: ArrowDown,
    EAST: ArrowRight,
    WEST: ArrowLeft,
  }[data.direction];
  const Icon = dirIcon;

  const phaseColors: Record<SignalPhase, { bg: string; text: string; bar: string; border: string }> = {
    GREEN:  { bg: 'bg-emerald-50', text: 'text-emerald-800', bar: 'bg-emerald-500', border: 'border-emerald-200' },
    YELLOW: { bg: 'bg-amber-50',   text: 'text-amber-800',   bar: 'bg-amber-400',   border: 'border-amber-200' },
    RED:    { bg: 'bg-red-50',     text: 'text-red-800',     bar: 'bg-red-500',      border: 'border-red-200' },
  };

  const c = phaseColors[data.phase];
  const densityPct = Math.min(100, data.density);

  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-4 flex flex-col space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-lg bg-white/70 border ${c.border}`}>
            <Icon className={`w-4 h-4 ${c.text}`} />
          </div>
          <span className={`text-sm font-black ${c.text}`}>{data.direction}</span>
        </div>
        <SignalLight phase={data.phase} size="sm" />
      </div>

      {/* Phase + Timer */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/60 border ${c.border} ${c.text}`}>
          {data.phase}
        </span>
        <div className={`flex items-center space-x-1 text-xs font-mono font-bold ${c.text}`}>
          <Clock className="w-3.5 h-3.5" />
          <span>{data.phaseRemaining}s</span>
        </div>
      </div>

      {/* Density Bar */}
      <div>
        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
          <span>Density</span>
          <span>{densityPct}%</span>
        </div>
        <div className="w-full bg-white/50 rounded-full h-1.5 border border-white/80">
          <div
            className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
            style={{ width: `${densityPct}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/50">
        <div className="text-center">
          <div className="text-[10px] text-slate-500 font-semibold">Queue</div>
          <div className={`text-sm font-black font-mono ${c.text}`}>{data.queueLength}</div>
        </div>
        <div className="text-center border-x border-white/50">
          <div className="text-[10px] text-slate-500 font-semibold">Speed</div>
          <div className={`text-sm font-black font-mono ${c.text}`}>{data.avgSpeed}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-slate-500 font-semibold">Wait</div>
          <div className={`text-sm font-black font-mono ${c.text}`}>{data.waitTime}s</div>
        </div>
      </div>

      {/* AI Green Allocation */}
      <div className={`flex items-center justify-between text-[10px] font-semibold text-slate-500 border-t border-white/50 pt-2`}>
        <span>AI Green Allocation</span>
        <span className="font-mono font-black text-blue-700">{data.greenAllocated}s</span>
      </div>
    </div>
  );
};

// ── Junction Signal Control Panel ────────────────────────────────
interface SignalControlPanelProps {
  junction: JunctionStatus;
  onToggleMode?: (junctionId: string) => void;
  onForcePhase?: (junctionId: string, direction: Direction) => void;
}

type Direction = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

const levelColors: Record<string, { badge: string }> = {
  LIGHT:    { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MODERATE: { badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  HEAVY:    { badge: 'bg-red-50 text-red-700 border-red-200' },
  CRITICAL: { badge: 'bg-red-100 text-red-900 border-red-300' },
};

export const SignalControlPanel: React.FC<SignalControlPanelProps> = ({
  junction,
  onToggleMode,
}) => {
  const lc = levelColors[junction.trafficLevel] ?? levelColors['LIGHT'];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Junction Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600 text-white text-xs font-black shadow-md shadow-blue-500/20">
              {junction.id}
            </div>
            <div>
              <div className="text-base font-black text-slate-900">{junction.name}</div>
              <div className="text-[11px] text-slate-500 font-medium">{junction.location}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider ${lc.badge}`}>
            {junction.trafficLevel}
          </span>

          {/* Mode Toggle */}
          <button
            onClick={() => onToggleMode?.(junction.id)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              junction.aiMode
                ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
            title="Toggle AI / Fixed timing mode"
          >
            <div className={`w-2 h-2 rounded-full ${junction.aiMode ? 'bg-blue-500' : 'bg-slate-400'}`} />
            <span>{junction.aiMode ? 'AI Adaptive' : 'Fixed 30s'}</span>
          </button>
        </div>
      </div>

      {/* Cycle Metrics Strip */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        {[
          { icon: Car, label: 'Total Vehicles', value: junction.totalVehicles, unit: '' },
          { icon: Clock, label: 'Cycle Time', value: junction.currentCycleTime, unit: 's' },
          { icon: Gauge, label: 'AI Cycle Eff.', value: `${Math.round((1 - junction.currentCycleTime / 120) * 100 + 60)}`, unit: '%' },
        ].map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="flex items-center space-x-2.5 px-4 py-3">
              <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-semibold">{m.label}</div>
                <div className="text-sm font-black text-slate-900 font-mono">{m.value}{m.unit}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Direction Phase Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        {junction.directions.map(dir => (
          <PhaseCard key={dir.direction} data={dir} />
        ))}
      </div>

      {/* Last Update Footer */}
      <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-medium">
          Data source: Python Simulator (static preview)
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          {new Date(junction.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

// ── Multi-Junction Overview Grid ─────────────────────────────────
interface JunctionOverviewGridProps {
  junctions: JunctionStatus[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export const JunctionOverviewGrid: React.FC<JunctionOverviewGridProps> = ({
  junctions, selectedId, onSelect,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {junctions.map(j => {
        const lc = levelColors[j.trafficLevel] ?? levelColors['LIGHT'];
        const isSelected = j.id === selectedId;
        return (
          <button
            key={j.id}
            onClick={() => onSelect(j.id)}
            className={`text-left rounded-2xl border p-4 transition-all cursor-pointer ${
              isSelected
                ? 'border-blue-400 bg-blue-50 shadow-md shadow-blue-500/10'
                : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-sm ${isSelected ? 'bg-blue-600' : 'bg-slate-700'}`}>
                {j.id}
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${lc.badge}`}>
                {j.trafficLevel}
              </span>
            </div>
            <div className="text-sm font-black text-slate-900 leading-tight">{j.name}</div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5 mb-2.5 leading-tight">{j.location}</div>

            {/* Mini signal phases */}
            <div className="flex space-x-1">
              {j.directions.map(d => (
                <div key={d.direction} className="flex-1 flex flex-col items-center space-y-0.5">
                  <div className={`w-2 h-2 rounded-full ${d.phase === 'GREEN' ? 'bg-emerald-500' : d.phase === 'YELLOW' ? 'bg-amber-400' : 'bg-red-500'}`} />
                  <div className="text-[8px] text-slate-400 font-bold">{d.direction[0]}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
              <span className="text-[10px] text-slate-500">{j.totalVehicles} vehicles</span>
              <span className={`text-[10px] font-bold ${j.aiMode ? 'text-blue-600' : 'text-slate-400'}`}>
                {j.aiMode ? '● AI' : '○ Fixed'}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
