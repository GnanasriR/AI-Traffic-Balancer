import React, { useState } from 'react';
import { useSignalSync } from '../hooks/useSignalSync';
import { Activity, Radio, ChevronDown, ChevronUp, Cpu, AlertTriangle, ShieldCheck } from 'lucide-react';

export const SyncDebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const { snapshot, connectionStatus, endpoint } = useSignalSync();

  const isConnected = connectionStatus === 'PYTHON_CONNECTED' || connectionStatus === 'CONNECTED';
  const isConnecting = connectionStatus === 'CONNECTING';

  const statusLabel = isConnected
    ? 'PYTHON CONNECTED'
    : isConnecting
    ? 'CONNECTING...'
    : 'PYTHON OFFLINE';

  const statusBg = isConnected
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    : isConnecting
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    : 'bg-rose-500/10 text-rose-400 border-rose-500/30';

  const dotBg = isConnected
    ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
    : isConnecting
    ? 'bg-amber-400 animate-pulse'
    : 'bg-rose-500';

  const ambulanceCount = snapshot?.vehicles?.filter((v) => v.isAmbulance)?.length || 0;
  const timeFormatted = snapshot?.ts
    ? new Date(snapshot.ts).toLocaleTimeString() + '.' + String(snapshot.ts % 1000).padStart(3, '0')
    : '—';

  return (
    <aside
      aria-label="Python Traffic Synchronization Monitor"
      className="fixed bottom-4 right-4 z-[9999] font-sans text-xs select-none shadow-2xl transition-all"
    >
      {/* Header / Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2.5 px-3 py-2 rounded-xl bg-slate-900/95 text-slate-100 border border-slate-700/80 backdrop-blur-md hover:bg-slate-800 transition-colors shadow-lg cursor-pointer"
      >
        <span className={`w-2.5 h-2.5 rounded-full ${dotBg}`} />
        <div className="flex items-center space-x-1.5 font-bold tracking-tight">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          <span>PYTHON SYNC</span>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${statusBg}`}>
          {statusLabel}
        </span>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
      </button>

      {/* Expanded Metrics Panel */}
      {isOpen && (
        <div className="mt-2 w-80 p-3.5 rounded-xl bg-slate-950/95 text-slate-200 border border-slate-800/90 backdrop-blur-lg shadow-2xl space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px]">
            <span className="font-semibold text-slate-400">Backend Authority</span>
            <span className="font-mono font-bold text-blue-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> PYTHON (FastAPI Server)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {/* WebSocket URL */}
            <div className="col-span-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
              <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 text-slate-400" /> WebSocket Endpoint
              </div>
              <div className="font-mono text-emerald-400 truncate mt-0.5">{endpoint}</div>
            </div>

            {/* Sequence & Timestamp */}
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
              <div className="text-[10px] uppercase font-semibold text-slate-400">Snapshot Seq</div>
              <div className="font-mono font-bold text-slate-100 text-sm mt-0.5">
                #{snapshot?.seq ?? '—'}
              </div>
            </div>

            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
              <div className="text-[10px] uppercase font-semibold text-slate-400">Snapshot Time</div>
              <div className="font-mono text-slate-200 text-xs mt-1 truncate">
                {timeFormatted}
              </div>
            </div>

            {/* Vehicles & Emergency */}
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
              <div className="text-[10px] uppercase font-semibold text-slate-400">Vehicle Count</div>
              <div className="font-mono font-bold text-slate-100 text-sm mt-0.5">
                {snapshot?.vehicles?.length ?? 0}
              </div>
            </div>

            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
              <div className="text-[10px] uppercase font-semibold text-slate-400">Ambulances</div>
              <div className={`font-mono font-bold text-sm mt-0.5 ${ambulanceCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`}>
                {ambulanceCount} active
              </div>
            </div>

            {/* Signal Phase & Remaining */}
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
              <div className="text-[10px] uppercase font-semibold text-slate-400">Active Phase</div>
              <div className="font-mono font-bold text-emerald-400 text-xs mt-0.5">
                {snapshot?.phase?.activeArm ? `${snapshot.phase.activeArm} (${snapshot.phase.state?.toUpperCase()})` : 'PED SCRAMBLE'}
              </div>
            </div>

            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
              <div className="text-[10px] uppercase font-semibold text-slate-400">Remaining Time</div>
              <div className="font-mono font-bold text-amber-400 text-sm mt-0.5">
                {snapshot?.phase?.remaining !== undefined ? `${snapshot.phase.remaining.toFixed(1)}s` : '—'}
              </div>
            </div>

            {/* XGBoost AI Engine Telemetry */}
            <div className="col-span-2 bg-purple-950/40 p-2.5 rounded-lg border border-purple-800/50 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="uppercase font-bold text-purple-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  XGBoost AI Model
                </span>
                <span className="font-mono px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-200 text-[9px] font-bold border border-purple-700/50">
                  {snapshot?.ai?.model || 'XGBoost'} {snapshot?.ai?.enabled ? 'ADAPTIVE' : 'FIXED'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                <div>
                  <span className="text-slate-400">Target Arm: </span>
                  <span className="font-mono font-bold text-emerald-300">
                    {snapshot?.ai?.selected_arm || snapshot?.phase?.activeArm || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Rec. Green: </span>
                  <span className="font-mono font-bold text-amber-300">
                    {snapshot?.ai?.recommended_green ? `${snapshot.ai.recommended_green.toFixed(1)}s` : `${snapshot?.phase?.allocatedGreen || 25}s`}
                  </span>
                </div>
              </div>
              {snapshot?.ai?.demand_scores && (
                <div className="pt-1 border-t border-purple-800/40 flex items-center justify-between text-[9px] font-mono text-purple-200">
                  <span>Scores:</span>
                  <span>S:{Math.round(snapshot.ai.demand_scores.SOUTH || 0)}</span>
                  <span>N:{Math.round(snapshot.ai.demand_scores.NORTH || 0)}</span>
                  <span>E:{Math.round(snapshot.ai.demand_scores.EAST || 0)}</span>
                  <span>W:{Math.round(snapshot.ai.demand_scores.WEST || 0)}</span>
                </div>
              )}
            </div>

            {/* Simulation Control State */}
            <div className="col-span-2 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Simulation State</span>
              <span className="font-mono text-[11px] font-bold">
                {snapshot?.control?.running ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400" /> RUNNING ({snapshot.control.rate}x)
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" /> PAUSED
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
