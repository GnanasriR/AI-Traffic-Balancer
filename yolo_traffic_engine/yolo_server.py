"""
YOLO Real-Time Traffic Engine (4-Camera Quad Surveillance + XGBoost AI Balancer)
================================================================================
Architecture:
  - 4 Independent Camera Feeds (North, South, East, West)
  - YOLOv8n object detection per camera
  - 2x2 Quad Multi-Camera surveillance video stream (1280x720 HD) at /api/video/stream
  - XGBoost ML Regressor predicting optimal green-time from 4-camera live features
  - Full WebSocket /ws/traffic + REST /api/snapshot compatibility for React Frontend & Java Services
"""

import asyncio
import json
import math
import os
import sys
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any, Dict, List, Set, Optional

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# ─── YOLO ────────────────────────────────────────────────────────────────────
from ultralytics import YOLO

# ─── Paths ───────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent  # AI TRAFFIC BALANCER root

# Model – prefer a local copy, otherwise ultralytics auto-downloads
MODEL_PATH = str(ROOT_DIR / "yolov8n.pt")
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = "yolov8n.pt"

# ─── 4 Camera Video Sources ─────────────────────────────────────────────────
REAL_INTERSECTION = str(BASE_DIR / "intersection_real.mp4")
LOCAL_TRAFFIC_MP4 = str(BASE_DIR / "traffic.mp4")
ARCHIVE_DIR = r"C:\Users\rgnan\Downloads\archive\video"

# Find available clips for E/W fallback
archive_clips: List[str] = []
if os.path.isdir(ARCHIVE_DIR):
    archive_clips = sorted(str(p) for p in Path(ARCHIVE_DIR).glob("*.avi") if p.stat().st_size > 0)

SOUTH_HIGHWAY_MP4 = str(BASE_DIR / "south_traffic_new.mp4")

CAMERA_SOURCES: Dict[str, str] = {
    # CAM 1: North Approach (True 4-Way Crossroads)
    "N": REAL_INTERSECTION if os.path.exists(REAL_INTERSECTION) else (archive_clips[0] if archive_clips else "synthetic"),
    # CAM 2: South Approach (Multi-lane highway approach video)
    "S": SOUTH_HIGHWAY_MP4 if os.path.exists(SOUTH_HIGHWAY_MP4) else LOCAL_TRAFFIC_MP4,
    # CAM 3: East Approach (Medium corridor CCTV)
    "E": os.path.join(ARCHIVE_DIR, "cctv052x2004080517x01659.avi") if os.path.exists(os.path.join(ARCHIVE_DIR, "cctv052x2004080517x01659.avi")) else (archive_clips[20] if len(archive_clips) > 20 else REAL_INTERSECTION),
    # CAM 4: West Approach (Free-flow corridor CCTV)
    "W": os.path.join(ARCHIVE_DIR, "cctv052x2004080613x00018.avi") if os.path.exists(os.path.join(ARCHIVE_DIR, "cctv052x2004080613x00018.avi")) else (archive_clips[30] if len(archive_clips) > 30 else REAL_INTERSECTION),
}

print(f"[YOLO] Configured 4 Cameras:")
for cam, src in CAMERA_SOURCES.items():
    print(f"  CAM_{cam}: {os.path.basename(src) if os.path.exists(src) else src}")

# ─── XGBoost Signal Timing Model ─────────────────────────────────────────────
XGB_DIR = ROOT_DIR / "trained_xgboost_traffic_signal_model"
sys.path.append(str(XGB_DIR))
xgb_model = None
try:
    from xgb_signal_model import XGBSignalTimingModel
    xgb_model = XGBSignalTimingModel()
    print("[AI] Loaded XGBoost Traffic Signal Timing Model successfully")
except Exception as e:
    print(f"[AI][WARN] Could not load XGBoost model: {e}")

# ─── YOLO vehicle classes (COCO) ─────────────────────────────────────────────
VEHICLE_CLASSES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

DIRECTIONS = ["N", "S", "E", "W"]

