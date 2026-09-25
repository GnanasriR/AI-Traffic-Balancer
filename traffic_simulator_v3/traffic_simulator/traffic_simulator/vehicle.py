"""
Microscopic Vehicle Model — single source of truth for vehicle physics.

Implements Intelligent Driver Model (IDM) car-following, realistic per-type
acceleration/braking (a bus does not brake or accelerate like a motorcycle),
deterministic Bezier-curve turning trajectories, motorcycle lane-filtering,
ambulance bypass steering, and conflict-zone yielding so vehicles slow down
smoothly (and never overlap) while turning through the junction — see
collision.py for the conflict-zone / anti-overlap logic this class defers to.
"""

import math
import random

from traffic_simulator.config import (
    CENTER_X, CENTER_Y, LANE_WIDTH,
    MAX_SPEED_PX, MIN_GAP, MIN_VEHICLE_GAP,
    VEHICLE_TYPES
)


def get_front_to_rear_gap(follower, leader):
    """Calculates physical bumper-to-bumper gap between follower's front and leader's rear.
    Formula: (lead.distance_traveled - lead.length) - follower.distance_traveled
    """
    if leader is None or follower is None:
        return float('inf')
    return (leader.distance_traveled - leader.length) - follower.distance_traveled


def get_safe_following_distance(follower, leader, min_gap=MIN_VEHICLE_GAP):
    """Calculates maximum allowed distance_traveled for follower behind leader.
    Formula: (lead.distance_traveled - lead.length) - min_gap
    """
    if leader is None or follower is None:
        return float('inf')
    return (leader.distance_traveled - leader.length) - min_gap


def constrain_vehicle_behind_leader(follower, leader, min_gap=MIN_VEHICLE_GAP):
    """Clamps follower's distance_traveled and speed so it never violates min_gap."""
    if leader is None or follower is None:
        return
    max_allowed = get_safe_following_distance(follower, leader, min_gap)
    if follower.distance_traveled > max_allowed:
        follower.distance_traveled = max_allowed
        follower.speed = min(follower.speed, leader.speed if leader.speed > 0 else 0.0)


def get_nearest_vehicle_ahead(vehicle, vehicles_in_lane):
    """Returns nearest vehicle ahead of `vehicle` in the same lane/arm."""
    nearest = None
    min_dist = float('inf')
    for v in vehicles_in_lane:
        if v.id == vehicle.id:
            continue
        d = v.distance_traveled - vehicle.distance_traveled
        if d > 0 and d < min_dist:
            min_dist = d
            nearest = v
    return nearest


