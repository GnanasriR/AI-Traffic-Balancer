import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export type ConnectionState = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'PYTHON_CONNECTED' | 'PYTHON_OFFLINE';

interface ConnectionBannerProps {
  state: ConnectionState;
  endpoint?: string;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  state,
  endpoint = 'ws://localhost:8000/ws/traffic',
}) => {
  if (state === 'CONNECTED' || state === 'PYTHON_CONNECTED') return null;

  return (
    <div className={`flex items-center justify-between px-4 py-2.5 text-xs font-semibold ${
      state === 'CONNECTING'
        ? 'bg-amber-50 border-b border-amber-200 text-amber-800'
        : 'bg-slate-100 border-b border-slate-200 text-slate-600'
    }`}>
      <div className="flex items-center space-x-2.5">
        {state === 'CONNECTING' ? (
          <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-slate-400" />
        )}
        <span>
          {state === 'CONNECTING'
            ? 'Attempting to connect to Python traffic simulator…'
            : 'Python backend not connected — displaying reference data. Connect backend to enable live control.'}
        </span>
        <code className="px-1.5 py-0.5 rounded bg-white/70 border border-current/20 font-mono text-[10px]">
          {endpoint}
        </code>
      </div>
      <div className={`flex items-center space-x-1.5 font-bold uppercase tracking-wider text-[10px] ${
        state === 'CONNECTING' ? 'text-amber-700' : 'text-slate-500'
      }`}>
        <div className={`w-2 h-2 rounded-full ${state === 'CONNECTING' ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'}`} />
        <span>{state}</span>
      </div>
    </div>
  );
};
