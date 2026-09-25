"""
Intersection Manager — orchestrates vehicle spawning (car/bus/motorcycle/
ambulance), pedestrian spawning during the scramble phase, incident/accident
lane blockages, emergency bypass logic, and — critically — the two-layer
collision resolution (collision.py) that actually prevents vehicles from
overlapping while turning, instead of merely detecting and logging it.

This is the single authoritative simulation loop: the optimizer-service
(Java) should read snapshots from this engine (via server.py) rather than
maintaining its own separate vehicle-physics implementation.
"""

import math
import random

from traffic_simulator.config import (
    ARM_ORDER, DEFAULT_VEHICLE_MIX, DEFAULT_TURN_MIX,
    PEDESTRIAN_SPAWN_CHANCE_PER_SEC, MIN_VEHICLE_GAP
)
from traffic_simulator.vehicle import Vehicle, constrain_vehicle_behind_leader
from traffic_simulator.pedestrian import Pedestrian
from traffic_simulator import collision
try:
    from traffic_simulator.demand import DynamicDemandGenerator
except ImportError:
    from demand import DynamicDemandGenerator


def _weighted_choice(mix, rng=None):
    r = (rng.random() if rng else random.random())
    cum = 0.0
    for value, weight in mix:
        cum += weight
        if r <= cum:
            return value
    return mix[-1][0]