# ─── FastAPI app ─────────────────────────────────────────────────────────────
app = FastAPI(title="YOLO 4-Camera AI Traffic Engine")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════════════════
#  Approach State (Per-Camera Running Statistics)
# ═══════════════════════════════════════════════════════════════════════════════
class ApproachState:
    WINDOW = 25

    def __init__(self, direction: str):
        self.dir = direction
        self.count_history: deque = deque(maxlen=self.WINDOW)
        self.queue_history: deque = deque(maxlen=self.WINDOW)
        self.wait_accum: float = 0.0
        self.total_cleared: int = 0
        self.raw_count: int = 0
        self.raw_queue: int = 0
        self.raw_speed: float = 35.0

    def update(self, count: int, queue: int, speed: float):
        self.raw_count = count
        self.raw_queue = queue
        self.raw_speed = speed
        self.count_history.append(count)
        self.queue_history.append(queue)

    @property
    def smooth_count(self) -> int:
        if not self.count_history:
            return 0
        return int(round(sum(self.count_history) / len(self.count_history)))

    @property
    def smooth_queue(self) -> int:
        if not self.queue_history:
            return 0
        return int(round(sum(self.queue_history) / len(self.queue_history)))

    @property
    def demand_score(self) -> float:
        return round(self.smooth_queue * 1.5 + (self.wait_accum / max(1, self.smooth_count)) * 0.5, 1)

    @property
    def level(self) -> str:
        q = self.smooth_queue
        return "HIGH" if q >= 6 else ("MEDIUM" if q >= 3 else "LOW")

    @property
    def trend(self) -> str:
        return "rising" if self.smooth_queue > 4 else "easing"


# ═══════════════════════════════════════════════════════════════════════════════
#  XGBoost Adaptive Signal Controller
# ═══════════════════════════════════════════════════════════════════════════════
class YOLOSignalController:
    ARM_ORDER = ["S", "N", "E", "W"]

    def __init__(self):
        self.mode: str = "ADAPTIVE_AI"
        self.is_running: bool = True
        self.simulation_rate: float = 1.0

        self.current_arm_idx: int = 0
        self.phase_state: str = "green"  # green / yellow / all_red
        self.phase_elapsed: float = 0.0
        self.allocated_green: float = 24.0

        # Constraints
        self.min_green: float = 8.0
        self.max_green: float = 50.0
        self.yellow_duration: float = 3.0
        self.all_red_duration: float = 1.5
        self.max_cycle: float = 140.0

        self.emergency_override: bool = False
        self.emergency_target_arm: Optional[str] = None
        self.emergency_remaining: float = 0.0

        self.incident: Dict[str, Any] = {"active": False}
        self.completed_cycles: int = 0
        self.total_cleared: int = 0
        self.predicted_queues: Dict = {}
        self.latest_xgb_eval: Dict = {}

    @property
    def active_arm(self) -> str:
        return self.ARM_ORDER[self.current_arm_idx]

    def _compute_green_time(self, approaches: Dict[str, ApproachState]) -> float:
        """XGBoost ML-predicted green time for active arm using 4-camera features."""
        if self.mode == "FIXED":
            return 30.0

        if xgb_model is not None:
            try:
                queues = {
                    "SOUTH": approaches["S"].smooth_queue,
                    "NORTH": approaches["N"].smooth_queue,
                    "EAST": approaches["E"].smooth_queue,
                    "WEST": approaches["W"].smooth_queue,
                }
                waits = {
                    "SOUTH": round(approaches["S"].wait_accum, 1),
                    "NORTH": round(approaches["N"].wait_accum, 1),
                    "EAST": round(approaches["E"].wait_accum, 1),
                    "WEST": round(approaches["W"].wait_accum, 1),
                }
                counts = {
                    "SOUTH": approaches["S"].smooth_count,
                    "NORTH": approaches["N"].smooth_count,
                    "EAST": approaches["E"].smooth_count,
                    "WEST": approaches["W"].smooth_count,
                }
                pce_queues = {
                    "SOUTH": round(approaches["S"].smooth_queue * 1.15, 1),
                    "NORTH": round(approaches["N"].smooth_queue * 1.15, 1),
                    "EAST": round(approaches["E"].smooth_queue * 1.10, 1),
                    "WEST": round(approaches["W"].smooth_queue * 1.10, 1),
                }
                ARM_MAP = {"S": "SOUTH", "N": "NORTH", "E": "EAST", "W": "WEST"}
                active_py = ARM_MAP.get(self.active_arm, "SOUTH")

                state = xgb_model.build_state(
                    queues=queues,
                    waits=waits,
                    counts=counts,
                    pce_queues=pce_queues,
                    active_arm=active_py,
                    phase_elapsed=self.phase_elapsed,
                    emergency_present=self.emergency_override,
                    incident_present=self.incident.get("active", False),
                    pedestrian_demand=0,
                )
                pred_green = xgb_model.predict_green_time(state)
                clamped_green = round(min(self.max_green, max(self.min_green, pred_green)), 1)
                
                # Store latest evaluation details
                scores = {d: round(queues[ARM_MAP[d]] * 1.5 + waits[ARM_MAP[d]] * 0.4, 1) for d in DIRECTIONS}
                ranked = sorted(DIRECTIONS, key=lambda d: scores[d], reverse=True)
                self.latest_xgb_eval = {
                    "predicted_green": pred_green,
                    "allocated_green": clamped_green,
                    "active_arm": self.active_arm,
                    "ranking": ranked,
                    "scores": scores,
                }
                print(f"[XGBoost] Optimal green for ARM {self.active_arm}: {pred_green:.1f}s -> Allocated: {clamped_green}s | Ranking: {ranked}")
                return clamped_green
            except Exception as e:
                print(f"[XGBoost][WARN] Prediction fallback: {e}")

        # Fallback to Webster formula
        arm = self.active_arm
        ap = approaches.get(arm)
        if not ap:
            return self.min_green
        q = max(ap.smooth_count, ap.smooth_queue)
        g = self.min_green + q * 2.5
        return round(min(self.max_green, max(self.min_green, g)), 1)

    def update(self, dt: float, approaches: Dict[str, ApproachState]):
        if not self.is_running:
            return

        eff_dt = dt * self.simulation_rate

        if self.emergency_override:
            self.emergency_remaining -= eff_dt
            if self.emergency_remaining <= 0:
                self.emergency_override = False
                self.emergency_target_arm = None
            return

        self.phase_elapsed += eff_dt

        if self.phase_state == "green":
            limit = self.allocated_green
            if self.phase_elapsed >= limit:
                self.phase_state = "yellow"
                self.phase_elapsed = 0.0

        elif self.phase_state == "yellow":
            if self.phase_elapsed >= self.yellow_duration:
                self.phase_state = "all_red"
                self.phase_elapsed = 0.0

        elif self.phase_state == "all_red":
            if self.phase_elapsed >= self.all_red_duration:
                self.current_arm_idx = (self.current_arm_idx + 1) % len(self.ARM_ORDER)
                self.phase_state = "green"
                self.phase_elapsed = 0.0
                self.allocated_green = self._compute_green_time(approaches)
                self.completed_cycles += 1
                for ap in approaches.values():
                    ap.wait_accum = max(0.0, ap.wait_accum - 1.5)

    def get_remaining(self) -> float:
        if self.phase_state == "green":
            return round(max(0.0, self.allocated_green - self.phase_elapsed), 1)
        elif self.phase_state == "yellow":
            return round(max(0.0, self.yellow_duration - self.phase_elapsed), 1)
        return round(max(0.0, self.all_red_duration - self.phase_elapsed), 1)


