// ─────────────────────────────────────────────────────────────────
// trafficData.ts — Static mock data mirroring Python backend output
// All types and values here match what the WS / REST API will send.
// Replace with real WS subscription in a later sprint.
// ─────────────────────────────────────────────────────────────────

export type SignalPhase = 'GREEN' | 'YELLOW' | 'RED';
export type TrafficLevel = 'LIGHT' | 'MODERATE' | 'HEAVY' | 'CRITICAL';
export type Direction = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

// ── Types that mirror Python backend JSON ─────────────────────────

export interface DirectionData {
  direction: Direction;
  queueLength: number;       // vehicles queued
  vehicleCount: number;      // vehicles detected in zone
  density: number;           // 0–100 %
  avgSpeed: number;          // km/h
  waitTime: number;          // seconds
  phase: SignalPhase;
  phaseRemaining: number;    // seconds remaining in phase
  greenAllocated: number;    // AI-allocated green time (s)
}

export interface JunctionStatus {
  id: string;                // 'J1' | 'J2' | 'J3' | 'J4'
  name: string;
  location: string;
  totalVehicles: number;
  currentCycleTime: number;  // s
  aiMode: boolean;
  directions: DirectionData[];
  trafficLevel: TrafficLevel;
  lastUpdated: string;       // ISO timestamp
}

export interface IncidentAlert {
  id: string;
  type: 'ACCIDENT' | 'ROADWORK' | 'BREAKDOWN' | 'CONGESTION';
  severity: 'LOW' | 'MODERATE' | 'HIGH';
  road: string;
  area: string;
  description: string;
  time: string;
  active: boolean;
}

export interface RoadCondition {
  road: string;
  area: string;
  junctionId: string;
  trafficLevel: TrafficLevel;
  avgSpeed: number;
  vehicleCount: number;
  density: number;
}

export interface SystemMetrics {
  avgWaitReduction: number;       // %
  totalVehiclesManaged: number;
  avgCongestionCoverage: number;  // %
  avgSpeed: number;               // km/h
  co2Abated: number;              // kg
  fuelSaved: number;              // litres
}

export interface HistoryPoint {
  time: string;
  aiWait: number;
  fixedWait: number;
  queueNorth: number;
  queueSouth: number;
  queueEast: number;
  queueWest: number;
  throughput: number;
}

export interface PredictiveAlert {
  type: 'WARNING' | 'OPTIMIZATION' | 'GREEN_WAVE' | 'INFO';
  title: string;
  message: string;
}

// ── Static Mock Data ──────────────────────────────────────────────

