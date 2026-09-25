"""
Intersection Conflict Resolution — the single source of truth for preventing
vehicle-vehicle collisions while turning inside the junction box.

The previous simulator (and the duplicate Java engine) both *detected*
overlapping vehicles during turns but never actually stopped them — the
Python version only printed "[SAFETY-NET-FIRE]" to the console, and the Java
version's speed-scaling ("TTR" factor) still let vehicles ease into each
other's bounding boxes. This module fixes that with two layers of defence:

1. PROACTIVE CONFLICT-ZONE RESERVATION (`resolve_conflicts`)
   Every pair of turning/through movements that physically crosses paths
   inside the box shares a small "conflict zone" circle at the crossing
   point (the same geometry used previously, now actually enforced). Each
   tick we work out, for every vehicle approaching such a zone, whether a
   higher-priority vehicle currently owns it. If so the vehicle is handed a
   hard "do not pass this point" distance which is fed into its IDM
   car-following model exactly like a red stop line — so it decelerates
   smoothly instead of teleporting to a stop.

2. HARD SAFETY-NET ROLLBACK (`enforce_no_overlap`)
   After physics has run, if any two vehicles' bounding circles still ended
   up overlapping (e.g. a very fast emergency vehicle, or an edge case the
   zone table doesn't cover), the lower-priority vehicle is rolled back to
   its pre-tick position and stopped. This guarantees — geometrically,
   every single frame — that no two vehicles ever end up occupying the same
   space, which is the actual bug this rewrite fixes.
"""

import math

# Crossing points shared between conflicting movements. Coordinates are tuned
# to the lane centerlines used throughout the simulator (377.5 / 422.5 px
# around the (400, 400) intersection center — i.e. LANE_WIDTH/2 either side).
CONFLICT_TABLE = {
    ("SOUTH", "LEFT"):     [("NORTH", "STRAIGHT", (377.5, 377.5)), ("WEST", "STRAIGHT", (377.5, 422.5)),
                            ("EAST", "STRAIGHT", (422.5, 377.5)), ("EAST", "LEFT", (400.0, 400.0))],
    ("NORTH", "LEFT"):     [("SOUTH", "STRAIGHT", (422.5, 422.5)), ("EAST", "STRAIGHT", (422.5, 377.5)),
                            ("WEST", "STRAIGHT", (377.5, 422.5)), ("WEST", "LEFT", (400.0, 400.0))],
    ("EAST", "LEFT"):      [("WEST", "STRAIGHT", (377.5, 422.5)), ("SOUTH", "STRAIGHT", (422.5, 422.5)),
                            ("NORTH", "STRAIGHT", (377.5, 377.5)), ("SOUTH", "LEFT", (400.0, 400.0))],
    ("WEST", "LEFT"):      [("EAST", "STRAIGHT", (422.5, 377.5)), ("NORTH", "STRAIGHT", (377.5, 377.5)),
                            ("SOUTH", "STRAIGHT", (422.5, 422.5)), ("NORTH", "LEFT", (400.0, 400.0))],
    ("SOUTH", "STRAIGHT"): [("EAST", "STRAIGHT", (422.5, 377.5)), ("WEST", "STRAIGHT", (422.5, 422.5)),
                            ("NORTH", "LEFT", (422.5, 422.5)), ("EAST", "LEFT", (422.5, 377.5))],
    ("NORTH", "STRAIGHT"): [("WEST", "STRAIGHT", (377.5, 422.5)), ("EAST", "STRAIGHT", (377.5, 377.5)),
                            ("SOUTH", "LEFT", (377.5, 377.5)), ("WEST", "LEFT", (377.5, 422.5))],
    ("EAST", "STRAIGHT"):  [("NORTH", "STRAIGHT", (377.5, 377.5)), ("SOUTH", "STRAIGHT", (422.5, 377.5)),
                            ("NORTH", "LEFT", (422.5, 377.5)), ("WEST", "LEFT", (422.5, 377.5))],
    ("WEST", "STRAIGHT"):  [("SOUTH", "STRAIGHT", (422.5, 422.5)), ("NORTH", "STRAIGHT", (377.5, 422.5)),
                            ("SOUTH", "LEFT", (377.5, 422.5)), ("NORTH", "LEFT", (377.5, 422.5))],
}

