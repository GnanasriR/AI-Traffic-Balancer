"""
Configuration parameters for the SignalSync Python Traffic Simulator.

This module is the SINGLE SOURCE OF TRUTH for simulation geometry, physics and
signal-timing constants. Both the standalone simulator and anything the
optimizer-service (Java) needs to display should read state from this Python
engine's WebSocket/REST API (see server.py) rather than re-implementing any of
this logic independently. See README.md for details on why the old duplicate
Java `TrafficSimulationEngine` physics loop should be retired in favour of
this engine.
"""

# Screen & Rendering Settings
WINDOW_WIDTH = 1100
WINDOW_HEIGHT = 800
SIM_CANVAS_SIZE = 800
HUD_WIDTH = 300
FPS = 60

# Road & Intersection Geometry (800x800 canvas space)
CENTER_X = 400
CENTER_Y = 400
ROAD_WIDTH = 180  # 4-lane road width (90px each side of center)
LANE_WIDTH = 45   # 2 lanes per approach

# Stop Line Positions
STOP_NORTH = CENTER_Y - ROAD_WIDTH // 2  # 310
STOP_SOUTH = CENTER_Y + ROAD_WIDTH // 2  # 490
STOP_EAST  = CENTER_X + ROAD_WIDTH // 2  # 490
STOP_WEST  = CENTER_X - ROAD_WIDTH // 2  # 310

# Vehicle Physics Constants (IDM Model) — defaults, overridden per vehicle type below
MAX_SPEED_KMH = 50.0
MAX_SPEED_PX = MAX_SPEED_KMH * 0.08  # ~4 px/frame at 60 FPS
MAX_ACCEL = 0.15
COMFORT_BRAKE = 0.25
EMERGENCY_BRAKE = 0.60
MIN_GAP = 14.0
MIN_VEHICLE_GAP = 12.0  # Central constant: minimum physical front-to-rear gap in pixels

# Dynamic Traffic Demand Engine Constants
DEFAULT_MIN_DEMAND_VPM = 8.0
DEFAULT_MAX_DEMAND_VPM = 85.0
SURGE_PULSE_CHANCE_PER_MIN = 1.2  # Expected surge pulses per minute

# Dynamic Regimes: (min_vpm, max_vpm)
DEMAND_REGIMES = {
    "LOW": (6.0, 20.0),
    "MEDIUM": (20.0, 42.0),
    "HIGH": (42.0, 65.0),
    "SURGE": (65.0, 85.0),
}

# Transition probability matrix between regimes
REGIME_TRANSITIONS = {
    "LOW":    {"LOW": 0.50, "MEDIUM": 0.40, "HIGH": 0.10, "SURGE": 0.00},
    "MEDIUM": {"LOW": 0.25, "MEDIUM": 0.45, "HIGH": 0.25, "SURGE": 0.05},
    "HIGH":   {"LOW": 0.05, "MEDIUM": 0.35, "HIGH": 0.45, "SURGE": 0.15},
    "SURGE":  {"LOW": 0.00, "MEDIUM": 0.20, "HIGH": 0.50, "SURGE": 0.30},
}

# Default Asymmetric Arterial Traffic Profile:
# In realistic intersections, demand is asymmetric (corridor highway vs side streets).
# This provides the necessary imbalance to demonstrate adaptive signal optimization.
DEFAULT_APPROACH_CONFIG = {
    "EAST":  {"regime": "SURGE", "rate": 60.0, "min_vpm": 30.0, "max_vpm": 85.0},  # Heavy Arterial Commuter Inflow
    "NORTH": {"regime": "HIGH",  "rate": 45.0, "min_vpm": 20.0, "max_vpm": 70.0},  # Secondary Arterial
    "SOUTH": {"regime": "MEDIUM","rate": 22.0, "min_vpm": 12.0, "max_vpm": 45.0},  # Moderate Collector
    "WEST":  {"regime": "LOW",   "rate": 10.0, "min_vpm": 5.0,  "max_vpm": 22.0},  # Light Side-Street
}

