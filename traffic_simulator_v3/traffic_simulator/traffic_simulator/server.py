"""
FastAPI & WebSocket Server for SignalSync Python AI Traffic Simulator.

This is the ONE authoritative simulation service. It replaces the need for
the optimizer-service (Java) to run its own duplicate `TrafficSimulationEngine`
— that service should instead call GET /api/snapshot or subscribe to
/ws/traffic on this server and forward the same JSON to its own clients, so
there is a single source of physics/AI truth across the whole stack.
"""

import asyncio
import json
import time
import sys
import math
import random
from typing import Set, Dict, Any
from pathlib import Path

_current_dir = Path(__file__).resolve().parent
_parent_dir = _current_dir.parent
for _p in (str(_parent_dir), str(_current_dir)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

try:
    from traffic_simulator.intersection import Intersection
    from traffic_simulator.signal_controller import SignalController
    from traffic_simulator.metrics import MetricsTracker
    from traffic_simulator.config import ARM_ORDER, DIR_PY_TO_REACT, DIR_REACT_TO_PY
except ImportError:
    from intersection import Intersection
    from signal_controller import SignalController
    from metrics import MetricsTracker
    from config import ARM_ORDER, DIR_PY_TO_REACT, DIR_REACT_TO_PY

app = FastAPI(title="SignalSync Python AI Traffic Simulator Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

intersection = Intersection()
signal_controller = SignalController(mode="ADAPTIVE_AI")
metrics = MetricsTracker()

is_running = True
simulation_rate = 1.0
gui_active = False
snapshot_seq = 0
connected_clients: Set[WebSocket] = set()

STAGE_LABELS = {
    "SOUTH": ("Stage 1: South Approach Green", "South Green", ["S->N", "S->E", "S->W"]),
    "NORTH": ("Stage 2: North Approach Green", "North Green", ["N->S", "N->W", "N->E"]),
    "EAST":  ("Stage 3: East Approach Green",  "East Green",  ["E->W", "E->N", "E->S"]),
    "WEST":  ("Stage 4: West Approach Green",  "West Green",  ["W->E", "W->S", "W->N"]),
}

VEHICLE_COLOR_MAP = {
    "AMBULANCE": "#FFFFFF",
    "BUS": "#f39c12",
    "MOTORCYCLE": "#9b59b6",
    "CAR": "#3498db",
}


def compute_react_pose(d: str, to: str, dist: float) -> Dict[str, float]:
    """Calculates exact (x, y, angle) in React's 1000x600 canvas coordinate space."""
    cx, cy, lane, half, H, W = 500.0, 300.0, 36.0, 74.0, 600.0, 1000.0
    sd = 248.0 if d in ("N", "S") else 448.0
    base_angle = {"N": math.pi / 2, "S": -math.pi / 2, "E": math.pi, "W": 0.0}[d]
    straight_to = {"N": "S", "S": "N", "E": "W", "W": "E"}[d]

    if not to or to == straight_to or dist <= sd:
        if d == "N":
            return {"x": cx - lane, "y": -50.0 + dist, "angle": math.pi / 2}
        if d == "S":
            return {"x": cx + lane, "y": H + 50.0 - dist, "angle": -math.pi / 2}
        if d == "E":
            return {"x": W + 50.0 - dist, "y": cy - lane, "angle": math.pi}
        return {"x": -50.0 + dist, "y": cy + lane, "angle": 0.0}

    d_past = dist - sd
    turn_len = 148.0
    t = min(1.0, max(0.0, d_past / turn_len))

    if d == "S":
        start = {"x": cx + lane, "y": cy + half, "a": -math.pi / 2}
        end = {"x": cx + half, "y": cy + lane, "a": 0.0} if to == "E" else {"x": cx - half, "y": cy - lane, "a": math.pi}
    elif d == "N":
        start = {"x": cx - lane, "y": cy - half, "a": math.pi / 2}
        end = {"x": cx - half, "y": cy - lane, "a": math.pi} if to == "W" else {"x": cx + half, "y": cy + lane, "a": 0.0}
    elif d == "E":
        start = {"x": cx + half, "y": cy - lane, "a": math.pi}
        end = {"x": cx + lane, "y": cy - half, "a": -math.pi / 2} if to == "N" else {"x": cx - lane, "y": cy + half, "a": math.pi / 2}
    else:  # W
        start = {"x": cx - half, "y": cy + lane, "a": 0.0}
        end = {"x": cx - lane, "y": cy + half, "a": math.pi / 2} if to == "S" else {"x": cx + lane, "y": cy - half, "a": -math.pi / 2}

    cp = {
        "x": start["x"] if d in ("S", "N") else end["x"],
        "y": end["y"] if d in ("S", "N") else start["y"]
    }

    if t < 1.0:
        omt = 1.0 - t
        x = omt * omt * start["x"] + 2.0 * omt * t * cp["x"] + t * t * end["x"]
        y = omt * omt * start["y"] + 2.0 * omt * t * cp["y"] + t * t * end["y"]
        dx = 2.0 * (1.0 - t) * (cp["x"] - start["x"]) + 2.0 * t * (end["x"] - cp["x"])
        dy = 2.0 * (1.0 - t) * (cp["y"] - start["y"]) + 2.0 * t * (end["y"] - cp["y"])
        return {"x": x, "y": y, "angle": math.atan2(dy, dx)}
    else:
        d_exit = d_past - turn_len
        x = end["x"] + math.cos(end["a"]) * d_exit
        y = end["y"] + math.sin(end["a"]) * d_exit
        return {"x": x, "y": y, "angle": end["a"]}


def format_snapshot() -> Dict[str, Any]:
    """Formats current Python simulation physics state into the React Snapshot JSON schema."""
    global snapshot_seq
    snapshot_seq += 1

    active_arm_py = signal_controller.get_active_arm()  # None during pedestrian scramble
    active_arm_react = DIR_PY_TO_REACT.get(active_arm_py) if active_arm_py else None
    signal_state = signal_controller.phase_state.lower()  # "green"/"yellow"/"all_red"/"walk"

    stage_num = (ARM_ORDER.index(active_arm_py) + 1) if active_arm_py in ARM_ORDER else 5
    label, short_label, movements = STAGE_LABELS.get(
        active_arm_py, ("Stage 5: Pedestrian Scramble", "Ped Scramble", [])
    )

    react_vehicles = []
    for arm_py in ARM_ORDER:
        arm_react = DIR_PY_TO_REACT[arm_py]
        for v in intersection.vehicles[arm_py]:
            react_stop = 248.0 if arm_py in ("NORTH", "SOUTH") else 448.0
            stop_thresh = getattr(v, 'stop_target', 300.0)
            d_trav = getattr(v, 'distance_traveled', 0.0)

            if not v.has_passed_stop_line:
                dist = min(react_stop, (min(stop_thresh, d_trav) / stop_thresh) * react_stop)
            else:
                dist = react_stop + max(0.0, d_trav - stop_thresh)

            dest_react = DIR_PY_TO_REACT.get(v.destination_arm, "N")
            col_hex = VEHICLE_COLOR_MAP.get(v.type, "#3498db")
            pose = compute_react_pose(arm_react, dest_react, dist)

            react_vehicles.append({
                "id": f"v-{v.id}",
                "dir": arm_react,
                "to": dest_react,
                "turn": v.turn_intent.lower(),
                "type": v.type.lower(),
                "dist": round(dist, 1),
                "x": round(v.x, 2),
                "y": round(v.y, 2),
                "angle": round(math.radians(v.angle), 3),
                "angle_deg": round(v.angle, 1),
                "react_x": round(pose["x"], 1),
                "react_y": round(pose["y"], 1),
                "speed": round(v.speed * 12.5, 1),
                "v": round(v.speed * 12.5, 1),
                "wait": round(v.waiting_time, 1),
                "waiting": v.waiting_time > 0,
                "stopped": v.speed < 0.5,
                "col": col_hex,
                "heavy": v.type == "BUS",
                "isAmbulance": v.is_emergency,
                "pce": v.pce,
            })

    pedestrians = []
    for arm_py in ARM_ORDER:
        arm_react = DIR_PY_TO_REACT[arm_py]
        for p in intersection.pedestrians[arm_py]:
            d = p.to_dict()
            d["arm"] = arm_react
            pedestrians.append(d)

    approaches = {}
    for arm_py in ARM_ORDER:
        arm_react = DIR_PY_TO_REACT[arm_py]
        q_len = intersection.get_arm_queue(arm_py)
        cnt = intersection.get_arm_vehicle_count(arm_py)
        wait_m = intersection.get_arm_max_wait_time(arm_py)

        level = "HIGH" if q_len >= 6 else ("MEDIUM" if q_len >= 3 else "LOW")
        is_active = (arm_py == active_arm_py)

        speeds = [v.speed * 12.5 for v in intersection.vehicles[arm_py]]
        avg_spd = round(sum(speeds) / len(speeds), 1) if speeds else (40.0 if is_active and signal_state == "green" else 0.0)
        demand_score = round(signal_controller.demand_scores.get(arm_py, q_len * 1.5 + wait_m * 0.5), 1)

        approaches[arm_react] = {
            "count": cnt,
            "queue": q_len,
            "wait": round(wait_m, 1),
            "speed": avg_spd,
            "density": min(100, q_len * 15),
            "score": demand_score,
            "level": level,
            "trend": "rising" if q_len > 4 else "easing",
            "conf": 0.94,
            "eta": round(q_len * 2.5, 1),
            "signalThrough": is_active and signal_state == "green",
            "signalRight": is_active and signal_state == "green",
            "isYellow": is_active and signal_state == "yellow"
        }

    completed_total = len(intersection.completed_vehicles)
    avg_total_wait = (sum(v['wait_time'] for v in intersection.completed_vehicles) / completed_total) if completed_total else 0.0
    baseline_wait = round(avg_total_wait * 1.35, 1) if completed_total else 0.0
    savings_calc = round(max(0.0, min(100.0, (1.0 - (avg_total_wait / baseline_wait)) * 100.0)), 1) if baseline_wait > 0 else 0.0

    j1_q = sum(intersection.get_arm_queue(arm) for arm in ARM_ORDER)
    j1_veh = sum(intersection.get_arm_vehicle_count(arm) for arm in ARM_ORDER)
    j1_load = round(min(0.95, max(0.12, (j1_q * 1.5 + j1_veh * 0.4) / 32.0)), 2)

    react_incident = None
    if intersection.incident and intersection.incident.get("active"):
        inc = intersection.incident
        react_incident = {
            "active": True,
            "type": inc.get("type", "collision"),
            "dir": DIR_PY_TO_REACT.get(inc.get("dir"), "N"),
            "lane": inc.get("lane", 0),
            "title": inc.get("title", "Collision Reported"),
            "description": inc.get("description", "Lane blocked — safety cones deployed.")
        }

    react_emergency = {
        "active": signal_controller.emergency_override,
        "dir": DIR_PY_TO_REACT.get(signal_controller.emergency_target_arm, "S") if signal_controller.emergency_override else None,
        "remaining": round(signal_controller.emergency_remaining, 1)
    }

    crosswalk_state = signal_controller.get_crosswalk_state()
    ped_ns = crosswalk_state == "WALK"
    ped_ew = crosswalk_state == "WALK"

    current_allocated_green = round(getattr(signal_controller, 'allocated_green', 25.0), 1)

    is_fixed_mode = (signal_controller.mode == "FIXED")

    snapshot = {
        "seq": snapshot_seq,
        "ts": int(time.time() * 1000),
        "junction": {"id": "J1", "name": "Gandhipuram Central (Python AI Engine)"},
        "control": {
            "adaptive": not is_fixed_mode,
            "running": is_running,
            "rate": simulation_rate,
            "cfg": {
                "minGreen": 8,
                "maxGreen": 45,
                "yellow": 3,
                "allRed": 1.5,
                "maxCycle": 140
            },
            "scenario": getattr(intersection.demand_generator, "active_scenario", "ASYMMETRIC_CORRIDOR"),
            "demand": {
                "S": intersection.spawn_rates["SOUTH"],
                "N": intersection.spawn_rates["NORTH"],
                "E": intersection.spawn_rates["EAST"],
                "W": intersection.spawn_rates["WEST"]
            }
        },
        "phase": {
            "stage": stage_num,
            "activeArm": active_arm_react if signal_state not in ("all_red", "walk") else None,
            "state": signal_state,
            "label": label,
            "shortLabel": short_label,
            "activeDirs": [active_arm_react] if active_arm_react and signal_state == "green" else [],
            "movements": movements if signal_state == "green" else [],
            "activeMovements": movements if signal_state == "green" else [],
            "pedestrianNS": ped_ns,
            "pedestrianEW": ped_ew,
            "remaining": round(signal_controller.get_remaining_time(), 1),
            "allocatedGreen": current_allocated_green,
            "phaseName": f"{active_arm_py or 'PED_SCRAMBLE'}_{signal_state.upper()}",
            "plan": {
                "S": 60.0 if is_fixed_mode else (current_allocated_green if active_arm_py == "SOUTH" else round(max(8.0, min(45.0, 10.0 + intersection.get_arm_queue("SOUTH") * 2.0)), 1)),
                "N": 60.0 if is_fixed_mode else (current_allocated_green if active_arm_py == "NORTH" else round(max(8.0, min(45.0, 10.0 + intersection.get_arm_queue("NORTH") * 2.0)), 1)),
                "E": 60.0 if is_fixed_mode else (current_allocated_green if active_arm_py == "EAST" else round(max(8.0, min(45.0, 10.0 + intersection.get_arm_queue("EAST") * 2.0)), 1)),
                "W": 60.0 if is_fixed_mode else (current_allocated_green if active_arm_py == "WEST" else round(max(8.0, min(45.0, 10.0 + intersection.get_arm_queue("WEST") * 2.0)), 1)),
                "yellow": signal_controller.yellow_duration,
                "allRed": signal_controller.all_red_duration,
                "cycle": 260 if is_fixed_mode else 98
            }
        },
        "approaches": approaches,
        "vehicles": react_vehicles,
        "pedestrians": pedestrians,
        "totals": {
            "inJunction": sum(intersection.get_arm_vehicle_count(arm) for arm in ARM_ORDER),
            "cleared": completed_total,
            "pedestriansCleared": intersection.completed_pedestrians,
            "avgWait": round(avg_total_wait, 1),
            "baselineWait": round(avg_total_wait, 1) if is_fixed_mode else baseline_wait,
            "savings": 0.0 if is_fixed_mode else savings_calc,
            "cycles": signal_controller.completed_cycles
        },
        "network": [
            {"id": "J1", "name": "Gandhipuram Central (Active)", "x": 120, "y": 140, "load": j1_load, "offset": 0},
            {"id": "J2", "name": "Lakeview Cross", "x": 340, "y": 140, "load": round(max(0.15, min(0.85, j1_load * 0.85)), 2), "offset": 12},
            {"id": "J3", "name": "Avinashi Junction", "x": 560, "y": 140, "load": round(max(0.18, min(0.90, j1_load * 0.95)), 2), "offset": 24},
            {"id": "J4", "name": "Mill Road Gate", "x": 780, "y": 140, "load": round(max(0.10, min(0.70, j1_load * 0.70)), 2), "offset": 36}
        ],
        "events": [
            {
                "kind": "emergency" if signal_controller.emergency_override else "ctl",
                "text": f"Phase {active_arm_py or 'PED_SCRAMBLE'} ({signal_state.upper()}) | Mode: {signal_controller.mode}",
                "ts": int(time.time() * 1000)
            }
        ],
        "emergency": react_emergency,
        "explain": signal_controller.generate_explainability(intersection),
        "incident": react_incident,
        "crosswalks": {
            "N": crosswalk_state, "S": crosswalk_state,
            "E": crosswalk_state, "W": crosswalk_state
        },
        "ai": {
            "model": "XGBoost",
            "enabled": signal_controller.mode == "ADAPTIVE_AI",
            "dqn_enabled": False,
            "selected_arm": getattr(signal_controller, 'selected_arm', signal_controller.get_active_arm() or "SOUTH"),
            "recommended_green": getattr(signal_controller, 'latest_recommended_green', signal_controller.allocated_green),
            "prediction_time_ms": getattr(signal_controller, 'latest_prediction_time_ms', 0.0),
            "demand_scores": getattr(signal_controller, 'demand_scores', {
                "SOUTH": 0.0, "NORTH": 0.0, "EAST": 0.0, "WEST": 0.0
            }),
        }
    }
    return snapshot


async def simulation_loop():
    """Background asyncio loop executing Python physics and streaming to React."""
    global is_running, simulation_rate, gui_active
    dt = 1.0 / 60.0
    broadcast_interval = 0.05
    time_since_broadcast = 0.0

    while True:
        await asyncio.sleep(dt)
        if is_running and not gui_active:
            eff_dt = dt * simulation_rate
            intersection.update(signal_controller, eff_dt)
            signal_controller.update(intersection, eff_dt)
            metrics.update(intersection, signal_controller, eff_dt)

        time_since_broadcast += dt
        if time_since_broadcast >= broadcast_interval:
            time_since_broadcast = 0.0
            if connected_clients:
                snap = format_snapshot()
                msg = json.dumps({"type": "METRICS_UPDATE", "data": snap})
                to_remove = set()
                for ws in connected_clients:
                    try:
                        await ws.send_text(msg)
                    except Exception:
                        to_remove.add(ws)
                connected_clients.difference_update(to_remove)


active_analytics_session_id = None

def _sync_analytics_http(snap: Dict[str, Any]):
    global active_analytics_session_id
    import urllib.request
    analytics_url = "http://localhost:8085/api/analytics"
    try:
        # Ensure session in Analytics Service
        if not active_analytics_session_id:
            req_data = json.dumps({
                "junctionId": snap.get("junction", {}).get("id", "J-101"),
                "controlMode": snap.get("control", {}).get("mode", "ADAPTIVE_AI"),
                "baselineAvgWaitSeconds": 45.0
            }).encode("utf-8")
            req = urllib.request.Request(f"{analytics_url}/sessions", data=req_data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                res_json = json.loads(resp.read().decode())
                active_analytics_session_id = res_json.get("sessionId")
                print(f"[ANALYTICS] Connected Python directly to Analytics Service. Active Session: {active_analytics_session_id}")

        if active_analytics_session_id:
            dir_map = {"N": "NORTH", "S": "SOUTH", "E": "EAST", "W": "WEST"}
            approaches = snap.get("approaches", {})
            cleared = snap.get("totals", {}).get("cleared", 0)
            for code, full in dir_map.items():
                a = approaches.get(code, {})
                metric_data = json.dumps({
                    "direction": full,
                    "vehicleCount": int(a.get("count", 0)),
                    "queueLength": int(a.get("queue", 0)),
                    "averageWaitTime": float(a.get("wait", 0.0)),
                    "maximumWaitTime": float(max(a.get("wait", 0.0) * 1.5, a.get("wait", 0.0))),
                    "averageSpeed": float(a.get("speed", 35.0)),
                    "vehiclesCleared": int(max(0, cleared // 4)),
                    "incidentBlocked": bool(snap.get("incident", {}).get("active", False) and snap.get("incident", {}).get("dir") == code)
                }).encode("utf-8")
                req = urllib.request.Request(f"{analytics_url}/sessions/{active_analytics_session_id}/approaches", data=metric_data, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=0.8):
                    pass
    except Exception:
        # Analytics service not running or offline; ignore quietly
        pass


async def analytics_sync_loop():
    """Background task syncing snapshot telemetry with Analytics Service (Port 8085)."""
    while True:
        await asyncio.sleep(5.0)
        try:
            snap = format_snapshot()
            if snap:
                await asyncio.to_thread(_sync_analytics_http, snap)
        except Exception:
            pass


@app.on_event("startup")
async def startup_event():
    model_loaded_str = "YES" if getattr(signal_controller, "model_loaded", False) else "NO"
    print(f"""
==========================================
AI TRAFFIC CONTROL
==========================================
Model: XGBoost
Mode: Adaptive Signal Timing
DQN: DISABLED
Model Loaded: {model_loaded_str}
==========================================
""")
    asyncio.create_task(simulation_loop())
    asyncio.create_task(analytics_sync_loop())


@app.websocket("/ws/traffic")
async def websocket_endpoint(websocket: WebSocket):
    global is_running, simulation_rate
    await websocket.accept()
    connected_clients.add(websocket)
    print(f"[WS] Client connected ({websocket.client}) — Total clients: {len(connected_clients)}")

    await websocket.send_text(json.dumps({"type": "METRICS_UPDATE", "data": format_snapshot()}))

    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                cmd = msg.get("type") or msg.get("action")
                payload = msg.get("payload") or msg
                print(f"[WS] Command received: '{cmd}' payload={payload}")

                if cmd in ("emergency", "dispatch_ambulance", "DISPATCH_AMBULANCE"):
                    arm_react = payload.get("dir") if isinstance(payload, dict) else None
                    if not arm_react or arm_react in ("RANDOM", "R", "ALL"):
                        arm_py = random.choice(ARM_ORDER)
                    else:
                        arm_py = DIR_REACT_TO_PY.get(arm_react, None)
                        if not arm_py or arm_py not in ARM_ORDER:
                            arm_py = random.choice(ARM_ORDER)

                    if signal_controller.emergency_override and signal_controller.emergency_target_arm == arm_py and cmd == "emergency":
                        signal_controller.clear_emergency()
                        print(f"[PREEMPTION] Cleared emergency preemption on {arm_py}")
                    else:
                        spawned_arm = intersection.spawn_emergency_vehicle(arm_py)
                        signal_controller.trigger_emergency(spawned_arm)
                        print(f"[PREEMPTION] Activated emergency green wave on {spawned_arm}")

                elif cmd in ("toggle_incident", "INCIDENT_TOGGLE"):
                    arm_react = payload.get("dir", "N")
                    arm_py = DIR_REACT_TO_PY.get(arm_react, "NORTH")
                    current_active = (intersection.incident and intersection.incident.get("active")
                                       and intersection.incident.get("dir") == arm_py)
                    intersection.set_incident(arm_py, active=not current_active)
                    print(f"[INCIDENT] Toggle incident on {arm_py} -> Active = {not current_active}")

                elif cmd in ("adaptive", "TOGGLE_ADAPTIVE", "toggle_mode"):
                    on = payload.get("on")
                    if on is not None:
                        signal_controller.mode = "ADAPTIVE_AI" if on else "FIXED"
                    else:
                        signal_controller.toggle_mode()
                    print(f"[CONTROL] Mode set to {signal_controller.mode}")

                elif cmd in ("pause", "resume", "TOGGLE_PAUSE"):
                    is_running = not is_running
                    print(f"[CONTROL] Simulation running = {is_running}")

                elif cmd in ("rate", "SET_RATE"):
                    r = payload.get("rate", 1.0)
                    simulation_rate = max(0.25, min(5.0, float(r)))
                    print(f"[CONTROL] Simulation rate set to {simulation_rate}x")

                elif cmd in ("scenario", "set_scenario", "SET_SCENARIO"):
                    sc_id = payload.get("scenario") or payload.get("id") or "ASYMMETRIC_CORRIDOR"
                    sc_applied = intersection.apply_scenario(sc_id)
                    print(f"[SCENARIO] Applied scenario via WS: {sc_id}")

                elif cmd in ("demand", "set_demand", "SET_DEMAND"):
                    arm_react = payload.get("dir")
                    val = payload.get("value") or payload.get("rate")
                    if arm_react and val is not None:
                        arm_py = DIR_REACT_TO_PY.get(arm_react, "SOUTH")
                        rate_vpm = float(val)
                        intersection.set_spawn_rate(arm_py, rate_vpm)
                        print(f"[DEMAND] Demand on {arm_py} set to {intersection.spawn_rates[arm_py]} veh/min")

                elif cmd in ("reset", "RESET_SIMULATION"):
                    intersection.completed_vehicles.clear()
                    signal_controller.completed_cycles = 0
                    print("[RESET] Reset completed vehicles and metrics")

                elif cmd == "constraints":
                    # "Send to Junction" button from PlansPage.tsx
                    min_g = payload.get("minGreen")
                    max_g = payload.get("maxGreen")
                    yellow = payload.get("yellow")
                    max_cyc = payload.get("maxCycle")
                    if min_g is not None and hasattr(signal_controller, "min_green"):
                        signal_controller.min_green = float(min_g)
                    if max_g is not None and hasattr(signal_controller, "max_green"):
                        signal_controller.max_green = float(max_g)
                    if yellow is not None and hasattr(signal_controller, "yellow_duration"):
                        signal_controller.yellow_duration = float(yellow)
                    if max_cyc is not None and hasattr(signal_controller, "max_cycle"):
                        signal_controller.max_cycle = float(max_cyc)
                    print(f"[CONSTRAINTS] Applied → minGreen={getattr(signal_controller,'min_green','?')} "
                          f"maxGreen={getattr(signal_controller,'max_green','?')} "
                          f"yellow={getattr(signal_controller,'yellow_duration','?')} "
                          f"maxCycle={getattr(signal_controller,'max_cycle','?')}")

            except Exception as e:
                print(f"[ERROR] Error handling message: {e}")

    except WebSocketDisconnect:
        connected_clients.discard(websocket)
        print(f"[WS] Client disconnected ({websocket.client}) — Remaining clients: {len(connected_clients)}")


@app.get("/api/status")
def get_status():
    return {
        "status": "ONLINE",
        "engine": "Python AI Traffic Simulator (single source of truth)",
        "mode": signal_controller.mode,
        "running": is_running,
        "rate": simulation_rate
    }


@app.get("/api/snapshot")
def get_snapshot():
    return format_snapshot()


@app.post("/api/control/{action}")
def post_control(action: str, payload: Dict[str, Any] = Body(default={})):
    global is_running, simulation_rate
    if action in ("emergency", "dispatch_ambulance"):
        arm_react = payload.get("dir") if isinstance(payload, dict) else None
        if not arm_react or arm_react in ("RANDOM", "R", "ALL"):
            arm_py = random.choice(ARM_ORDER)
        else:
            arm_py = DIR_REACT_TO_PY.get(arm_react, None)
            if not arm_py or arm_py not in ARM_ORDER:
                arm_py = random.choice(ARM_ORDER)
        spawned_arm = intersection.spawn_emergency_vehicle(arm_py)
        signal_controller.trigger_emergency(spawned_arm)
        return {"status": "SUCCESS", "action": action, "arm": spawned_arm}
    elif action in ("toggle_incident", "incident"):
        arm_react = payload.get("dir", "N")
        arm_py = DIR_REACT_TO_PY.get(arm_react, "NORTH")
        current_active = bool(intersection.incident and intersection.incident.get("active") and intersection.incident.get("dir") == arm_py)
        intersection.set_incident(arm_py, active=not current_active)
        return {"status": "SUCCESS", "active": not current_active, "arm": arm_py}
    elif action in ("adaptive", "toggle_mode"):
        on = payload.get("on")
        if on is not None:
            signal_controller.mode = "ADAPTIVE_AI" if on else "FIXED"
        else:
            signal_controller.toggle_mode()
        return {"status": "SUCCESS", "mode": signal_controller.mode}
    elif action in ("pause", "resume"):
        is_running = not is_running
        return {"status": "SUCCESS", "running": is_running}
    elif action in ("override", "manual_override"):
        arm_react = payload.get("dir") or payload.get("arm") or "N"
        arm_py = DIR_REACT_TO_PY.get(arm_react, "NORTH")
        dur = float(payload.get("duration") or payload.get("seconds") or 30.0)
        signal_controller.force_phase(arm_py, dur)
        return {"status": "SUCCESS", "action": "override", "arm": arm_py, "duration": dur}
    elif action in ("scenario", "set_scenario"):
        sc_id = payload.get("scenario") or payload.get("id") or "ASYMMETRIC_CORRIDOR"
        res = intersection.apply_scenario(sc_id)
        return {"status": "SUCCESS", "action": "scenario", "scenario": res}
    elif action in ("demand", "set_demand"):
        arm_react = payload.get("dir") or payload.get("arm")
        val = payload.get("value") or payload.get("rate")
        if arm_react and val is not None:
            arm_py = DIR_REACT_TO_PY.get(arm_react, "SOUTH")
            intersection.set_spawn_rate(arm_py, float(val))
            return {"status": "SUCCESS", "action": "demand", "arm": arm_py, "rate": intersection.spawn_rates[arm_py]}
    elif action == "rate":
        simulation_rate = max(0.25, min(5.0, float(payload.get("rate", 1.0))))
        return {"status": "SUCCESS", "rate": simulation_rate}
    return {"status": "ACK", "action": action}


@app.post("/api/prediction/update")
def post_prediction_update(payload: Dict[str, Any] = Body(default={})):
    """Receives AI traffic surge predictions from the Java Optimizer Service."""
    if not hasattr(signal_controller, "predicted_queues") or signal_controller.predicted_queues is None:
        signal_controller.predicted_queues = {}
    signal_controller.predicted_queues.update(payload)
    print(f"[PREDICTION] Received {len(payload)} approach predictions from Java Optimizer Service")
    return {"status": "SUCCESS", "received": len(payload)}


def run_server(host="0.0.0.0", port=8000):
    print(f"[START] Starting Python AI Traffic Simulator Server on http://{host}:{port}...")
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    run_server()