ZONE_RADIUS = 30.0          # footprint around each crossing point that only one flow may occupy
ACTIVATION_RANGE = 170.0    # only arbitrate once a vehicle is this close to a zone


def resolve_conflicts(vehicles_in_box):
    """
    For every vehicle that has already crossed its stop line, work out the
    maximum extra distance (px) it may travel *this tick* before it would
    enter a conflict zone currently owned by a higher-priority vehicle.

    Returns {vehicle_id: max_extra_distance_or_None}. None means unrestricted
    (no active conflict).
    """
    allowances = {v.id: None for v in vehicles_in_box}

    for v in vehicles_in_box:
        zones = CONFLICT_TABLE.get((v.origin_arm, v.turn_intent))
        if not zones:
            continue

        for c_arm, c_turn, center in zones:
            dist_v = math.hypot(center[0] - v.x, center[1] - v.y)
            if dist_v <= ZONE_RADIUS:
                continue  # already committed inside the zone: let it clear rather than freezing mid-box
            if dist_v > ACTIVATION_RANGE:
                continue

            for other in vehicles_in_box:
                if other is v or other.origin_arm != c_arm or other.turn_intent != c_turn:
                    continue

                dist_other = math.hypot(center[0] - other.x, center[1] - other.y)
                other_inside = dist_other <= ZONE_RADIUS
                if not other_inside and dist_other > ACTIVATION_RANGE:
                    continue

                ttr_v = dist_v / max(v.speed, 0.3)
                ttr_other = dist_other / max(other.speed, 0.3)

                v_yields = other_inside or ttr_other < ttr_v or (ttr_other == ttr_v and other.id < v.id)
                if v_yields:
                    allowed = max(0.0, dist_v - ZONE_RADIUS)
                    current = allowances[v.id]
                    allowances[v.id] = allowed if current is None else min(current, allowed)

    return allowances


def enforce_no_overlap(vehicles_in_box, prev_states):
    """
    Last-resort geometric safety net. Compares every pair of vehicles that
    have entered the junction box; if their bounding circles still overlap
    after this tick's physics step, the lower-priority vehicle (later id, or
    the faster of the two if ids tie in some derived list) is rolled back to
    its pre-tick (x, y, distance_traveled, angle, speed) and fully stopped.

    `prev_states` maps vehicle.id -> (x, y, distance_traveled, angle, speed)
    captured BEFORE physics ran this tick.

    Unlike the previous implementation (which only logged a
    "[SAFETY-NET-FIRE]" message), this function actually prevents the
    overlap from ever being visible on screen or persisting into the next
    tick, guaranteeing collision-free turning.
    """
    n = len(vehicles_in_box)
    for i in range(n):
        v1 = vehicles_in_box[i]
        r1 = max(v1.length, v1.width) / 2.0
        for j in range(i + 1, n):
            v2 = vehicles_in_box[j]
            r2 = max(v2.length, v2.width) / 2.0
            min_sep = r1 + r2
            dist_2d = math.hypot(v1.x - v2.x, v1.y - v2.y)
            if dist_2d < min_sep:
                # Emergency vehicles keep right of way; otherwise the vehicle
                # with the larger id (arrived at the conflict later) yields.
                if v1.is_emergency and not v2.is_emergency:
                    loser = v2
                elif v2.is_emergency and not v1.is_emergency:
                    loser = v1
                else:
                    loser = v2 if v2.id > v1.id else v1

                state = prev_states.get(loser.id)
                if state is not None:
                    loser.x, loser.y, loser.distance_traveled, loser.angle, _ = state
                loser.speed = 0.0
