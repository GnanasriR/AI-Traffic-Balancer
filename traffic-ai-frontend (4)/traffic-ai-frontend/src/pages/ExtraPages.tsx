import React, { useState } from 'react';
import type { User } from '../services/authStore';
import { MOCK_JUNCTIONS, MOCK_HISTORY } from '../services/trafficData';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { BarChart3, Network, TrendingDown, Clock, Car, Leaf } from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface PageProps { user: User; }

// ── Junction Network Page ────────────────────────────────────────
export const NetworkPage: React.FC<PageProps> = ({ user: _user }) => {
  const [selectedId, setSelectedId] = useState('J1');

  const connections = [
    { from: 'J1', to: 'J2', offset: 28, status: 'ACTIVE' },
    { from: 'J1', to: 'J3', offset: 25, status: 'ACTIVE' },
    { from: 'J2', to: 'J3', offset: 22, status: 'ACTIVE' },
    { from: 'J3', to: 'J4', offset: 28, status: 'SYNCING' },
  ];

  const levelColors: Record<string, string> = {
    LIGHT: 'border-emerald-300 bg-emerald-50',
    MODERATE: 'border-amber-300 bg-amber-50',
    HEAVY: 'border-red-300 bg-red-50',
  };

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto">
      <ConnectionBanner state="DISCONNECTED" />

      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100">
            <Network className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Multi-Junction Coordination Network</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              J1–J4 Green Wave Synchronization · Offset management for corridor coordination
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Network topology */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-black text-slate-900 mb-5">Junction Network Topology</h2>

          {/* Visual grid */}
          <div className="relative">
            {/* Connection lines (SVG) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
              {/* J1 → J2 */}
              <line x1="20%" y1="50%" x2="80%" y2="20%" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 3" opacity="0.5" />
              {/* J1 → J3 */}
              <line x1="20%" y1="50%" x2="50%" y2="80%" stroke="#10b981" strokeWidth="2" strokeDasharray="6 3" opacity="0.5" />
              {/* J2 → J3 */}
              <line x1="80%" y1="20%" x2="50%" y2="80%" stroke="#10b981" strokeWidth="2" strokeDasharray="6 3" opacity="0.5" />
              {/* J3 → J4 */}
              <line x1="50%" y1="80%" x2="80%" y2="75%" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6 3" opacity="0.5" />
            </svg>

            {/* Junction nodes */}
            <div className="relative min-h-64" style={{ zIndex: 1 }}>
              {[
                { id: 'J1', label: 'Central Junction', x: '10%', y: '40%' },
                { id: 'J2', label: 'Business Loop', x: '72%', y: '8%' },
                { id: 'J3', label: 'North Connector', x: '42%', y: '68%' },
                { id: 'J4', label: 'South Expressway', x: '72%', y: '64%' },
              ].map(node => {
                const j = MOCK_JUNCTIONS.find(jj => jj.id === node.id)!;
                const isSelected = node.id === selectedId;
                const lc = levelColors[j.trafficLevel] ?? levelColors['LIGHT'];
                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedId(node.id)}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all`}
                    style={{ left: node.x, top: node.y }}
                  >
                    <div className={`rounded-2xl border-2 p-3 min-w-[130px] text-center shadow-md transition-all ${isSelected ? 'border-blue-500 bg-blue-50 shadow-blue-500/15' : `${lc} shadow-slate-200/50`}`}>
                      <div className={`w-9 h-9 rounded-xl mx-auto mb-2 flex items-center justify-center text-sm font-black text-white shadow-sm ${isSelected ? 'bg-blue-600' : 'bg-slate-700'}`}>
                        {node.id}
                      </div>
                      <div className="text-xs font-black text-slate-900 leading-tight">{node.label}</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">{j.totalVehicles} vehicles</div>
                      {/* Mini phase dots */}
                      <div className="flex justify-center space-x-1 mt-2">
                        {j.directions.map(d => (
                          <div key={d.direction} className={`w-2 h-2 rounded-full ${d.phase === 'GREEN' ? 'bg-emerald-500' : d.phase === 'YELLOW' ? 'bg-amber-400' : 'bg-red-500'}`} />
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Green Wave Connections Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-black text-slate-900">Green Wave Synchronization</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['From', 'To', 'Phase Offset', 'Status', 'Throughput Gain'].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {connections.map(c => (
                  <tr key={`${c.from}-${c.to}`} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-black">{c.from}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-black">{c.to}</span>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-bold text-slate-700">{c.offset}s</td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-bold text-emerald-700">+{22 + connections.indexOf(c) * 3}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected junction detail */}
        {(() => {
          const j = MOCK_JUNCTIONS.find(jj => jj.id === selectedId)!;
          return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-black text-slate-900 mb-4">
                {j.id} — {j.name} · Direction Detail
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {j.directions.map(d => (
                  <div key={d.direction} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-slate-700">{d.direction}</span>
                      <div className={`w-2.5 h-2.5 rounded-full ${d.phase === 'GREEN' ? 'bg-emerald-500' : d.phase === 'YELLOW' ? 'bg-amber-400' : 'bg-red-500'}`} />
                    </div>
                    <div className="space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between text-slate-600"><span>Queue</span><span className="font-black">{d.queueLength}</span></div>
                      <div className="flex justify-between text-slate-600"><span>Speed</span><span className="font-black">{d.avgSpeed} km/h</span></div>
                      <div className="flex justify-between text-slate-600"><span>Green</span><span className="font-black text-blue-700">{d.greenAllocated}s</span></div>
                      <div className="flex justify-between text-slate-600"><span>Wait</span><span className="font-black">{d.waitTime}s</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

// ── Analytics Page ───────────────────────────────────────────────
export const AnalyticsPage: React.FC<PageProps> = ({ user: _user }) => {
  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto">
      <ConnectionBanner state="DISCONNECTED" />

      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-purple-50 border border-purple-100">
            <BarChart3 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Performance Analytics & Telemetry</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Historical wait time, queue trends, and throughput — Python backend data preview
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Peak Wait Reduction', value: '42s → 25s', sub: '-38% vs fixed timing', color: 'blue', icon: TrendingDown },
            { label: 'Morning Rush Cleared', value: '09:48 AM', sub: '12 min ahead of baseline', color: 'emerald', icon: Clock },
            { label: 'Vehicles Cleared Today', value: '1,284', sub: '+8% vs yesterday', color: 'purple', icon: Car },
            { label: 'Emissions Saved', value: '12.4 kg CO₂', sub: 'Idle time reduction', color: 'teal', icon: Leaf },
          ].map(k => {
            const Icon = k.icon;
            const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
              blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    border: 'border-blue-100' },
              emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
              purple:  { bg: 'bg-purple-50',  icon: 'text-purple-600',  border: 'border-purple-100' },
              teal:    { bg: 'bg-teal-50',    icon: 'text-teal-600',    border: 'border-teal-100' },
            };
            const cc = colorMap[k.color];
            return (
              <div key={k.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className={`p-2 rounded-xl ${cc.bg} border ${cc.border} w-fit mb-2.5`}>
                  <Icon className={`w-4 h-4 ${cc.icon}`} />
                </div>
                <div className="text-base font-black text-slate-900 tracking-tight">{k.value}</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">{k.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{k.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Wait Time Comparison Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-black text-slate-900">Wait Time — AI vs Fixed Timing</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Average vehicle wait time (seconds) across all junctions · Hourly</p>
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold">
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-0.5 bg-blue-500 rounded-full" />
                <span className="text-slate-600">AI Adaptive</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-0.5 bg-slate-400 rounded-full" style={{ borderTop: '2px dashed' }} />
                <span className="text-slate-600">Fixed 30s</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={MOCK_HISTORY} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fixedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} unit="s" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0', fontWeight: 600 }}
                labelStyle={{ fontWeight: 800, color: '#0f172a' }}
              />
              <Area type="monotone" dataKey="fixedWait" name="Fixed 30s" stroke="#94a3b8" fill="url(#fixedGrad)" strokeDasharray="5 3" strokeWidth={2} />
              <Area type="monotone" dataKey="aiWait" name="AI Adaptive" stroke="#3b82f6" fill="url(#aiGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Queue Length Trend */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="mb-5">
            <h2 className="text-sm font-black text-slate-900">Queue Length Trends — All Directions</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Vehicle queue per direction at Junction J1 (primary) · Hourly average</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={MOCK_HISTORY} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} unit=" veh" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0', fontWeight: 600 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
              <Line type="monotone" dataKey="queueNorth" name="North" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="queueSouth" name="South" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="queueEast" name="East" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="queueWest" name="West" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Throughput Trend */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="mb-5">
            <h2 className="text-sm font-black text-slate-900">Vehicle Throughput — Hourly</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Total vehicles cleared through all managed junctions per hour</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={MOCK_HISTORY} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="throughGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} unit=" veh" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0', fontWeight: 600 }} />
              <Area type="monotone" dataKey="throughput" name="Throughput" stroke="#10b981" fill="url(#throughGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
