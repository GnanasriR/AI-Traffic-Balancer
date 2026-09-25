"""
Dynamic Traffic Demand Generator for SignalSync Python AI Simulator.

Provides realistic, continuously changing, stochastic traffic demand for each
intersection approach (North, South, East, West). Features:
  - Independent approach dynamics: each arm transitions through Low, Medium,
    High, and Surge traffic regimes on its own timeline.
  - Variable Poisson inter-arrival intervals: exponentially distributed
    arrival times instead of rigid metronome-like spacing.
  - Controlled stochastic variation: smooth rate transitions, occasional peak
    surges, and lull periods.
  - Random seed support: optional seed for 100% reproducible test runs.
  - 100% Independent of incidents/accidents: demand generation ignores
    road blockages so queues and delays accumulate naturally.
"""

import math
import random
from typing import Dict, Optional, Tuple

from traffic_simulator.config import (
    ARM_ORDER,
    DEFAULT_MIN_DEMAND_VPM,
    DEFAULT_MAX_DEMAND_VPM,
    DEMAND_REGIMES,
    REGIME_TRANSITIONS,
    SURGE_PULSE_CHANCE_PER_MIN,
    DEFAULT_APPROACH_CONFIG,
    TRAFFIC_SCENARIOS,
)


class ApproachDemandState:
    """Tracks dynamic demand state for a single approach arm."""

    def __init__(
        self,
        arm: str,
        rng: random.Random,
        min_vpm: float = DEFAULT_MIN_DEMAND_VPM,
        max_vpm: float = DEFAULT_MAX_DEMAND_VPM,
        initial_regime: Optional[str] = None,
        initial_rate: Optional[float] = None
    ):
        self.arm = arm
        self.rng = rng
        self.min_vpm = min_vpm
        self.max_vpm = max_vpm

        # Load asymmetric profile defaults if available
        cfg = DEFAULT_APPROACH_CONFIG.get(arm, {})
        self.current_regime = initial_regime or cfg.get("regime", "MEDIUM")
        self.target_rate = initial_rate or cfg.get("rate", 30.0)
        self.current_rate = self.target_rate
        if "min_vpm" in cfg:
            self.min_vpm = cfg["min_vpm"]
        if "max_vpm" in cfg:
            self.max_vpm = cfg["max_vpm"]

        self.regime_timer = 0.0
        self.regime_duration = self.rng.uniform(40.0, 95.0)

        # Surge pulse overlay state
        self.surge_pulse_timer = 0.0
        self.surge_boost = 0.0

        # Manual override (if set via set_manual_rate)
        self.manual_override: Optional[float] = None

        # Inter-arrival timer
        self.spawn_timer = 0.0
        self.next_arrival_interval = self._calculate_next_interval()

    def _pick_new_target(self, initial: bool = False):
        """Transitions regime and sets a new target arrival rate."""
        if not initial:
            probs = REGIME_TRANSITIONS.get(self.current_regime, REGIME_TRANSITIONS["MEDIUM"])
            regimes = list(probs.keys())
            weights = list(probs.values())
            self.current_regime = self.rng.choices(regimes, weights=weights)[0]

        low_bound, high_bound = DEMAND_REGIMES[self.current_regime]
        low_bound = max(self.min_vpm, low_bound)
        high_bound = min(self.max_vpm, high_bound)

        self.target_rate = self.rng.uniform(low_bound, high_bound)
        self.regime_timer = 0.0
        self.regime_duration = self.rng.uniform(30.0, 90.0)

    def _calculate_next_interval(self) -> float:
        """Calculates exponentially distributed inter-arrival time (Poisson process).

        Formula: dt = -ln(U) * (60.0 / rate), where U ~ Uniform(0, 1]. Clamped to
        a minimum of 0.6 seconds to avoid unphysical zero-gap spawning.
        """
        eff_rate = max(4.0, min(self.max_vpm + 25.0, self.get_rate()))
        mean_interval = 60.0 / eff_rate
        u = max(1e-6, self.rng.random())
        exp_interval = -math.log(u) * mean_interval
        # Clamped interval: min 0.6s to allow physics separation
        return max(0.6, min(18.0, exp_interval))

    def get_rate(self) -> float:
        """Returns effective current rate in vehicles per minute."""
        if self.manual_override is not None:
            return float(self.manual_override)
        return max(self.min_vpm, min(self.max_vpm + 25.0, self.current_rate + self.surge_boost))

    def update(self, dt: float):
        """Updates internal demand timers, smooth rate interpolation, and surge pulses."""
        if self.manual_override is not None:
            return

        # 1. Step regime timer and transition if expired
        self.regime_timer += dt
        if self.regime_timer >= self.regime_duration:
            self._pick_new_target()

        # 2. Smooth exponential drift towards target_rate
        # Adds small stochastic jitter (random walk noise) for organic fluctuation
        noise = self.rng.gauss(0.0, 0.15)
        drift_speed = 0.08  # smooth rate transition per second
        rate_diff = self.target_rate - self.current_rate
        self.current_rate += rate_diff * min(1.0, drift_speed * dt) + noise * dt
        self.current_rate = max(self.min_vpm, min(self.max_vpm, self.current_rate))

        # 3. Handle occasional short surge pulses (e.g., sudden burst of traffic)
        if self.surge_pulse_timer > 0.0:
            self.surge_pulse_timer -= dt
            if self.surge_pulse_timer <= 0.0:
                self.surge_boost = 0.0
        else:
            # Check chance per second for a surge pulse
            surge_chance_per_sec = SURGE_PULSE_CHANCE_PER_MIN / 60.0
            if self.rng.random() < surge_chance_per_sec * dt:
                self.surge_pulse_timer = self.rng.uniform(10.0, 25.0)
                self.surge_boost = self.rng.uniform(15.0, 30.0)

    def should_spawn(self, dt: float) -> bool:
        """Accumulates time and returns True if a vehicle arrival event triggers."""
        self.spawn_timer += dt
        if self.spawn_timer >= self.next_arrival_interval:
            self.spawn_timer = 0.0
            self.next_arrival_interval = self._calculate_next_interval()
            return True
        return False


