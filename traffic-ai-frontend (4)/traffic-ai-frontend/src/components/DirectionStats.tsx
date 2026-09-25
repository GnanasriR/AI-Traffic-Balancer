import React from 'react';
import type { DirectionMetrics } from '../types/traffic';
import { 
  Car, 
  Clock, 
  Gauge, 
  AlertCircle, 
  CheckCircle2, 
  Flame,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

interface DirectionStatsProps {
  metrics: {
    NORTH: DirectionMetrics;
    SOUTH: DirectionMetrics;
    EAST: DirectionMetrics;
    WEST: DirectionMetrics;
  };
  onSurgeDirection?: (direction: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST') => void;
}

export const DirectionStats: React.FC<DirectionStatsProps> = ({ metrics, onSurgeDirection }) => {
  const directions: ('NORTH' | 'SOUTH' | 'EAST' | 'WEST')[] = ['NORTH', 'SOUTH', 'EAST', 'WEST'];

  const getDirectionIcon = (dir: string) => {
    switch (dir) {
      case 'NORTH': return <ArrowDown className="w-4 h-4 text-blue-600" />;
      case 'SOUTH': return <ArrowUp className="w-4 h-4 text-blue-600" />;
      case 'EAST': return <ArrowLeft className="w-4 h-4 text-blue-600" />;
      case 'WEST': return <ArrowRight className="w-4 h-4 text-blue-600" />;
      default: return null;
    }
  };

  const getCongestionBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 animate-pulse">
            <Flame className="w-3 h-3 text-red-600" />
            <span>CRITICAL</span>
          </span>
        );
      case 'HIGH':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            <span>HIGH</span>
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <span>MEDIUM</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>OPTIMAL</span>
          </span>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {directions.map((dir) => {
        const d = metrics[dir];
        const isGreen = d.signalState === 'GREEN';
        const isYellow = d.signalState === 'YELLOW';

        return (
          <div
            key={dir}
            onClick={() => onSurgeDirection?.(dir)}
            className="enterprise-card p-3.5 hover:border-blue-300 hover:shadow-enterprise-md transition-all cursor-pointer group"
            title={`Click to add vehicles to ${dir} corridor`}
          >
            {/* Header: Direction name & Signal pill */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                  {getDirectionIcon(dir)}
                </div>
                <span className="font-bold text-sm tracking-wide text-slate-900">
                  {dir} APPROACH
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {getCongestionBadge(d.congestion)}
                <div className={`w-3 h-3 rounded-full border border-white shadow-xs ${
                  isGreen 
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' 
                    : isYellow 
                    ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' 
                    : 'bg-red-500'
                }`} />
              </div>
            </div>

            {/* Core Metrics: Vehicle Count & Queue */}
            <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                  <Car className="w-3 h-3 text-slate-400" />
                  <span>Active Vehicles</span>
                </div>
                <div className="text-sm font-black text-slate-900 font-mono mt-0.5">
                  {d.vehicleCount} vehicles · <span className="text-[12px] font-bold text-blue-600">{(d.effectivePce ?? d.vehicleCount).toFixed(1)} PCE</span>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Queue Length</span>
                </div>
                <div className="text-base font-black text-amber-600 font-mono mt-0.5">
                  {d.queueLength} <span className="text-[11px] font-bold text-amber-700">veh</span>
                </div>
              </div>
            </div>

            {/* Density Progress Bar */}
            <div className="mb-2.5">
              <div className="flex justify-between text-[11px] text-slate-600 mb-1 font-medium">
                <span>Lane Capacity Density</span>
                <span className="font-mono font-bold text-slate-800">{d.density}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    d.density > 75
                      ? 'bg-red-500'
                      : d.density > 45
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, d.density)}%` }}
                />
              </div>
            </div>

            {/* Speed & Wait Time Footer */}
            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-slate-100 font-mono">
              <span className="flex items-center space-x-1">
                <Gauge className="w-3.5 h-3.5 text-slate-400" />
                <span>Avg: <strong>{d.avgSpeed} km/h</strong></span>
              </span>
              <span>Wait: <strong className="text-slate-800">{d.avgWaitTime}s</strong></span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
