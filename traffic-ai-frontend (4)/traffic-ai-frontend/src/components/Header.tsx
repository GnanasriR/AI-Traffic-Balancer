import React from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Zap, 
  Clock, 
  Siren, 
  Radio, 
  Cpu, 
  Sparkles
} from 'lucide-react';
import type { ConnectionStatus } from '../services/websocketClient';

interface HeaderProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSetSpeed: (speed: number) => void;
  mode: 'FIXED_TRADITIONAL' | 'AI_ADAPTIVE';
  onToggleMode: () => void;
  connectionStatus: ConnectionStatus;
  onTriggerEmergency: () => void;
  onReset: () => void;
  emergencyActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isPlaying,
  onTogglePlay,
  speed,
  onSetSpeed,
  mode,
  onToggleMode,
  connectionStatus,
  onTriggerEmergency,
  onReset,
  emergencyActive,
}) => {
  return (
    <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-6 py-3.5 sticky top-0 z-50 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 max-w-[1700px] mx-auto">
        {/* Left: Brand Identity */}
        <div className="flex items-center space-x-3.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Cpu className="w-5 h-5" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black tracking-tight text-slate-900">
                Transit<span className="text-blue-600">Flow</span> <span className="text-emerald-600">AI</span>
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Enterprise v2.4
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Autonomous Multi-Junction Traffic Signal Optimization Platform
            </p>
          </div>
        </div>

        {/* Center: Command Controls */}
        <div className="flex items-center space-x-2.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-inner">
          {/* Play/Pause */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
              isPlaying
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? 'PAUSE' : 'RESUME'}</span>
          </button>

          {/* Speeds */}
          <div className="flex items-center space-x-0.5 bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => onSetSpeed(s)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  speed === s
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-300" />

          {/* Mode Switcher */}
          <button
            onClick={onToggleMode}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-xs ${
              mode === 'AI_ADAPTIVE'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
            }`}
          >
            {mode === 'AI_ADAPTIVE' ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" style={{ animationDuration: '4s' }} />
                <span>AI ADAPTIVE TIMING</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>FIXED 30s/30s (PRE-AI)</span>
              </>
            )}
          </button>

          {/* Ambulance Preemption */}
          <button
            onClick={onTriggerEmergency}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-xs ${
              emergencyActive
                ? 'bg-red-600 text-white animate-pulse border-red-700 shadow-md shadow-red-500/20'
                : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
            }`}
          >
            <Siren className={`w-3.5 h-3.5 ${emergencyActive ? 'animate-bounce' : 'text-rose-600'}`} />
            <span>AMBULANCE PREEMPTION</span>
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            title="Reset Simulation"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Operational Status Badges */}
        <div className="flex items-center space-x-2.5 text-xs">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 shadow-xs">
            <Radio className={`w-3.5 h-3.5 ${(connectionStatus === 'CONNECTED' || connectionStatus === 'PYTHON_CONNECTED') ? 'text-emerald-600 animate-pulse' : 'text-blue-600'}`} />
            <span className="font-mono text-[11px] font-semibold">
              {(connectionStatus === 'CONNECTED' || connectionStatus === 'PYTHON_CONNECTED')
                ? 'PYTHON SIMULATOR: LIVE'
                : 'SIMULATOR: AUTONOMOUS'}
            </span>
            <span className={`w-2 h-2 rounded-full ${(connectionStatus === 'CONNECTED' || connectionStatus === 'PYTHON_CONNECTED') ? 'bg-emerald-500' : 'bg-blue-500'}`} />
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-mono text-[11px] font-bold">XGBOOST ML: ACTIVE</span>
          </div>
        </div>
      </div>
    </header>
  );
};
