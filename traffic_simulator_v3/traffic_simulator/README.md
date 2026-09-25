# SignalSync Traffic Simulator v3 — Single Source of Truth

This is a full rewrite of `traffic_simulator/` that merges everything useful
from the duplicate Java simulation logic (`optimizer-service`'s
`TrafficSimulationEngine.java` + `WebsterOptimizerService.java` +
`TrafficPredictionService.java`) into **this one Python engine**, and fixes
the vehicle-collides-while-turning bug.

## What changed vs. the old two-engine setup

**Before:** the React frontend, this Python simulator, and the Java
`optimizer-service` each had their *own* copy of vehicle physics / turning /
Webster signal-timing logic, slowly drifting out of sync. Both simulators
also had turning-collision detection code that only *logged* an overlap
(`[SAFETY-NET-FIRE]` / `[OVERLAP-BLOCKED]` in the console) instead of
actually preventing it, so vehicles visibly clipped through each other while
turning.

**Now:** all vehicle physics, turning geometry, signal phasing, PCE-weighted
Webster AI timing, the DQN signal agent and the demand predictor live only in
this Python package (`traffic_simulator/`). Anything else (the React
frontend, or the Java optimizer-service if you keep it around for other
duties like historical analytics/auth) should read state from this engine's
API instead of re-simulating anything itself:

- `GET /api/snapshot` — one-shot current state (React `Snapshot` schema)
- `WS /ws/traffic` — live push stream + command channel (emergency dispatch,
  incident toggle, adaptive/fixed mode, demand, rate, reset)
- `POST /api/control/{action}` — REST equivalent of the WS commands

If you still need the Java service for something else, point its
`TrafficWebSocketHandler` at this server's `/ws/traffic` feed and simply
relay the JSON on to its own clients, rather than running
`TrafficSimulationEngine`'s own physics loop.

## Collision-during-turning fix (`collision.py`)

Two layers, both new:

1. **Proactive conflict-zone reservation** (`resolve_conflicts`) — every pair
   of movements that crosses paths inside the box shares a small "conflict
   zone" circle at the crossing point. Each tick, a vehicle approaching a
   zone that a higher-priority vehicle currently owns is handed a hard
   "do-not-pass-this-point" distance, fed straight into its IDM
   car-following model — so it brakes smoothly, like it would for a red
   light, instead of freezing or clipping through.
2. **Hard geometric safety net** (`enforce_no_overlap`) — after physics runs,
   if two vehicles' bounding circles still overlap (e.g. an emergency
   vehicle bypassing signals), the lower-priority one is rolled back to its
   pre-tick position and stopped. This is a *guarantee*, not a log message:
   the old code detected overlaps and printed them; this code prevents them
   from ever being visible.

## Realism additions

- Per-vehicle-type physics (`config.VEHICLE_TYPES`): a **bus** accelerates
  and brakes much more gently and takes turns wider/slower than a **car**; a
  **motorcycle** accelerates quickly, brakes sharply, corners tighter, and
  can filter laterally through queued traffic before the stop line
  (`vehicle.py`'s `filter_offset` mechanic).
- The stop-line distance used to be a flat, physically-wrong `300px` for
  every vehicle/arm; it is now computed exactly from geometry
  (`box_edge + vehicle_length`).
- **Pedestrians** (`pedestrian.py`) now exist as first-class agents that
  cross during a dedicated 5th "Pedestrian Scramble" signal stage
  (`signal_controller.py`), merged in from the Java model's Barnes-Dance
  concept. Vehicles — including emergency vehicles running a red light — will
  not cross a stop line while a pedestrian is still on that arm's crosswalk.
- Webster Adaptive AI timing is now PCE-weighted (`ai_traffic_engine.py`,
  `intersection.get_arm_pce_queue`), matching the formula the Java service
  used to compute independently.

## Running it

```bash
pip install -r traffic_simulator/requirements.txt

# Interactive Pygame GUI
python -m traffic_simulator.main --mode gui --controller ai

# Headless benchmark + analytics PNG
python -m traffic_simulator.main --mode headless --duration 120

# WebSocket/REST server for the React frontend
python -m traffic_simulator.main --mode server --port 8000
```

GUI controls: `Space` pause/play, `M` switch AI/Fixed mode, `A` dispatch
ambulance on SOUTH, or use the sidebar buttons.

## File map

| File | Responsibility |
|---|---|
| `config.py` | All geometry, physics, PCE, and timing constants — single source of truth |
| `vehicle.py` | IDM car-following, per-type physics, Bezier turning, motorcycle filtering |
| `pedestrian.py` | Pedestrian crossing agents |
| `collision.py` | Conflict-zone reservation + hard anti-overlap safety net |
| `signal_controller.py` | 5-stage Indian phasing incl. pedestrian scramble, Webster AI, emergency preemption |
| `intersection.py` | Spawning (car/bus/motorcycle/ambulance/pedestrian), orchestrates physics + collision resolution each tick |
| `ai_traffic_engine.py` | DQN agent, Webster engine, demand predictor (standalone/testable) |
| `metrics.py` | Time-series metrics + Matplotlib summary report |
| `gui.py` | Pygame 2D visualisation |
| `server.py` | FastAPI/WebSocket server — the API contract other services should consume |
| `main.py` | CLI entry point (`gui` / `headless` / `server`) |
