import React from 'react';
import type { SignalOptimizationResult, DirectionMetrics } from '../types/traffic';
import { 
  BrainCircuit, 
  ShieldCheck, 
  ArrowRight, 
  TrendingDown, 
  Fuel, 
  Leaf, 
  Sliders, 
  Cpu,
  Binary
} from 'lucide-react';

interface AIOptimizerPanelProps {
  optimization: SignalOptimizationResult;
  northMetrics: DirectionMetrics;
  southMetrics: DirectionMetrics;
  eastMetrics: DirectionMetrics;
  westMetrics: DirectionMetrics;
}

export const AIOptimizerPanel: React.FC<AIOptimizerPanelProps> = ({
  optimization,
  northMetrics,
  southMetrics,
  eastMetrics,
  westMetrics
}) => {
  const isAdaptive = optimization.mode === 'AI_ADAPTIVE';

  return (
    <div className="enterprise-card p-4 space-y-4">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-xs">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase">
              AI Signal Optimization Engine
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              XGBoost Congestion Prediction & Dynamic Linear Program
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold">
          <Cpu className="w-3.5 h-3.5 text-emerald-600 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Model Accuracy: {optimization.confidenceScore}%</span>
        </div>
      </div>

      {/* Comparison: Pre-AI vs After AI Timings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Pre-AI Fixed */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          !isAdaptive 
            ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/30' 
            : 'bg-slate-50 border-slate-200 opacity-80'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-900 tracking-wider">
              TRADITIONAL FIXED TIMING
            </span>
            <span className="text-[10px] text-slate-500 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
              PRE-AI
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">North / South Green:</span>
              <span className="font-mono font-bold text-slate-900">
                {optimization.beforeAi.northSouthGreen}s
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: '50%' }} />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">East / West Green:</span>
              <span className="font-mono font-bold text-slate-900">
                {optimization.beforeAi.eastWestGreen}s
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: '50%' }} />
            </div>
          </div>

          <div className="mt-3 text-[11px] text-slate-600 border-t border-slate-200 pt-2 flex justify-between font-mono">
            <span>Cycle Length: 68s</span>
            <span className="text-amber-700 font-semibold">Static Cycle</span>
          </div>
        </div>

        {/* AI Adaptive */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          isAdaptive 
            ? 'bg-emerald-50/70 border-emerald-300 shadow-sm ring-2 ring-emerald-400/30' 
            : 'bg-slate-50 border-slate-200 opacity-80'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-900 tracking-wider flex items-center space-x-1.5">
              <span>AI DYNAMIC TIMING</span>
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
            </span>
            <span className="text-[10px] text-emerald-800 font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
              OPTIMIZED
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 font-semibold">North / South Green:</span>
              <span className="font-mono font-bold text-emerald-700 text-sm">
                {optimization.afterAi.northSouthGreen}s
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${(optimization.afterAi.northSouthGreen / 65) * 100}%` }} 
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 font-semibold">East / West Green:</span>
              <span className="font-mono font-bold text-blue-700 text-sm">
                {optimization.afterAi.eastWestGreen}s
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${(optimization.afterAi.eastWestGreen / 65) * 100}%` }} 
              />
            </div>
          </div>

          <div className="mt-3 text-[11px] text-slate-700 border-t border-emerald-200 pt-2 flex justify-between font-mono">
            <span>Cycle Length: {optimization.afterAi.cycleTime}s</span>
            <span className="text-emerald-700 font-bold">Dynamic Actuation</span>
          </div>
        </div>
      </div>

      {/* Step 3: XGBoost Ingested Features & Predictions Table */}
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-800 uppercase flex items-center space-x-1.5">
            <Binary className="w-3.5 h-3.5 text-blue-600" />
            <span>XGBoost Real-Time Traffic Prediction Model</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Inference: 12ms</span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
          {[
            { dir: 'NORTH', m: northMetrics },
            { dir: 'SOUTH', m: southMetrics },
            { dir: 'EAST', m: eastMetrics },
            { dir: 'WEST', m: westMetrics }
          ].map(({ dir, m }) => (
            <div key={dir} className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs">
              <div className="font-bold text-slate-800">{dir}</div>
              <div className="text-slate-500 mt-0.5">Vehicles: <strong className="text-slate-900">{m.vehicleCount}</strong></div>
              <div className="text-slate-500">Queue: <strong className="text-amber-600">{m.queueLength}</strong></div>
              <div className={`mt-1.5 px-1.5 py-0.5 rounded-full font-bold ${
                m.congestion === 'CRITICAL' ? 'bg-red-50 text-red-700 border border-red-200' :
                m.congestion === 'HIGH' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                m.congestion === 'MEDIUM' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {m.congestion}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Decision Rationale Banner */}
      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs">
        <div className="flex items-center space-x-1.5 text-blue-800 font-bold mb-1">
          <Sliders className="w-3.5 h-3.5 text-blue-600" />
          <span>REAL-TIME ACTUATION RATIONALE</span>
        </div>
        <p className="text-slate-700 leading-relaxed font-sans font-medium">
          {optimization.aiReasoning}
        </p>
      </div>

      {/* Safety Constraints & Impact Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col items-center text-center">
          <TrendingDown className="w-4 h-4 text-emerald-600 mb-1" />
          <div className="text-[10px] font-bold text-slate-500 uppercase">Wait Time Cut</div>
          <div className="text-sm font-black text-emerald-700 font-mono">
            -{optimization.waitTimeReductionPercent}%
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col items-center text-center">
          <Fuel className="w-4 h-4 text-blue-600 mb-1" />
          <div className="text-[10px] font-bold text-slate-500 uppercase">Fuel Saved</div>
          <div className="text-sm font-black text-blue-700 font-mono">
            {optimization.fuelSavedLiters} L
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col items-center text-center">
          <Leaf className="w-4 h-4 text-teal-600 mb-1" />
          <div className="text-[10px] font-bold text-slate-500 uppercase">CO₂ Abated</div>
          <div className="text-sm font-black text-teal-700 font-mono">
            {optimization.co2SavedKg} kg
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col items-center text-center">
          <ShieldCheck className="w-4 h-4 text-indigo-600 mb-1" />
          <div className="text-[10px] font-bold text-slate-500 uppercase">Fairness Index</div>
          <div className="text-sm font-black text-indigo-700 font-mono">
            {optimization.constraints.fairnessIndex}
          </div>
        </div>
      </div>

      {/* Closed-Loop Pipeline Steps */}
      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
        <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">
          Autonomous Feedback Control Loop
        </div>
        <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-700 gap-1.5 font-medium">
          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-blue-700 shadow-2xs">1. Virtual Traffic</span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-indigo-700 shadow-2xs">2. Metrics Ingestion</span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-purple-700 shadow-2xs">3. XGBoost Pred</span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-amber-700 shadow-2xs">4. LP Optimizer</span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold shadow-2xs">
            5. Dynamic Signal
          </span>
        </div>
      </div>
    </div>
  );
};
