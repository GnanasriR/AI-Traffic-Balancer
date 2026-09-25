"""
Rolling Traffic History — bounded per-arm time-series sampler for the SignalSync
Python AI Traffic Simulator.

Records simulation metrics at a configurable sample_interval so the
TrafficDemandPredictor (ai_traffic_engine.py) can use genuine historical data
instead of a single-snapshot guess. server.py calls record_sample() on every
simulation tick; the resulting per-arm deques are handed to the predictor at the
controlled prediction interval (default every 10 sim-seconds).

This file deliberately has NO imports from other traffic_simulator modules so it
can be imported freely from server.py, signal_controller.py, or tests without
risking circular-import issues.
"""

from __future__ import annotations
from collections import deque
from typing import Dict, List

# ── Configurable defaults ─────────────────────────────────────────────────────
DEFAULT_SAMPLE_INTERVAL_SEC: float = 5.0   # Sample every 5 simulation-seconds
DEFAULT_MAX_HISTORY_SAMPLES: int   = 60    # 60 × 5 s  = 5 min of history per arm

ARM_ORDER: List[str] = ["SOUTH", "NORTH", "EAST", "WEST"]


class RollingTrafficHistory:
    """
    Bounded rolling time-series history for all four intersection approaches.

    Usage (in server.py simulation loop)
    -------------------------------------
    history = RollingTrafficHistory()

    # inside the async simulation_loop():
    history.record_sample(intersection, signal_controller, eff_dt)

    # every prediction_interval sim-seconds:
    history_by_arm = {arm: history.get_history(arm) for arm in ARM_ORDER}
    predictions = predictor.predict_from_history(
        history_by_arm, current_queues, current_pce, current_wait, incidents, sim_time
    )
    signal_controller.prediction_cache = predictions
    """

    def __init__(
        self,
        sample_interval: float = DEFAULT_SAMPLE_INTERVAL_SEC,
        max_samples:     int   = DEFAULT_MAX_HISTORY_SAMPLES,
    ):
        self.sample_interval = sample_interval
        self.max_samples     = max_samples

        self._sample_timer: float = 0.0
        self._sim_time:     float = 0.0
        self._sample_count: int   = 0

        self._history: Dict[str, deque] = {
            arm: deque(maxlen=max_samples) for arm in ARM_ORDER
        }

    # ── Core sampling ─────────────────────────────────────────────────────────

    def record_sample(self, intersection, signal_controller, dt: float) -> bool:
        """
        Advance internal timers by dt (simulation seconds).
        Records one sample per arm when the sample_interval has elapsed.

        Parameters
        ----------
        intersection      : Intersection   — source of queue / PCE / wait / rate data
        signal_controller : SignalController — source of signal state
        dt                : float          — simulation tick duration in seconds

        Returns True when a sample was written this tick, False otherwise.
        """
        self._sim_time    += dt
        self._sample_timer += dt

        if self._sample_timer < self.sample_interval:
            return False

        self._sample_timer = 0.0
        self._sample_count += 1

        for arm in ARM_ORDER:
            sample = {
                "sim_time":         round(self._sim_time, 1),
                "sample_index":     self._sample_count,
                # ── queue / flow metrics ─────────────────────────────────────
                "queue":            intersection.get_arm_queue(arm),
                "pce_queue":        round(intersection.get_arm_pce_queue(arm), 2),
                "wait":             round(intersection.get_arm_max_wait_time(arm), 1),
                "vehicle_count":    intersection.get_arm_vehicle_count(arm),
                "arrival_rate_vpm": intersection.spawn_rates.get(arm, 0),
                # ── signal / incident state ──────────────────────────────────
                "is_green": signal_controller.is_arm_green(arm),
                "has_incident": bool(
                    intersection.incident
                    and intersection.incident.get("active")
                    and intersection.incident.get("dir") == arm
                ),
            }
            self._history[arm].append(sample)

        return True

    # ── Accessors ─────────────────────────────────────────────────────────────

    def get_history(self, arm: str) -> List[dict]:
        """Returns a list (oldest-first) of recorded samples for the given arm."""
        return list(self._history.get(arm, []))

    def get_history_size(self) -> int:
        """Number of samples currently held for SOUTH (representative of all arms)."""
        return len(self._history.get("SOUTH", []))

    def get_sim_time(self) -> float:
        """Total simulation time elapsed in seconds."""
        return round(self._sim_time, 1)

    def get_sample_count(self) -> int:
        """Total number of samples recorded since construction."""
        return self._sample_count