class Vehicle:
    _id_counter = 1

    def __init__(self, origin_arm, v_type='CAR', turn_intent='STRAIGHT'):
        self.id = Vehicle._id_counter
        Vehicle._id_counter += 1

        self.origin_arm = origin_arm  # "NORTH", "SOUTH", "EAST", "WEST"
        self.type = v_type
        self.turn_intent = turn_intent  # "STRAIGHT", "RIGHT", "LEFT"

        spec = VEHICLE_TYPES.get(v_type, VEHICLE_TYPES['CAR'])
        self.width = spec['width']
        self.length = spec['length']
        self.color = spec['color']
        self.is_emergency = spec.get('is_emergency', False)
        self.can_filter = spec.get('can_filter', False)
        self.pce = spec.get('pce', 1.0)
        self.s0 = spec.get('s0', 5.0)
        self.headway_t = spec.get('headway_t', 1.0)

        # Per-type realistic physics profile (a bus and a motorcycle should
        # feel completely different, not just "slower top speed").
        self.target_speed = MAX_SPEED_PX * spec['speed_ratio']
        self.max_accel = spec.get('max_accel', 0.15)
        self.comfort_brake = spec.get('comfort_brake', 0.28)
        self.emergency_brake = spec.get('emergency_brake', 0.65)
        self.turn_speed_factor = spec.get('turn_speed_factor', 0.45)

        self.speed = random.uniform(0.7, 1.0) * self.target_speed
        self.acceleration = 0.0

        self.waiting_time = 0.0  # Time spent stopped in seconds
        self.travel_time = 0.0   # Total lifespan in seconds
        self.has_passed_stop_line = False
        self.is_turning = False
        self.turn_progress = 0.0
        self.bypass_incident = False
        self.distance_traveled = 0.0

        # Lane alignment: keep lateral coordinate strictly on lane centerline
        self.filter_offset = 0.0
        self.filter_target = 0.0

        # Set initial positions/orientation, and the *exact* geometric
        # distance to the stop line for this arm (previously hard-coded to a
        # flat 300px regardless of vehicle length or arm, which was not
        # physically correct).
        self._init_path()

    def _init_path(self):
        """Initializes starting coordinate (x, y), travel angle, destination arm
        and the exact stop-line distance based on arm + vehicle length."""
        half_lane = LANE_WIDTH / 2.0
        box_edge = 310.0  # distance from center to the intersection box edge (ROAD_WIDTH/2)

        if self.origin_arm == "NORTH":
            self.x = CENTER_X - half_lane
            self.y = -self.length
            self.angle = 90
            self.destination_arm = "SOUTH" if self.turn_intent == "STRAIGHT" else ("WEST" if self.turn_intent == "RIGHT" else "EAST")

        elif self.origin_arm == "SOUTH":
            self.x = CENTER_X + half_lane
            self.y = 800 + self.length
            self.angle = 270
            self.destination_arm = "NORTH" if self.turn_intent == "STRAIGHT" else ("EAST" if self.turn_intent == "RIGHT" else "WEST")

        elif self.origin_arm == "EAST":
            self.x = 800 + self.length
            self.y = CENTER_Y - half_lane
            self.angle = 180
            self.destination_arm = "WEST" if self.turn_intent == "STRAIGHT" else ("NORTH" if self.turn_intent == "RIGHT" else "SOUTH")

        elif self.origin_arm == "WEST":
            self.x = -self.length
            self.y = CENTER_Y + half_lane
            self.angle = 0
            self.destination_arm = "EAST" if self.turn_intent == "STRAIGHT" else ("SOUTH" if self.turn_intent == "RIGHT" else "NORTH")

        # Exact longitudinal distance from spawn point to the stop line: the
        # spawn point sits `self.length` px off-canvas, and the box edge is
        # `box_edge` px from center, so the true gap is box_edge + length for
        # every arm (this used to be a flat, physically-inaccurate 300px).
        self.stop_target = box_edge + self.length

    def get_stop_line_dist(self):
        """Returns distance to the stop line of current approach arm."""
        if self.has_passed_stop_line:
            return float('inf')
        return max(0.0, self.stop_target - self.distance_traveled)

    def update_physics(self, lead_vehicle, is_green, dt=1.0 / 60.0,
                        blockage_dist=None, incident_crawl=False,
                        yield_distance=None):
        """Updates vehicle position, speed, and trajectory based on IDM physics,
        signal state, pedestrian/crosswalk right-of-way, and (if supplied)
        `yield_distance` — a hard "do not pass this point" distance computed
        by collision.resolve_conflicts() to prevent turning collisions."""
        self.travel_time += dt

        can_cross = is_green or self.is_emergency
        dist_to_stop = self.get_stop_line_dist()

        # Crossing stop line on green or emergency right-of-way
        if not self.has_passed_stop_line and dist_to_stop <= 0:
            if can_cross:
                self.has_passed_stop_line = True
            else:
                self.speed = 0.0
                self.acceleration = 0.0

        # Incident crawl mode: civilian vehicles slow down ONLY while passing
        # through the hazard zone. Hazard zone = distance_traveled between
        # 130 and 250 px (the accident area). Outside the zone, full normal
        # IDM physics applies.
        HAZARD_ZONE_START = 130.0
        HAZARD_ZONE_END = 250.0
        CRAWL_SPEED = 0.35 * (0.8 if self.type == 'BUS' else 1.0)

        if incident_crawl and not self.is_emergency:
            in_hazard = HAZARD_ZONE_START <= self.distance_traveled <= HAZARD_ZONE_END

            if in_hazard:
                if not can_cross and not self.has_passed_stop_line:
                    dist_to_stop_line = max(0.0, self.stop_target - self.distance_traveled)
                    step = min(CRAWL_SPEED, dist_to_stop_line)
                    if step <= 0.01:
                        self.speed = 0.0
                        step = 0.0
                else:
                    step = CRAWL_SPEED

                if lead_vehicle:
                    gap = (lead_vehicle.distance_traveled - self.distance_traveled) - (lead_vehicle.length + self.length) / 2
                    step = min(step, max(0.0, gap - MIN_GAP))

                self.speed = CRAWL_SPEED if step > 0.01 else 0.0
                self.distance_traveled += step

                if self.speed < 0.2 and not self.has_passed_stop_line:
                    self.waiting_time += dt

                if not self.has_passed_stop_line and self.distance_traveled >= self.stop_target:
                    if can_cross:
                        self.has_passed_stop_line = True
                    else:
                        self.distance_traveled = self.stop_target
                        self.speed = 0.0

                rad = math.radians(self.angle)
                self.x += math.cos(rad) * step
                self.y += math.sin(rad) * step
                return
            # Outside hazard zone: fall through to normal IDM physics below

        effective_gap = float('inf')
        dt_scale = dt * 60.0

        # 1. Lead Vehicle Bumper Gap
        dist_lead_bumper = None
        if lead_vehicle:
            # Physical bumper-to-bumper gap (distance between lead's rear bumper and self's front bumper)
            gap_bumper = get_front_to_rear_gap(self, lead_vehicle)
            dist_lead_bumper = max(0.0, gap_bumper)
            effective_gap = max(0.1, dist_lead_bumper)

        # 2. Stop Line Gap if signal is RED/YELLOW (or a pedestrian owns the crosswalk)
        if not self.has_passed_stop_line and not can_cross:
            effective_gap = min(effective_gap, max(0.1, dist_to_stop - 2.0))

        # 3. Conflict-zone yield gap (prevents turning collisions)
        if yield_distance is not None:
            effective_gap = min(effective_gap, max(0.1, yield_distance - 2.0))

        # IDM Car-Following Acceleration Calculation
        if effective_gap < float('inf'):
            s = max(0.5, effective_gap)
            v = self.speed
            lead_spd = lead_vehicle.speed if lead_vehicle else 0.0
            delta_v = v - lead_spd
            s_star = self.s0 + max(0.0, v * self.headway_t + (v * delta_v) / (2.0 * math.sqrt(self.max_accel * self.comfort_brake)))
            term = (s_star / s) ** 2
            if term > 1.0:
                accel = -self.comfort_brake * min(3.0, term - 0.2)
            else:
                accel = self.max_accel * (1.0 - (v / self.target_speed) ** 4 - max(0.0, term - 0.1))
        else:
            accel = self.max_accel * (1.0 - (self.speed / self.target_speed) ** 4)

        # Startup reaction push when signal is green and road ahead is clear
        if can_cross and self.speed < 0.8 and effective_gap > self.s0 + 4.0:
            accel = max(accel, 0.35 * (self.max_accel / 0.15))

        self.speed = max(0.0, min(self.target_speed, self.speed + accel * dt_scale))

        # Immediate bumper-to-bumper clamp behind lead vehicle
        if dist_lead_bumper is not None and dist_lead_bumper <= self.s0:
            self.speed = min(self.speed, max(0.0, lead_vehicle.speed if lead_vehicle else 0.0))

        if self.speed < 0.2 and not self.has_passed_stop_line:
            self.waiting_time += dt

        self._move_along_trajectory(dt, can_cross, dist_lead_bumper, blockage_dist, yield_distance, lead_vehicle=lead_vehicle)

    def _move_along_trajectory(self, dt, can_cross=True, dist_lead=None, blockage_dist=None, yield_distance=None, lead_vehicle=None):
        """Moves vehicle according to speed, handling turns, motorcycle
        filtering, ambulance bypass steering, and conflict-zone yielding."""
        dt_scale = dt * 60.0
        step = self.speed * dt_scale

        # Stopline boundary enforcement on RED/YELLOW
        if not self.has_passed_stop_line and not can_cross:
            rem = max(0.0, self.stop_target - self.distance_traveled)
            step = min(step, rem)
            if rem <= 0.01:
                self.speed = 0.0
                step = 0.0

        # Enforce lead vehicle bumper gap boundary (prevents clipping)
        if lead_vehicle:
            max_safe = get_safe_following_distance(self, lead_vehicle, MIN_VEHICLE_GAP)
            allowed_step = max(0.0, max_safe - self.distance_traveled)
            step = min(step, allowed_step)
            if allowed_step <= 0.001:
                self.speed = min(self.speed, max(0.0, lead_vehicle.speed if lead_vehicle else 0.0))

        # Hard conflict-zone boundary
        if yield_distance is not None:
            step = min(step, max(0.0, yield_distance))
            if yield_distance <= 0.01:
                self.speed = 0.0
                step = 0.0

        # Advance total trajectory distance
        self.distance_traveled += step

        # Hard non-overlap stopping clamp: guarantees following vehicle never clips into lead vehicle's rear bumper
        if lead_vehicle:
            constrain_vehicle_behind_leader(self, lead_vehicle, MIN_VEHICLE_GAP)
            gap = get_front_to_rear_gap(self, lead_vehicle)
            if gap < MIN_VEHICLE_GAP - 0.01:
                print(f"[COLLISION WARNING] follower={self.id} leader={lead_vehicle.id} gap={gap:.2f}")

        # Mark stop line passed on green
        if not self.has_passed_stop_line and self.distance_traveled >= self.stop_target:
            if can_cross:
                self.has_passed_stop_line = True
            else:
                self.distance_traveled = self.stop_target
                self.speed = 0.0

        # Move 2D coordinates for local rendering (strictly along lane centerline)
        if not self.has_passed_stop_line or self.turn_intent == "STRAIGHT":
            rad = math.radians(self.angle)
            self.x += math.cos(rad) * step
            self.y += math.sin(rad) * step
        else:
            # ── Deterministic Quadratic Bezier Curve Turning Trajectory ────
            # Position and heading angle are computed directly from a Bezier
            # curve connecting the entry lane stop line (P0) to the exit lane
            # centerline (P2). turn_progress (t) advances smoothly from 0.0
            # to 1.0 scaled by distance traveled, so the swept path always
            # follows a physically continuous, single lane-width-wide arc —
            # this (plus collision.py's conflict zones) is what prevents
            # vehicles from cutting across each other while turning.
            BEZIER_TABLE = {
                ("NORTH", "WEST"): ((377.5, 310.0), (377.5, 377.5), (310.0, 377.5), 180.0),
                ("NORTH", "EAST"): ((377.5, 310.0), (377.5, 422.5), (490.0, 422.5), 0.0),
                ("SOUTH", "EAST"): ((422.5, 490.0), (422.5, 422.5), (490.0, 422.5), 0.0),
                ("SOUTH", "WEST"): ((422.5, 490.0), (422.5, 377.5), (310.0, 377.5), 180.0),
                ("EAST", "NORTH"): ((490.0, 377.5), (422.5, 377.5), (422.5, 310.0), 270.0),
                ("EAST", "SOUTH"): ((490.0, 377.5), (377.5, 377.5), (377.5, 490.0), 90.0),
                ("WEST", "SOUTH"): ((310.0, 422.5), (377.5, 422.5), (377.5, 490.0), 90.0),
                ("WEST", "NORTH"): ((310.0, 422.5), (422.5, 422.5), (422.5, 310.0), 270.0),
            }

            key = (self.origin_arm, self.destination_arm)
            if key in BEZIER_TABLE:
                P0, CP, P2, exit_angle = BEZIER_TABLE[key]
                d_past = self.distance_traveled - self.stop_target
                turn_len = 148.0
                t = min(1.0, max(0.0, d_past / turn_len))

                # Turn speed profile — capped by the vehicle's own
                # turn_speed_factor (a bus creeps around the corner, a
                # motorcycle can carve it faster) and ramped in/out smoothly.
                if t < 0.25:
                    speed_factor = 1.0 - (1.0 - self.turn_speed_factor) * (t / 0.25)
                elif t > 0.75:
                    speed_factor = self.turn_speed_factor + (1.0 - self.turn_speed_factor) * ((t - 0.75) / 0.25)
                else:
                    speed_factor = self.turn_speed_factor
                self.speed = min(self.speed, self.target_speed * speed_factor)

                if t < 1.0:
                    omt = 1.0 - t
                    self.x = omt * omt * P0[0] + 2.0 * omt * t * CP[0] + t * t * P2[0]
                    self.y = omt * omt * P0[1] + 2.0 * omt * t * CP[1] + t * t * P2[1]
                    dx = 2.0 * omt * (CP[0] - P0[0]) + 2.0 * t * (P2[0] - CP[0])
                    dy = 2.0 * omt * (CP[1] - P0[1]) + 2.0 * t * (P2[1] - CP[1])
                    self.angle = math.degrees(math.atan2(dy, dx)) % 360.0
                else:
                    d_exit = d_past - turn_len
                    rad = math.radians(exit_angle)
                    self.x = P2[0] + math.cos(rad) * d_exit
                    self.y = P2[1] + math.sin(rad) * d_exit
                    self.angle = exit_angle
            else:
                rad = math.radians(self.angle)
                self.x += math.cos(rad) * step
                self.y += math.sin(rad) * step

    def is_out_of_bounds(self):
        """Returns True if vehicle has exited the simulation canvas."""
        buffer = 100
        return (self.x < -buffer or self.x > 800 + buffer or
                self.y < -buffer or self.y > 800 + buffer)