export const MOCK_JUNCTIONS: JunctionStatus[] = [
  {
    id: 'J1',
    name: 'Central Junction',
    location: 'Central Avenue × Main Street',
    totalVehicles: 54,
    currentCycleTime: 98,
    aiMode: true,
    trafficLevel: 'MODERATE',
    lastUpdated: new Date().toISOString(),
    directions: [
      { direction: 'NORTH', queueLength: 12, vehicleCount: 18, density: 58, avgSpeed: 28, waitTime: 42, phase: 'GREEN', phaseRemaining: 22, greenAllocated: 48 },
      { direction: 'SOUTH', queueLength: 9,  vehicleCount: 14, density: 44, avgSpeed: 32, waitTime: 31, phase: 'GREEN', phaseRemaining: 22, greenAllocated: 48 },
      { direction: 'EAST',  queueLength: 5,  vehicleCount: 8,  density: 26, avgSpeed: 45, waitTime: 18, phase: 'RED',   phaseRemaining: 43, greenAllocated: 17 },
      { direction: 'WEST',  queueLength: 7,  vehicleCount: 11, density: 35, avgSpeed: 38, waitTime: 24, phase: 'RED',   phaseRemaining: 43, greenAllocated: 17 },
    ],
  },
  {
    id: 'J2',
    name: 'Business Loop',
    location: 'Business Loop × East Ring Rd',
    totalVehicles: 87,
    currentCycleTime: 102,
    aiMode: true,
    trafficLevel: 'HEAVY',
    lastUpdated: new Date().toISOString(),
    directions: [
      { direction: 'NORTH', queueLength: 22, vehicleCount: 31, density: 82, avgSpeed: 18, waitTime: 74, phase: 'RED',    phaseRemaining: 15, greenAllocated: 52 },
      { direction: 'SOUTH', queueLength: 19, vehicleCount: 27, density: 74, avgSpeed: 21, waitTime: 65, phase: 'RED',    phaseRemaining: 15, greenAllocated: 52 },
      { direction: 'EAST',  queueLength: 6,  vehicleCount: 9,  density: 28, avgSpeed: 42, waitTime: 21, phase: 'GREEN',  phaseRemaining: 8,  greenAllocated: 22 },
      { direction: 'WEST',  queueLength: 8,  vehicleCount: 12, density: 36, avgSpeed: 35, waitTime: 28, phase: 'YELLOW', phaseRemaining: 3,  greenAllocated: 22 },
    ],
  },
  {
    id: 'J3',
    name: 'North Connector',
    location: 'North Connector × Riverside Rd',
    totalVehicles: 38,
    currentCycleTime: 90,
    aiMode: true,
    trafficLevel: 'LIGHT',
    lastUpdated: new Date().toISOString(),
    directions: [
      { direction: 'NORTH', queueLength: 4,  vehicleCount: 7,  density: 22, avgSpeed: 52, waitTime: 14, phase: 'RED',   phaseRemaining: 28, greenAllocated: 28 },
      { direction: 'SOUTH', queueLength: 5,  vehicleCount: 8,  density: 24, avgSpeed: 49, waitTime: 16, phase: 'RED',   phaseRemaining: 28, greenAllocated: 28 },
      { direction: 'EAST',  queueLength: 10, vehicleCount: 14, density: 42, avgSpeed: 36, waitTime: 33, phase: 'GREEN', phaseRemaining: 19, greenAllocated: 38 },
      { direction: 'WEST',  queueLength: 8,  vehicleCount: 11, density: 34, avgSpeed: 38, waitTime: 26, phase: 'GREEN', phaseRemaining: 19, greenAllocated: 38 },
    ],
  },
  {
    id: 'J4',
    name: 'South Expressway',
    location: 'South Expressway × Ring Road',
    totalVehicles: 29,
    currentCycleTime: 85,
    aiMode: false,
    trafficLevel: 'LIGHT',
    lastUpdated: new Date().toISOString(),
    directions: [
      { direction: 'NORTH', queueLength: 3,  vehicleCount: 5,  density: 15, avgSpeed: 58, waitTime: 11, phase: 'GREEN', phaseRemaining: 14, greenAllocated: 30 },
      { direction: 'SOUTH', queueLength: 4,  vehicleCount: 6,  density: 18, avgSpeed: 55, waitTime: 14, phase: 'GREEN', phaseRemaining: 14, greenAllocated: 30 },
      { direction: 'EAST',  queueLength: 6,  vehicleCount: 8,  density: 24, avgSpeed: 44, waitTime: 21, phase: 'RED',   phaseRemaining: 33, greenAllocated: 30 },
      { direction: 'WEST',  queueLength: 5,  vehicleCount: 7,  density: 21, avgSpeed: 46, waitTime: 18, phase: 'RED',   phaseRemaining: 33, greenAllocated: 30 },
    ],
  },
];

export const MOCK_ROAD_CONDITIONS: RoadCondition[] = [
  { road: 'Central Avenue',   area: 'Downtown',          junctionId: 'J1', trafficLevel: 'MODERATE', avgSpeed: 32, vehicleCount: 54,  density: 52 },
  { road: 'Business Loop',    area: 'Business District', junctionId: 'J2', trafficLevel: 'HEAVY',    avgSpeed: 24, vehicleCount: 87,  density: 78 },
  { road: 'Riverside Road',   area: 'Riverside Area',    junctionId: 'J3', trafficLevel: 'LIGHT',    avgSpeed: 45, vehicleCount: 38,  density: 23 },
  { road: 'East Ring Road',   area: 'East Corridor',     junctionId: 'J2', trafficLevel: 'MODERATE', avgSpeed: 36, vehicleCount: 61,  density: 48 },
  { road: 'North Connector',  area: 'North District',    junctionId: 'J3', trafficLevel: 'HEAVY',    avgSpeed: 22, vehicleCount: 93,  density: 82 },
  { road: 'South Expressway', area: 'South Gate',        junctionId: 'J4', trafficLevel: 'LIGHT',    avgSpeed: 58, vehicleCount: 29,  density: 18 },
];

