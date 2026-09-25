"""
XGBoost Adaptive Signal Timing Model for SignalSync Traffic Simulator.

Replaces the legacy Deep Q-Network (DQN) implementation with a trained XGBoost
regression model (traffic_signal_xgboost.json) that predicts optimal green duration
for active intersection approaches based on real-time simulation traffic states.
"""

from pathlib import Path
import numpy as np
import xgboost as xgb

# ── Feature Definitions & Deterministic Order ────────────────────────────────
FEATURES = [
    "south_queue", "north_queue", "east_queue", "west_queue",
    "south_wait", "north_wait", "east_wait", "west_wait",
    "south_count", "north_count", "east_count", "west_count",
    "south_pce", "north_pce", "east_pce", "west_pce",
    "active_arm", "phase_elapsed", "emergency_present",
    "incident_present", "pedestrian_demand",
]

ARM_INDEX = {
    "SOUTH": 0,
    "NORTH": 1,
    "EAST": 2,
    "WEST": 3,
}

# Resolve candidate model paths relative to this file
_THIS_DIR = Path(__file__).resolve().parent
_CANDIDATE_PATHS = [
    _THIS_DIR / "models" / "traffic_signal_xgboost.json",
    _THIS_DIR / "traffic_signal_xgboost.json",
    _THIS_DIR.parent / "models" / "traffic_signal_xgboost.json",
]


def resolve_model_path() -> Path:
    """Finds the trained XGBoost model JSON file or raises FileNotFoundError."""
    for path in _CANDIDATE_PATHS:
        if path.is_file():
            return path
    raise FileNotFoundError(
        f"traffic_signal_xgboost.json not found in candidate locations: "
        f"{[str(p) for p in _CANDIDATE_PATHS]}"
    )


class XGBSignalTimingModel:
    """
    XGBoost adaptive green-time regression model.
    Loads traffic_signal_xgboost.json ONCE during initialization.
    """

    def __init__(self, model_path: Path | str | None = None):
        if model_path is None:
            self.model_path = resolve_model_path()
        else:
            self.model_path = Path(model_path)
            if not self.model_path.is_file():
                raise FileNotFoundError(f"Model file not found at: {self.model_path}")

        self.model = xgb.XGBRegressor()
        self.model.load_model(str(self.model_path))
        print(f"[AI] XGBoost model loaded: {self.model_path.name}")

    def predict_green_time(self, state: dict, min_green: float = 8.0, max_green: float = 45.0) -> float:
        """
        Predicts recommended green duration in seconds from the exact 21 features.
        The prediction is strictly bounded between min_green and max_green.
        """
        row = []
        for name in FEATURES:
            if name not in state:
                print(f"[AI ERROR] Missing required XGBoost feature: '{name}'. Using 0.0.")
            row.append(float(state.get(name, 0.0)))

        feature_matrix = np.asarray([row], dtype=np.float32)
        raw_pred = float(self.model.predict(feature_matrix)[0])
        bounded_green = float(np.clip(raw_pred, min_green, max_green))
        return bounded_green

    def get_feature_importance(self) -> dict:
        """Returns feature importance mapping from the trained booster."""
        try:
            booster = self.model.get_booster()
            scores = booster.get_score(importance_type="gain")
            # Map booster f0..f20 or feature names to readable scores
            importance = {}
            for i, name in enumerate(FEATURES):
                key = f"f{i}"
                score = scores.get(key, scores.get(name, 0.0))
                importance[name] = float(score)
            return importance
        except Exception:
            return {}

    def build_state(
        self,
        queues: dict,
        waits: dict,
        counts: dict,
        pce_queues: dict,
        active_arm: str,
        phase_elapsed: float = 0.0,
        emergency_present: bool = False,
        incident_present: bool = False,
        pedestrian_demand: int = 0,
    ) -> dict:
        """Builds a deterministic 21-feature state dictionary."""
        return {
            "south_queue": float(queues.get("SOUTH", 0)),
            "north_queue": float(queues.get("NORTH", 0)),
            "east_queue": float(queues.get("EAST", 0)),
            "west_queue": float(queues.get("WEST", 0)),
            "south_wait": float(waits.get("SOUTH", 0.0)),
            "north_wait": float(waits.get("NORTH", 0.0)),
            "east_wait": float(waits.get("EAST", 0.0)),
            "west_wait": float(waits.get("WEST", 0.0)),
            "south_count": float(counts.get("SOUTH", 0)),
            "north_count": float(counts.get("NORTH", 0)),
            "east_count": float(counts.get("EAST", 0)),
            "west_count": float(counts.get("WEST", 0)),
            "south_pce": float(pce_queues.get("SOUTH", 0.0)),
            "north_pce": float(pce_queues.get("NORTH", 0.0)),
            "east_pce": float(pce_queues.get("EAST", 0.0)),
            "west_pce": float(pce_queues.get("WEST", 0.0)),
            "active_arm": float(ARM_INDEX.get(active_arm, 0)),
            "phase_elapsed": float(phase_elapsed),
            "emergency_present": float(1.0 if emergency_present else 0.0),
            "incident_present": float(1.0 if incident_present else 0.0),
            "pedestrian_demand": float(pedestrian_demand),
        }


def build_xgb_state(intersection, signal_controller, active_arm: str | None = None) -> dict:
    """
    Extracts real simulation telemetry from Intersection and SignalController
    into the exact 21 features required by the trained XGBoost model.
    """
    if active_arm is None:
        active_arm = signal_controller.get_active_arm() or "SOUTH"
    phase_elapsed = getattr(signal_controller, "timer", 0.0)

    # Check emergency state
    emergency_present = bool(
        signal_controller.emergency_override
        or any(
            any(v.is_emergency for v in v_list)
            for v_list in intersection.vehicles.values()
        )
    )

    # Check incident state
    incident_present = bool(
        intersection.incident and intersection.incident.get("active", False)
    )

    # Real pedestrian count currently crossing or waiting
    pedestrian_demand = intersection.get_active_pedestrian_count()

    queues = {arm: intersection.get_arm_queue(arm) for arm in ARM_INDEX}
    waits = {arm: intersection.get_arm_max_wait_time(arm) for arm in ARM_INDEX}
    counts = {arm: intersection.get_arm_vehicle_count(arm) for arm in ARM_INDEX}
    pce_queues = {arm: intersection.get_arm_pce_queue(arm) for arm in ARM_INDEX}

    return {
        "south_queue": float(queues["SOUTH"]),
        "north_queue": float(queues["NORTH"]),
        "east_queue": float(queues["EAST"]),
        "west_queue": float(queues["WEST"]),
        "south_wait": float(waits["SOUTH"]),
        "north_wait": float(waits["NORTH"]),
        "east_wait": float(waits["EAST"]),
        "west_wait": float(waits["WEST"]),
        "south_count": float(counts["SOUTH"]),
        "north_count": float(counts["NORTH"]),
        "east_count": float(counts["EAST"]),
        "west_count": float(counts["WEST"]),
        "south_pce": float(pce_queues["SOUTH"]),
        "north_pce": float(pce_queues["NORTH"]),
        "east_pce": float(pce_queues["EAST"]),
        "west_pce": float(pce_queues["WEST"]),
        "active_arm": float(ARM_INDEX.get(active_arm, 0)),
        "phase_elapsed": float(phase_elapsed),
        "emergency_present": float(1.0 if emergency_present else 0.0),
        "incident_present": float(1.0 if incident_present else 0.0),
        "pedestrian_demand": float(pedestrian_demand),
    }