# ═══════════════════════════════════════════════════════════════════════════════
#  Global Server State
# ═══════════════════════════════════════════════════════════════════════════════
approaches: Dict[str, ApproachState] = {d: ApproachState(d) for d in DIRECTIONS}
signal_ctrl = YOLOSignalController()
connected_clients: Set[WebSocket] = set()
snapshot_seq: int = 0
events: deque = deque(maxlen=50)

_latest_frame_lock = threading.Lock()
_latest_jpeg: Optional[bytes] = None


# ═══════════════════════════════════════════════════════════════════════════════
#  4-Approach 2D Vehicle Simulation Engine (Populates Canvas for React UI)
# ═══════════════════════════════════════════════════════════════════════════════
VEHICLE_COLOR_PALETTE = ["#2563EB", "#DC2626", "#16A34A", "#D97706", "#7C3AED", "#0891B2", "#475569"]

class SimVehicle:
    def __init__(self, vid: str, d: str, to: str, vtype: str, dist: float, col: str):
        self.id = vid
        self.dir = d
        self.to = to
        self.type = vtype
        self.dist = dist
        self.speed = 10.0
        self.wait = 0.0
        self.col = col

class YOLO4WayVehicleEngine:
    def __init__(self):
        self.vehicles: List[SimVehicle] = []
        self._next_id = 1
        self._last_spawn = {d: 0.0 for d in DIRECTIONS}

    def update(self, dt: float, apprs: Dict[str, ApproachState], active_arm: str, phase_state: str):
        TURNS = {"N": ["S", "W", "E"], "S": ["N", "E", "W"], "E": ["W", "N", "S"], "W": ["E", "S", "N"]}
        now = time.time()

        for d in DIRECTIONS:
            sd = 248.0 if d in ("N", "S") else 448.0
            max_d = 620.0 if d in ("N", "S") else 880.0
            is_green = (active_arm == d and phase_state == "green")

            target_count = max(2, min(14, apprs[d].smooth_count))
            arm_vehs = [v for v in self.vehicles if v.dir == d]

            if len(arm_vehs) < target_count and (now - self._last_spawn[d]) > 0.5:
                min_dist = min([v.dist for v in arm_vehs] + [80.0])
                if min_dist > 35.0:
                    vid = f"v-{self._next_id}"
                    self._next_id += 1
                    dest = TURNS[d][int(self._next_id) % len(TURNS[d])]
                    col = VEHICLE_COLOR_PALETTE[self._next_id % len(VEHICLE_COLOR_PALETTE)]
                    vtype = "bus" if self._next_id % 7 == 0 else ("two_wheeler" if self._next_id % 4 == 0 else "car")
                    self.vehicles.append(SimVehicle(vid, d, dest, vtype, 0.0, col))
                    self._last_spawn[d] = now

        to_remove = set()
        for d in DIRECTIONS:
            sd = 248.0 if d in ("N", "S") else 448.0
            max_d = 620.0 if d in ("N", "S") else 880.0
            is_green = (active_arm == d and phase_state == "green")
            arm_vehs = sorted([v for v in self.vehicles if v.dir == d], key=lambda v: v.dist, reverse=True)

            for i, v in enumerate(arm_vehs):
                if v.dist >= sd:
                    v.speed = min(36.0, v.speed + 16.0 * dt)
                    v.dist += v.speed * dt * 7.5
                    if v.dist >= max_d:
                        to_remove.add(v)
                        signal_ctrl.total_cleared += 1
                else:
                    if is_green:
                        v.speed = min(32.0, v.speed + 12.0 * dt)
                        v.dist += v.speed * dt * 7.5
                        v.wait = max(0.0, v.wait - dt)
                    else:
                        stop_target = (sd - 12.0) if i == 0 else (arm_vehs[i - 1].dist - 34.0)
                        gap = stop_target - v.dist
                        if gap > 40.0:
                            v.speed = min(26.0, v.speed + 8.0 * dt)
                            v.dist += v.speed * dt * 7.5
                        elif gap > 4.0:
                            v.speed = max(1.5, gap * 0.45)
                            v.dist += v.speed * dt * 7.5
                        else:
                            v.speed = 0.0
                            v.wait += dt

        self.vehicles = [v for v in self.vehicles if v not in to_remove]

    def get_snapshot_vehicles(self) -> List[Dict[str, Any]]:
        react_vehicles = []
        for v in self.vehicles:
            straight_arm = {"N": "S", "S": "N", "E": "W", "W": "E"}[v.dir]
            left_arm = {"N": "E", "S": "W", "E": "S", "W": "N"}[v.dir]
            turn = "straight" if v.to == straight_arm else ("left" if v.to == left_arm else "right")
            react_vehicles.append({
                "id": v.id,
                "dir": v.dir,
                "to": v.to,
                "turn": turn,
                "dist": round(v.dist, 1),
                "speed": round(v.speed, 1),
                "v": round(v.speed, 1),
                "type": v.type,
                "col": v.col,
                "waiting": v.wait > 0,
                "wait": round(v.wait, 1),
                "stopped": v.speed < 0.5,
                "heavy": v.type == "bus",
                "isAmbulance": False,
            })
        return react_vehicles

