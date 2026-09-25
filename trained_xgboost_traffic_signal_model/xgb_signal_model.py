import os
import numpy as np
import xgboost as xgb

MODEL_PATH = os.path.join(os.path.dirname(__file__), "traffic_signal_xgboost.json")

FEATURES = [
    "south_queue", "north_queue", "east_queue", "west_queue",
    "south_wait", "north_wait", "east_wait", "west_wait",
    "south_count", "north_count", "east_count", "west_count",
    "south_pce", "north_pce", "east_pce", "west_pce",
    "active_arm", "phase_elapsed", "emergency_present",
    "incident_present", "pedestrian_demand",
]

ARM_INDEX = {"SOUTH": 0, "NORTH": 1, "EAST": 2, "WEST": 3}


class XGBSignalTimingModel:
    """XGBoost adaptive green-time model."""

    def __init__(self, model_path=MODEL_PATH):
        self.model = xgb.XGBRegressor()
        self.model.load_model(model_path)

    def predict_green_time(self, state):
        row = [[float(state.get(name, 0.0)) for name in FEATURES]]
        value = float(self.model.predict(np.asarray(row, dtype=np.float32))[0])
        return float(np.clip(value, 8.0, 45.0))

    def build_state(
        self,
        queues,
        waits,
        counts,
        pce_queues,
        active_arm,
        phase_elapsed,
        emergency_present=False,
        incident_present=False,
        pedestrian_demand=0,
    ):
        return {
            "south_queue": queues.get("SOUTH", 0),
            "north_queue": queues.get("NORTH", 0),
            "east_queue": queues.get("EAST", 0),
            "west_queue": queues.get("WEST", 0),
            "south_wait": waits.get("SOUTH", 0),
            "north_wait": waits.get("NORTH", 0),
            "east_wait": waits.get("EAST", 0),
            "west_wait": waits.get("WEST", 0),
            "south_count": counts.get("SOUTH", 0),
            "north_count": counts.get("NORTH", 0),
            "east_count": counts.get("EAST", 0),
            "west_count": counts.get("WEST", 0),
            "south_pce": pce_queues.get("SOUTH", 0),
            "north_pce": pce_queues.get("NORTH", 0),
            "east_pce": pce_queues.get("EAST", 0),
            "west_pce": pce_queues.get("WEST", 0),
            "active_arm": ARM_INDEX.get(active_arm, 0),
            "phase_elapsed": phase_elapsed,
            "emergency_present": int(bool(emergency_present)),
            "incident_present": int(bool(incident_present)),
            "pedestrian_demand": pedestrian_demand,
        }