# Switchable Traffic Demand Scenarios
TRAFFIC_SCENARIOS = {
    "ASYMMETRIC_CORRIDOR": {
        "id": "ASYMMETRIC_CORRIDOR",
        "name": "Asymmetric Rush (East Heavy Inbound)",
        "description": "East 60 VPM (Heavy), North 45 VPM (Medium-Heavy), South 22 VPM, West 10 VPM (Light)",
        "rates": {"EAST": 60.0, "NORTH": 45.0, "SOUTH": 22.0, "WEST": 10.0},
        "regimes": {"EAST": "SURGE", "NORTH": "HIGH", "SOUTH": "MEDIUM", "WEST": "LOW"}
    },
    "NORTH_SOUTH_ARTERIAL": {
        "id": "NORTH_SOUTH_ARTERIAL",
        "name": "N-S Highway Corridor",
        "description": "North 58 VPM (Heavy), South 54 VPM (Heavy), East 12 VPM (Light), West 10 VPM (Light)",
        "rates": {"NORTH": 58.0, "SOUTH": 54.0, "EAST": 12.0, "WEST": 10.0},
        "regimes": {"NORTH": "HIGH", "SOUTH": "HIGH", "EAST": "LOW", "WEST": "LOW"}
    },
    "EAST_WEST_SURGE": {
        "id": "EAST_WEST_SURGE",
        "name": "East-West Tidal Commute",
        "description": "East 65 VPM (Surge), West 50 VPM (Heavy), North 12 VPM (Light), South 12 VPM (Light)",
        "rates": {"EAST": 65.0, "WEST": 50.0, "NORTH": 12.0, "SOUTH": 12.0},
        "regimes": {"EAST": "SURGE", "WEST": "HIGH", "NORTH": "LOW", "SOUTH": "LOW"}
    },
    "BALANCED": {
        "id": "BALANCED",
        "name": "Balanced Off-Peak",
        "description": "Symmetric 25 VPM across all four directions",
        "rates": {"NORTH": 25.0, "SOUTH": 25.0, "EAST": 25.0, "WEST": 25.0},
        "regimes": {"NORTH": "MEDIUM", "SOUTH": "MEDIUM", "EAST": "MEDIUM", "WEST": "MEDIUM"}
    }
}

# Signal Timing Constants (Seconds)
DEFAULT_MIN_GREEN = 8.0
DEFAULT_MAX_GREEN = 45.0
DEFAULT_YELLOW = 3.0
DEFAULT_ALL_RED = 1.5
DEFAULT_FIXED_GREEN = 60.0


# Pedestrian Scramble ("Barnes Dance") Phase — 5th stage, all vehicle signals RED
PED_SCRAMBLE_WALK_SECONDS = 18.0
PED_SCRAMBLE_CLEARANCE_SECONDS = 3.0
PEDESTRIAN_SPEED_PX = 1.6           # ~1.3 m/s walking pace, scaled to px/frame @60fps
PEDESTRIAN_SPAWN_CHANCE_PER_SEC = 0.9  # probability of a new pedestrian arriving per crosswalk per second during WALK
CROSSWALK_SETBACK = 14.0            # distance the crosswalk sits outside the stop line

# Indian 5-Stage Phasing Definition: S -> N -> E -> W -> PED_SCRAMBLE
STAGES = ["SOUTH_GREEN", "NORTH_GREEN", "EAST_GREEN", "WEST_GREEN", "PED_SCRAMBLE"]
ARM_ORDER = ["SOUTH", "NORTH", "EAST", "WEST"]

# Direction mapping between Python and React Frontend
DIR_PY_TO_REACT = {"SOUTH": "S", "NORTH": "N", "EAST": "E", "WEST": "W"}
DIR_REACT_TO_PY = {"S": "SOUTH", "N": "NORTH", "E": "EAST", "W": "WEST"}
DIR_NAMES = {"SOUTH": "South", "NORTH": "North", "EAST": "East", "WEST": "West"}

# Colors (R, G, B)
COLOR_ASPHALT = (45, 52, 54)
COLOR_GRASS = (39, 174, 96)
COLOR_CURB = (220, 221, 225)
COLOR_LANE_LINE = (241, 196, 15)
COLOR_STOP_LINE = (255, 255, 255)
COLOR_ZEBRA = (236, 240, 241)

