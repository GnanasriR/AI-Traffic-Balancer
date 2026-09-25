export type Direction = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

export type LightState = 'RED' | 'YELLOW' | 'GREEN';

export type CongestionLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type VehicleType = 'CAR' | 'BUS' | 'EMERGENCY' | 'MOTORCYCLE';

export interface Vehicle {
  id: string;
  type: VehicleType;
  direction: Direction;
  lane: number; // 0 or 1
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  maxSpeed: number;
  waitingTime: number;
  isQueued: boolean;
  color: string;
  hasPassedIntersection: boolean;
}

export interface DirectionMetrics {
  direction: Direction;
  vehicleCount: number;
  queueLength: number;
  density: number; // 0 - 100%
  avgSpeed: number; // km/h
  avgWaitTime: number; // seconds
  capacity: number; // max vehicles lane can hold
  congestion: CongestionLevel;
  signalState: LightState;
  countdown: number;
  greenAllocated: number;
  effectivePce?: number;
}

export interface SignalOptimizationResult {
  mode: 'FIXED_TRADITIONAL' | 'AI_ADAPTIVE';
  beforeAi: {
    northSouthGreen: number; // e.g. 30s
    eastWestGreen: number;   // e.g. 30s
    cycleTime: number;
  };
  afterAi: {
    northSouthGreen: number; // e.g. 48s
    eastWestGreen: number;   // e.g. 17s
    cycleTime: number;
  };
  activePhase: 'NORTH_SOUTH' | 'EAST_WEST';
  phaseRemainingSeconds: number;
  constraints: {
    minGreen: number; // 10s
    maxGreen: number; // 65s
    yellowTime: number; // 4s
    maxCycleTime: number; // 120s
    fairnessIndex: number; // 0.0 - 1.0
  };
  aiReasoning: string;
  confidenceScore: number;
  co2SavedKg: number;
  fuelSavedLiters: number;
  waitTimeReductionPercent: number;
}

export interface JunctionNode {
  id: string; // J1, J2, J3, J4
  name: string;
  status: 'OPTIMAL' | 'CONGESTED' | 'GREEN_WAVE_ACTIVE';
  activeGreenDirection: 'NORTH_SOUTH' | 'EAST_WEST';
  currentPhaseTimer: number;
  totalVehicles: number;
  congestionScore: number; // 0 - 100
  coordinates: { x: number; y: number };
  neighbors: { targetJunctionId: string; distanceMeters: number; travelTimeSeconds: number }[];
}

export interface TrafficHistoryPoint {
  timestamp: string;
  traditionalWaitTime: number;
  aiWaitTime: number;
  northQueue: number;
  southQueue: number;
  eastQueue: number;
  westQueue: number;
  throughput: number;
}

export type ScenarioPreset = 
  | 'BALANCED' 
  | 'MORNING_RUSH_NS' 
  | 'EVENING_RUSH_EW' 
  | 'EAST_LANE_ACCIDENT' 
  | 'EMERGENCY_AMBULANCE_NORTH';
