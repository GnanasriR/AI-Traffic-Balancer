export type Direction = 'N' | 'S' | 'E' | 'W';

export type TurnType = 'straight' | 'right' | 'left';

export type VehicleTypeKind = 'TWO_WHEELER' | 'AUTO_RICKSHAW' | 'CAR' | 'BUS' | 'TRUCK';

export interface Vehicle {
  id: string;
  dir: Direction;
  to: Direction;
  turn: TurnType;
  dist: number;
  x?: number;
  y?: number;
  angle?: number;
  speed?: number;
  waiting?: boolean;
  v: number;
  wait: number;
  stopped: boolean;
  col: string;
  heavy: boolean;
  isAmbulance?: boolean;
  type?: VehicleTypeKind;
  lateralOffset?: number; // [-18.0 to +18.0]
  pce?: number;          // 0.5 (TWO_WHEELER), 0.8 (AUTO), 1.0 (CAR), 3.0 (BUS/TRUCK)
  otState?: 'NONE' | 'PASSING' | 'ALONGSIDE' | 'FILTERING' | 'MERGING';
  targetOtOffset?: number;
  otTargetId?: string;
}

export type PedestrianSubState = 'WALK' | 'CLEARANCE_FLASHING' | 'DONT_WALK';

export interface PhaseInfo {
  stage: number;
  activeArm: Direction | null;
  state: 'green' | 'yellow' | 'allred';
  label: string;
  shortLabel: string;
  activeDirs: Direction[];
  movements: string[];
  activeMovements?: string[];
  pedestrianNS: boolean;
  pedestrianEW: boolean;
  pedestrianScramble?: boolean;
  pedestrianSubState?: Record<string, PedestrianSubState>;
  crosswalks?: Record<Direction, 'WALK' | 'CLEARANCE' | 'DONT_WALK'>;
  allocatedGreen?: number;
}

export interface SignalPlan {
  S: number;
  N: number;
  E: number;
  W: number;
  yellow: number;
  allRed: number;
  cycle: number;
}

export interface SafetyConfig {
  minGreen: number;
  maxGreen: number;
  yellow: number;
  allRed: number;
  maxCycle: number;
}

export interface ApproachTelemetry {
  count: number;
  queue: number;
  effectivePce: number; // PCE-weighted effective demand
  wait: number;
  speed: number;
  density: number;
  score: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  trend: 'rising' | 'easing' | 'steady';
  conf: number;
  eta: number;
  signalThrough: boolean;
  signalRight: boolean;
  isYellow: boolean;
  anomaly?: boolean;
  anomalyReason?: string;
}

export interface CorridorJunction {
  id: string;
  name: string;
  x: number;
  y: number;
  load: number;
  offset: number;
}

export interface OptimizationEvent {
  kind: 'plan' | 'ctl' | 'incident' | 'emergency';
  text: string;
  ts: number;
}

export interface HistoryPoint {
  ts: number;
  veh: number;
  queue: number;
  wait: number;
  spd: number;
}

export interface ExplainItem {
  feature: string;
  value: string;
  impact: number;
  positive: boolean;
  reason?: string;
}

export interface EmergencyState {
  active: boolean;
  dir: Direction | null;
  remaining: number;
}

export interface JunctionIncident {
  active: boolean;
  type: 'collision' | 'roadworks' | 'stall';
  dir: Direction;
  lane: number;
  title: string;
  description: string;
}

export interface Snapshot {
  seq?: number;
  ts: number;
  junction: { id: string; name: string };
  control: {
    adaptive: boolean;
    running: boolean;
    rate: number;
    cfg: SafetyConfig;
    demand: Record<Direction, number>;
    scenario?: string;
  };
  phase: PhaseInfo & {
    remaining: number;
    phaseName: string;
    plan: SignalPlan;
  };
  approaches: Record<Direction, ApproachTelemetry>;
  vehicles: Vehicle[];
  totals: {
    inJunction: number;
    cleared: number;
    avgWait: number;
    baselineWait: number;
    savings: number;
    cycles: number;
  };
  network: CorridorJunction[];
  events: OptimizationEvent[];
  emergency?: EmergencyState;
  explain?: ExplainItem[];
  incident?: JunctionIncident | null;
  ai?: {
    model?: string;
    enabled?: boolean;
    dqn_enabled?: boolean;
    selected_arm?: string;
    recommended_green?: number;
    prediction_time_ms?: number;
    decision?: string;
    next_arm?: string;
    ranking?: string[];
    cameras?: Record<string, any>;
    demand_scores?: Record<string, number>;
  };
}

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  dept: string;
  empId: string;
  phone: string;
}
