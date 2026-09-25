import React from 'react';
import type { ScenarioPreset } from '../types/traffic';
import { 
  SunMedium, 
  Sunset, 
  AlertOctagon, 
  Siren, 
  Scale, 
  SlidersHorizontal 
} from 'lucide-react';

interface ScenarioControlsProps {
  currentScenario: ScenarioPreset;
  onSelectScenario: (scenario: ScenarioPreset) => void;
}

export const ScenarioControls: React.FC<ScenarioControlsProps> = ({
  currentScenario,
  onSelectScenario
}) => {
  const scenarios: { id: ScenarioPreset; label: string; desc: string; icon: any; iconColor: string; activeBorder: string }[] = [
    {
      id: 'MORNING_RUSH_NS',
      label: 'Morning Rush (N/S)',
      desc: 'N/S heavy demand (42+ cars) → AI actuates 48s / 17s green timing',
      icon: SunMedium,
      iconColor: 'text-amber-500',
      activeBorder: 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-300/40'
    },
    {
      id: 'EVENING_RUSH_EW',
      label: 'Evening Rush (E/W)',
      desc: 'Commuter surge East/West → AI extends E/W green phase to 45s',
      icon: Sunset,
      iconColor: 'text-blue-500',
      activeBorder: 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-300/40'
    },
    {
      id: 'EAST_LANE_ACCIDENT',
      label: 'East Lane Accident',
      desc: 'Obstruction blocks lane → AI detects queue spike and mitigates delay',
      icon: AlertOctagon,
      iconColor: 'text-red-500',
      activeBorder: 'border-red-400 bg-red-50/60 ring-2 ring-red-300/40'
    },
    {
      id: 'EMERGENCY_AMBULANCE_NORTH',
      label: 'Ambulance Preemption',
      desc: 'Emergency siren priority → Immediate green wave hold for vehicle',
      icon: Siren,
      iconColor: 'text-rose-500',
      activeBorder: 'border-rose-400 bg-rose-50/60 ring-2 ring-rose-300/40'
    },
    {
      id: 'BALANCED',
      label: 'Balanced Off-Peak',
      desc: 'Uniform arrival across all 4 corridors → Symmetric 32s/32s cycle',
      icon: Scale,
      iconColor: 'text-emerald-500',
      activeBorder: 'border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-300/40'
    }
  ];

  return (
    <div className="enterprise-card p-4">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <SlidersHorizontal className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-black tracking-tight text-slate-800 uppercase">
            Simulation Scenario Injector
          </h2>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Test real-time AI adaptive response under distinct traffic conditions
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {scenarios.map(s => {
          const Icon = s.icon;
          const isActive = currentScenario === s.id;

          return (
            <button
              key={s.id}
              onClick={() => onSelectScenario(s.id)}
              className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                isActive
                  ? s.activeBorder + ' shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white shadow-xs' : 'bg-slate-100'}`}>
                  <Icon className={`w-4 h-4 ${s.iconColor}`} />
                </div>
                {isActive && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                    ACTIVE
                  </span>
                )}
              </div>

              <div>
                <div className="text-xs font-bold text-slate-900">
                  {s.label}
                </div>
                <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug font-medium">
                  {s.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
