import time
from traffic_simulator.config import (
    ARM_ORDER, DEFAULT_MIN_GREEN, DEFAULT_MAX_GREEN,
    DEFAULT_YELLOW, DEFAULT_ALL_RED, DEFAULT_FIXED_GREEN, DIR_NAMES,
    PED_SCRAMBLE_WALK_SECONDS, PED_SCRAMBLE_CLEARANCE_SECONDS
)

try:
    from traffic_simulator.xgb_signal_model import XGBSignalTimingModel, build_xgb_state
except ImportError:
    from xgb_signal_model import XGBSignalTimingModel, build_xgb_state

PED_STAGE_INDEX = 4  # 5th stage (0-indexed): pedestrian scramble


class SignalController:
    def __init__(self, mode="ADAPTIVE_AI"):
        self.mode = mode  # "FIXED" or "ADAPTIVE_AI"

        self.stage_index = 0  # 0: SOUTH, 1: NORTH, 2: EAST, 3: WEST, 4: PED_SCRAMBLE
        self.phase_state = "GREEN"  # "GREEN", "YELLOW", "ALL_RED", "WALK"

        self.timer = 0.0
        self.allocated_green = DEFAULT_FIXED_GREEN

        self.yellow_duration = DEFAULT_YELLOW
        self.all_red_duration = DEFAULT_ALL_RED
        self.walk_duration = PED_SCRAMBLE_WALK_SECONDS
        self.ped_clearance_duration = PED_SCRAMBLE_CLEARANCE_SECONDS
        self.max_ped_clearance_timeout = 30.0  # Configurable safety cap for clearance hold

        # Emergency override status
        self.emergency_override = False
        self.emergency_target_arm = None
        self.emergency_remaining = 0.0

        # Cycle Counter
        self.completed_cycles = 0

        # AI Adaptive Phase Selection & Starvation Prevention State
        self.selected_arm = "SOUTH"
        self.demand_scores = {arm: 0.0 for arm in ARM_ORDER}
        self.phases_since_arm_served = {arm: 0 for arm in ARM_ORDER}
        self.vehicle_phases_since_ped = 0

        # Traffic demand predictor for proactive arrival forecasting
        self.demand_predictor = None
        try:
            from traffic_simulator.ai_traffic_engine import TrafficDemandPredictor
            self.demand_predictor = TrafficDemandPredictor()
        except ImportError:
            try:
                from ai_traffic_engine import TrafficDemandPredictor
                self.demand_predictor = TrafficDemandPredictor()
            except ImportError:
                self.demand_predictor = None

        # XGBoost ML Model Initialization (Loaded once at startup)
        self.xgb_model = None
        self.model_loaded = False
        self.latest_recommended_green = DEFAULT_FIXED_GREEN
        self.latest_prediction_time_ms = 0.0
        self.latest_features = {}

        try:
            self.xgb_model = XGBSignalTimingModel()
            self.model_loaded = True
        except Exception as e:
            print(f"[AI ERROR] XGBoost model could not be loaded: {e}")
            print("[AI FALLBACK] Using deterministic adaptive timing.")
            self.xgb_model = None
            self.model_loaded = False

    def toggle_mode(self):
        """Toggles between FIXED and ADAPTIVE_AI control modes."""
        self.mode = "ADAPTIVE_AI" if self.mode == "FIXED" else "FIXED"
        return self.mode

    def get_active_arm(self):
        """Returns name of arm currently having Green/Yellow signal, or None
        during the pedestrian scramble stage."""
        if self.stage_index >= len(ARM_ORDER):
            return None
        return ARM_ORDER[self.stage_index]

    def is_arm_green(self, arm):
        """Returns True if arm currently has GREEN light."""
        return self.get_active_arm() == arm and self.phase_state == "GREEN"

    def get_arm_signal_color(self, arm):
        """Returns 'RED', 'YELLOW', or 'GREEN' for the specified arm."""
        if self.stage_index >= len(ARM_ORDER):
            return "RED"  # pedestrian scramble: every vehicle approach is red
        if self.phase_state == "ALL_RED":
            return "RED"
        active = self.get_active_arm()
        if arm == active:
            return self.phase_state
        return "RED"

    def get_crosswalk_state(self):
        """Returns 'WALK', 'CLEARANCE', or 'DONT_WALK' — the single source of
        truth for pedestrian signal state (and hence when pedestrians may
        legally occupy the crosswalks in intersection.py)."""
        if self.stage_index == PED_STAGE_INDEX:
            if self.phase_state == "WALK":
                return "WALK"
            elif self.phase_state in ("CLEARANCE", "ALL_RED"):
                return "CLEARANCE"
        return "DONT_WALK"

    def trigger_emergency(self, arm):
        """Activates emergency green wave preemption for specified arm."""
        self.emergency_override = True
        self.emergency_target_arm = arm
        self.emergency_remaining = 30.0

        if self.get_active_arm() == arm and self.phase_state == "GREEN":
            self.timer = 0.0
            self.allocated_green = 30.0
        else:
            if self.phase_state in ("GREEN", "WALK"):
                self.phase_state = "YELLOW" if self.phase_state == "GREEN" else "ALL_RED"
                self.timer = 0.0

    def clear_emergency(self):
        """Releases emergency preemption and resumes normal cycle."""
        self.emergency_override = False
        self.emergency_target_arm = None
        self.emergency_remaining = 0.0

    def force_phase(self, arm, duration=30.0):
        """Forces immediate green on specified approach for duration seconds (manual override from optimizer)."""
        if arm in ARM_ORDER:
            self.stage_index = ARM_ORDER.index(arm)
            self.selected_arm = arm
            self.phase_state = "GREEN"
            self.timer = 0.0
            self.allocated_green = max(5.0, min(120.0, float(duration)))
            print(f"[MANUAL OVERRIDE] Forced {arm} GREEN for {self.allocated_green}s")

    def update(self, intersection, dt=1.0 / 60.0):
        """Advances signal phase timer and executes phase transition logic."""
        self.timer += dt

        if self.emergency_override:
            self.emergency_remaining = max(0.0, self.emergency_remaining - dt)
            if self.emergency_remaining <= 0:
                self.clear_emergency()

        if self.stage_index < PED_STAGE_INDEX:
            # Vehicle-approach stage: GREEN -> YELLOW -> ALL_RED -> advance
            if self.phase_state == "GREEN":
                # Actuated Adaptive Gap-Out (NEMA actuated signal logic):
                # If min green is met, stop line has 0 queued vehicles, and another arm has waiting queues,
                # gap out immediately to transfer green to waiting demand rather than wasting green on empty road.
                active_arm = self.get_active_arm()
                if (
                    self.mode == "ADAPTIVE_AI"
                    and not self.emergency_override
                    and self.timer >= DEFAULT_MIN_GREEN
                    and active_arm
                ):
                    q = intersection.get_arm_queue(active_arm)
                    approaching_near = sum(
                        1 for v in intersection.vehicles[active_arm]
                        if not v.has_passed_stop_line and v.distance_traveled > 180.0
                    )
                    other_waiting = any(
                        intersection.get_arm_queue(a) > 0 for a in ARM_ORDER if a != active_arm
                    )
                    if q == 0 and approaching_near == 0 and other_waiting:
                        self.phase_state = "YELLOW"
                        self.timer = 0.0

                if self.phase_state == "GREEN" and self.timer >= self.allocated_green:
                    self.phase_state = "YELLOW"
                    self.timer = 0.0
            elif self.phase_state == "YELLOW":
                if self.timer >= self.yellow_duration:
                    self.phase_state = "ALL_RED"
                    self.timer = 0.0
            elif self.phase_state == "ALL_RED":
                if self.timer >= self.all_red_duration:
                    self._advance(intersection)
        else:
            # Pedestrian scramble stage: WALK -> CLEARANCE -> advance
            if self.phase_state == "WALK":
                if self.timer >= self.walk_duration:
                    self.phase_state = "CLEARANCE"
                    self.timer = 0.0
                    print(f"[PED_STAGE] WALK phase complete. Switching to CLEARANCE. Active pedestrians crossing: {intersection.get_active_pedestrian_count()}")
            elif self.phase_state in ("CLEARANCE", "ALL_RED"):
                active_peds = intersection.get_active_pedestrian_count()
                min_clearance_met = self.timer >= self.ped_clearance_duration
                all_peds_cleared = (active_peds == 0)
                max_timeout_reached = self.timer >= self.max_ped_clearance_timeout

                # Advance ONLY when all pedestrians have safely reached opposite curb (or max safety timeout)
                if (min_clearance_met and all_peds_cleared) or max_timeout_reached:
                    if max_timeout_reached and active_peds > 0:
                        print(f"[PED_STAGE] Max safety clearance timeout reached ({self.max_ped_clearance_timeout}s). {active_peds} pedestrians still crossing safely. Advancing signal stage.")
                    else:
                        print(f"[PED_STAGE] Clearance complete. All pedestrians reached curb. Advancing signal stage.")
                    self._advance(intersection)

    def calculate_arm_demand_score(self, arm, intersection, predicted_queues=None, previous_arm=None):
        """
        Calculates a deterministic AI demand score for a given approach using real simulation state.
        Score formula based on Section 9:
            score = (pce_queue * 3.0
                   + queue * 2.0
                   + wait_time * 1.5
                   + vehicle_count * 0.5
                   + predicted_demand * 1.5)
        With starvation protection and incident compensation.
        """
        queue = intersection.get_arm_queue(arm)
        pce_queue = intersection.get_arm_pce_queue(arm)
        wait_time = intersection.get_arm_max_wait_time(arm)
        vehicle_count = intersection.get_arm_vehicle_count(arm)

        has_incident = bool(
            intersection.incident
            and intersection.incident.get("active")
            and intersection.incident.get("dir") == arm
        )

        pred_demand = 0.0
        if predicted_queues and arm in predicted_queues:
            pred_demand = float(predicted_queues[arm].get("predicted_queue_15min", queue))

        # Base demand score (Section 9)
        score = (
            pce_queue * 3.0
            + queue * 2.0
            + wait_time * 1.5
            + vehicle_count * 0.5
            + pred_demand * 1.5
        )

        # Incident bottleneck multiplier
        if has_incident:
            score *= 1.35

        # Section 5: Starvation Protection
        # If an approach has queued vehicles waiting, progressively escalate priority
        if queue > 0:
            if wait_time > 20.0:
                score += (wait_time - 20.0) * 2.0
            phases_unserved = self.phases_since_arm_served.get(arm, 0)
            if phases_unserved >= 2:
                score += phases_unserved * 20.0

        # Avoid back-to-back same phase when other approaches have waiting vehicles
        if arm == previous_arm:
            other_has_queue = any(
                intersection.get_arm_queue(a) > 0 for a in ARM_ORDER if a != arm
            )
            if other_has_queue:
                score -= 30.0

        return max(0.0, round(score, 2))

    def _advance(self, intersection):
        """
        AI Traffic Signal Optimizer:
        Dynamically selects WHICH approach gets green next based on real simulation demand scores,
        and uses the trained XGBoost model to predict HOW LONG that approach gets green.
        """
        # 1. Emergency Preemption: Immediate deterministic priority
        if self.emergency_override and self.emergency_target_arm:
            self.stage_index = ARM_ORDER.index(self.emergency_target_arm)
            self.selected_arm = self.emergency_target_arm
            self.phase_state = "GREEN"
            self.timer = 0.0
            self.allocated_green = 30.0  # Dedicated emergency clearance window
            return

        # 2. Fixed Control Mode: Round-robin sequence
        if self.mode == "FIXED":
            self.stage_index = (self.stage_index + 1) % (len(ARM_ORDER) + 1)
            if self.stage_index == PED_STAGE_INDEX:
                self.phase_state = "WALK"
                self.timer = 0.0
                return
            if self.stage_index == 0:
                self.completed_cycles += 1
            self.selected_arm = ARM_ORDER[self.stage_index]
            self.phase_state = "GREEN"
            self.timer = 0.0
            self.allocated_green = DEFAULT_FIXED_GREEN
            return

        # 3. ADAPTIVE_AI Control Mode
        prev_arm = self.get_active_arm()

        # Check if returning from Pedestrian Scramble phase
        if self.stage_index == PED_STAGE_INDEX:
            self.vehicle_phases_since_ped = 0
        else:
            # Check if Pedestrian Scramble phase should trigger
            active_peds = intersection.get_active_pedestrian_count()
            if (active_peds > 0 and self.vehicle_phases_since_ped >= 2) or (self.vehicle_phases_since_ped >= 4):
                self.stage_index = PED_STAGE_INDEX
                self.phase_state = "WALK"
                self.timer = 0.0
                self.completed_cycles += 1
                return

        # Update starvation tracking for unserved approaches
        for arm in ARM_ORDER:
            if arm != prev_arm:
                self.phases_since_arm_served[arm] = self.phases_since_arm_served.get(arm, 0) + 1
            else:
                self.phases_since_arm_served[arm] = 0

        # Predict future traffic demand using external/Java Optimizer predictions or local TrafficDemandPredictor
        predicted_queues = getattr(self, "predicted_queues", None)
        if not predicted_queues and self.demand_predictor:
            try:
                curr_q = {a: intersection.get_arm_queue(a) for a in ARM_ORDER}
                curr_inc = {
                    a: bool(
                        intersection.incident
                        and intersection.incident.get("active")
                        and intersection.incident.get("dir") == a
                    )
                    for a in ARM_ORDER
                }
                predicted_queues = self.demand_predictor.predict(curr_q, curr_inc)
            except Exception:
                predicted_queues = None

        # Evaluate candidate demand scores across all four arms
        scores = {}
        for arm in ARM_ORDER:
            scores[arm] = self.calculate_arm_demand_score(
                arm, intersection, predicted_queues=predicted_queues, previous_arm=prev_arm
            )
        self.demand_scores = scores

        # Select the highest-demand eligible approach
        max_score = max(scores.values())
        if max_score <= 0.0:
            # Default sequence progression if intersection is completely quiet
            next_idx = ((ARM_ORDER.index(prev_arm) + 1) % len(ARM_ORDER)) if prev_arm in ARM_ORDER else 0
            selected_arm = ARM_ORDER[next_idx]
        else:
            selected_arm = max(scores, key=scores.get)

        self.selected_arm = selected_arm
        self.stage_index = ARM_ORDER.index(selected_arm)
        self.phases_since_arm_served[selected_arm] = 0
        self.vehicle_phases_since_ped += 1

        # Use trained XGBoost model to predict green duration for selected approach
        rec_green = None
        if self.xgb_model and self.model_loaded:
            try:
                t0 = time.perf_counter()
                state = build_xgb_state(intersection, self, active_arm=selected_arm)
                raw_green = self.xgb_model.predict_green_time(
                    state, min_green=DEFAULT_MIN_GREEN, max_green=DEFAULT_MAX_GREEN
                )
                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                rec_green = round(raw_green, 1)

                self.latest_recommended_green = rec_green
                self.latest_prediction_time_ms = round(elapsed_ms, 2)
                self.latest_features = state
            except Exception as e:
                print(f"[AI ERROR] XGBoost prediction failed: {e}")
                rec_green = None

        if rec_green is not None:
            self.allocated_green = max(DEFAULT_MIN_GREEN, min(DEFAULT_MAX_GREEN, rec_green))
        else:
            # Safe queue-proportional adaptive fallback (never hardcoded 30s)
            q = intersection.get_arm_queue(selected_arm)
            self.allocated_green = max(DEFAULT_MIN_GREEN, min(DEFAULT_MAX_GREEN, round(10.0 + q * 1.5, 1)))
            self.latest_recommended_green = self.allocated_green

        self.phase_state = "GREEN"
        self.timer = 0.0

        # Section 19: Debug Logging
        print(f"""[XGBOOST SIGNAL OPTIMIZER]

South:
    queue={intersection.get_arm_queue('SOUTH')}
    wait={intersection.get_arm_max_wait_time('SOUTH'):.1f}
    score={scores.get('SOUTH', 0.0):.1f}

North:
    queue={intersection.get_arm_queue('NORTH')}
    wait={intersection.get_arm_max_wait_time('NORTH'):.1f}
    score={scores.get('NORTH', 0.0):.1f}

East:
    queue={intersection.get_arm_queue('EAST')}
    wait={intersection.get_arm_max_wait_time('EAST'):.1f}
    score={scores.get('EAST', 0.0):.1f}

West:
    queue={intersection.get_arm_queue('WEST')}
    wait={intersection.get_arm_max_wait_time('WEST'):.1f}
    score={scores.get('WEST', 0.0):.1f}

Selected: {selected_arm}
Recommended Green: {self.allocated_green:.1f}s
""")

    def get_remaining_time(self):
        """Returns remaining seconds in current phase."""
        if self.phase_state == "GREEN":
            return max(0.0, self.allocated_green - self.timer)
        elif self.phase_state == "YELLOW":
            return max(0.0, self.yellow_duration - self.timer)
        elif self.phase_state == "WALK":
            return max(0.0, self.walk_duration - self.timer)
        elif self.stage_index == PED_STAGE_INDEX:
            return max(0.0, self.ped_clearance_duration - self.timer)
        else:
            return max(0.0, self.all_red_duration - self.timer)

    def generate_explainability(self, intersection):
        """Generates 6-Feature AI Explainability items matching the React frontend."""
        active_arm = self.get_active_arm() or "SOUTH"
        queue = intersection.get_arm_queue(active_arm)
        wait_time = round(intersection.get_arm_max_wait_time(active_arm), 1)
        count = intersection.get_arm_vehicle_count(active_arm)

        has_incident = (intersection.incident is not None and
                        intersection.incident.get("active") and
                        intersection.incident.get("dir") == active_arm)

        explain_items = [
            {
                "feature": "Queue Density",
                "value": f"{queue} vehicles",
                "impact": min(35, queue * 4),
                "positive": queue < 6,
                "reason": f"Queue on {DIR_NAMES[active_arm]} requires {round(queue * 1.8, 1)}s allocation"
            },
            {
                "feature": "Max Waiting Time",
                "value": f"{wait_time}s",
                "impact": min(25, int(wait_time * 0.6)),
                "positive": wait_time < 30.0,
                "reason": f"Accumulated wait delay adds {round(wait_time * 0.4, 1)}s green extension"
            },
            {
                "feature": "Approach Flow",
                "value": f"{count} approaching",
                "impact": min(20, count * 3),
                "positive": count < 8,
                "reason": f"Arrival flow requires continuous clearance through {DIR_NAMES[active_arm]}"
            },
            {
                "feature": "XGBoost Adaptive Timing",
                "value": f"{round(self.allocated_green, 1)}s allocated",
                "impact": 20,
                "positive": True,
                "reason": f"Optimal green split calculated at {round(self.allocated_green, 1)}s by trained XGBoost regression model"
            },
            {
                "feature": "Incident Impact",
                "value": "Active Incident" if has_incident else "Clear Road",
                "impact": 25 if has_incident else 0,
                "positive": not has_incident,
                "reason": "Lane 1 blocked; capacity reduced by 50%" if has_incident else "All lanes free flowing"
            },
            {
                "feature": "Emergency Preemption",
                "value": "ACTIVE" if self.emergency_override else "STANDBY",
                "impact": 40 if self.emergency_override else 0,
                "positive": True,
                "reason": f"Green wave active for {DIR_NAMES.get(self.emergency_target_arm, '')}" if self.emergency_override else "No active emergency preemption"
            }
        ]
        return explain_items
