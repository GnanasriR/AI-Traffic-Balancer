"""
SignalSync Python AI Traffic Simulator — Main Entry Point.
Supports both Visual GUI (Pygame) and Fast Headless CLI Benchmark modes.
"""

import argparse
import os
import sys
import time
from pathlib import Path

# Ensure root directory is in sys.path
root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from traffic_simulator.intersection import Intersection
from traffic_simulator.signal_controller import SignalController
from traffic_simulator.metrics import MetricsTracker

def run_headless(duration_sec=60, controller_mode="ADAPTIVE_AI", save_plot=True, seed=None):
    """Executes fast headless CLI simulation benchmark."""
    print(f"\n==================================================")
    print(f"   SignalSync AI Traffic Simulator (Headless Mode)   ")
    print(f"==================================================")
    print(f"• Control Mode: {controller_mode}")
    print(f"• Target Duration: {duration_sec} seconds")
    print(f"• Random Seed: {seed if seed is not None else 'Unseeded (Stochastic)'}")
    print(f"• Simulating 60 Hz physics step loop...\n")

    intersection = Intersection(seed=seed)
    signal_controller = SignalController(mode=controller_mode)
    metrics = MetricsTracker()

    model_loaded_str = "YES" if getattr(signal_controller, "model_loaded", False) else "NO"
    print(f"""==========================================
AI TRAFFIC CONTROL
==========================================
Model: XGBoost
Mode: Adaptive Signal Timing
DQN: DISABLED
Model Loaded: {model_loaded_str}
==========================================
""")

    dt = 1.0 / 60.0
    total_steps = int(duration_sec * 60)

    start_wall = time.time()
    for step in range(total_steps):
        intersection.update(signal_controller, dt)
        signal_controller.update(intersection, dt)
        metrics.update(intersection, signal_controller, dt)

        # Print terminal progress status every 10 sim seconds
        if (step + 1) % 600 == 0:
            sim_sec = (step + 1) // 60
            active_arm = signal_controller.get_active_arm()
            phase_st = signal_controller.phase_state
            completed = len(intersection.completed_vehicles)
            avg_wait = (sum(v['wait_time'] for v in intersection.completed_vehicles) / completed) if completed else 0.0
            rates = f"S:{intersection.spawn_rates['SOUTH']} N:{intersection.spawn_rates['NORTH']} E:{intersection.spawn_rates['EAST']} W:{intersection.spawn_rates['WEST']}"
            
            print(f"[{sim_sec:3d}s] Stage: {active_arm:<11} ({phase_st:<7}) | Demand(VPM): {rates} | Queue: S:{intersection.get_arm_queue('SOUTH')} N:{intersection.get_arm_queue('NORTH')} E:{intersection.get_arm_queue('EAST')} W:{intersection.get_arm_queue('WEST')} | Served: {completed:3d} | Avg Wait: {avg_wait:.1f}s")

    elapsed_wall = time.time() - start_wall
    print(f"\n==================================================")
    print(f"   Simulation Completed in {elapsed_wall:.2f}s real time")
    print(f"==================================================")
    completed_total = len(intersection.completed_vehicles)
    avg_total_wait = (sum(v['wait_time'] for v in intersection.completed_vehicles) / completed_total) if completed_total else 0.0
    print(f"• Total Vehicles Served: {completed_total}")
    print(f"• Average Vehicle Delay: {avg_total_wait:.2f} seconds")

    if save_plot:
        out_path = metrics.generate_summary_plot("traffic_performance_report.png")
        print(f"• Analytics plot generated: {out_path}")

def run_gui(controller_mode="ADAPTIVE_AI", seed=None, with_server=True, port=8000):
    """Launches full visual Pygame 2D interactive simulator GUI, sharing the exact same
    authoritative state with the WebSocket server so Python and React stay 100% in sync."""
    import threading
    import traffic_simulator.server as srv
    from traffic_simulator.gui import SimulationGUI

    srv.signal_controller.mode = controller_mode
    srv.gui_active = True

    if with_server:
        import uvicorn
        def start_bg_server():
            config = uvicorn.Config(srv.app, host="0.0.0.0", port=port, log_level="warning")
            server = uvicorn.Server(config)
            server.run()

        srv_thread = threading.Thread(target=start_bg_server, daemon=True)
        srv_thread.start()
        print(f"[SERVER] Background WebSocket / REST server active on ws://localhost:{port}/ws/traffic")

    gui = SimulationGUI(srv.intersection, srv.signal_controller, srv.metrics, srv_module=srv)

    dt = 1.0 / 60.0
    print("\nStarting SignalSync Interactive GUI Simulation...")
    print("Controls: Space = Pause/Play | M = Switch Mode | A = Dispatch Ambulance | Click Sidebar Buttons\n")

    while True:
        gui.run_frame(dt)

def main():
    parser = argparse.ArgumentParser(description="SignalSync Python AI Traffic Simulator")
    parser.add_argument("--mode", choices=["gui", "headless", "server", "benchmark"], default="server", help="Simulation mode: server/headless (FastAPI Server), gui (Pygame + Server), benchmark (offline test)")
    parser.add_argument("--controller", choices=["ai", "fixed"], default="ai", help="Traffic signal controller (ai or fixed)")
    parser.add_argument("--duration", type=int, default=60, help="Duration in seconds for benchmark mode")
    parser.add_argument("--plot", action="store_true", default=True, help="Generate analytics plot at end of benchmark")
    parser.add_argument("--port", type=int, default=8000, help="Port for WebSocket server mode")
    parser.add_argument("--seed", type=int, default=None, help="Optional random seed for reproducible runs")

    args = parser.parse_args()
    ctrl_mode = "ADAPTIVE_AI" if args.controller == "ai" else "FIXED"

    if args.mode in ("server", "headless"):
        import traffic_simulator.server as srv
        srv.signal_controller.mode = ctrl_mode
        srv.run_server(port=args.port)
    elif args.mode == "benchmark":
        run_headless(duration_sec=args.duration, controller_mode=ctrl_mode, save_plot=args.plot, seed=args.seed)
    else:
        run_gui(controller_mode=ctrl_mode, seed=args.seed, with_server=True, port=args.port)

if __name__ == "__main__":
    main()
