"""
Performance Metrics Tracker & Analytics Report Generator for SignalSync Simulator.
"""

import time
import os

try:
    import matplotlib.pyplot as plt
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False

class MetricsTracker:
    def __init__(self):
        self.start_time = time.time()
        self.history_time = []
        self.history_queue_south = []
        self.history_queue_north = []
        self.history_queue_east = []
        self.history_queue_west = []
        self.history_avg_wait = []
        self.history_throughput = []

        self.sample_timer = 0.0
        self.sample_interval = 1.0  # Sample every 1.0 second

    def update(self, intersection, signal_controller, dt=1.0/60.0):
        """Records metric snapshots at periodic sample intervals."""
        self.sample_timer += dt
        if self.sample_timer >= self.sample_interval:
            self.sample_timer = 0.0

            elapsed = time.time() - self.start_time
            self.history_time.append(round(elapsed, 1))

            self.history_queue_south.append(intersection.get_arm_queue("SOUTH"))
            self.history_queue_north.append(intersection.get_arm_queue("NORTH"))
            self.history_queue_east.append(intersection.get_arm_queue("EAST"))
            self.history_queue_west.append(intersection.get_arm_queue("WEST"))

            completed = intersection.completed_vehicles
            avg_wait = (sum(v['wait_time'] for v in completed) / len(completed)) if completed else 0.0
            self.history_avg_wait.append(round(avg_wait, 2))
            self.history_throughput.append(len(completed))

    def generate_summary_plot(self, output_path="traffic_performance_report.png"):
        """Generates and saves a publication-quality Matplotlib analytics dashboard."""
        if not self.history_time:
            return None

        plt.style.use('ggplot')
        fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(10, 10), sharex=True)
        fig.suptitle('SignalSync AI Traffic Simulator Performance Analytics', fontsize=14, fontweight='bold')

        # 1. Queue Lengths Panel
        ax1.plot(self.history_time, self.history_queue_south, label='South Queue', color='#e74c3c')
        ax1.plot(self.history_time, self.history_queue_north, label='North Queue', color='#3498db')
        ax1.plot(self.history_time, self.history_queue_east, label='East Queue', color='#2ecc71')
        ax1.plot(self.history_time, self.history_queue_west, label='West Queue', color='#f1c40f')
        ax1.set_ylabel('Queue Length (vehicles)')
        ax1.set_title('Approach Queue Lengths per Arm')
        ax1.legend(loc='upper left')

        # 2. Average Wait Time Panel
        ax2.plot(self.history_time, self.history_avg_wait, color='#9b59b6', linewidth=2)
        ax2.set_ylabel('Avg Wait Time (sec)')
        ax2.set_title('Average Vehicle Waiting Time')

        # 3. Accumulated Throughput Panel
        ax3.plot(self.history_time, self.history_throughput, color='#16a085', linewidth=2)
        ax3.set_xlabel('Simulation Time (seconds)')
        ax3.set_ylabel('Vehicles Served')
        ax3.set_title('Cumulative Intersection Throughput')

        plt.tight_layout()
        fig.savefig(output_path, dpi=150)
        plt.close(fig)
        return output_path