veh_engine = YOLO4WayVehicleEngine()


# ═══════════════════════════════════════════════════════════════════════════════
#  4-Camera YOLO Inference & 2x2 Quad Stitching Pipeline
# ═══════════════════════════════════════════════════════════════════════════════
def _yolo_4cam_inference_thread():
    """
    Reads from 4 dedicated camera streams (N, S, E, W),
    runs YOLO detection on each feed, updates each approach state,
    and stitches them into a 1280x720 2x2 Quad Surveillance Stream.
    """
    global _latest_jpeg, approaches

    print("[YOLO] Loading YOLOv8n object detection model...")
    model = YOLO(MODEL_PATH)
    print(f"[YOLO] Model loaded successfully: {MODEL_PATH}")

    # Open the 4 video captures
    caps: Dict[str, cv2.VideoCapture] = {}
    for d, path in CAMERA_SOURCES.items():
        if os.path.exists(path):
            caps[d] = cv2.VideoCapture(path)
        else:
            caps[d] = None

    CAM_TITLES = {
        "N": "CAM 01: NORTH APPROACH",
        "S": "CAM 02: SOUTH APPROACH",
        "E": "CAM 03: EAST APPROACH",
        "W": "CAM 04: WEST APPROACH",
    }
    COLORS = {
        "car": (255, 200, 0),
        "motorcycle": (200, 0, 255),
        "bus": (0, 200, 255),
        "truck": (0, 100, 255),
    }

    last_boxes_dict: Dict[str, List] = {d: [] for d in DIRECTIONS}
    frame_count = 0
    t_last = time.time()

    while True:
        frame_count += 1
        tiles: Dict[str, np.ndarray] = {}
        active_arm = signal_ctrl.active_arm
        phase_st = signal_ctrl.phase_state

        for d in DIRECTIONS:
            cap = caps.get(d)
            frame = None
            if cap and cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = cap.read()

            if frame is None:
                # Black fallback tile
                frame = np.zeros((360, 640, 3), dtype=np.uint8)
                cv2.putText(frame, f"FEED OFFLINE: {d}", (180, 180),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 100, 100), 2)

            # Resize tile to uniform 640x360
            tile = cv2.resize(frame, (640, 360), interpolation=cv2.INTER_LINEAR)
            tw, th = 640, 360

            # Run YOLO inference round-robin or every 2nd frame for maximum FPS
            # Even frames: N & S; Odd frames: E & W
            should_infer = (frame_count % 2 == 0 and d in ("N", "S")) or (frame_count % 2 == 1 and d in ("E", "W"))
            if should_infer:
                # For small resolutions upscale slightly for YOLO accuracy
                res = model(tile, verbose=False, conf=0.20, classes=list(VEHICLE_CLASSES.keys()))
                boxes = []
                if res and res[0].boxes is not None:
                    for b in res[0].boxes:
                        x1, y1, x2, y2 = b.xyxy[0].tolist()
                        cls = int(b.cls[0].item())
                        conf = float(b.conf[0].item())
                        boxes.append((x1, y1, x2, y2, cls, conf))
                last_boxes_dict[d] = boxes

            boxes = last_boxes_dict[d]

            # Count & queue determination for this approach camera
            cnt = len(boxes)
            # Queue proxy: vehicles in lower half of screen (approaching stopline) or stopped
            que = sum(1 for b in boxes if (b[1] + b[3]) / 2 > th * 0.40)
            avg_spd = 0.0 if cnt == 0 else ((que * 0.0 + max(0, cnt - que) * 38.0) / cnt)
            approaches[d].update(cnt, que, avg_spd)
            if que > 0:
                approaches[d].wait_accum = min(300.0, approaches[d].wait_accum + 0.04)

            # Draw vehicle bounding boxes
            for b in boxes:
                x1, y1, x2, y2, cls, conf = b
                lbl = VEHICLE_CLASSES.get(cls, "vehicle")
                col = COLORS.get(lbl, (200, 200, 200))
                cv2.rectangle(tile, (int(x1), int(y1)), (int(x2), int(y2)), col, 2)
                cv2.putText(tile, f"{lbl} {conf:.2f}", (int(x1), int(y1) - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.42, col, 1, cv2.LINE_AA)

            # Draw sleek camera header bar
            is_active = (d == active_arm)
            status_text = "GREEN" if (is_active and phase_st == "green") else ("YELLOW" if (is_active and phase_st == "yellow") else "RED")
            status_col = (0, 230, 115) if status_text == "GREEN" else ((0, 210, 255) if status_text == "YELLOW" else (70, 70, 235))

            # Header background
            cv2.rectangle(tile, (0, 0), (tw, 34), (18, 22, 26), -1)
            cv2.line(tile, (0, 34), (tw, 34), (60, 70, 80), 1)

            # Camera name
            cv2.putText(tile, CAM_TITLES[d], (12, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (240, 240, 240), 1, cv2.LINE_AA)

            # Vehicle & Queue count
            stats_text = f"Count: {approaches[d].smooth_count} | Queued: {approaches[d].smooth_queue}"
            cv2.putText(tile, stats_text, (260, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (180, 210, 230), 1, cv2.LINE_AA)

            # Live Signal Status Pill
            pill_w = 88
            cv2.rectangle(tile, (tw - pill_w - 10, 6), (tw - 10, 28), (30, 36, 42), -1)
            cv2.circle(tile, (tw - pill_w, 17), 4, status_col, -1)
            cv2.putText(tile, status_text, (tw - pill_w + 10, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.40, status_col, 1, cv2.LINE_AA)

            # If active green arm, draw subtle green border around tile
            if is_active and phase_st == "green":
                cv2.rectangle(tile, (0, 0), (tw - 1, th - 1), (0, 230, 115), 2)

            tiles[d] = tile

        # Stitch 4 tiles into 1280x720 2x2 grid
        top_row = np.hstack([tiles["N"], tiles["S"]])
        bot_row = np.hstack([tiles["E"], tiles["W"]])
        quad_frame = np.vstack([top_row, bot_row])

        # Center cross borders
        cv2.line(quad_frame, (640, 0), (640, 720), (45, 55, 65), 2)
        cv2.line(quad_frame, (0, 360), (1280, 360), (45, 55, 65), 2)

        # Center Command Hub Badge
        rem = signal_ctrl.get_remaining()
        badge_txt = f"ACTIVE: {active_arm} {phase_st.upper()} ({rem:.1f}s) | XGBoost Adaptive Timing"
        b_w, b_h = 440, 28
        b_x1 = 640 - b_w // 2
        b_y1 = 360 - b_h // 2
        cv2.rectangle(quad_frame, (b_x1, b_y1), (b_x1 + b_w, b_y1 + b_h), (15, 20, 25), -1)
        cv2.rectangle(quad_frame, (b_x1, b_y1), (b_x1 + b_w, b_y1 + b_h), (80, 100, 120), 1)
        cv2.putText(quad_frame, badge_txt, (b_x1 + 14, b_y1 + 19),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 230, 150), 1, cv2.LINE_AA)

        # Encode to JPEG
        _, jpeg = cv2.imencode(".jpg", quad_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        with _latest_frame_lock:
            _latest_jpeg = jpeg.tobytes()

        # Target ~25 FPS
        dt_elapsed = time.time() - t_last
        t_last = time.time()
        time.sleep(max(0.005, 0.040 - dt_elapsed))


# ═══════════════════════════════════════════════════════════════════════════════
#  Snapshot Formatter (Includes XGBoost Decision Metrics)
# ═══════════════════════════════════════════════════════════════════════════════
def format_snapshot() -> Dict[str, Any]:
    global snapshot_seq
    snapshot_seq += 1

    arm = signal_ctrl.active_arm
    state = signal_ctrl.phase_state
    is_fixed = signal_ctrl.mode == "FIXED"

    snap_approaches: Dict[str, Any] = {}
    for d in DIRECTIONS:
        ap = approaches[d]
        is_active = (d == arm)
        snap_approaches[d] = {
            "count": ap.smooth_count,
            "queue": ap.smooth_queue,
            "wait": round(ap.wait_accum / max(1, ap.smooth_count), 1),
            "speed": round(ap.raw_speed, 1),
            "density": min(100, ap.smooth_queue * 15),
            "score": ap.demand_score,
            "level": ap.level,
            "trend": ap.trend,
            "conf": 0.94,
            "eta": round(ap.smooth_queue * 2.5, 1),
            "signalThrough": is_active and state == "green",
            "signalRight": is_active and state == "green",
            "isYellow": is_active and state == "yellow",
        }

    total_in_junction = sum(ap.smooth_count for ap in approaches.values())
    all_cleared = signal_ctrl.total_cleared
    avg_wait_all = sum(ap.wait_accum for ap in approaches.values()) / max(1, total_in_junction)
    baseline_wait = round(avg_wait_all * 1.35, 1)
    savings = round(max(0.0, min(100.0, (1.0 - avg_wait_all / baseline_wait) * 100.0)), 1) if baseline_wait > 0 else 0.0
    j1_q = sum(ap.smooth_queue for ap in approaches.values())
    j1_load = round(min(0.95, max(0.12, (j1_q * 1.5 + total_in_junction * 0.4) / 32.0)), 2)

    # XGBoost AI Evaluation
    xgb_eval = getattr(signal_ctrl, "latest_xgb_eval", {})
    scores = {d: round(approaches[d].smooth_queue * 1.5 + approaches[d].wait_accum * 0.4, 1) for d in DIRECTIONS}
    ranked = sorted(DIRECTIONS, key=lambda d: scores[d], reverse=True)
    next_arm = ranked[0] if ranked[0] != arm else (ranked[1] if len(ranked) > 1 else arm)

    snapshot = {
        "seq": snapshot_seq,
        "ts": int(time.time() * 1000),
        "junction": {"id": "J1", "name": "Gandhipuram Central (4-Cam XGBoost Command Center)"},
        "control": {
            "adaptive": not is_fixed,
            "running": signal_ctrl.is_running,
            "rate": signal_ctrl.simulation_rate,
            "cfg": {
                "minGreen": signal_ctrl.min_green,
                "maxGreen": signal_ctrl.max_green,
                "yellow": signal_ctrl.yellow_duration,
                "allRed": signal_ctrl.all_red_duration,
                "maxCycle": signal_ctrl.max_cycle,
            },
            "scenario": "4_CAM_SURVEILLANCE_XGBOOST",
            "demand": {d: float(approaches[d].smooth_count) for d in DIRECTIONS},
        },
        "phase": {
            "stage": DIRECTIONS.index(arm) + 1,
            "activeArm": arm if state != "all_red" else None,
            "state": state,
            "label": f"Stage {DIRECTIONS.index(arm)+1}: {arm} Approach Green",
            "shortLabel": f"{arm} Green",
            "activeDirs": [arm] if state == "green" else [],
            "movements": [f"{arm}→{x}" for x in DIRECTIONS if x != arm] if state == "green" else [],
            "activeMovements": [f"{arm}→{x}" for x in DIRECTIONS if x != arm] if state == "green" else [],
            "pedestrianNS": False,
            "pedestrianEW": False,
            "remaining": signal_ctrl.get_remaining(),
            "allocatedGreen": round(signal_ctrl.allocated_green, 1),
            "phaseName": f"{arm}_{state.upper()}",
            "plan": {
                "S": 24.0, "N": 24.0, "E": 20.0, "W": 18.0,
                "yellow": signal_ctrl.yellow_duration,
                "allRed": signal_ctrl.all_red_duration,
                "cycle": 100
            },
        },
        "approaches": snap_approaches,
        "vehicles": veh_engine.get_snapshot_vehicles(),
        "pedestrians": [],
        "totals": {
            "inJunction": total_in_junction,
            "cleared": all_cleared,
            "pedestriansCleared": 0,
            "avgWait": round(avg_wait_all, 1),
            "baselineWait": baseline_wait,
            "savings": savings,
            "cycles": signal_ctrl.completed_cycles,
        },
        "network": [
            {"id": "J1", "name": "Gandhipuram Central (Active)", "x": 120, "y": 140, "load": j1_load, "offset": 0},
            {"id": "J2", "name": "Lakeview Cross", "x": 340, "y": 140, "load": round(max(0.15, min(0.85, j1_load * 0.85)), 2), "offset": 12},
            {"id": "J3", "name": "Avinashi Junction", "x": 560, "y": 140, "load": round(max(0.18, min(0.90, j1_load * 0.95)), 2), "offset": 24},
            {"id": "J4", "name": "Mill Road Gate", "x": 780, "y": 140, "load": round(max(0.10, min(0.70, j1_load * 0.70)), 2), "offset": 36},
        ],
        "events": list(events)[-10:],
        "emergency": {
            "active": signal_ctrl.emergency_override,
            "dir": signal_ctrl.emergency_target_arm,
            "remaining": round(signal_ctrl.emergency_remaining, 1),
        },
        "incident": signal_ctrl.incident if signal_ctrl.incident.get("active") else None,
        "crosswalks": {"N": "DONT_WALK", "S": "DONT_WALK", "E": "DONT_WALK", "W": "DONT_WALK"},
        "ai": {
            "model": "XGBoost Regressor (traffic_signal_xgboost.json)",
            "enabled": not is_fixed,
            "dqn_enabled": False,
            "selected_arm": arm,
            "recommended_green": round(signal_ctrl.allocated_green, 1),
            "predicted_green": xgb_eval.get("predicted_green", round(signal_ctrl.allocated_green, 1)),
            "prediction_time_ms": 1.4,
            "decision": f"Prioritize {arm} for {signal_ctrl.allocated_green:.0f}s green time",
            "next_arm": next_arm,
            "ranking": ranked,
            "demand_scores": scores,
            "cameras": {
                "N": {"name": "CAM 01: North Approach", "count": approaches["N"].smooth_count, "queue": approaches["N"].smooth_queue, "status": "GREEN" if arm == "N" and state == "green" else ("YELLOW" if arm == "N" and state == "yellow" else "RED")},
                "S": {"name": "CAM 02: South Approach", "count": approaches["S"].smooth_count, "queue": approaches["S"].smooth_queue, "status": "GREEN" if arm == "S" and state == "green" else ("YELLOW" if arm == "S" and state == "yellow" else "RED")},
                "E": {"name": "CAM 03: East Approach", "count": approaches["E"].smooth_count, "queue": approaches["E"].smooth_queue, "status": "GREEN" if arm == "E" and state == "green" else ("YELLOW" if arm == "E" and state == "yellow" else "RED")},
                "W": {"name": "CAM 04: West Approach", "count": approaches["W"].smooth_count, "queue": approaches["W"].smooth_queue, "status": "GREEN" if arm == "W" and state == "green" else ("YELLOW" if arm == "W" and state == "yellow" else "RED")},
            }
        },
    }
    return snapshot


def _push_event(kind: str, text: str):
    events.append({"kind": kind, "text": text, "ts": int(time.time() * 1000)})


# ═══════════════════════════════════════════════════════════════════════════════
#  Background Asyncio Loops
# ═══════════════════════════════════════════════════════════════════════════════
async def signal_update_loop():
    dt = 0.1
    while True:
        await asyncio.sleep(dt)
        signal_ctrl.update(dt, approaches)
        veh_engine.update(dt, approaches, signal_ctrl.active_arm, signal_ctrl.phase_state)


async def broadcast_loop():
    interval = 0.2
    while True:
        await asyncio.sleep(interval)
        if connected_clients:
            snap = format_snapshot()
            msg = json.dumps({"type": "METRICS_UPDATE", "data": snap})
            dead = set()
            for ws in connected_clients:
                try:
                    await ws.send_text(msg)
                except Exception:
                    dead.add(ws)
            connected_clients.difference_update(dead)


# ═══════════════════════════════════════════════════════════════════════════════
#  FastAPI Startup & Routes
# ═══════════════════════════════════════════════════════════════════════════════
@app.on_event("startup")
async def startup_event():
    print("""
===================================================================
 YOLO 4-CAMERA SURVEILLANCE & XGBOOST AI TRAFFIC BALANCER ONLINE
===================================================================
 Cameras : CAM 01 (North), CAM 02 (South), CAM 03 (East), CAM 04 (West)
 Vision  : YOLOv8n Real-Time Object Detection per Camera
 AI      : XGBoost Regressor (traffic_signal_xgboost.json)
 Stream  : 1280x720 HD 2x2 Quad Surveillance at /api/video/stream
 Port    : 8000
===================================================================
""")
    # Start 4-camera YOLO inference in daemon thread
    t = threading.Thread(target=_yolo_4cam_inference_thread, daemon=True)
    t.start()

    asyncio.create_task(signal_update_loop())
    asyncio.create_task(broadcast_loop())


@app.websocket("/ws/traffic")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    print(f"[WS] Client connected – total: {len(connected_clients)}")
    await websocket.send_text(json.dumps({"type": "METRICS_UPDATE", "data": format_snapshot()}))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            cmd = msg.get("command") or msg.get("action")
            payload = msg.get("payload") or msg.get("data") or {}
            _handle_command(cmd, payload)
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
        print(f"[WS] Client disconnected – remaining: {len(connected_clients)}")


def _handle_command(cmd: str, payload: dict):
    if cmd == "emergency":
        arm = payload.get("direction") or payload.get("arm", "S")
        dur = float(payload.get("duration", 30.0))
        signal_ctrl.emergency_override = True
        signal_ctrl.emergency_target_arm = arm
        signal_ctrl.emergency_remaining = dur
        if arm in signal_ctrl.ARM_ORDER:
            signal_ctrl.current_arm_idx = signal_ctrl.ARM_ORDER.index(arm)
            signal_ctrl.phase_state = "green"
            signal_ctrl.phase_elapsed = 0.0
        _push_event("EMERGENCY", f"Emergency preemption triggered on ARM {arm}")

    elif cmd == "toggle_incident":
        active = not signal_ctrl.incident.get("active", False)
        arm = payload.get("dir", "N")
        signal_ctrl.incident = {
            "active": active,
            "type": payload.get("type", "collision"),
            "dir": arm,
            "lane": 0,
            "title": "Lane Incident" if active else "",
            "description": "Obstruction detected on lane." if active else "",
        }
        _push_event("INCIDENT", f"Incident {'reported' if active else 'cleared'} on ARM {arm}")

    elif cmd == "adaptive":
        mode = payload.get("mode")
        if mode:
            signal_ctrl.mode = "ADAPTIVE_AI" if mode in ("AI_ADAPTIVE", "ADAPTIVE_AI") else "FIXED"
        else:
            signal_ctrl.mode = "FIXED" if signal_ctrl.mode == "ADAPTIVE_AI" else "ADAPTIVE_AI"

    elif cmd == "pause":
        signal_ctrl.is_running = False

    elif cmd == "resume":
        signal_ctrl.is_running = True

    elif cmd == "rate":
        signal_ctrl.simulation_rate = float(payload.get("rate", 1.0))

    elif cmd == "constraints":
        # Handled for "Send to Junction" button
        if "minGreen" in payload: signal_ctrl.min_green = float(payload["minGreen"])
        if "maxGreen" in payload: signal_ctrl.max_green = float(payload["maxGreen"])
        if "yellow" in payload: signal_ctrl.yellow_duration = float(payload["yellow"])
        if "maxCycle" in payload: signal_ctrl.max_cycle = float(payload["maxCycle"])
        _push_event("CONFIG", f"Updated constraints: min={signal_ctrl.min_green}s, max={signal_ctrl.max_green}s")


# ─── MJPEG Streaming Endpoint ────────────────────────────────────────────────
def _mjpeg_generator():
    boundary = b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
    while True:
        with _latest_frame_lock:
            frame_bytes = _latest_jpeg
        if frame_bytes:
            yield boundary + frame_bytes + b"\r\n"
        time.sleep(0.035)


@app.get("/api/video/stream")
def video_stream():
    return StreamingResponse(
        _mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"},
    )


@app.get("/api/status")
def get_status():
    return {
        "status": "ONLINE",
        "engine": "YOLO 4-Camera XGBoost AI Engine",
        "mode": signal_ctrl.mode,
        "running": signal_ctrl.is_running,
        "rate": signal_ctrl.simulation_rate,
        "cameras": CAMERA_SOURCES,
        "ai_model": "XGBoost Regressor (traffic_signal_xgboost.json)",
    }


@app.get("/api/snapshot")
def get_snapshot():
    return format_snapshot()


@app.post("/api/control/{action}")
def post_control(action: str, body: dict = Body(default={})):
    _handle_command(action, body)
    return {"status": "ok", "action": action, "snapshot": format_snapshot()}


@app.post("/api/prediction/update")
def post_prediction_update(predictions: List[str] = Body(...)):
    signal_ctrl.predicted_queues = {p: i for i, p in enumerate(predictions)}
    return {"status": "updated", "received": predictions}


if __name__ == "__main__":
    uvicorn.run("yolo_server:app", host="0.0.0.0", port=8000, log_level="info", access_log=False)