COLOR_RED_SIGNAL = (231, 76, 60)
COLOR_YELLOW_SIGNAL = (241, 196, 15)
COLOR_GREEN_SIGNAL = (46, 204, 113)
COLOR_OFF_SIGNAL = (70, 75, 80)
COLOR_WALK_SIGNAL = (46, 204, 113)
COLOR_DONT_WALK_SIGNAL = (231, 76, 60)

COLOR_BG_DARK = (24, 28, 36)
COLOR_CARD_BG = (34, 40, 52)
COLOR_TEXT_WHITE = (255, 255, 255)
COLOR_TEXT_MUTED = (160, 174, 192)
COLOR_ACCENT_BLUE = (52, 152, 219)
COLOR_ACCENT_ORANGE = (230, 126, 34)
COLOR_PEDESTRIAN = (255, 224, 130)

# ---------------------------------------------------------------------------
# Vehicle Types
# ---------------------------------------------------------------------------
# Each type carries its own realistic physics profile (not just a single global
# speed_ratio): mass affects how hard it can brake/accelerate, turn_speed_factor
# controls how much it must slow down to take a turn without looking like it's
# sliding, and pce (Passenger Car Equivalent) is used by the Webster/AI signal
# timing engine exactly like the Java optimizer-service used to compute
# independently — merged here so there is one definition of vehicle taxonomy.
VEHICLE_TYPES = {
    'CAR': {
        'width': 22,
        'length': 40,
        'color': (52, 152, 219),
        'speed_ratio': 1.0,
        'max_accel': 0.15,
        'comfort_brake': 0.28,
        'emergency_brake': 0.65,
        'turn_speed_factor': 0.45,
        'pce': 1.0,
        'is_emergency': False,
        's0': 12.0,          # Stopped gap in pixels (>= MIN_VEHICLE_GAP 12px)
        'headway_t': 1.0,   # Safe time headway multiplier
    },
    'BUS': {
        'width': 30,
        'length': 70,
        'color': (243, 156, 18),
        'speed_ratio': 0.68,
        'max_accel': 0.075,      # heavier vehicle accelerates more slowly
        'comfort_brake': 0.16,   # and needs a longer, gentler braking distance
        'emergency_brake': 0.40,
        'turn_speed_factor': 0.30,  # wider, more cautious turning radius/speed
        'pce': 3.0,
        'is_emergency': False,
        's0': 14.0,          # Bus stopped gap (>= MIN_VEHICLE_GAP 12px)
        'headway_t': 1.2,
    },
    'MOTORCYCLE': {
        'width': 13,
        'length': 22,
        'color': (155, 89, 182),
        'speed_ratio': 1.2,
        'max_accel': 0.22,       # nimble, quick off the line
        'comfort_brake': 0.34,
        'emergency_brake': 0.75,
        'turn_speed_factor': 0.65,  # can carve a tighter, faster turn
        'pce': 0.5,
        'is_emergency': False,
        'can_filter': False,     # Remains strictly inside assigned lane without lateral weaving
        's0': 12.0,          # Motorcycle stopped gap (>= MIN_VEHICLE_GAP 12px)
        'headway_t': 0.8,
    },
    'AMBULANCE': {
        'width': 24,
        'length': 46,
        'color': (231, 76, 60),
        'speed_ratio': 1.35,
        'max_accel': 0.20,
        'comfort_brake': 0.32,
        'emergency_brake': 0.70,
        'turn_speed_factor': 0.50,
        'pce': 1.0,
        'is_emergency': True,
        's0': 12.0,          # Ambulance stopped gap (>= MIN_VEHICLE_GAP 12px)
        'headway_t': 0.9,
    },
}

# Spawn mix used by the default arrival model (probabilities must sum to 1.0)
DEFAULT_VEHICLE_MIX = [
    ('CAR', 0.88),
    ('BUS', 0.12),
]

# Turning-intent mix (Straight / Left / Right)
DEFAULT_TURN_MIX = [
    ('STRAIGHT', 0.60),
    ('LEFT', 0.20),
    ('RIGHT', 0.20),
]