class DynamicDemandGenerator:
    """Manages independent dynamic demand generators for all intersection approaches."""

    def __init__(
        self,
        seed: Optional[int] = None,
        min_vpm: float = DEFAULT_MIN_DEMAND_VPM,
        max_vpm: float = DEFAULT_MAX_DEMAND_VPM,
        vehicle_mix: Optional[list] = None,
        turn_mix: Optional[list] = None,
    ):
        self.seed = seed
        self.rng = random.Random(seed)

        self.min_vpm = min_vpm
        self.max_vpm = max_vpm
        self.vehicle_mix = vehicle_mix
        self.turn_mix = turn_mix
        self.active_scenario = "ASYMMETRIC_CORRIDOR"

        # Create independent approach demand state for each arm using default asymmetric profile
        self.approaches: Dict[str, ApproachDemandState] = {
            arm: ApproachDemandState(arm, self.rng, min_vpm=min_vpm, max_vpm=max_vpm)
            for arm in ARM_ORDER
        }

    def apply_scenario(self, scenario_id: str) -> dict:
        """Applies a named traffic scenario preset across all 4 intersection arms."""
        scenario_key = (scenario_id or "ASYMMETRIC_CORRIDOR").upper().strip()
        scenario = TRAFFIC_SCENARIOS.get(scenario_key)
        if not scenario:
            for k, sc in TRAFFIC_SCENARIOS.items():
                if scenario_key in k or k in scenario_key:
                    scenario = sc
                    break
        if not scenario:
            scenario = TRAFFIC_SCENARIOS["ASYMMETRIC_CORRIDOR"]

        self.active_scenario = scenario["id"]
        for arm, rate in scenario["rates"].items():
            if arm in self.approaches:
                app = self.approaches[arm]
                app.manual_override = None  # Clear manual override
                app.current_regime = scenario["regimes"].get(arm, "MEDIUM")
                app.target_rate = float(rate)
                app.current_rate = float(rate)
                app.surge_boost = 0.0
                app.spawn_timer = 0.0
                app.next_arrival_interval = app._calculate_next_interval()
        print(f"[SCENARIO] Applied traffic scenario: {scenario['name']} -> {scenario['rates']}")
        return scenario

    def set_seed(self, seed: Optional[int]):
        """Re-seeds the random number generator for reproducible testing."""
        self.seed = seed
        self.rng = random.Random(seed)
        for arm, approach in self.approaches.items():
            approach.rng = self.rng

    def update(self, dt: float):
        """Updates demand states across all approaches."""
        for approach in self.approaches.values():
            approach.update(dt)

    def should_spawn_vehicle(self, arm: str, dt: float) -> bool:
        """Checks if a vehicle arrival triggers for the specified approach."""
        if arm in self.approaches:
            return self.approaches[arm].should_spawn(dt)
        return False

    def get_current_rate(self, arm: str) -> int:
        """Returns rounded current VPM demand rate for approach telemetry."""
        if arm in self.approaches:
            return int(round(self.approaches[arm].get_rate()))
        return 30

    def get_raw_rate(self, arm: str) -> float:
        """Returns raw float VPM demand rate for approach."""
        if arm in self.approaches:
            return self.approaches[arm].get_rate()
        return 30.0

    def get_regime(self, arm: str) -> str:
        """Returns active regime name (LOW, MEDIUM, HIGH, SURGE)."""
        if arm in self.approaches:
            return self.approaches[arm].current_regime
        return "MEDIUM"

    def set_manual_rate(self, arm: str, rate: Optional[float]):
        """Sets or clears a manual demand rate override for an approach."""
        if arm in self.approaches:
            app = self.approaches[arm]
            app.manual_override = float(rate) if rate is not None else None
            app.spawn_timer = 0.0
            app.next_arrival_interval = app._calculate_next_interval()

    def choose_vehicle_type(self) -> str:
        """Selects a vehicle type based on configured probabilities."""
        from traffic_simulator.config import DEFAULT_VEHICLE_MIX
        mix = self.vehicle_mix or DEFAULT_VEHICLE_MIX
        r = self.rng.random()
        cum = 0.0
        for v_type, weight in mix:
            cum += weight
            if r <= cum:
                return v_type
        return mix[-1][0]

    def choose_turn_intent(self) -> str:
        """Selects a turning intent based on configured probabilities."""
        from traffic_simulator.config import DEFAULT_TURN_MIX
        mix = self.turn_mix or DEFAULT_TURN_MIX
        r = self.rng.random()
        cum = 0.0
        for turn, weight in mix:
            cum += weight
            if r <= cum:
                return turn
        return mix[-1][0]