export const MOCK_INCIDENTS: IncidentAlert[] = [
  {
    id: 'INC-2026-001',
    type: 'ACCIDENT',
    severity: 'MODERATE',
    road: 'Central Avenue',
    area: 'Downtown',
    description: 'Minor collision at Stop Line 3 near J1. Lane 2 partially blocked, tow truck dispatched.',
    time: '08:42',
    active: true,
  },
  {
    id: 'INC-2026-002',
    type: 'ROADWORK',
    severity: 'LOW',
    road: 'East Ring Road',
    area: 'East Corridor',
    description: 'Scheduled maintenance — Lane 2 closed until 14:00. Traffic diverted via Business Loop.',
    time: '07:00',
    active: true,
  },
  {
    id: 'INC-2026-003',
    type: 'CONGESTION',
    severity: 'HIGH',
    road: 'Business Loop',
    area: 'Business District',
    description: 'Severe congestion at J2 N/S direction — 22 vehicles queued. AI extending green phase.',
    time: '09:15',
    active: true,
  },
];

export const MOCK_SYSTEM_METRICS: SystemMetrics = {
  avgWaitReduction: 38,
  totalVehiclesManaged: 128450,
  avgCongestionCoverage: 28,
  avgSpeed: 34,
  co2Abated: 12.4,
  fuelSaved: 18.7,
};

export const MOCK_PREDICTIVE_ALERTS: PredictiveAlert[] = [
  {
    type: 'WARNING',
    title: 'High Traffic Risk — Business District',
    message: 'Model predicts 85% congestion probability on Business Loop within 45 min. Consider pre-emptive phase extension at J2.',
  },
  {
    type: 'OPTIMIZATION',
    title: 'AI Recommendation — J2 Phase Extend',
    message: 'Extending N/S green phase to 52 s for next 3 cycles at J2 will reduce queue by ~40% and prevent upstream spillover to J1.',
  },
  {
    type: 'GREEN_WAVE',
    title: 'Green Wave Active — J1 → J3 → J4',
    message: 'Corridor synchronized with 25 s offsets. Throughput improvement: +22% measured over last 15 min.',
  },
  {
    type: 'INFO',
    title: 'Morning Rush Peak — 09:00–10:30',
    message: 'Historical data indicates peak load window begins in 12 min. All junctions pre-configured for high-demand mode.',
  },
];

export const MOCK_HISTORY: HistoryPoint[] = [
  { time: '06:00', aiWait: 18, fixedWait: 30, queueNorth: 3,  queueSouth: 2,  queueEast: 4,  queueWest: 3,  throughput: 42 },
  { time: '07:00', aiWait: 22, fixedWait: 34, queueNorth: 7,  queueSouth: 6,  queueEast: 5,  queueWest: 6,  throughput: 68 },
  { time: '08:00', aiWait: 31, fixedWait: 52, queueNorth: 14, queueSouth: 12, queueEast: 8,  queueWest: 9,  throughput: 112 },
  { time: '09:00', aiWait: 38, fixedWait: 65, queueNorth: 19, queueSouth: 16, queueEast: 11, queueWest: 13, throughput: 138 },
  { time: '10:00', aiWait: 42, fixedWait: 72, queueNorth: 22, queueSouth: 19, queueEast: 14, queueWest: 15, throughput: 154 },
  { time: '11:00', aiWait: 35, fixedWait: 61, queueNorth: 16, queueSouth: 14, queueEast: 10, queueWest: 11, throughput: 128 },
  { time: '12:00', aiWait: 28, fixedWait: 49, queueNorth: 10, queueSouth: 9,  queueEast: 7,  queueWest: 8,  throughput: 98 },
  { time: '13:00', aiWait: 25, fixedWait: 44, queueNorth: 8,  queueSouth: 7,  queueEast: 6,  queueWest: 7,  throughput: 88 },
  { time: '14:00', aiWait: 29, fixedWait: 51, queueNorth: 11, queueSouth: 10, queueEast: 8,  queueWest: 9,  throughput: 104 },
  { time: '15:00', aiWait: 33, fixedWait: 57, queueNorth: 15, queueSouth: 13, queueEast: 9,  queueWest: 10, throughput: 118 },
];