class Intersection:
    def __init__(self, seed=None, min_vpm=None, max_vpm=None):
        self.seed = seed
        if seed is not None:
            random.seed(seed)
            Vehicle._id_counter = 1

        self.vehicles = {arm: [] for arm in ARM_ORDER}
        self.completed_vehicles = []

        self.pedestrians = {arm: [] for arm in ARM_ORDER}
        self.completed_pedestrians = 0
        self._ped_spawn_timer = {arm: 0.0 for arm in ARM_ORDER}

        # Dynamic Traffic Demand Generator
        demand_kwargs = {"seed": seed}
        if min_vpm is not None:
            demand_kwargs["min_vpm"] = min_vpm
        if max_vpm is not None:
            demand_kwargs["max_vpm"] = max_vpm
        self.demand_generator = DynamicDemandGenerator(**demand_kwargs)

        # Traffic arrival rates (Vehicles per Minute) for backward compatibility
        self.spawn_rates = {arm: self.demand_generator.get_current_rate(arm) for arm in ARM_ORDER}
        self.spawn_timers = {arm: 0.0 for arm in ARM_ORDER}

        # Incident / Accident state (matches frontend contract)
        self.incident = None

        # Last resolved conflict-zone allowances (exposed for debugging/UI)
        self.last_yield_count = 0

    # ------------------------------------------------------------------
    # Public controls
    # ------------------------------------------------------------------
    def set_spawn_rate(self, arm, rate):
        """Sets manual override spawn rate in vehicles per minute."""
        if hasattr(self, 'demand_generator'):
            self.demand_generator.set_manual_rate(arm, rate)
            self.spawn_rates[arm] = int(rate) if rate is not None else self.demand_generator.get_current_rate(arm)

    def apply_scenario(self, scenario_id: str):
        """Applies a named traffic demand scenario (e.g. ASYMMETRIC_CORRIDOR, BALANCED, etc)."""
        if hasattr(self, 'demand_generator'):
            scenario = self.demand_generator.apply_scenario(scenario_id)
            for arm in ARM_ORDER:
                self.spawn_rates[arm] = self.demand_generator.get_current_rate(arm)
            return scenario
        return None

    def set_incident(self, arm, active=True):
        """Toggles an accident / collision on the specified approach."""
        if not active:
            self.incident = None
            return

        self.incident = {
            "active": True,
            "type": "collision",
            "dir": arm,
            "lane": 0,
            "title": f"Collision on {arm.capitalize()} approach",
            "description": "Two vehicles collided before stop line. Lane 1 blocked — safety cones deployed."
        }

    def spawn_emergency_vehicle(self, arm=None):
        """Forces immediate spawn of an emergency ambulance with sirens.
        If arm is None, invalid, or "RANDOM", selects a random arm from ARM_ORDER.
        Enforces entry clearance to avoid vehicle overlap at the spawn point.
        Returns the arm string where the emergency vehicle was spawned.
        """
        if not arm or arm not in ARM_ORDER:
            arm = random.choice(ARM_ORDER)

        ambulance = Vehicle(origin_arm=arm, v_type='AMBULANCE', turn_intent='STRAIGHT')
        ambulance.is_emergency = True
        ambulance.bypass_incident = False

        # Safe upstream spawning: NEVER move existing vehicles!
        arm_vehicles = self.vehicles[arm]
        if arm_vehicles:
            last = arm_vehicles[-1]
            if not last.has_passed_stop_line:
                min_clearance = last.length + MIN_VEHICLE_GAP
                if last.distance_traveled < min_clearance:
                    # Place ambulance safely upstream behind the last vehicle without shifting existing vehicles
                    ambulance.distance_traveled = min(0.0, (last.distance_traveled - last.length) - MIN_VEHICLE_GAP)

        self.vehicles[arm].append(ambulance)
        return arm

    def has_emergency_vehicle(self, arm):
        """Returns True if arm contains an emergency vehicle."""
        return any(v.is_emergency for v in self.vehicles[arm])

    # ------------------------------------------------------------------
    # Queue / telemetry helpers
    # ------------------------------------------------------------------
    def get_arm_queue(self, arm):
        """Counts vehicles queued before the stop line."""
        return sum(1 for v in self.vehicles[arm] if v.speed < 0.5 and not v.has_passed_stop_line)

    def get_arm_pce_queue(self, arm):
        """Sum of Passenger Car Equivalent weights for queued vehicles — used
        by the Webster Adaptive AI timing calculation (merged in from the
        Java optimizer-service's PCE-weighted model)."""
        return sum(v.pce for v in self.vehicles[arm] if v.speed < 0.5 and not v.has_passed_stop_line) or 0.0

    def get_arm_vehicle_count(self, arm):
        """Counts total active approaching vehicles."""
        return len(self.vehicles[arm])

    def get_arm_max_wait_time(self, arm):
        """Returns max waiting time among queued vehicles."""
        waits = [v.waiting_time for v in self.vehicles[arm] if not v.has_passed_stop_line]
        return max(waits) if waits else 0.0

    def is_crosswalk_occupied(self, arm):
        """True while any pedestrian is currently on that arm's crosswalk —
        vehicles must not cross the stop line while this is True, even an
        emergency vehicle running a red light should not run over a
        pedestrian."""
        return len(self.pedestrians[arm]) > 0

    def has_active_pedestrians(self):
        """Returns True if any pedestrian is currently physically crossing inside any crosswalk."""
        return any(len(self.pedestrians[arm]) > 0 for arm in ARM_ORDER)

    def get_active_pedestrian_count(self):
        """Returns total number of active pedestrians currently inside crosswalks across all arms."""
        return sum(len(self.pedestrians[arm]) for arm in ARM_ORDER)

    # ------------------------------------------------------------------
    # Main update loop
    # ------------------------------------------------------------------
    def update(self, signal_controller, dt=1.0 / 60.0):
        """Updates physics, vehicle arrivals, pedestrian crossings, accident
        avoidance, and ambulance bypass — with collision-safe turning."""
        # 1. Vehicle dynamic demand update & stochastic Poisson arrival spawning
        self.demand_generator.update(dt)
        for arm in ARM_ORDER:
            self.spawn_rates[arm] = self.demand_generator.get_current_rate(arm)
            if self.demand_generator.should_spawn_vehicle(arm, dt):
                self._try_spawn_vehicle(arm)

        # 2. Pedestrian spawning + movement (only while the scramble WALK
        # phase is active — see signal_controller.get_crosswalk_state()).
        self._update_pedestrians(signal_controller, dt)

        has_incident_on_arm = lambda a: (self.incident and self.incident.get("active") and self.incident.get("dir") == a)

        # 3. Save pre-physics state for every vehicle so the hard safety net
        # can roll a vehicle back to a known-good position if needed.
        prev_states = {}
        for arm in ARM_ORDER:
            # Sort vehicles by distance_traveled descending (farthest ahead first)
            self.vehicles[arm].sort(key=lambda veh: veh.distance_traveled, reverse=True)
            for v in self.vehicles[arm]:
                prev_states[v.id] = (v.x, v.y, v.distance_traveled, v.angle, v.speed)

        # 4. Proactively resolve turning conflicts BEFORE stepping physics,
        # using last-tick positions (collision.py). This is what actually
        # fixes vehicles colliding while turning: each vehicle gets a hard
        # "do not pass this point yet" distance fed into its IDM model so it
        # decelerates smoothly instead of clipping through another vehicle.
        in_box_prev = [v for arm in ARM_ORDER for v in self.vehicles[arm] if v.has_passed_stop_line]
        yield_allowances = collision.resolve_conflicts(in_box_prev)
        self.last_yield_count = sum(1 for val in yield_allowances.values() if val is not None)

        # 5. Step physics for every vehicle
        for arm in ARM_ORDER:
            arm_vehicles = self.vehicles[arm]
            is_green = signal_controller.is_arm_green(arm)
            arm_incident = has_incident_on_arm(arm)
            crosswalk_blocked = self.is_crosswalk_occupied(arm)

            for i, v in enumerate(arm_vehicles):
                # An ambulance/vehicle MUST ALWAYS detect the nearest physical vehicle ahead in its lane
                lead = arm_vehicles[i - 1] if i > 0 else None

                if arm_incident and not v.is_emergency:
                    v.update_physics(lead_vehicle=lead, is_green=is_green, dt=dt,
                                      blockage_dist=160.0, incident_crawl=True)
                    continue

                effective_green = is_green and not crosswalk_blocked

                yield_dist = yield_allowances.get(v.id)
                v.update_physics(lead_vehicle=lead, is_green=effective_green, dt=dt,
                                  blockage_dist=None, yield_distance=yield_dist)

        # 6. Same-approach queued-turn gap modulation: keeps vehicles queued
        # on the SAME path (e.g. two vehicles both turning left from SOUTH)
        # from nosing into each other along the curve even though they are
        # not caught by the cross-arm conflict table above.
        for arm in ARM_ORDER:
            arm_vehs = self.vehicles[arm]
            for k in range(1, len(arm_vehs)):
                v_behind = arm_vehs[k]
                v_ahead = arm_vehs[k - 1]
                constrain_vehicle_behind_leader(v_behind, v_ahead, MIN_VEHICLE_GAP)
                gap_2d = math.hypot(v_ahead.x - v_behind.x, v_ahead.y - v_behind.y)
                min_touch_gap = (v_ahead.length + v_behind.length) / 2.0
                safe_gap = min_touch_gap + 25.0
                if gap_2d < safe_gap:
                    cap = max(0.0, (gap_2d - min_touch_gap) * 0.35)
                    v_behind.speed = min(v_behind.speed, cap)

        # 7. Hard geometric safety net: guarantees zero bounding-circle
        # overlap every single frame by rolling back the lower-priority
        # vehicle in any pair that still ended up touching. This replaces
        # the old "[SAFETY-NET-FIRE]" print-only debug statement with an
        # actual fix.
        in_box_now = [v for arm in ARM_ORDER for v in self.vehicles[arm] if v.has_passed_stop_line]
        collision.enforce_no_overlap(in_box_now, prev_states)

        # 8. Clean up completed vehicles
        for arm in ARM_ORDER:
            remaining = []
            for v in self.vehicles[arm]:
                if v.is_out_of_bounds() or getattr(v, 'distance_traveled', 0) > 850:
                    self.completed_vehicles.append({
                        'id': v.id,
                        'origin': v.origin_arm,
                        'type': v.type,
                        'wait_time': v.waiting_time,
                        'travel_time': v.travel_time,
                        'is_emergency': v.is_emergency,
                        'pce': v.pce,
                    })
                else:
                    remaining.append(v)
            self.vehicles[arm] = remaining

    # ------------------------------------------------------------------
    # Pedestrians
    # ------------------------------------------------------------------
    def _update_pedestrians(self, signal_controller, dt):
        crosswalk_state = signal_controller.get_crosswalk_state()

        # Spawning ONLY allowed during WALK phase.
        if crosswalk_state == "WALK":
            for arm in ARM_ORDER:
                self._ped_spawn_timer[arm] += dt
                if self._ped_spawn_timer[arm] >= 1.0:
                    self._ped_spawn_timer[arm] = 0.0
                    if random.random() < PEDESTRIAN_SPAWN_CHANCE_PER_SEC and len(self.pedestrians[arm]) < 6:
                        p = Pedestrian(arm)
                        self.pedestrians[arm].append(p)
                        print(f"[PEDESTRIAN SPAWN] Pedestrian #{p.id} spawned at {arm} crosswalk curb.")

        # Continuous movement and curb completion
        for arm in ARM_ORDER:
            still_crossing = []
            for p in self.pedestrians[arm]:
                p.update(dt)
                if not p.is_done():
                    still_crossing.append(p)
                else:
                    self.completed_pedestrians += 1
                    print(f"[PEDESTRIAN CLEAR] Pedestrian #{p.id} reached opposite curb at {arm} crosswalk.")
            self.pedestrians[arm] = still_crossing

    # ------------------------------------------------------------------
    # Spawning
    # ------------------------------------------------------------------
    def _try_spawn_vehicle(self, arm):
        """Spawns arrival vehicle if entry point is clear.
        Note: Vehicle demand generation is 100% independent of incidents/accidents;
        an active incident on an approach does NOT reduce vehicle arrival rate."""
        v_type = self.demand_generator.choose_vehicle_type()
        turn = self.demand_generator.choose_turn_intent()
        new_v = Vehicle(origin_arm=arm, v_type=v_type, turn_intent=turn)

        arm_vehicles = self.vehicles[arm]
        if arm_vehicles:
            last = arm_vehicles[-1]
            if not last.has_passed_stop_line:
                # Require that the last vehicle has traveled far enough so its rear
                # bumper clears the spawn point with MIN_VEHICLE_GAP safety gap
                min_clearance = last.length + MIN_VEHICLE_GAP
                if last.distance_traveled < min_clearance:
                    return

                if arm == "NORTH" and last.y < 50: return
                elif arm == "SOUTH" and last.y > 750: return
                elif arm == "EAST" and last.x > 750: return
                elif arm == "WEST" and last.x < 50: return

        self.vehicles[arm].append(new_v)
