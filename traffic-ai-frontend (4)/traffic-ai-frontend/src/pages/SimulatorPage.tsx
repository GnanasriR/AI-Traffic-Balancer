import React, { useState } from 'react';
import { MOCK_JUNCTIONS } from '../services/trafficData';
import type { JunctionStatus } from '../services/trafficData';
import { SignalControlPanel, JunctionOverviewGrid } from '../components/SignalControlPanel';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { Signal, Lock, Unlock, AlertCircle } from 'lucide-react';

export const SignalControlPage: React.FC = () => {
  const [junctions, setJunctions] = useState<JunctionStatus[]>(MOCK_JUNCTIONS);
  const [selectedId, setSelectedId] = useState<string>('J1');
  const [overrideMsg, setOverrideMsg] = useState('');

  const selectedJunction = junctions.find(j => j.id === selectedId)!;

  const handleToggleMode = (id: string) => {
    setJunctions(prev =>
      prev.map(j => j.id === id ? { ...j, aiMode: !j.aiMode } : j)
    );
    const junction = junctions.find(j => j.id === id)!;
    const newMode = !junction.aiMode;
    setOverrideMsg(
      `${id}: Switched to ${newMode ? 'AI Adaptive' : 'Fixed 30s'} mode. ` +
      (newMode ? 'AI is now managing signal timings.' : 'Manual override active — signals use fixed 30s cycles.')
    );
    setTimeout(() => setOverrideMsg(''), 5000);
  };

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto">
      <ConnectionBanner state="DISCONNECTED" />

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
              <Signal className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Signal Control Centre</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Live junction phase management · Powered by Python AI Optimizer
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500">
              <div className="w-2 h-2 bg-slate-400 rounded-full" />
              <span>AWAITING BACKEND</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Override notification */}
        {overrideMsg && (
          <div className="flex items-center space-x-2.5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-800">
            <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span>{overrideMsg}</span>
          </div>
        )}

        {/* How to connect info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-blue-100 border border-blue-200 flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-black text-blue-900">Python Backend Integration</div>
              <p className="text-xs text-blue-700 font-medium mt-1 leading-relaxed">
                This Signal Control Centre is ready to connect to your Python traffic simulator via WebSocket.
                Start your FastAPI/Spring Boot backend, then this panel will display live phase data, allow real-time phase overrides,
                and relay AI timing recommendations automatically.
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <code className="text-[11px] font-mono bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg text-blue-800">
                  ws://localhost:8000/ws/traffic
                </code>
                <span className="text-[11px] text-blue-600 font-semibold">·</span>
                <code className="text-[11px] font-mono bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg text-blue-800">
                  POST /api/signal/override
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Junction Selector Grid */}
        <div>
          <h2 className="text-sm font-black text-slate-900 mb-3">Select Junction</h2>
          <JunctionOverviewGrid
            junctions={junctions}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Signal Control Panel for selected junction */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-slate-900">
              Signal Detail — {selectedJunction.name}
            </h2>
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500">
              {selectedJunction.aiMode ? (
                <><Unlock className="w-3.5 h-3.5 text-blue-500" /><span className="text-blue-600">AI is managing signals</span></>
              ) : (
                <><Lock className="w-3.5 h-3.5 text-amber-500" /><span className="text-amber-700">Fixed mode — manual override</span></>
              )}
            </div>
          </div>
          <SignalControlPanel
            junction={selectedJunction}
            onToggleMode={handleToggleMode}
          />
        </div>

        {/* All Junctions Compact Summary */}
        <div>
          <h2 className="text-sm font-black text-slate-900 mb-3">All Junctions — Phase Summary</h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {['Junction', 'Location', 'Active Phase', 'N Queue', 'S Queue', 'E Queue', 'W Queue', 'Mode', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {junctions.map(j => {
                  const greenDirs = j.directions.filter(d => d.phase === 'GREEN').map(d => d.direction).join(', ');
                  const levelColors: Record<string, string> = {
                    LIGHT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    MODERATE: 'bg-amber-50 text-amber-800 border-amber-200',
                    HEAVY: 'bg-red-50 text-red-700 border-red-200',
                  };
                  return (
                    <tr
                      key={j.id}
                      onClick={() => setSelectedId(j.id)}
                      className={`border-b border-slate-50 cursor-pointer transition-colors ${j.id === selectedId ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[11px] font-black">{j.id}</div>
                          <span className="font-bold text-slate-900 text-xs">{j.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-medium max-w-[140px] truncate">{j.location}</td>
                      <td className="px-4 py-3 text-xs font-mono text-emerald-700 font-bold">{greenDirs || '—'} GREEN</td>
                      {j.directions.map(d => (
                        <td key={d.direction} className="px-4 py-3 text-xs font-mono font-bold text-slate-700">{d.queueLength}</td>
                      ))}
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${j.aiMode ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {j.aiMode ? 'AI' : 'Fixed'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${levelColors[j.trafficLevel] ?? levelColors['LIGHT']}`}>
                          {j.trafficLevel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
