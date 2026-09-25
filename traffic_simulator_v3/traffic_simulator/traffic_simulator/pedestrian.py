"""
Pedestrian agents. Pedestrians wait at the corners of the junction and cross
during the dedicated PED_SCRAMBLE signal stage (all vehicle approaches RED),
matching the "Barnes Dance" scramble crossing pattern used by the Java
optimizer-service's model and folded here into the single Python engine.
"""

import math
import random

from traffic_simulator.config import (
    CENTER_X, CENTER_Y, ROAD_WIDTH, PEDESTRIAN_SPEED_PX, CROSSWALK_SETBACK
)


class Pedestrian:
    _id_counter = 1

    def __init__(self, crossing_arm):
        self.id = Pedestrian._id_counter
        Pedestrian._id_counter += 1

        self.crossing_arm = crossing_arm  # which approach's carriageway this ped walks across
        self.progress = 0.0               # 0.0 (curb) -> 1.0 (opposite curb)
        self.speed = PEDESTRIAN_SPEED_PX * random.uniform(0.85, 1.2)
        self.direction = random.choice([1, -1])

        self._init_path()

    def _init_path(self):
        half_road = ROAD_WIDTH / 2.0

        if self.crossing_arm == "NORTH":
            y = CENTER_Y - half_road - CROSSWALK_SETBACK
            x0, x1 = CENTER_X - half_road, CENTER_X + half_road
        elif self.crossing_arm == "SOUTH":
            y = CENTER_Y + half_road + CROSSWALK_SETBACK
            x0, x1 = CENTER_X - half_road, CENTER_X + half_road
        elif self.crossing_arm == "EAST":
            x = CENTER_X + half_road + CROSSWALK_SETBACK
            y0, y1 = CENTER_Y - half_road, CENTER_Y + half_road
        else:  # WEST
            x = CENTER_X - half_road - CROSSWALK_SETBACK
            y0, y1 = CENTER_Y - half_road, CENTER_Y + half_road

        if self.crossing_arm in ("NORTH", "SOUTH"):
            if self.direction < 0:
                x0, x1 = x1, x0
            self.start = (x0, y)
            self.end = (x1, y)
        else:
            if self.direction < 0:
                y0, y1 = y1, y0
            self.start = (x, y0)
            self.end = (x, y1)

        self.x, self.y = self.start
        self._path_len = max(1.0, math.hypot(self.end[0] - self.start[0], self.end[1] - self.start[1]))

    def update(self, dt):
        dt_scale = dt * 60.0
        step_progress = (self.speed * dt_scale) / self._path_len
        self.progress = min(1.0, self.progress + step_progress)
        self.x = self.start[0] + (self.end[0] - self.start[0]) * self.progress
        self.y = self.start[1] + (self.end[1] - self.start[1]) * self.progress

    def is_done(self):
        return self.progress >= 1.0

    def to_dict(self):
        return {
            "id": self.id,
            "arm": self.crossing_arm,
            "x": round(self.x, 1),
            "y": round(self.y, 1),
            "progress": round(self.progress, 2),
            "start": [round(self.start[0], 1), round(self.start[1], 1)],
            "end": [round(self.end[0], 1), round(self.end[1], 1)],
            "direction": self.direction,
            "is_done": self.is_done(),
        }
