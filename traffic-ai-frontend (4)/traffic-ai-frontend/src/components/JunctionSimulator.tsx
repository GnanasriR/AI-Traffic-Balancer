import React, { useEffect, useRef } from 'react';
import type { Vehicle, DirectionMetrics, Direction } from '../types/traffic';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, AlertTriangle, Crosshair } from 'lucide-react';

interface JunctionSimulatorProps {
  vehicles: Vehicle[];
  northMetrics: DirectionMetrics;
  southMetrics: DirectionMetrics;
  eastMetrics: DirectionMetrics;
  westMetrics: DirectionMetrics;
  emergencyActive: boolean;
  accidentDirection: Direction | null;
  onLaneClick?: (direction: Direction) => void;
}

export const JunctionSimulator: React.FC<JunctionSimulatorProps> = ({
  vehicles,
  northMetrics,
  southMetrics,
  eastMetrics,
  westMetrics,
  emergencyActive,
  accidentDirection,
  onLaneClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render high-fidelity canvas simulation (Lively Enterprise Urban Theme)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fixed internal resolution
    const width = 600;
    const height = 600;
    canvas.width = width;
    canvas.height = height;

    // Clean urban greenery ground
    ctx.fillStyle = '#ecfdf5';
    ctx.fillRect(0, 0, width, height);

    // Landscaped park blocks at 4 quadrants
    const drawParkQuadrant = (x: number, y: number, w: number, h: number) => {
      // Grass lawn
      ctx.fillStyle = '#dcfce7';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 16);
      ctx.fill();

      // Concrete walkway curb
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Subtle architectural / park tree dots
      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.arc(x + 40, y + 40, 14, 0, Math.PI * 2);
      ctx.arc(x + w - 40, y + 40, 12, 0, Math.PI * 2);
      ctx.arc(x + 40, y + h - 40, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(x + 40, y + 40, 9, 0, Math.PI * 2);
      ctx.arc(x + w - 40, y + 40, 7, 0, Math.PI * 2);
      ctx.arc(x + 40, y + h - 40, 7, 0, Math.PI * 2);
      ctx.fill();
    };

    drawParkQuadrant(15, 15, 210, 210);
    drawParkQuadrant(375, 15, 210, 210);
    drawParkQuadrant(15, 375, 210, 210);
    drawParkQuadrant(375, 375, 210, 210);

    // Roads (Premium Slate Asphalt)
    ctx.fillStyle = '#334155';
    // Vertical road (North - South)
    ctx.fillRect(235, 0, 130, height);
    // Horizontal road (East - West)
    ctx.fillRect(0, 235, width, 130);

    // Intersection center box
    ctx.fillStyle = '#293548';
    ctx.fillRect(235, 235, 130, 130);

    // Sidewalk curbing alongside the asphalt
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(235, 0, 130, height);
    ctx.strokeRect(0, 235, width, 130);

    // Yellow Center Median Dividing Lines (High-Contrast Amber)
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 10]);

    // North Center Line
    ctx.beginPath();
    ctx.moveTo(300, 0); ctx.lineTo(300, 215);
    ctx.stroke();

    // South Center Line
    ctx.beginPath();
    ctx.moveTo(300, 385); ctx.lineTo(300, 600);
    ctx.stroke();

    // West Center Line
    ctx.beginPath();
    ctx.moveTo(0, 300); ctx.lineTo(215, 300);
    ctx.stroke();

    // East Center Line
    ctx.beginPath();
    ctx.moveTo(385, 300); ctx.lineTo(600, 300);
    ctx.stroke();

    // White Lane dividers (dashed)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 12]);

    // North sub-lanes
    ctx.beginPath();
    ctx.moveTo(268, 0); ctx.lineTo(268, 215);
    ctx.moveTo(332, 0); ctx.lineTo(332, 215);
    ctx.stroke();

    // South sub-lanes
    ctx.beginPath();
    ctx.moveTo(268, 385); ctx.lineTo(268, 600);
    ctx.moveTo(332, 385); ctx.lineTo(332, 600);
    ctx.stroke();

    // West sub-lanes
    ctx.beginPath();
    ctx.moveTo(0, 268); ctx.lineTo(215, 268);
    ctx.moveTo(0, 332); ctx.lineTo(215, 332);
    ctx.stroke();

    // East sub-lanes
    ctx.beginPath();
    ctx.moveTo(385, 268); ctx.lineTo(600, 268);
    ctx.moveTo(385, 332); ctx.lineTo(600, 332);
    ctx.stroke();

    ctx.setLineDash([]); // Reset dash

    // Pedestrian Zebra Crossings (Crisp White)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const drawZebra = (x: number, y: number, w: number, h: number, horizontal: boolean) => {
      const stripes = 7;
      if (horizontal) {
        const sw = w / stripes;
        for (let i = 0; i < stripes; i += 2) {
          ctx.fillRect(x + i * sw, y, sw, h);
        }
      } else {
        const sh = h / stripes;
        for (let i = 0; i < stripes; i += 2) {
          ctx.fillRect(x, y + i * sh, w, sh);
        }
      }
    };
    // North Crosswalk
    drawZebra(240, 218, 120, 14, true);
    // South Crosswalk
    drawZebra(240, 368, 120, 14, true);
    // West Crosswalk
    drawZebra(218, 240, 14, 120, false);
    // East Crosswalk
    drawZebra(368, 240, 14, 120, false);

    // Stop Lines (Solid Bright White)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    // North Stop Line
    ctx.beginPath(); ctx.moveTo(235, 216); ctx.lineTo(300, 216); ctx.stroke();
    // South Stop Line
    ctx.beginPath(); ctx.moveTo(300, 384); ctx.lineTo(365, 384); ctx.stroke();
    // West Stop Line
    ctx.beginPath(); ctx.moveTo(216, 300); ctx.lineTo(216, 365); ctx.stroke();
    // East Stop Line
    ctx.beginPath(); ctx.moveTo(384, 235); ctx.lineTo(384, 300); ctx.stroke();

    // Incident warning marker if accident
    if (accidentDirection) {
      let ax = 430;
      let ay = 270;
      if (accidentDirection === 'NORTH') { ax = 280; ay = 120; }
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.beginPath();
      ctx.arc(ax, ay, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('ACCIDENT', ax - 27, ay - 28);
    }

    // Render Vehicles (Vivid Enterprise Colors)
    vehicles.forEach(v => {
      ctx.save();
      ctx.translate(v.x, v.y);

      let angle = 0;
      if (v.direction === 'NORTH') angle = Math.PI / 2;
      if (v.direction === 'SOUTH') angle = -Math.PI / 2;
      if (v.direction === 'WEST') angle = 0;
      if (v.direction === 'EAST') angle = Math.PI;

      ctx.rotate(angle);

      const isEmergency = v.type === 'EMERGENCY';
      const isBus = v.type === 'BUS';
      const isMotorcycle = v.type === 'MOTORCYCLE';

      const carLength = isBus ? 34 : (isMotorcycle ? 15 : 23);
      const carWidth = isBus ? 14 : (isMotorcycle ? 7 : 12);

      // Vehicle soft drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(-carLength / 2 + 2, -carWidth / 2 + 2, carLength, carWidth);

      // Vehicle glossy body
      ctx.fillStyle = isEmergency ? '#ef4444' : v.color;
      ctx.beginPath();
      ctx.roundRect(-carLength / 2, -carWidth / 2, carLength, carWidth, 3.5);
      ctx.fill();

      // Vehicle roof / windshield
      ctx.fillStyle = isEmergency ? '#ffffff' : '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-carLength / 4, -carWidth / 2 + 2, carLength / 2, carWidth - 4, 2);
      ctx.fill();

      // Headlights (Warm Yellow)
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(carLength / 2 - 2, -carWidth / 2 + 1, 2, 2.5);
      ctx.fillRect(carLength / 2 - 2, carWidth / 2 - 3.5, 2, 2.5);

      // Taillights (Red)
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-carLength / 2, -carWidth / 2 + 1, 2, 2.5);
      ctx.fillRect(-carLength / 2, carWidth / 2 - 3.5, 2, 2.5);

      // Emergency Flashing Siren
      if (isEmergency) {
        const flashPhase = Math.floor(Date.now() / 200) % 2;
        ctx.fillStyle = flashPhase === 0 ? '#3b82f6' : '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = flashPhase === 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    });

  }, [vehicles, northMetrics, southMetrics, eastMetrics, westMetrics, emergencyActive, accidentDirection]);

  // Traffic Light Indicator Component (Clean Enterprise Slate Enclosure)
  const TrafficLightPole = ({
    metrics,
    direction
  }: {
    metrics: DirectionMetrics;
    direction: Direction;
  }) => {
    const isRed = metrics.signalState === 'RED';
    const isYellow = metrics.signalState === 'YELLOW';
    const isGreen = metrics.signalState === 'GREEN';

    return (
      <div className="flex flex-col items-center bg-slate-900/95 p-1.5 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md transition-transform hover:scale-105">
        <div className="flex items-center space-x-1.5 mb-1">
          <span className="text-[10px] font-black tracking-wider text-slate-200 uppercase">
            {direction}
          </span>
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
            isGreen ? 'bg-emerald-500/25 text-emerald-300' : isYellow ? 'bg-amber-500/25 text-amber-300' : 'bg-red-500/25 text-red-300'
          }`}>
            {metrics.countdown}s
          </span>
        </div>

        {/* Vertical Light Bulbs */}
        <div className="flex space-x-1.5 bg-black/70 px-2 py-1 rounded-full border border-slate-800">
          {/* Red Bulb */}
          <div
            className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
              isRed
                ? 'bg-red-500 traffic-glow-red scale-110 ring-2 ring-red-400/50'
                : 'bg-red-950/40 opacity-30'
            }`}
          />
          {/* Yellow Bulb */}
          <div
            className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
              isYellow
                ? 'bg-amber-400 traffic-glow-yellow scale-110 ring-2 ring-amber-400/50'
                : 'bg-amber-950/40 opacity-30'
            }`}
          />
          {/* Green Bulb */}
          <div
            className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
              isGreen
                ? 'bg-emerald-400 traffic-glow-green scale-110 ring-2 ring-emerald-400/50'
                : 'bg-emerald-950/40 opacity-30'
            }`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="enterprise-card p-4">
      {/* Simulation Header */}
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-sm font-black tracking-tight text-slate-800 uppercase">
            Junction J3 (Central Plaza) Live Digital Twin
          </h2>
        </div>
        <div className="flex items-center space-x-3 text-xs text-slate-500 font-mono">
          <span>Active Stop Line Control</span>
          <span>•</span>
          <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
            {vehicles.length} Active Vehicles
          </span>
        </div>
      </div>

      {/* Main Canvas & Overlay HUD */}
      <div className="relative flex items-center justify-center bg-slate-100 rounded-xl overflow-hidden border border-slate-200 aspect-square max-w-[580px] mx-auto shadow-inner">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain cursor-crosshair"
          title="Click any approach to inject localized traffic burst"
        />

        {/* Traffic Light HUDs positioned at 4 corners */}
        <div 
          onClick={() => onLaneClick?.('NORTH')}
          className="absolute top-3 left-1/2 -translate-x-1/2 cursor-pointer"
        >
          <TrafficLightPole metrics={northMetrics} direction="NORTH" />
        </div>

        <div 
          onClick={() => onLaneClick?.('SOUTH')}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 cursor-pointer"
        >
          <TrafficLightPole metrics={southMetrics} direction="SOUTH" />
        </div>

        <div 
          onClick={() => onLaneClick?.('WEST')}
          className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer"
        >
          <TrafficLightPole metrics={westMetrics} direction="WEST" />
        </div>

        <div 
          onClick={() => onLaneClick?.('EAST')}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
        >
          <TrafficLightPole metrics={eastMetrics} direction="EAST" />
        </div>

        {/* Direction Flow Badges with Arrows (Clean Enterprise Glass) */}
        <div className="absolute top-2 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium text-slate-700 flex items-center space-x-1.5 border border-slate-200 shadow-sm">
          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
          <span>North: <strong>{northMetrics.vehicleCount}</strong></span>
        </div>

        <div className="absolute bottom-2 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium text-slate-700 flex items-center space-x-1.5 border border-slate-200 shadow-sm">
          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
          <span>South: <strong>{southMetrics.vehicleCount}</strong></span>
        </div>

        <div className="absolute top-2 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium text-slate-700 flex items-center space-x-1.5 border border-slate-200 shadow-sm">
          <ArrowLeft className="w-3.5 h-3.5 text-blue-600" />
          <span>East: <strong>{eastMetrics.vehicleCount}</strong></span>
        </div>

        <div className="absolute bottom-2 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium text-slate-700 flex items-center space-x-1.5 border border-slate-200 shadow-sm">
          <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
          <span>West: <strong>{westMetrics.vehicleCount}</strong></span>
        </div>

        {/* Emergency Preemption Banner */}
        {emergencyActive && (
          <div className="absolute top-16 bg-red-600 text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-wider animate-bounce flex items-center space-x-2 shadow-lg border border-red-300">
            <AlertTriangle className="w-4 h-4" />
            <span>AMBULANCE PRIORITY: EMERGENCY GREEN WAVE</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 px-1">
        <span className="flex items-center space-x-1.5">
          <Crosshair className="w-3.5 h-3.5 text-blue-600" />
          <span>Click any lane approach to simulate a sudden traffic surge</span>
        </span>
        <span className="text-[11px] font-mono text-slate-400">
          60 FPS Simulation Loop • Car Safe Gap: 32px
        </span>
      </div>
    </div>
  );
};
