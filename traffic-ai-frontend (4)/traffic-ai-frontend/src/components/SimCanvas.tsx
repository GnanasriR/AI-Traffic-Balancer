import React, { useEffect, useRef } from 'react';
import { signalSyncEngine, GEO, vpos, round, DIRNAME, mapPythonToReactCoords } from '../services/signalsyncEngine';
import type { SignalEngineInstance } from '../services/signalsyncEngine';
import type { Direction } from '../types/signalsync';

interface SimCanvasProps {
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  engine?: SignalEngineInstance;
  highlightMovement?: string | null;
}

export const SimCanvas: React.FC<SimCanvasProps> = ({
  height,
  className,
  style,
  engine = signalSyncEngine,
  highlightMovement = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId: number;

    const paint = () => {
      const cv = canvasRef.current;
      if (!cv) return;

      const f = engine.getInterpolated();
      if (!f) {
        animId = requestAnimationFrame(paint);
        return;
      }

      const ctx = cv.getContext('2d');
      if (!ctx) return;

      const cssW = cv.getBoundingClientRect().width || 900;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssH = height || Math.round(cssW * (GEO.H / GEO.W));

      const targetW = Math.round(cssW * dpr);
      const targetH = Math.round(cssH * dpr);

      if (cv.width !== targetW || cv.height !== targetH) {
        cv.width = targetW;
        cv.height = targetH;
        cv.style.height = `${cssH}px`;
      }

      // Uniform scaling to guarantee the entire 1000x600 coordinate space is 100% visible
      const sc = Math.min(targetW / GEO.W, targetH / GEO.H);
      const offsetX = (targetW - GEO.W * sc) / 2;
      const offsetY = (targetH - GEO.H * sc) / 2;

      // Clear the entire physical canvas
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#F3F5F7';
      ctx.fillRect(0, 0, targetW, targetH);

      // Apply transform with centering
      ctx.setTransform(sc, 0, 0, sc, offsetX, offsetY);
      const { W, H, cx, cy, half, lane } = GEO;
      const ph = f.snap.phase;
      const emergency = f.snap.emergency;

      // Background
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#F3F5F7';
      ctx.fillRect(0, 0, W, H);

      // Curbs & Corner grass
      ctx.fillStyle = '#E8EDF0';
      [
        [0, 0, cx - half, cy - half],
        [cx + half, 0, W - cx - half, cy - half],
        [0, cy + half, cx - half, H - cy - half],
        [cx + half, cy + half, W - cx - half, H - cy - half],
      ].forEach((r) => {
        round(ctx, r[0] + 12, r[1] + 12, r[2] - 24, r[3] - 24, 14);
        ctx.fill();
      });

      // Asphalt Road
      ctx.fillStyle = '#D8DFE4';
      ctx.fillRect(cx - half, 0, half * 2, H);
      ctx.fillRect(0, cy - half, W, half * 2);

      // ── Emergency Approach Pulse Highlight ───────────────────────
      if (emergency?.active && emergency.dir) {
        const isBlink = Math.floor(performance.now() / 280) % 2 === 0;
        const eColor = isBlink ? 'rgba(239, 68, 68, 0.38)' : 'rgba(245, 158, 11, 0.22)';
        ctx.fillStyle = eColor;

        if (emergency.dir === 'N') ctx.fillRect(cx - half, 0, half * 2, cy - half);
        else if (emergency.dir === 'S') ctx.fillRect(cx - half, cy + half, half * 2, H - (cy + half));
        else if (emergency.dir === 'E') ctx.fillRect(cx + half, cy - half, W - (cx + half), half * 2);
        else if (emergency.dir === 'W') ctx.fillRect(0, cy - half, cx - half, half * 2);
      }

      // Yellow Median Marking
      ctx.strokeStyle = '#EBC974';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, cy - half);
      ctx.moveTo(cx, cy + half);
      ctx.lineTo(cx, H);
      ctx.moveTo(0, cy);
      ctx.lineTo(cx - half, cy);
      ctx.moveTo(cx + half, cy);
      ctx.lineTo(W, cy);
      ctx.stroke();

      // Dashed lane dividers
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.setLineDash([16, 14]);
      ctx.beginPath();
      ctx.moveTo(cx - half + 2, 0);
      ctx.lineTo(cx - half + 2, cy - half);
      ctx.moveTo(cx + half - 2, 0);
      ctx.lineTo(cx + half - 2, cy - half);
      ctx.moveTo(cx - half + 2, cy + half);
      ctx.lineTo(cx - half + 2, H);
      ctx.moveTo(cx + half - 2, cy + half);
      ctx.lineTo(cx + half - 2, H);
      ctx.moveTo(0, cy - half + 2);
      ctx.lineTo(cx - half, cy - half + 2);
      ctx.moveTo(0, cy + half - 2);
      ctx.lineTo(cx - half, cy + half - 2);
      ctx.moveTo(cx + half, cy - half + 2);
      ctx.lineTo(W, cy - half + 2);
      ctx.moveTo(cx + half, cy + half - 2);
      ctx.lineTo(W, cy + half - 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Stop Lines (solid white)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx - half + 4, cy - half - 6, half - 6, 5);
      ctx.fillRect(cx + 4, cy + half + 1, half - 6, 5);
      ctx.fillRect(cx - half - 6, cy - half + 4, 5, half - 6);
      ctx.fillRect(cx + half + 1, cy + 4, 5, half - 6);

      // Pedestrian zebra crossings
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 7; i++) {
        ctx.fillRect(cx - half + 6 + i * 20, cy - half - 26, 11, 15);
        ctx.fillRect(cx - half + 6 + i * 20, cy + half + 11, 11, 15);
        ctx.fillRect(cx - half - 26, cy - half + 6 + i * 20, 15, 11);
        ctx.fillRect(cx + half + 11, cy - half + 6 + i * 20, 15, 11);
      }

      // Turn guide markings inside intersection
      ctx.strokeStyle = 'rgba(255,255,255,.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(cx + lane, cy + half);
      ctx.quadraticCurveTo(cx + lane, cy + lane, cx + half, cy + lane);
      ctx.moveTo(cx - lane, cy - half);
      ctx.quadraticCurveTo(cx - lane, cy - lane, cx - half, cy - lane);
      ctx.moveTo(cx + lane, cy + half);
      ctx.quadraticCurveTo(cx + lane, cy - lane, cx - half, cy - lane);
      ctx.moveTo(cx - lane, cy - half);
      ctx.quadraticCurveTo(cx - lane, cy + lane, cx + half, cy + lane);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Interactive Movement Path Highlight Overlay ──────────────
      if (highlightMovement) {
        ctx.save();
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.setLineDash([10, 8]);
        ctx.shadowColor = '#3B82F6';
        ctx.shadowBlur = 12;
        ctx.beginPath();

        if (highlightMovement === 'S->N') {
          ctx.moveTo(cx + lane, H);
          ctx.lineTo(cx + lane, 0);
        } else if (highlightMovement === 'S->E') {
          ctx.moveTo(cx + lane, H);
          ctx.lineTo(cx + lane, cy + half);
          ctx.quadraticCurveTo(cx + lane, cy + lane, cx + half, cy + lane);
          ctx.lineTo(W, cy + lane);
        } else if (highlightMovement === 'S->W') {
          ctx.moveTo(cx + lane, H);
          ctx.lineTo(cx + lane, cy + half);
          ctx.quadraticCurveTo(cx + lane, cy - lane, cx - half, cy - lane);
          ctx.lineTo(0, cy - lane);
        } else if (highlightMovement === 'N->S') {
          ctx.moveTo(cx - lane, 0);
          ctx.lineTo(cx - lane, H);
        } else if (highlightMovement === 'N->W') {
          ctx.moveTo(cx - lane, 0);
          ctx.lineTo(cx - lane, cy - half);
          ctx.quadraticCurveTo(cx - lane, cy - lane, cx - half, cy - lane);
          ctx.lineTo(0, cy - lane);
        } else if (highlightMovement === 'N->E') {
          ctx.moveTo(cx - lane, 0);
          ctx.lineTo(cx - lane, cy - half);
          ctx.quadraticCurveTo(cx - lane, cy + lane, cx + half, cy + lane);
          ctx.lineTo(W, cy + lane);
        } else if (highlightMovement === 'E->W') {
          ctx.moveTo(W, cy - lane);
          ctx.lineTo(0, cy - lane);
        } else if (highlightMovement === 'E->N') {
          ctx.moveTo(W, cy - lane);
          ctx.lineTo(cx + half, cy - lane);
          ctx.quadraticCurveTo(cx + lane, cy - lane, cx + lane, cy - half);
          ctx.lineTo(cx + lane, 0);
        } else if (highlightMovement === 'E->S') {
          ctx.moveTo(W, cy - lane);
          ctx.lineTo(cx + half, cy - lane);
          ctx.quadraticCurveTo(cx - lane, cy - lane, cx - lane, cy + half);
          ctx.lineTo(cx - lane, H);
        } else if (highlightMovement === 'W->E') {
          ctx.moveTo(0, cy + lane);
          ctx.lineTo(W, cy + lane);
        } else if (highlightMovement === 'W->S') {
          ctx.moveTo(0, cy + lane);
          ctx.lineTo(cx - half, cy + lane);
          ctx.quadraticCurveTo(cx - lane, cy + lane, cx - lane, cy + half);
          ctx.lineTo(cx - lane, H);
        } else if (highlightMovement === 'W->N') {
          ctx.moveTo(0, cy + lane);
          ctx.lineTo(cx - half, cy + lane);
          ctx.quadraticCurveTo(cx + lane, cy + lane, cx + lane, cy - half);
          ctx.lineTo(cx + lane, 0);
        }

        ctx.stroke();
        ctx.restore();
      }

      // Vehicles with dynamic rotation along turns
      for (const car of f.cars) {
        let pose: { x: number; y: number; angle: number };
        if (car.x !== undefined && car.y !== undefined && car.angle !== undefined) {
          const mapped = mapPythonToReactCoords(car.x, car.y);
          pose = { x: mapped.x, y: mapped.y, angle: car.angle };
        } else {
          pose = vpos(car.dir, car.to, car.dist);
        }

        // Approach-relative hazard zone calculation (civilian crawl & ambulance bypass)
        const sd = GEO.stop[car.dir];
        const hzStart = sd - 173;
        const hzEnd = sd - 33;
        if (f.snap.incident?.active && f.snap.incident.dir === car.dir) {
          if (car.dist >= hzStart && car.dist <= hzEnd) {
            const shift = Math.sin(((car.dist - hzStart) / 140) * Math.PI) * 26;
            if (car.dir === 'N') pose.x += shift;
            else if (car.dir === 'S') pose.x -= shift;
            else if (car.dir === 'E') pose.y += shift;
            else if (car.dir === 'W') pose.y += shift; // Shift southwards into bypass space
          }
        }

        const L = car.type === 'BUS' || car.type === 'TRUCK' || car.heavy ? 42 : car.type === 'TWO_WHEELER' ? 16 : car.type === 'AUTO_RICKSHAW' ? 20 : GEO.carL;
        const Wd = car.type === 'TWO_WHEELER' ? 7 : car.type === 'AUTO_RICKSHAW' ? 11 : car.type === 'BUS' || car.type === 'TRUCK' || car.heavy ? 18 : GEO.carW;

        ctx.save();
        ctx.translate(pose.x, pose.y);
        ctx.rotate(pose.angle);
        ctx.translate(0, car.lateralOffset || 0);

        // Drop shadow
        ctx.fillStyle = 'rgba(17,26,34,.15)';
        round(ctx, -L / 2 + 2, -Wd / 2 + 2, L, Wd, 4);
        ctx.fill();

        // ── Custom Emergency Ambulance Rendering ────────────────────
        if (car.isAmbulance) {
          const AmbL = 34;
          const AmbW = 18;

          // Flashing emergency road beacon glow
          const strobe = Math.floor(performance.now() / 140) % 2 === 0;
          ctx.beginPath();
          ctx.arc(0, 0, 36, 0, Math.PI * 2);
          ctx.fillStyle = strobe ? 'rgba(239, 68, 68, 0.22)' : 'rgba(37, 99, 235, 0.22)';
          ctx.fill();

          // Ambulance Body (clean white with rounded corners)
          ctx.fillStyle = '#FFFFFF';
          round(ctx, -AmbL / 2, -AmbW / 2, AmbL, AmbW, 4);
          ctx.fill();
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 1;
          round(ctx, -AmbL / 2, -AmbW / 2, AmbL, AmbW, 4);
          ctx.stroke();

          // Red lateral warning stripes
          ctx.fillStyle = '#DC2626';
          ctx.fillRect(-AmbL / 2 + 5, -AmbW / 2 + 1, AmbL - 10, 2.5);
          ctx.fillRect(-AmbL / 2 + 5, AmbW / 2 - 3.5, AmbL - 10, 2.5);

          // Cab Front Windshield
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(AmbL / 2 - 8, -AmbW / 2 + 2, 4, AmbW - 4);

          // Red Cross on white roof
          ctx.fillStyle = '#DC2626';
          ctx.fillRect(-5, -1.5, 10, 3);
          ctx.fillRect(-1.5, -5, 3, 10);

          // Alternating Red & Blue Roof Emergency Lightbar
          const isRed = Math.floor(performance.now() / 110) % 2 === 0;
          ctx.fillStyle = isRed ? '#EF4444' : '#1D4ED8';
          ctx.fillRect(AmbL / 2 - 12, -AmbW / 2 + 3, 3, 3.5);
          ctx.fillStyle = isRed ? '#1D4ED8' : '#EF4444';
          ctx.fillRect(AmbL / 2 - 12, AmbW / 2 - 6.5, 3, 3.5);

          ctx.restore();
          continue;
        }

        // ── Heterogeneous Vehicle Rendering (TWO_WHEELER / AUTO / BUS / CAR) ──
        if (car.type === 'TWO_WHEELER') {
          // Bike Body & Rider Helmet
          ctx.fillStyle = car.col || '#2563EB';
          round(ctx, -L / 2, -Wd / 2, L, Wd, 3);
          ctx.fill();
          // Rider Helmet Icon
          ctx.beginPath();
          ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#1E293B';
          ctx.fill();
        } else if (car.type === 'AUTO_RICKSHAW') {
          // Auto Rickshaw Canopy Body
          ctx.fillStyle = '#D97706'; // Vibrant Auto Yellow
          round(ctx, -L / 2, -Wd / 2, L, Wd, 3);
          ctx.fill();
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(L / 2 - 5, -Wd / 2 + 1.5, 3, Wd - 3); // Front Windshield
        } else if (car.type === 'BUS' || car.type === 'TRUCK' || car.heavy) {
          // Bus / Heavy Truck Body
          ctx.fillStyle = car.col || '#0D9488';
          round(ctx, -L / 2, -Wd / 2, L, Wd, 4);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.7)';
          ctx.fillRect(L / 2 - 8, -Wd / 2 + 2, 4, Wd - 4); // Bus Windshield
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(-L / 2 + 4, -Wd / 2 + 2, 8, Wd - 4); // Roof AC Unit
        } else {
          // Standard Car Body
          ctx.fillStyle = car.col || '#4A5966';
          round(ctx, -L / 2, -Wd / 2, L, Wd, 4);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.7)';
          ctx.fillRect(L / 2 - 7, -Wd / 2 + 2.5, 4, Wd - 5);
          ctx.fillStyle = 'rgba(255,255,255,.35)';
          ctx.fillRect(-L / 2 + 3, -Wd / 2 + 2.5, 3, Wd - 5);
        }

        // Turn indicator blinker
        if (car.turn === 'left' || car.turn === 'right') {
          const isBlink = Math.floor(performance.now() / 250) % 2 === 0;
          if (isBlink) {
            ctx.fillStyle = '#F59E0B';
            const indY = car.turn === 'left' ? -Wd / 2 : Wd / 2 - 2.5;
            ctx.fillRect(L / 2 - 3, indY, 3, 2.5);
          }
        }
        ctx.restore();
      }

      // ── Physical Collision Hazard Zone (Accident Simulation) ──────
      if (f.snap.incident?.active) {
        const inc = f.snap.incident;
        const d = inc.dir;
        let incX = 0;
        let incY = 0;
        let angle = 0;

        if (d === 'N') {
          incX = cx - lane;
          incY = 110;
          angle = Math.PI / 2;
        } else if (d === 'S') {
          incX = cx + lane;
          incY = H - 110;
          angle = -Math.PI / 2;
        } else if (d === 'E') {
          incX = W - 110;
          incY = cy - lane;
          angle = Math.PI;
        } else {
          incX = 110;
          incY = cy + lane;
          angle = 0;
        }

        ctx.save();
        ctx.translate(incX, incY);
        ctx.rotate(angle);

        // Blocked Lane Box with dashed warning perimeter
        ctx.fillStyle = 'rgba(220, 38, 38, 0.18)';
        round(ctx, -26, -20, 52, 40, 6);
        ctx.fill();
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        round(ctx, -26, -20, 52, 40, 6);
        ctx.stroke();
        ctx.setLineDash([]);

        // Reflective Road Traffic Cones
        const coneCoords = [
          [-22, -16],
          [22, -16],
          [-22, 16],
          [22, 16],
        ];
        coneCoords.forEach(([cpx, cpy]) => {
          ctx.beginPath();
          ctx.arc(cpx, cpy, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#EA580C';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(cpx, cpy, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
        });

        // Collided Vehicle 1 (Angled Sedan)
        ctx.save();
        ctx.translate(-6, -3);
        ctx.rotate(0.24);
        ctx.fillStyle = '#991B1B';
        round(ctx, -13, -7, 26, 14, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(5, -5, 3, 10);
        if (Math.floor(performance.now() / 320) % 2 === 0) {
          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(9, -7, 3, 2.5);
          ctx.fillRect(-13, 4.5, 3, 2.5);
        }
        ctx.restore();

        // Collided Vehicle 2 (Angled Hatchback)
        ctx.save();
        ctx.translate(8, 4);
        ctx.rotate(-0.32);
        ctx.fillStyle = '#334155';
        round(ctx, -12, -7, 24, 14, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(4, -5, 3, 10);
        if (Math.floor(performance.now() / 320) % 2 === 0) {
          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(8, -7, 3, 2.5);
          ctx.fillRect(-12, 4.5, 3, 2.5);
        }
        ctx.restore();

        // Warning Label above blocked lane
        ctx.fillStyle = '#DC2626';
        ctx.font = '700 8.5px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('LANE 1 BLOCKED', 0, -24);

        ctx.restore();
      }

      // Signal heads & lights (SITUATION 1: EXACTLY ONE ARM GREEN AT A TIME)
      const heads = [
        { d: 'N' as Direction, x: cx - half - 32, y: cy - half - 60 },
        { d: 'S' as Direction, x: cx + half + 12, y: cy + half + 18 },
        { d: 'E' as Direction, x: cx + half + 12, y: cy - half - 60 },
        { d: 'W' as Direction, x: cx - half - 32, y: cy + half + 18 },
      ];

      heads.forEach((hd) => {
        let on = 'r';
        if (ph.state === 'green') {
          on = hd.d === ph.activeArm ? 'g' : 'r';
        } else if (ph.state === 'yellow') {
          on = hd.d === ph.activeArm ? 'y' : 'r';
        } else {
          on = 'r';
        }

        ctx.fillStyle = '#1A2831';
        round(ctx, hd.x, hd.y, 22, 48, 6);
        ctx.fill();

        const cols: Record<string, string> = { r: '#C7413F', y: '#C8860D', g: '#1F9D62' };
        (['r', 'y', 'g'] as const).forEach((k, i) => {
          ctx.beginPath();
          ctx.arc(hd.x + 11, hd.y + 11 + i * 13, 4.8, 0, Math.PI * 2);
          ctx.fillStyle = on === k ? cols[k] : '#34434D';
          ctx.fill();
          if (on === k) {
            ctx.shadowColor = cols[k];
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        });
      });

      // ── Pedestrian Figures Rendering (Crosswalk & Scramble Walkers) ──────
      const crosswalks = ph.crosswalks || { N: 'DONT_WALK', S: 'DONT_WALK', E: 'DONT_WALK', W: 'DONT_WALK' };
      const isScramble = Boolean(ph.pedestrianScramble);
      // Pedestrian walking speed: 1.2 m/s.
      // Canvas is 1000 px wide ≈ 60 m  →  1 px = 0.06 m  →  16.67 px/m.
      // Crosswalk width (NW→NE) = 300 px  →  300 / 16.67 / 1.2 ≈ 15 s per crossing.
      // The sin-based progress oscillates 0→1→0 in one full period = 2 × 15 000 ms.
      // timeT drives Math.sin(timeT + phase); for one full crossing we need
      //   sin(timeT_end) - sin(timeT_start) to span π (half-period).
      //   → period = 2 * 15 000 ms = 30 000 ms; timeT = ms / (30000 / 2π).
      const PED_CROSSING_MS = 15_000; // 15 s crossing time (1.2 m/s, 300 px crosswalk)
      const timeT = (performance.now() / PED_CROSSING_MS) * Math.PI; // radians, 0→π in 15 s

      // Helper to draw a single pedestrian figure
      const drawPedestrian = (px: number, py: number, color: string, walking: boolean, flashing = false) => {
        ctx.save();
        ctx.translate(px, py);
        if (flashing && Math.floor(performance.now() / 240) % 2 === 0) {
          ctx.globalAlpha = 0.3;
        }
        // Head
        ctx.beginPath();
        ctx.arc(0, -6, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        // Torso
        ctx.fillStyle = color;
        ctx.fillRect(-2, -3, 4, 6);
        // Animated Legs when walking
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        const legShift = walking ? Math.sin(timeT * 5) * 3 : 0;
        ctx.beginPath();
        ctx.moveTo(-1, 3);
        ctx.lineTo(-1 - legShift, 8);
        ctx.moveTo(1, 3);
        ctx.lineTo(1 + legShift, 8);
        ctx.stroke();
        ctx.restore();
      };

      // ── Corner Kerb Anchor Points & Geometry Model (100% Independent of Signal Poles) ──
      // NW Corner Sidewalk Block: (350, 150) - 44px clear of NW Signal Pole Box [394..416, 166..214]
      // NE Corner Sidewalk Block: (650, 150) - 42px clear of NE Signal Pole Box [586..608, 166..214]
      // SW Corner Sidewalk Block: (350, 450) - 44px clear of SW Signal Pole Box [394..416, 392..440]
      // SE Corner Sidewalk Block: (650, 450) - 42px clear of SE Signal Pole Box [586..608, 392..440]

      const corners = {
        NW: { x: cx - half - 76, y: cy - half - 76 }, // (350, 150)
        NE: { x: cx + half + 76, y: cy - half - 76 }, // (650, 150)
        SW: { x: cx - half - 76, y: cy + half + 76 }, // (350, 450)
        SE: { x: cx + half + 76, y: cy + half + 76 }, // (650, 450)
      };

      // North Crosswalk: connects NW Kerb to NE Kerb across North Zebra Crossing
      const stN = crosswalks.N || 'DONT_WALK';
      const colN = stN === 'WALK' ? '#10B981' : stN === 'CLEARANCE' ? '#F59E0B' : '#64748B';
      const walkN = stN === 'WALK' || stN === 'CLEARANCE';
      for (let k = 0; k < 5; k++) {
        if (!walkN) {
          const kerb = k % 2 === 0 ? corners.NW : corners.NE;
          const kOffsetX = (k % 2 === 0 ? -1 : 1) * ((k >> 1) * 8);
          drawPedestrian(kerb.x + kOffsetX, kerb.y - 6, '#64748B', false);
        } else {
          const progress = (Math.sin(timeT + k * 0.8) + 1) / 2;
          const startX = cx - half + 12; // 438 - strictly inside North zebra stripes (432..563)
          const endX = cx + half - 12;   // 557 - strictly inside North zebra stripes (432..563)
          const px = startX + progress * (endX - startX);
          const py = cy - half - 18.5;   // 207.5 - centered inside North zebra stripes (200..215)
          drawPedestrian(px, py, colN, true, stN === 'CLEARANCE');
        }
      }

      // South Crosswalk: connects SW Kerb to SE Kerb across South Zebra Crossing
      const stS = crosswalks.S || 'DONT_WALK';
      const colS = stS === 'WALK' ? '#10B981' : stS === 'CLEARANCE' ? '#F59E0B' : '#64748B';
      const walkS = stS === 'WALK' || stS === 'CLEARANCE';
      for (let k = 0; k < 5; k++) {
        if (!walkS) {
          const kerb = k % 2 === 0 ? corners.SW : corners.SE;
          const kOffsetX = (k % 2 === 0 ? -1 : 1) * ((k >> 1) * 8);
          drawPedestrian(kerb.x + kOffsetX, kerb.y + 6, '#64748B', false);
        } else {
          const progress = (Math.sin(timeT + k * 0.8 + 1) + 1) / 2;
          const startX = cx - half + 12; // 438 - strictly inside South zebra stripes (432..563)
          const endX = cx + half - 12;   // 557 - strictly inside South zebra stripes (432..563)
          const px = startX + progress * (endX - startX);
          const py = cy + half + 18.5;   // 392.5 - centered inside South zebra stripes (385..400)
          drawPedestrian(px, py, colS, true, stS === 'CLEARANCE');
        }
      }

      // East Crosswalk: connects NE Kerb to SE Kerb across East Zebra Crossing
      const stE = crosswalks.E || 'DONT_WALK';
      const colE = stE === 'WALK' ? '#10B981' : stE === 'CLEARANCE' ? '#F59E0B' : '#64748B';
      const walkE = stE === 'WALK' || stE === 'CLEARANCE';
      for (let k = 0; k < 5; k++) {
        if (!walkE) {
          const kerb = k % 2 === 0 ? corners.NE : corners.SE;
          const kOffsetY = (k % 2 === 0 ? -1 : 1) * ((k >> 1) * 8);
          drawPedestrian(kerb.x + 6, kerb.y + kOffsetY, '#64748B', false);
        } else {
          const progress = (Math.sin(timeT + k * 0.8 + 2) + 1) / 2;
          const px = cx + half + 18.5;   // 592.5 - centered inside East zebra stripes (585..600)
          const startY = cy - half + 12; // 238 - strictly inside East zebra stripes (232..363)
          const endY = cy + half - 12;   // 362 - strictly inside East zebra stripes (232..363)
          const py = startY + progress * (endY - startY);
          drawPedestrian(px, py, colE, true, stE === 'CLEARANCE');
        }
      }

      // West Crosswalk: connects NW Kerb to SW Kerb across West Zebra Crossing
      const stW = crosswalks.W || 'DONT_WALK';
      const colW = stW === 'WALK' ? '#10B981' : stW === 'CLEARANCE' ? '#F59E0B' : '#64748B';
      const walkW = stW === 'WALK' || stW === 'CLEARANCE';
      for (let k = 0; k < 5; k++) {
        if (!walkW) {
          const kerb = k % 2 === 0 ? corners.NW : corners.SW;
          const kOffsetY = (k % 2 === 0 ? -1 : 1) * ((k >> 1) * 8);
          drawPedestrian(kerb.x - 6, kerb.y + kOffsetY, '#64748B', false);
        } else {
          const progress = (Math.sin(timeT + k * 0.8 + 3) + 1) / 2;
          const px = cx - half - 18.5;   // 407.5 - centered inside West zebra stripes (400..415)
          const startY = cy - half + 12; // 238 - strictly inside West zebra stripes (232..363)
          const endY = cy + half - 12;   // 362 - strictly inside West zebra stripes (232..363)
          const py = startY + progress * (endY - startY);
          drawPedestrian(px, py, colW, true, stW === 'CLEARANCE');
        }
      }

      // Diagonal Scramble Pedestrians during Stage 5 Scramble Phase
      if (isScramble) {
        for (let k = -3; k <= 3; k++) {
          const progress = (Math.sin(timeT + k * 0.5) + 1) / 2;
          const diagX = corners.NW.x + progress * (corners.SE.x - corners.NW.x);
          const diagY = corners.NW.y + progress * (corners.SE.y - corners.NW.y);
          drawPedestrian(diagX, diagY, '#10B981', true);
        }
      }

      // ── Center Phase Badge ───────────────────────────────────────
      const armNames: Record<string, string> = {
        S: 'South Approach Green',
        N: 'North Approach Green',
        E: 'East Approach Green',
        W: 'West Approach Green',
      };
      const label =
        emergency?.active && emergency.dir
          ? `Emergency: ${DIRNAME[emergency.dir]} Preemption`
          : ph.state === 'green'
          ? armNames[ph.activeArm || ''] || 'Approach Green'
          : ph.state === 'yellow'
          ? (DIRNAME[ph.activeArm || 'N'] || '') + ' Yellow Clearance'
          : 'All Red Clearance';
      const col = emergency?.active
        ? '#DC2626'
        : ph.state === 'green'
        ? '#0B5C3E'
        : ph.state === 'yellow'
        ? '#8A6208'
        : '#9E3331';

      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      round(ctx, cx - 120, cy - 30, 240, 60, 12);
      ctx.fill();
      ctx.strokeStyle = emergency?.active ? '#EF4444' : '#E2E7EB';
      ctx.lineWidth = emergency?.active ? 2 : 1.5;
      round(ctx, cx - 120, cy - 30, 240, 60, 12);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = col;
      ctx.font = '600 24px Inter, sans-serif';
      ctx.fillText(Math.ceil(f.remaining) + 's', cx, cy);
      ctx.fillStyle = emergency?.active ? '#B91C1C' : '#74838F';
      ctx.font = '500 12px Inter, sans-serif';
      ctx.fillText(label, cx, cy + 18);

      // ── Top Banner for Emergency / Incident / Movement Inspection ──────────
      if (emergency?.active && emergency.dir) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
        round(ctx, cx - 210, 16, 420, 36, 8);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 13px Inter, sans-serif';
        ctx.fillText(
          `[EMERGENCY PREEMPTION] Priority clearing for ${DIRNAME[emergency.dir]} approach`,
          cx,
          39
        );
      } else if (f.snap.incident?.active) {
        const inc = f.snap.incident;
        ctx.fillStyle = 'rgba(220, 38, 38, 0.95)';
        round(ctx, cx - 220, 16, 440, 36, 8);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 13px Inter, sans-serif';
        ctx.fillText(
          `[INCIDENT: COLLISION] ${DIRNAME[inc.dir]}bound Approach: Lane 1 Blocked`,
          cx,
          39
        );
      } else if (highlightMovement) {
        ctx.fillStyle = 'rgba(37, 99, 235, 0.92)';
        round(ctx, cx - 170, 16, 340, 34, 8);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 12.5px Inter, sans-serif';
        ctx.fillText(`Inspecting Movement: ${highlightMovement} (Conflict-Free)`, cx, 38);
      }

      animId = requestAnimationFrame(paint);
    };

    animId = requestAnimationFrame(paint);
    const handleResize = () => {
      if (canvasRef.current) canvasRef.current.width = 0;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [height, engine, highlightMovement]);

  return (
    <canvas
      ref={canvasRef}
      id="simCanvas"
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: height ? `${height}px` : 'auto',
        background: 'var(--surface-2, #F7F9FA)',
        borderRadius: '10px',
        ...style,
      }}
    />
  );
};
