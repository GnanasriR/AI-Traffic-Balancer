import type {
  Direction,
  TurnType,
  Vehicle,
  PhaseInfo,
  SignalPlan,
  SafetyConfig,
  ApproachTelemetry,
  CorridorJunction,
  OptimizationEvent,
  HistoryPoint,
  Snapshot,
  EmergencyState,
  ExplainItem,
  JunctionIncident,
} from '../types/signalsync';
import { trafficWsClient } from './websocketClient';

export const DIRS: Direction[] = ['N', 'S', 'E', 'W'];
export const DIRNAME: Record<Direction, string> = {
  N: 'North',
  S: 'South',
  E: 'East',
  W: 'West',
};

export const CAR_COLORS = [
  '#3B82F6', // Vibrant Blue
  '#F59E0B', // Orange / Amber
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#E11D48', // Crimson Red
  '#64748B', // Slate
  '#2563EB', // Deep Blue
];

export const GEO = {
  W: 1000,
  H: 600,
  cx: 500,
  cy: 300,
  half: 74,
  lane: 36,
  carL: 26,
  carW: 15,
  gap: 13,
  stop: { N: 248, S: 248, E: 448, W: 448 } as Record<Direction, number>,
  total: { N: 700, S: 700, E: 1100, W: 1100 } as Record<Direction, number>,
};

export function assignMovement(from: Direction, turn: TurnType): Direction {
  const MOVEMENT_MAP: Record<Direction, Record<TurnType, Direction>> = {
    N: { straight: 'S', left: 'E', right: 'W' },
    S: { straight: 'N', left: 'W', right: 'E' },
    E: { straight: 'W', left: 'S', right: 'N' },
    W: { straight: 'E', left: 'N', right: 'S' },
  };
  return MOVEMENT_MAP[from][turn];
}

export function resolveTurnType(from: Direction, to: Direction): TurnType {
  if (to === assignMovement(from, 'straight')) return 'straight';
  if (to === assignMovement(from, 'left')) return 'left';
  return 'right';
}

/* =========================================================================
   SITUATION 1: REAL-WORLD INDIAN 4-STAGE APPROACH-BY-APPROACH ROUTINE
   (Split Phasing — Standard for Single-Lane / Mixed Traffic Indian Junctions)
   ========================================================================= */
export const PHASE_SEQUENCE = [
  'stage_s',
  'yellow_s',
  'allred_s',
  'stage_n',
  'yellow_n',
  'allred_n',
  'stage_e',
  'yellow_e',
  'allred_e',
  'stage_w',
  'yellow_w',
  'allred_w',
  'stage_ped_scramble',
  'yellow_ped_scramble',
  'allred_ped_scramble',
];

export function computeCrosswalkStates(
  _movements: string[],
  phaseState: 'green' | 'yellow' | 'allred',
  isScramble?: boolean
): Record<Direction, 'WALK' | 'CLEARANCE' | 'DONT_WALK'> {
  if (isScramble) {
    if (phaseState === 'green') {
      return { N: 'WALK', S: 'WALK', E: 'WALK', W: 'WALK' };
    } else if (phaseState === 'yellow') {
      return { N: 'CLEARANCE', S: 'CLEARANCE', E: 'CLEARANCE', W: 'CLEARANCE' };
    } else {
      return { N: 'DONT_WALK', S: 'DONT_WALK', E: 'DONT_WALK', W: 'DONT_WALK' };
    }
  }

  // During all vehicle phases (stages 1-4), vehicles turning or moving straight
  // conflict with crosswalks. Crosswalks are DONT_WALK during all vehicle phases and all-red clearance.
  return {
    N: 'DONT_WALK',
    S: 'DONT_WALK',
    E: 'DONT_WALK',
    W: 'DONT_WALK',
  };
}

export const PHASES: Record<string, PhaseInfo> = {
  stage_s: {
    stage: 1,
    activeArm: 'S',
    state: 'green',
    label: 'Stage 1: South Approach Green',
    shortLabel: 'South Green',
    activeDirs: ['S'],
    movements: ['S->N', 'S->E', 'S->W'],
    pedestrianNS: false,
    pedestrianEW: false,
  },
  yellow_s: {
    stage: 1,
    activeArm: 'S',
    state: 'yellow',
    label: 'South Clearance (Yellow)',
    shortLabel: 'Yellow Clearance',
    activeDirs: ['S'],
    movements: [],
    pedestrianNS: false,
    pedestrianEW: false,
  },
  allred_s: {
    stage: 1,
    activeArm: null,
    state: 'allred',
    label: 'All-Red Safety Clearance',
    shortLabel: 'All-Red',
    activeDirs: [],
    movements: [],
    pedestrianNS: false,
    pedestrianEW: false,
  },

  stage_n: {
    stage: 2,
    activeArm: 'N',
    state: 'green',
    label: 'Stage 2: North Approach Green',
    shortLabel: 'North Green',
    activeDirs: ['N'],
    movements: ['N->S', 'N->W', 'N->E'],
    pedestrianNS: false,
    pedestrianEW: false,
  },
  yellow_n: {
    stage: 2,
    activeArm: 'N',
    state: 'yellow',
    label: 'North Clearance (Yellow)',
    shortLabel: 'Yellow Clearance',
    activeDirs: ['N'],
    movements: [],
    pedestrianNS: false,
    pedestrianEW: false,
  },
  allred_n: {
    stage: 2,
    activeArm: null,
    state: 'allred',
    label: 'All-Red Safety Clearance',
    shortLabel: 'All-Red',
    activeDirs: [],
    movements: [],
    pedestrianNS: false,
    pedestrianEW: false,
  },

  stage_e: {
    stage: 3,
    activeArm: 'E',
    state: 'green',
    label: 'Stage 3: East Approach Green',
    shortLabel: 'East Green',
    activeDirs: ['E'],
    movements: ['E->W', 'E->N', 'E->S'],
    pedestrianNS: false,
    pedestrianEW: false,
  },
  yellow_e: {
    stage: 3,
    activeArm: 'E',
    state: 'yellow',
    label: 'East Clearance (Yellow)',
    shortLabel: 'Yellow Clearance',
    activeDirs: ['E'],
    movements: [],
    pedestrianNS: false,
    pedestrianEW: false,
  },
  allred_e: {
    stage: 3,
    activeArm: null,
    state: 'allred',
    label: 'All-Red Safety Clearance',
    shortLabel: 'All-Red',
    activeDirs: [],
    movements: [],
    pedestrianNS: false,
    pedestrianEW: false,
  },

  stage_w: {
    stage: 4,
    activeArm: 'W',
    state: 'green',
    label: 'Stage 4: West Approach Green',
    shortLabel: 'West Green',
    activeDirs: ['W'],
    movements: ['W->E', 'W->S', 'W->N'],
    pedestrianNS: false,
    pedestrianEW: false,
  },
  yellow_w: {
    stage: 4,
    activeArm: 'W',
    state: 'yellow',
    label: 'West Clearance (Yellow)',
    shortLabel: 'Yellow Clearance',
    activeDirs: ['W'],
    movements: [],
    pedestrianNS: false,
    pedestrianEW: false,
  },
  allred_w: {
    stage: 4,
    activeArm: null,
    state: 'allred',
    label: 'All-Red Safety Clearance',
    shortLabel: 'All-Red',
    activeDirs: [],
    movements: [],
    pedestrianNS: false,
    pedestrianEW: false,
  },

  stage_ped_scramble: {
    stage: 5,
    activeArm: null,
    state: 'green',
    label: 'Stage 5: Exclusive Pedestrian Scramble Phase (Barnes Dance)',
    shortLabel: 'Pedestrian Scramble',
    activeDirs: [],
    movements: [],
    pedestrianNS: true,
    pedestrianEW: true,
    pedestrianScramble: true,
  },
  yellow_ped_scramble: {
    stage: 5,
    activeArm: null,
    state: 'yellow',
    label: 'Pedestrian Clearance (Flashing Don\'t Walk)',
    shortLabel: 'Ped Clearance',
    activeDirs: [],
    movements: [],
    pedestrianNS: true,
    pedestrianEW: true,
    pedestrianScramble: true,
  },
  allred_ped_scramble: {
    stage: 5,
    activeArm: null,
    state: 'allred',
    label: 'All-Red Safety Clearance',
    shortLabel: 'All-Red',
    activeDirs: [],
    movements: [],
    pedestrianNS: false,
    pedestrianEW: false,
    pedestrianScramble: false,
  },
};

export const NETWORK: CorridorJunction[] = [
  { id: 'J1', name: 'Gandhipuram Central', x: 150, y: 190, load: 0.74, offset: 0 },
  { id: 'J2', name: 'Lakeview Cross', x: 430, y: 70, load: 0.41, offset: 12 },
  { id: 'J3', name: 'Avinashi Junction', x: 430, y: 300, load: 0.63, offset: 22 },
  { id: 'J4', name: 'Mill Road Gate', x: 700, y: 300, load: 0.35, offset: 34 },
];

export const LINKS: [string, string][] = [
  ['J1', 'J3'],
  ['J3', 'J2'],
  ['J3', 'J4'],
];

/* ------------------------------------------------------------------ *
 * Vehicle Trajectory & Turning Curves Calculation                    *
 * ------------------------------------------------------------------ */
export function vpos(d: Direction, to: Direction, dist: number): { x: number; y: number; angle: number } {
  const { cx, cy, lane, half, H, W } = GEO;
  const sd = GEO.stop[d];

  const baseAngle = { N: Math.PI / 2, S: -Math.PI / 2, E: Math.PI, W: 0 }[d];
  const straightTo = { N: 'S', S: 'N', E: 'W', W: 'E' }[d];

  // Straight movement or before stop line
  if (!to || to === straightTo || dist <= sd) {
    if (d === 'N') return { x: cx - lane, y: -50 + dist, angle: Math.PI / 2 };
    if (d === 'S') return { x: cx + lane, y: H + 50 - dist, angle: -Math.PI / 2 };
    if (d === 'E') return { x: W + 50 - dist, y: cy - lane, angle: Math.PI };
    return { x: -50 + dist, y: cy + lane, angle: 0 };
  }

  // Turning movement past the stop line
  const dPast = dist - sd;
  const turnLen = 148;
  const t = Math.min(1, Math.max(0, dPast / turnLen));

  let start = { x: 0, y: 0, a: baseAngle };
  let end = { x: 0, y: 0, a: 0 };

  if (d === 'S') {
    start = { x: cx + lane, y: cy + half, a: -Math.PI / 2 };
    if (to === 'E') {
      end = { x: cx + half, y: cy + lane, a: 0 };
    } else {
      end = { x: cx - half, y: cy - lane, a: Math.PI };
    }
  } else if (d === 'N') {
    start = { x: cx - lane, y: cy - half, a: Math.PI / 2 };
    if (to === 'W') {
      end = { x: cx - half, y: cy - lane, a: Math.PI };
    } else {
      end = { x: cx + half, y: cy + lane, a: 0 };
    }
  } else if (d === 'E') {
    start = { x: cx + half, y: cy - lane, a: Math.PI };
    if (to === 'N') {
      end = { x: cx + lane, y: cy - half, a: -Math.PI / 2 };
    } else {
      end = { x: cx - lane, y: cy + half, a: Math.PI / 2 };
    }
  } else if (d === 'W') {
    start = { x: cx - half, y: cy + lane, a: 0 };
    if (to === 'S') {
      end = { x: cx - lane, y: cy + half, a: Math.PI / 2 };
    } else {
      end = { x: cx + lane, y: cy - half, a: -Math.PI / 2 };
    }
  }

  const cp = {
    x: d === 'S' || d === 'N' ? start.x : end.x,
    y: d === 'S' || d === 'N' ? end.y : start.y,
  };

  if (t < 1) {
    const omt = 1 - t;
    const x = omt * omt * start.x + 2 * omt * t * cp.x + t * t * end.x;
    const y = omt * omt * start.y + 2 * omt * t * cp.y + t * t * end.y;
    const dx = 2 * (1 - t) * (cp.x - start.x) + 2 * t * (end.x - cp.x);
    const dy = 2 * (1 - t) * (cp.y - start.y) + 2 * t * (end.y - cp.y);
    return { x, y, angle: Math.atan2(dy, dx) };
  } else {
    const dExit = dPast - turnLen;
    const x = end.x + Math.cos(end.a) * dExit;
    const y = end.y + Math.sin(end.a) * dExit;
    return { x, y, angle: end.a };
  }
}

export function round(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Maps Python simulation world coordinates (800x800, center at 400, 400)
 * to React canvas coordinates (1000x600, center at 500, 300)
 * using linear scale and translation only.
 * No physics, no spawning, no turning calculations.
 */
export function mapPythonToReactCoords(pyX: number, pyY: number): { x: number; y: number } {
  const scale = 74.0 / 90.0;
  return {
    x: 500.0 + (pyX - 400.0) * scale,
    y: 300.0 + (pyY - 400.0) * scale,
  };
}

/* ------------------------------------------------------------------ *
 * SignalSync Simulation Engine Class                                  *
 * ------------------------------------------------------------------ */
export class SignalEngineInstance {
  public mode: 'PYTHON_LIVE' | 'LOCAL_DEMO' = 'PYTHON_LIVE';
  private seq = 0;
  private lastSeq = -1;
  private animFrameId: number | null = null;
  private lastTime = 0;
  private emitTime = 0;
  private interval = 200;

  public snapshot: Snapshot | null = null;
  public previous: Snapshot | null = null;
  public lastAt = 0;
  public history: HistoryPoint[] = [];

  // Rolling history for anomaly detection (last 12 readings)
  private queueRolling: Record<Direction, number[]> = { N: [], S: [], E: [], W: [] };
  private anomalyNotified: Record<Direction, number> = { N: 0, S: 0, E: 0, W: 0 };

  private listeners: Set<(snap: Snapshot) => void> = new Set();

  public S = {
    t: 0,
    running: true,
    adaptive: true,
    rate: 1,
    phaseIdx: 0,
    remaining: 20,
    plan: { S: 22, N: 24, E: 18, W: 16, yellow: 3, allRed: 1.5, cycle: 98 } as SignalPlan,
    cfg: { minGreen: 10, maxGreen: 50, yellow: 3, allRed: 1.5, maxCycle: 140 } as SafetyConfig,
    demand: { N: 1.05, S: 0.9, E: 0.55, W: 0.5 } as Record<Direction, number>,
    cars: { N: [], S: [], E: [], W: [] } as Record<Direction, Vehicle[]>,
    cleared: 0,
    waitSum: 0,
    waitN: 0,
    baseSum: 0,
    cycles: 0,
    surge: null as Direction | null,
    emergency: { active: false, dir: null as Direction | null, remaining: 0 } as EmergencyState,
    incident: null as JunctionIncident | null,
    events: [] as OptimizationEvent[],
  };

  constructor(adaptive = true) {
    this.S.adaptive = adaptive;
    if (!adaptive) {
      // Benchmark Mode: Local Fixed Timing Simulation (rigid 60s timers, baseline delay)
      this.mode = 'LOCAL_DEMO';
      this.S.plan.S = 60;
      this.S.plan.N = 60;
      this.S.plan.E = 60;
      this.S.plan.W = 60;
      this.S.remaining = 60;
      this.warm();
      this.start();
    } else {
      // Authoritative Mode: Connected directly to Python AI Simulator
      this.mode = 'PYTHON_LIVE';
      trafficWsClient.connect();
      trafficWsClient.onMessage((msg: any) => {
        if (this.mode === 'PYTHON_LIVE') {
          if (msg.type === 'METRICS_UPDATE' && msg.data) {
            this.receive(msg.data as Snapshot);
          } else if (msg.data && (msg.data.approaches || msg.data.activePhase || msg.data.phase)) {
            this.receive(msg.data as Snapshot);
          } else if (msg.approaches || msg.activePhase || msg.phase) {
            this.receive(msg as Snapshot);
          }
        }
      });
    }
  }

  public subscribe(fn: (snap: Snapshot) => void): () => void {
    this.listeners.add(fn);
    if (this.snapshot) fn(this.snapshot);
    return () => this.listeners.delete(fn);
  }

  public currentPhaseKey(): string {
    return PHASE_SEQUENCE[this.S.phaseIdx];
  }

  public phaseInfo(): PhaseInfo {
    const key = this.currentPhaseKey();
    const base = PHASES[key];
    const isScramble = Boolean(base.pedestrianScramble);
    const crosswalks = computeCrosswalkStates(base.movements, base.state, isScramble);
    return {
      ...base,
      crosswalks,
    };
  }

  public queue(d: Direction): number {
    return this.S.cars[d].filter((c) => c.stopped && c.dist <= GEO.stop[d] + 2).length;
  }

  public scoreOf(d: Direction): number {
    const arr = this.S.cars[d];
    const q = this.queue(d);
    const wait = arr.length ? arr.reduce((s, c) => s + c.wait, 0) / arr.length : 0;
    const density = Math.min(1, arr.length / 22);
    return Math.min(1, density * 0.55 + Math.min(1, q / 14) * 0.3 + Math.min(1, wait / 45) * 0.15);
  }

  private replan(): void {
    const c = this.S.cfg;
    // Geometry calculation for 14m x 14m intersection diagonal crossing at 1.2m/s
    const PED_SCRAMBLE_DURATION = 20;

    if (!this.S.adaptive) {
      this.S.plan.S = 60;
      this.S.plan.N = 60;
      this.S.plan.E = 60;
      this.S.plan.W = 60;
    } else {
      // Use sum(vehicle.pce) per approach for effective queue calculation
      const pceS = Math.max(1.0, this.S.cars['S'].reduce((sum, c) => sum + (c.pce || 1.0), 0));
      const pceN = Math.max(1.0, this.S.cars['N'].reduce((sum, c) => sum + (c.pce || 1.0), 0));
      const pceE = Math.max(1.0, this.S.cars['E'].reduce((sum, c) => sum + (c.pce || 1.0), 0));
      const pceW = Math.max(1.0, this.S.cars['W'].reduce((sum, c) => sum + (c.pce || 1.0), 0));
      const totalWeight = pceS + pceN + pceE + pceW;

      // Lost time L = (4 vehicle phases * (yellow + allRed)) + 20s Exclusive Pedestrian Scramble
      const lost = 4 * (c.yellow + c.allRed) + PED_SCRAMBLE_DURATION;
      const cyc = Math.max(60, Math.min(c.maxCycle, Math.round(55 + totalWeight * 1.6)));
      const avail = cyc - lost;

      this.S.plan.S = Math.max(c.minGreen, Math.min(c.maxGreen, Math.round(avail * (pceS / totalWeight))));
      this.S.plan.N = Math.max(c.minGreen, Math.min(c.maxGreen, Math.round(avail * (pceN / totalWeight))));
      this.S.plan.E = Math.max(c.minGreen, Math.min(c.maxGreen, Math.round(avail * (pceE / totalWeight))));
      this.S.plan.W = Math.max(c.minGreen, Math.min(c.maxGreen, Math.round(avail * (pceW / totalWeight))));
    }
    this.S.plan.yellow = c.yellow;
    this.S.plan.allRed = c.allRed;
    this.S.plan.cycle = this.S.plan.S + this.S.plan.N + this.S.plan.E + this.S.plan.W + 4 * (c.yellow + c.allRed) + PED_SCRAMBLE_DURATION;
    this.logEvent(
      'plan',
      `AI Webster Timing: South ${this.S.plan.S}s | North ${this.S.plan.N}s | East ${this.S.plan.E}s | West ${this.S.plan.W}s | Ped Scramble 20s (Total Cycle ${this.S.plan.cycle}s)`
    );
  }

  public logEvent(kind: 'plan' | 'ctl' | 'incident' | 'emergency', text: string): void {
    this.S.events.unshift({ kind, text, ts: Date.now() });
    if (this.S.events.length > 25) this.S.events.pop();
  }

  private phaseDuration(key: string): number {
    if (key === 'stage_s') return this.S.plan.S;
    if (key === 'stage_n') return this.S.plan.N;
    if (key === 'stage_e') return this.S.plan.E;
    if (key === 'stage_w') return this.S.plan.W;
    if (key === 'stage_ped_scramble') return 20; // 20s geometry-calculated diagonal walk
    if (key.startsWith('yellow')) return this.S.plan.yellow;
    return this.S.plan.allRed;
  }

  private advancePhase(): void {
    // If emergency is active, handle holding or switching to emergency direction
    if (this.S.emergency.active && this.S.emergency.dir) {
      const eKey = `stage_${this.S.emergency.dir.toLowerCase()}`;
      if (this.currentPhaseKey() !== eKey) {
        // Step through clearance to reach emergency arm
        const curPi = this.phaseInfo();
        if (curPi.state === 'green') {
          // Move to yellow
          this.S.phaseIdx = PHASE_SEQUENCE.indexOf(`yellow_${curPi.activeDirs[0].toLowerCase()}`);
          this.S.remaining = this.S.plan.yellow;
          return;
        } else if (curPi.state === 'yellow') {
          // Move to all red
          this.S.phaseIdx = PHASE_SEQUENCE.indexOf(`allred_${this.currentPhaseKey().split('_')[1]}`);
          this.S.remaining = this.S.plan.allRed;
          return;
        } else {
          // Immediately enter emergency green
          this.S.phaseIdx = PHASE_SEQUENCE.indexOf(eKey);
          this.S.remaining = Math.max(15, Math.ceil(this.S.emergency.remaining));
          this.logEvent('emergency', `Emergency Green Priority Activated for ${DIRNAME[this.S.emergency.dir]} approach`);
          return;
        }
      } else {
        // Already on emergency green, hold if still remaining
        if (this.S.emergency.remaining > 0) {
          this.S.remaining = Math.ceil(this.S.emergency.remaining);
          return;
        }
      }
    }

    this.S.phaseIdx = (this.S.phaseIdx + 1) % PHASE_SEQUENCE.length;
    const key = this.currentPhaseKey();
    if (key === 'stage_s') {
      this.S.cycles++;
      this.replan();
    }
    this.S.remaining = this.phaseDuration(key);
    const pi = this.phaseInfo();
    if (pi.state === 'green') {
      this.logEvent('plan', `${pi.label} ACTIVE — All other 3 arms held on RED before stop lines`);
    }
  }

  private step(dt: number): void {
    if (!this.S.running) return;
    dt = Math.min(dt, 0.05) * this.S.rate;
    this.S.t += dt;
    this.S.remaining -= dt;

    // Handle emergency countdown
    if (this.S.emergency.active) {
      this.S.emergency.remaining -= dt;
      if (this.S.emergency.remaining <= 0) {
        const d = this.S.emergency.dir;
        this.S.emergency = { active: false, dir: null, remaining: 0 };
        this.logEvent('emergency', `Emergency preemption cleared for ${DIRNAME[d || 'S']} approach — normal Situation 1 cycle resumed`);
      }
    }

    if (this.S.remaining <= 0) this.advancePhase();

    const pi = this.phaseInfo();

    for (const d of DIRS) {
      let r = this.S.demand[d] * (1 + 0.35 * Math.sin(this.S.t / 47 + DIRS.indexOf(d)));
      if (this.S.surge === d) r *= 1.9;
      if (this.S.emergency.active && this.S.emergency.dir === d) r *= 1.4;

      const arr = this.S.cars[d];
      const tail = arr[arr.length - 1];
      const isIncidentArm = Boolean(this.S.incident?.active && this.S.incident.dir === d);

      // Spawn vehicle with destination & turn (moderated inflow during lane incident)
      // Spawn vehicle with destination & turn using single shared assignMovement function
      const spawnRate = isIncidentArm ? r * 0.5 : r;
      if (Math.random() < spawnRate * dt && arr.length < 42 && !(tail && tail.dist < 34)) {
        const turnRoll = Math.random();
        const turn: TurnType = turnRoll < 0.40 ? 'straight' : turnRoll < 0.70 ? 'left' : 'right';
        const to: Direction = assignMovement(d, turn);

        // Consistent vehicle fleet matching adaptive side: Cars (88%) and Buses (12%)
        // No bikes or auto rickshaws, zero lateral jitter so cars stay perfectly aligned in lanes
        const isBus = Math.random() < 0.12;
        const vType: 'CAR' | 'BUS' = isBus ? 'BUS' : 'CAR';
        const pceVal = isBus ? 2.5 : 1.0;
        const isHeavyVeh = isBus;

        arr.push({
          id: 'v' + ++this.seq,
          dir: d,
          dist: 0,
          v: 0,
          wait: 0,
          stopped: false,
          to,
          turn,
          col: CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0],
          heavy: isHeavyVeh,
          type: vType,
          lateralOffset: 0,
          pce: pceVal,
          otState: 'NONE',
          targetOtOffset: 0,
        });
      }

      const sd = GEO.stop[d];
      const isGreenForArm = pi.state === 'green' && pi.activeArm === d;

      // Sort vehicles by distance descending
      arr.sort((a, b) => b.dist - a.dist);

      for (let i = 0; i < arr.length; i++) {
        const car = arr[i];
        car.lateralOffset = 0;
        car.otState = 'NONE';
        car.targetOtOffset = 0;

        const carL = car.type === 'BUS' || car.type === 'TRUCK' || car.heavy ? 40 : car.type === 'TWO_WHEELER' ? 16 : car.type === 'AUTO_RICKSHAW' ? 22 : 26;

        let limit = Infinity;

        // Check against lead vehicle directly ahead on the same approach
        if (i > 0) {
          const lead = arr[i - 1];
          const leadL = lead.type === 'BUS' || lead.type === 'TRUCK' || lead.heavy ? 40 : lead.type === 'TWO_WHEELER' ? 16 : lead.type === 'AUTO_RICKSHAW' ? 22 : 26;
          const minSafetyGap = (leadL + carL) / 2 + 10;
          limit = Math.min(limit, lead.dist - minSafetyGap);
        }

        // Signal enforcement: stop vehicles before the stop line if signal is NOT green!
        if (!isGreenForArm && !car.isAmbulance) {
          if (car.dist <= sd + 5) {
            limit = Math.min(limit, sd);
          }
        }

        // Approach-relative hazard zone calculation:
        // For N/S (sd=248): hzStart=75, hzEnd=215
        // For E/W (sd=448): hzStart=275, hzEnd=415
        const hzStart = sd - 173;
        const hzEnd = sd - 33;
        const inHazardZone = isIncidentArm && !car.isAmbulance && car.dist >= hzStart && car.dist <= hzEnd;

        let top = car.isAmbulance
          ? 165
          : inHazardZone
          ? 35 // Slow crawl while passing through accident bottleneck for ALL approaches (N, S, E, W)
          : car.heavy
          ? 95
          : car.type === 'TWO_WHEELER'
          ? 140
          : car.type === 'AUTO_RICKSHAW'
          ? 110
          : 120;

        // Turning speed reduction inside curve segment (dist > sd && dist < sd + 148)
        if (car.dist > sd && car.dist < sd + 148 && car.turn !== 'straight') {
          top = car.turn === 'left' ? 50 : 65;
        }

        const target = Math.min(car.dist + top * dt, limit);
        car.v = Math.max(0, (target - car.dist) / dt);
        car.dist = Math.max(car.dist, Math.min(target, limit));
        car.stopped = car.v < 5;

        // Strict stopline enforcement ONLY for vehicles arriving at the stop line on RED
        if (!isGreenForArm && !car.isAmbulance && car.dist >= sd && car.dist <= sd + 5) {
          car.dist = sd;
          car.v = 0;
          car.stopped = true;
        }

        if (car.stopped && car.dist <= sd + 2) car.wait += dt;
      }

      // Check if ambulance cleared through the junction
      const amb = arr.find((c) => c.isAmbulance);
      if (amb && amb.dist > 480 && this.S.emergency.active && this.S.emergency.dir === d) {
        this.logEvent('emergency', `[AMBULANCE CLEARED] Emergency Medical Unit passed junction safely — restoring standard cycle`);
        this.S.emergency = { active: false, dir: null, remaining: 0 };
      }

      // Remove cleared vehicles (drive off screen past 1150px)
      while (arr.length && arr[0].dist > 1150) {
        const c = arr.shift()!;
        this.S.cleared++;
        this.S.waitSum += c.wait;
        this.S.waitN++;
        this.S.baseSum += c.wait * (this.S.adaptive ? 1.34 : 1.0);
      }
      arr.sort((a, b) => b.dist - a.dist);
    }

    // Cross-Approach Intersection Collision Prevention
    const junctionCars: { car: Vehicle; pos: { x: number; y: number } }[] = [];
    for (const d of DIRS) {
      const sd = GEO.stop[d];
      for (const car of this.S.cars[d]) {
        if (car.dist > sd - 10 && car.dist < sd + 160) {
          const pos = vpos(car.dir, car.to, car.dist);
          junctionCars.push({ car, pos });
        }
      }
    }
    for (let i = 0; i < junctionCars.length; i++) {
      for (let j = i + 1; j < junctionCars.length; j++) {
        const a = junctionCars[i];
        const b = junctionCars[j];
        if (a.car.dir === b.car.dir) continue; // Same-approach already checked
        const dx = a.pos.x - b.pos.x;
        const dy = a.pos.y - b.pos.y;
        const dist2D = Math.sqrt(dx * dx + dy * dy);
        if (dist2D < 28) {
          // Collision threat between vehicles from different approaches:
          // Yielding vehicle decelerates to maintain safe spacing
          const yielding = a.car.dist < b.car.dist ? a.car : b.car;
          yielding.v = Math.max(0, yielding.v * 0.5);
        }
      }
    }
  }

  private generateExplainability(): ExplainItem[] {
    const qS = this.queue('S');
    const qN = this.queue('N');
    const qE = this.queue('E');
    const qW = this.queue('W');

    const queues = [
      { dir: 'S' as Direction, q: qS },
      { dir: 'N' as Direction, q: qN },
      { dir: 'E' as Direction, q: qE },
      { dir: 'W' as Direction, q: qW },
    ].sort((a, b) => b.q - a.q);

    const highest = queues[0];
    const second = queues[1];
    const lowest = queues[3];

    const waitHighest = this.S.cars[highest.dir].length
      ? this.S.cars[highest.dir].reduce((sum, c) => sum + c.wait, 0) / this.S.cars[highest.dir].length
      : 0;

    return [
      {
        feature: `${DIRNAME[highest.dir]} Queue Density`,
        value: `${highest.q} veh waiting`,
        impact: Math.min(48, Math.max(25, 20 + highest.q * 3)),
        positive: true,
        reason: 'Heavy stopline queue priority split allocation',
      },
      {
        feature: `${DIRNAME[second.dir]} Wait Pressure`,
        value: `${waitHighest.toFixed(1)}s avg wait`,
        impact: Math.min(35, Math.max(15, 12 + Math.round(waitHighest))),
        positive: true,
        reason: 'Accumulated driver delay approaching threshold',
      },
      {
        feature: `${DIRNAME[lowest.dir]} Minor Approach Flow`,
        value: `${this.S.demand[lowest.dir].toFixed(2)} veh/s`,
        impact: -Math.min(25, Math.max(10, Math.round(18 - lowest.q * 2))),
        positive: false,
        reason: 'Light arrival rate trimmed to minimum green allowance',
      },
    ];
  }

  public createSnapshot(): Snapshot {
    const pi = this.phaseInfo();
    const approaches: Record<Direction, ApproachTelemetry> = {} as any;
    const vehicles: Vehicle[] = [];
    let inJunction = 0;

    for (const d of DIRS) {
      const arr = this.S.cars[d];
      const q = this.queue(d);
      const wait = arr.length ? arr.reduce((s, c) => s + c.wait, 0) / arr.length : 0;
      const speed = arr.length ? (arr.reduce((s, c) => s + c.v, 0) / arr.length) * 0.36 : 46;
      const score = this.scoreOf(d);

      const isGreen = pi.state === 'green' && pi.activeArm === d;
      const isYellow = pi.state === 'yellow' && pi.activeArm === d;

      // Track rolling history for anomaly detection
      const roll = this.queueRolling[d];
      roll.push(q);
      if (roll.length > 15) roll.shift();
      const avgQ = roll.reduce((sum, v) => sum + v, 0) / roll.length;

      // Anomaly trigger: queue 75% above rolling average and queue >= 5, or score > 0.82
      const isAnomaly = (q >= 6 && q > avgQ * 1.7) || score > 0.82;
      let anomalyReason: string | undefined;

      if (isAnomaly) {
        anomalyReason = `Surge detected: queue +${Math.round(((q - avgQ) / Math.max(1, avgQ)) * 100)}% above 5-min average`;
        const now = Date.now();
        if (now - this.anomalyNotified[d] > 35000) {
          this.anomalyNotified[d] = now;
          this.logEvent('incident', `[ANOMALY DETECTED] Unusual congestion spike on ${DIRNAME[d]} approach: ${q} veh queued`);
        }
      }

      const effectivePce = arr.reduce((s, c) => s + (c.pce || (c.heavy ? 3.0 : 1.0)), 0);

      approaches[d] = {
        count: arr.length,
        queue: q,
        effectivePce,
        wait,
        speed,
        density: Math.min(1, arr.length / 22),
        score,
        level: score > 0.66 ? 'HIGH' : score > 0.33 ? 'MEDIUM' : 'LOW',
        trend: q > 6 ? 'rising' : q < 3 ? 'easing' : 'steady',
        conf: 0.74 + Math.min(0.22, arr.length / 90),
        eta: Math.round(4 + (1 - score) * 9),
        signalThrough: isGreen,
        signalRight: isGreen,
        isYellow,
        anomaly: isAnomaly,
        anomalyReason,
      };

      inJunction += arr.length;
      for (const c of arr) {
        vehicles.push({ ...c });
      }
    }

    const avgWait = this.S.waitN ? this.S.waitSum / this.S.waitN : 0;
    const baselineWait = this.S.waitN ? this.S.baseSum / this.S.waitN : 0;

    return {
      ts: Date.now(),
      junction: { id: 'J1', name: 'Gandhipuram Central' },
      control: {
        adaptive: this.S.adaptive,
        running: this.S.running,
        rate: this.S.rate,
        cfg: { ...this.S.cfg },
        demand: { ...this.S.demand },
      },
      phase: {
        stage: pi.stage,
        activeArm: pi.activeArm,
        state: pi.state,
        remaining: this.S.remaining,
        phaseName: this.currentPhaseKey(),
        label: pi.label,
        shortLabel: pi.shortLabel,
        activeDirs: pi.activeDirs,
        movements: pi.movements,
        activeMovements: pi.movements,
        pedestrianNS: pi.pedestrianNS,
        pedestrianEW: pi.pedestrianEW,
        plan: { ...this.S.plan },
      },
      approaches,
      vehicles,
      totals: {
        inJunction,
        cleared: this.S.cleared,
        avgWait,
        baselineWait,
        savings: baselineWait > 0 ? Math.max(0, (1 - avgWait / baselineWait) * 100) : 0,
        cycles: this.S.cycles,
      },
      network: NETWORK.map((j) => ({ ...j })),
      events: this.S.events.slice(0, 15),
      emergency: { ...this.S.emergency },
      explain: this.generateExplainability(),
      incident: this.S.incident ? { ...this.S.incident } : null,
    };
  }

  public normalizeSnapshot(raw: any): Snapshot {
    if (!raw) return this.createSnapshot();

    const keyMap: Record<string, Direction> = {
      NORTH: 'N', N: 'N',
      SOUTH: 'S', S: 'S',
      EAST: 'E', E: 'E',
      WEST: 'W', W: 'W',
    };

    const rawApproaches = raw.approaches || {};
    const normApproaches: Record<Direction, ApproachTelemetry> = {} as any;

    for (const d of DIRS) {
      const srcKey = Object.keys(rawApproaches).find(
        (k) => keyMap[k.toUpperCase()] === d
      );
      const appData = srcKey ? rawApproaches[srcKey] : null;

      normApproaches[d] = {
        count: appData?.vehicleCount ?? appData?.count ?? 0,
        queue: appData?.queueCount ?? appData?.queue ?? 0,
        effectivePce: appData?.effectivePce ?? (appData?.queueCount ?? appData?.queue ?? 0),
        wait: appData?.averageWaitTimeSeconds ?? appData?.wait ?? 0,
        speed: appData?.speed ?? 40,
        density: appData?.density !== undefined ? (appData.density > 1.0 ? appData.density / 100.0 : appData.density) : Math.min(1, (appData?.queueCount ?? 0) / 22),
        score: appData?.score !== undefined ? (appData.score > 1.0 ? Math.min(1.0, appData.score / 500.0) : appData.score) : Math.min(1, (appData?.queueCount ?? 0) / 20),
        level: appData?.level ?? ((appData?.queueCount ?? 0) > 10 ? 'HIGH' : 'LOW'),
        trend: appData?.trend ?? 'steady',
        conf: appData?.conf ?? 0.85,
        eta: appData?.eta ?? 5,
        signalThrough: appData?.light === 'GREEN' || appData?.signalThrough || false,
        signalRight: appData?.light === 'GREEN' || appData?.signalRight || false,
        isYellow: appData?.light === 'YELLOW' || appData?.isYellow || false,
      };
    }

    let vehicles: Vehicle[] = [];
    if (Array.isArray(raw.vehicles)) {
      vehicles = raw.vehicles.map((v: any, idx: number) => {
        const dir: Direction = keyMap[v.dir?.toUpperCase()] || v.dir || 'N';
        const turn: TurnType = v.turn || 'straight';
        const to: Direction = v.to ? (keyMap[v.to.toUpperCase()] || v.to) : assignMovement(dir, turn);
        return {
          id: v.id || `v_${idx}`,
          dir,
          to,
          turn,
          dist: v.dist ?? 0,
          x: v.x !== undefined ? Number(v.x) : undefined,
          y: v.y !== undefined ? Number(v.y) : undefined,
          angle: v.angle !== undefined ? Number(v.angle) : undefined,
          speed: v.speed ?? v.v ?? 12,
          waiting: v.waiting ?? ((v.wait ?? 0) > 0),
          v: v.speed ?? v.v ?? 12,
          wait: v.wait ?? 0,
          stopped: v.stopped ?? ((v.speed ?? v.v ?? 0) < 0.5),
          col: v.col || CAR_COLORS[idx % CAR_COLORS.length],
          heavy: v.heavy || v.type === 'BUS' || v.type === 'TRUCK',
          isAmbulance: v.isAmbulance || v.type === 'AMBULANCE' || false,
          type: v.type ? v.type.toUpperCase() : (v.heavy ? 'BUS' : 'CAR'),
          lateralOffset: 0,
          pce: v.pce ?? (v.type === 'TWO_WHEELER' ? 0.5 : v.type === 'AUTO_RICKSHAW' ? 0.8 : v.type === 'BUS' || v.type === 'TRUCK' ? 3.0 : 1.0),
          otState: v.otState || 'NONE',
          targetOtOffset: v.targetOtOffset || 0,
          otTargetId: v.otTargetId || undefined,
        };
      });
    }

    const activeArmRaw = raw.activePhase || raw.phase?.activeArm;
    const activeArmNorm = activeArmRaw ? keyMap[String(activeArmRaw).toUpperCase()] || null : null;
    const activeColorRaw = raw.activeColor || raw.phase?.state || 'green';
    const stateNorm = String(activeColorRaw).toLowerCase() as 'green' | 'yellow' | 'allred';

    const stageNum = raw.phase?.stage ?? (activeArmNorm === 'S' ? 1 : activeArmNorm === 'N' ? 2 : activeArmNorm === 'E' ? 3 : activeArmNorm === 'W' ? 4 : 5);
    const activeMovements = activeArmNorm ? [`${activeArmNorm}->N`, `${activeArmNorm}->E`, `${activeArmNorm}->W`] : [];

    return {
      seq: raw.seq,
      ts: raw.timestamp || raw.ts || Date.now(),
      junction: raw.junction || { id: 'J1', name: 'Gandhipuram Central' },
      control: raw.control || {
        adaptive: raw.currentPlan === 'ADAPTIVE' || true,
        running: true,
        rate: 1,
        cfg: { minGreen: 10, maxGreen: 50, yellow: 3, allRed: 1.5, maxCycle: 140 },
        demand: { N: 1.0, S: 1.0, E: 0.8, W: 0.8 },
      },
      phase: {
        stage: stageNum,
        activeArm: activeArmNorm,
        state: stateNorm,
        remaining: raw.phaseTimeRemaining ?? raw.phase?.remaining ?? 20,
        phaseName: raw.phase?.phaseName || (activeArmNorm ? `stage_${activeArmNorm.toLowerCase()}` : 'stage_clearance'),
        label: raw.phase?.label || raw.aiExplanation || (activeArmNorm ? `${DIRNAME[activeArmNorm]} Green` : 'Clearance Phase'),
        shortLabel: raw.phase?.shortLabel || (activeArmNorm ? `${DIRNAME[activeArmNorm]} Green` : (stateNorm === 'yellow' ? 'Yellow Clearance' : 'All-Red Clearance')),
        activeDirs: activeArmNorm ? [activeArmNorm] : [],
        movements: activeMovements,
        activeMovements,
        pedestrianNS: false,
        pedestrianEW: false,
        crosswalks: raw.crosswalks || computeCrosswalkStates(activeMovements, stateNorm, stageNum === 5),
        plan: raw.phase?.plan || { S: 22, N: 24, E: 18, W: 16, yellow: 3, allRed: 1.5, cycle: raw.cycleLength || 115 },
      },
      approaches: normApproaches,
      vehicles,
      totals: {
        inJunction: raw.totals?.inJunction ?? vehicles.length,
        cleared: raw.totals?.cleared ?? 0,
        avgWait: raw.totals?.avgWait ?? 15.0,
        baselineWait: raw.totals?.baselineWait ?? 25.0,
        savings: raw.totals?.savings ?? 20.0,
        cycles: raw.totals?.cycles ?? 1,
      },
      network: (() => {
        const qTotal = Object.values(normApproaches).reduce((sum, a) => sum + (a.queue || 0), 0);
        const vTotal = vehicles.length;
        const j1DynamicLoad = Math.min(0.92, Math.max(0.15, (qTotal * 1.5 + vTotal * 0.4) / 32.0));

        return (raw.network || NETWORK).map((j: any, idx: number) => {
          let l = typeof j.load === 'number' ? j.load : 0.4;
          if (l > 1.0) l = l / 100.0;
          if (idx === 0) {
            l = j1DynamicLoad;
          } else if (l >= 0.70) {
            const factor = idx === 1 ? 0.82 : idx === 2 ? 0.75 : 0.68;
            const jitter = ((idx * 7) % 5) / 100;
            l = Math.min(0.88, Math.max(0.18, j1DynamicLoad * factor + jitter));
          }
          return {
            ...j,
            load: Math.round(Math.min(1.0, Math.max(0.05, l)) * 100) / 100,
          };
        });
      })(),
      events: raw.events || [],
      emergency: raw.emergency || { active: false, dir: null, remaining: 0 },
      explain: raw.explain || [],
      incident: raw.incident || null,
      ai: raw.ai,
    };
  }

  public receive(rawSnap: any): void {
    if (rawSnap && typeof rawSnap.seq === 'number') {
      if (rawSnap.seq <= this.lastSeq) {
        // Drop out-of-order or duplicate snapshot
        return;
      }
      this.lastSeq = rawSnap.seq;
    }
    const snap = this.normalizeSnapshot(rawSnap);
    this.previous = this.snapshot;
    this.snapshot = snap;
    this.lastAt = performance.now();
    const h = this.history;
    if (!h.length || snap.ts - h[h.length - 1].ts > 3500) {
      h.push({
        ts: snap.ts,
        veh: snap.totals.inJunction,
        queue: DIRS.reduce((s, d) => s + (snap.approaches[d]?.queue ?? 0), 0),
        wait: +(snap.totals.avgWait || 0).toFixed(1),
        spd: +((DIRS.reduce((s, d) => s + (snap.approaches[d]?.speed ?? 40), 0)) / 4).toFixed(1),
      });
      if (h.length > 60) h.shift();
    }
    this.listeners.forEach((fn) => fn(snap));
  }

  private loop = (now: number): void => {
    // In PYTHON_LIVE mode, local simulation MUST NEVER RUN, even if Python is offline.
    // If Python disconnects, live simulation stops and displays PYTHON OFFLINE.
    if (this.mode === 'PYTHON_LIVE') {
      return;
    }
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.step(dt);
    if (now - this.emitTime >= this.interval) {
      this.emitTime = now;
      this.receive(this.createSnapshot());
    }
    this.animFrameId = requestAnimationFrame(this.loop);
  };

  public warm(): void {
    if (this.mode === 'PYTHON_LIVE') return;
    for (let i = 0; i < 520; i++) this.step(0.05);
    this.receive(this.createSnapshot());
  }

  public start(): void {
    if (this.mode === 'PYTHON_LIVE') return;
    if (this.animFrameId) return;
    this.lastTime = performance.now();
    this.emitTime = 0;
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  public stop(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = null;
  }

  public command(type: string, payload: any = {}): void {
    trafficWsClient.send({
      type,
      action: type,
      payload,
      ...payload,
    });

    if (this.mode === 'PYTHON_LIVE') {
      // In live WebSocket mode, Python is the SINGLE SOURCE OF TRUTH.
      // Do NOT run local simulation mutations or create local snapshots.
      // Python's backend processes the command and broadcasts the authoritative snapshot.
      return;
    }

    if (type === 'pause') {
      this.S.running = !this.S.running;
      this.logEvent('ctl', this.S.running ? 'Feed resumed' : 'Feed paused');
    }
    if (type === 'rate') {
      this.S.rate = payload.rate;
    }
    if (type === 'adaptive') {
      this.S.adaptive = payload.on;
      this.replan();
      this.logEvent('ctl', payload.on ? 'Adaptive Stage Timing enabled' : 'Fixed Stage Timers enabled');
    }
    if (type === 'constraints') {
      this.S.cfg = { ...this.S.cfg, ...payload };
      this.replan();
    }
    if (type === 'demand') {
      this.S.demand[payload.dir as Direction] = payload.value;
    }
    if (type === 'incident') {
      this.S.surge = payload.dir;
      this.S.demand[payload.dir as Direction] = Math.min(2, this.S.demand[payload.dir as Direction] + 0.7);
      this.logEvent('incident', `Surge on ${DIRNAME[payload.dir as Direction]} approach — AI extending green allocation`);
      setTimeout(() => {
        this.S.surge = null;
      }, 40000);
    }
    if (type === 'dispatch_ambulance' || type === 'emergency') {
      let targetDir = payload?.dir as Direction;
      if (!targetDir || (targetDir as string) === 'RANDOM' || (targetDir as string) === 'R') {
        targetDir = DIRS[Math.floor(Math.random() * DIRS.length)];
      }
      if (this.S.emergency.active && this.S.emergency.dir === targetDir && type === 'emergency') {
        // Cancel emergency
        this.S.emergency = { active: false, dir: null, remaining: 0 };
        this.logEvent('emergency', `Emergency preemption cleared by operator for ${DIRNAME[targetDir]} approach`);
      } else {
        // Activate emergency override
        this.S.emergency = { active: true, dir: targetDir, remaining: 32 };
        this.logEvent('emergency', `[EMERGENCY PREEMPTION] Priority green corridor open for Ambulance on ${DIRNAME[targetDir]} approach`);
        // If not already green on this arm, transition safely via yellow & all-red
        const curPi = this.phaseInfo();
        if (curPi.activeArm !== targetDir) {
          if (curPi.state === 'green') {
            this.S.phaseIdx = PHASE_SEQUENCE.indexOf(`yellow_${curPi.activeDirs[0].toLowerCase()}`);
            this.S.remaining = this.S.plan.yellow;
          }
        }

        // Spawn physical Ambulance vehicle
        const straightOpposite: Record<Direction, Direction> = { N: 'S', S: 'N', E: 'W', W: 'E' };
        const hasAmb = this.S.cars[targetDir].some((c) => c.isAmbulance);
        if (!hasAmb) {
          this.S.cars[targetDir].push({
            id: 'amb_' + ++this.seq,
            dir: targetDir,
            dist: 12,
            v: 155,
            wait: 0,
            stopped: false,
            to: straightOpposite[targetDir],
            turn: 'straight',
            col: '#FFFFFF',
            heavy: false,
            isAmbulance: true,
          });
          this.S.cars[targetDir].sort((a, b) => b.dist - a.dist);
          this.logEvent('emergency', `[AMBULANCE DISPATCHED] Emergency Medical Unit deployed on ${DIRNAME[targetDir]} approach`);
        }
      }
    }
    if (type === 'toggle_incident') {
      const targetDir = (payload.dir as Direction) || 'N';
      if (this.S.incident && this.S.incident.active && this.S.incident.dir === targetDir) {
        this.S.incident = null;
        this.logEvent('incident', `Incident cleared on ${DIRNAME[targetDir]} approach — all lanes restored`);
      } else {
        this.S.incident = {
          active: true,
          type: 'collision',
          dir: targetDir,
          lane: 0,
          title: `Collision on ${DIRNAME[targetDir]}bound approach`,
          description: 'Two vehicles collided before stop line. Lane 1 blocked — capacity reduced.',
        };
        // Preserve all vehicles in queue during incident
        this.logEvent('incident', `[INCIDENT] Collision reported on ${DIRNAME[targetDir]} approach — Lane 1 blocked`);
      }
    }
    if (type === 'reset') {
      this.S.cleared = 0;
      this.S.waitSum = 0;
      this.S.waitN = 0;
      this.S.baseSum = 0;
      this.S.cycles = 0;
      this.S.events = [];
      this.history = [];
      this.S.emergency = { active: false, dir: null, remaining: 0 };
    }
    this.receive(this.createSnapshot());
  }

  public getInterpolated(): { snap: Snapshot; cars: Vehicle[]; remaining: number } | null {
    const s = this.snapshot;
    if (!s) return null;
    const p = this.previous;
    const k = Math.max(0, Math.min(1.25, (performance.now() - this.lastAt) / this.interval));
    const prevMap = new Map<string, Vehicle>();
    if (p) {
      for (const v of p.vehicles) prevMap.set(v.id, v);
    }
    const cars = s.vehicles.map((v) => {
      const q = prevMap.get(v.id);
      const dist = q ? q.dist + (v.dist - q.dist) * k : v.dist;
      let x = v.x;
      let y = v.y;
      let angle = v.angle;
      if (q && q.x !== undefined && v.x !== undefined && q.y !== undefined && v.y !== undefined) {
        x = q.x + (v.x - q.x) * k;
        y = q.y + (v.y - q.y) * k;
        angle = v.angle;
      }
      return { ...v, dist, x, y, angle };
    });
    // Authoritative remaining time directly from Python — no local deduction
    const remaining = s.phase.remaining;
    return { snap: s, cars, remaining };
  }
}

export const signalSyncEngine = new SignalEngineInstance(true);
export const fixedSyncEngine = new SignalEngineInstance(false);
export { SignalEngineInstance as SignalSyncEngine };
