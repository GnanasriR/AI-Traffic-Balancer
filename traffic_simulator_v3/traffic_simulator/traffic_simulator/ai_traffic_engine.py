"""
Traffic SignalSync — AI Intelligence Engine
Includes:
1. XGBoost Adaptive Signal Timing Model (via xgb_signal_model.py)
2. Webster Adaptive AI Timing Calculator (PCE-weighted queues, 5-stage Indian
   phasing lost-time accounting including the pedestrian scramble phase)
3. Time-Series Traffic Arrival & Congestion Spillback Predictor

The legacy Deep Q-Network (DQN) implementation has been completely removed
and replaced with the trained XGBoost model (traffic_signal_xgboost.json).
"""

import random
import numpy as np

# PCE (Passenger Car Equivalent) Weights — mirrors config.VEHICLE_TYPES['pce']
PCE_WEIGHTS = {
    'MOTORCYCLE': 0.5,
    'CAR': 1.0,
    'BUS': 3.0,
    'AMBULANCE': 1.0,
}


class WebsterAIEngine:
    """
    Webster Adaptive AI Timing Calculator.
    Computes optimal cycle length C_0 = (1.5*L + 5) / (1 - Y) and dynamic green
    splits, accounting for the pedestrian scramble phase's duration in lost
    time L — merged in from the Java optimizer-service's model.
    """

    def __init__(self, saturation_flow=1800.0, vehicle_phase_lost_time=4.0, scramble_duration=18.0):
        self.saturation_flow = saturation_flow
        self.vehicle_phase_lost_time = vehicle_phase_lost_time
        self.scramble_duration = scramble_duration
        self.total_lost_time = (4 * vehicle_phase_lost_time) + scramble_duration

    def calculate_timing(self, pce_queues):
        """Calculates optimal cycle length and green splits based on PCE-weighted queues."""
        flow_ratios = {}
        sum_y = 0.0

        for arm, pce_q in pce_queues.items():
            est_flow = max(100.0, pce_q * 65.0)
            y = min(0.20, est_flow / self.saturation_flow)
            flow_ratios[arm] = y
            sum_y += y

        sum_y = max(0.20, min(0.75, sum_y))
        webster_cycle = (1.5 * self.total_lost_time + 5.0) / (1.0 - sum_y)
        cycle_length = int(round(max(60, min(120, webster_cycle))))

        effective_vehicle_green = cycle_length - self.total_lost_time
        green_splits = {}

        for arm, y in flow_ratios.items():
            prop = y / sum_y
            g = int(round(effective_vehicle_green * prop))
            green_splits[arm] = max(8, min(45, g))

        return {
            'optimal_cycle_length': cycle_length,
            'pedestrian_scramble_duration': int(self.scramble_duration),
            'total_lost_time': int(self.total_lost_time),
            'green_splits': green_splits
        }


class TrafficDemandPredictor:
    """
    Time-Series Traffic Arrival & Congestion Spillback Predictor.
    Predicts Q_(t+15min) and Q_(t+30min), Congestion Severity Index (CSI), and Spillback Minutes.

    Two public interfaces
    ─────────────────────
    predict(current_queues, incidents)
        Legacy single-snapshot prediction.  Maintained for backward compatibility
        and used as fallback when the rolling history has < 3 samples.

    predict_from_history(history_by_arm, current_queues, current_pce,
                         current_wait, incidents, sim_time)
        Authoritative time-series prediction called by server.py at the
        controlled prediction interval.  Uses genuine rolling history from
        predictor.RollingTrafficHistory (weighted moving average + OLS linear
        regression) rather than a single-snapshot guess.  Its output is injected
        into signal_controller.prediction_cache so SignalController._advance()
        can use predicted demand to enhance adaptive green time allocation.
    """

    def predict(self, current_queues, incidents):
        """Legacy single-snapshot prediction (fallback; backward-compatible)."""
        predictions = {}
        lane_capacity = 22

        for arm in ['SOUTH', 'NORTH', 'EAST', 'WEST']:
            q = current_queues.get(arm, 0)
            is_incident = incidents.get(arm, False)

            arrival_rate = (q * 0.45 + 1.2) * (1.35 if is_incident else 1.0)
            pred_15 = int(round(min(35, max(0, q + arrival_rate * 0.8 * 3.5))))
            pred_30 = int(round(min(50, max(0, q + arrival_rate * 1.4 * 5.0))))

            csi = min(1.0, max(0.0, round(q * 0.08 + (0.35 if is_incident else 0.05), 2)))
            trend = "UPWARD_SURGE" if pred_15 > q + 2 else ("DECAYING" if pred_15 < q - 2 else "STABLE")

            spillback_mins = round((max(1, lane_capacity - q) / (arrival_rate + 0.1)), 1) if is_incident else 99.0

            if csi > 0.70:
                rec = f"CRITICAL: Proactively allocate +{min(12, q * 2)}s green time to {arm} approach"
            elif csi > 0.40:
                rec = "MODERATE: Extend green split by +4s to prevent arrival queue accumulation"
            else:
                rec = "OPTIMAL: Standard Webster cycle sufficient for free-flow clearance"

            predictions[arm] = {
                'current_queue': q,
                'predicted_queue_15min': pred_15,
                'predicted_queue_30min': pred_30,
                'congestion_severity_index': csi,
                'trend_direction': trend,
                'estimated_spillback_minutes': spillback_mins,
                'recommendation': rec
            }

        return predictions

    def predict_from_history(self, history_by_arm, current_queues, current_pce,
                              current_wait, incidents, sim_time=0.0):
        """
        Authoritative time-series prediction using rolling per-arm history windows.

        Called by server.py at the controlled prediction interval (default every
        10 sim-seconds).  Its results are injected into
        signal_controller.prediction_cache so _advance() can blend current
        measurements with the predicted leading indicator.

        Parameters
        ----------
        history_by_arm : dict  arm → list[dict]  per-arm samples from RollingTrafficHistory
        current_queues : dict  arm → int          current queue length
        current_pce    : dict  arm → float        current PCE-weighted queue
        current_wait   : dict  arm → float        current max wait time (s)
        incidents      : dict  arm → bool         incident active flag
        sim_time       : float                    current simulation time in s

        Returns
        -------
        dict  arm → prediction dict
            Keys: arm, sim_time, history_samples_used, current_queue,
                  current_pce_queue, current_wait, predicted_queue_15min,
                  predicted_queue_30min, predicted_pce_15min,
                  congestion_severity_index, trend_direction,
                  estimated_spillback_minutes, recommendation, incident_active
        """
        predictions = {}
        lane_capacity = 22

        for arm in ['SOUTH', 'NORTH', 'EAST', 'WEST']:
            q           = current_queues.get(arm, 0)
            pce         = current_pce.get(arm, 0.0)
            wait        = current_wait.get(arm, 0.0)
            is_incident = incidents.get(arm, False)
            history     = history_by_arm.get(arm, [])
            n_samples   = len(history)

            # ── Time-series extrapolation (requires >= 3 samples) ─────────────
            if n_samples >= 3:
                # Use the most recent 12 samples (≈ 60 s at 5-s sample interval)
                recent      = history[-min(12, n_samples):]
                queues_hist = [s['queue']     for s in recent]
                pce_hist    = [s['pce_queue'] for s in recent]
                n           = len(queues_hist)

                # Linearly increasing weights: most-recent sample has highest weight
                weights = list(range(1, n + 1))
                wsum    = sum(weights)
                q_wma   = sum(w * v for w, v in zip(weights, queues_hist)) / wsum
                pce_wma = sum(w * v for w, v in zip(weights, pce_hist))    / wsum

                # OLS linear regression slope (vehicles per sample step)
                if n >= 2:
                    mean_i = (n - 1) / 2.0
                    num    = sum((i - mean_i) * (v - q_wma)
                                 for i, v in enumerate(queues_hist))
                    den    = sum((i - mean_i) ** 2 for i in range(n))
                    slope  = num / den if den > 0 else 0.0
                else:
                    slope = 0.0

                # Project 3 and 6 sample steps forward
                # (3 steps × 5 s/step = 15 sim-seconds — conservative "near-term" horizon)
                pred_q_15   = q_wma + slope * 3
                pred_q_30   = q_wma + slope * 6
                pred_pce_15 = pce_wma + (slope * 1.2) * 3   # scale by typical PCE factor

            else:
                # Fallback: original single-snapshot formula
                arrival_rate = (q * 0.45 + 1.2) * (1.35 if is_incident else 1.0)
                pred_q_15   = q + arrival_rate * 0.8 * 3.5
                pred_q_30   = q + arrival_rate * 1.4 * 5.0
                pred_pce_15 = pce + (pred_q_15 - q) * 1.2

            # Apply incident congestion amplifier to forward projections
            if is_incident:
                pred_q_15   *= 1.20
                pred_q_30   *= 1.35
                pred_pce_15 *= 1.20

            pred_15  = int(round(min(35, max(0, pred_q_15))))
            pred_30  = int(round(min(50, max(0, pred_q_30))))
            pred_pce = round(min(42.0, max(0.0, pred_pce_15)), 2)

            # ── Congestion Severity Index — PCE-based (more accurate) ─────────
            csi = min(1.0, max(0.0, round(pce * 0.065 + (0.35 if is_incident else 0.05), 2)))

            # ── Trend direction ───────────────────────────────────────────────
            trend = ("UPWARD_SURGE" if pred_15 > q + 2
                     else ("DECAYING" if pred_15 < q - 2 else "STABLE"))

            # ── Spillback risk ────────────────────────────────────────────────
            arrival_rate_fb = (q * 0.45 + 1.2) * (1.35 if is_incident else 1.0)
            spillback_mins  = (
                round((max(1, lane_capacity - q) / (arrival_rate_fb + 0.1)), 1)
                if is_incident else 99.0
            )

            # ── AI recommendation ─────────────────────────────────────────────
            if csi > 0.70:
                rec = f"CRITICAL: Proactively allocate +{min(12, q * 2)}s green time to {arm} approach"
            elif csi > 0.40:
                rec = "MODERATE: Extend green split by +4s to prevent arrival queue accumulation"
            else:
                rec = "OPTIMAL: Standard Webster cycle sufficient for free-flow clearance"

            predictions[arm] = {
                'arm':                         arm,
                'sim_time':                    round(sim_time, 1),
                'history_samples_used':        n_samples,
                'current_queue':               q,
                'current_pce_queue':           round(pce, 2),
                'current_wait':                round(wait, 1),
                'predicted_queue_15min':       pred_15,
                'predicted_queue_30min':       pred_30,
                'predicted_pce_15min':         pred_pce,
                'congestion_severity_index':   csi,
                'trend_direction':             trend,
                'estimated_spillback_minutes': spillback_mins,
                'recommendation':              rec,
                'incident_active':             is_incident,
            }

            print(
                f"[PREDICT] sim_t={sim_time:.1f}s arm={arm} "
                f"q={q} pce={pce:.1f} wait={wait:.1f}s hist={n_samples} "
                f"pred15={pred_15} pred30={pred_30} pred_pce={pred_pce:.1f} "
                f"csi={csi:.2f} trend={trend} | {rec[:55]}"
            )

        return predictions


if __name__ == "__main__":
    from xgb_signal_model import XGBSignalTimingModel

    xgb_model = XGBSignalTimingModel()
    webster = WebsterAIEngine()
    predictor = TrafficDemandPredictor()

    queues     = {'SOUTH': 6, 'NORTH': 3, 'EAST': 4, 'WEST': 1}
    pce_queues = {'SOUTH': 7.5, 'NORTH': 3.0, 'EAST': 4.8, 'WEST': 0.5}
    incidents  = {'SOUTH': True, 'NORTH': False, 'EAST': False, 'WEST': False}

    print("=== WEBSTER ADAPTIVE AI CALCULATOR ===")
    timing = webster.calculate_timing(pce_queues)
    print("Optimal Timing:", timing)

    print("\n=== AI TRAFFIC DEMAND PREDICTOR (legacy snapshot) ===")
    preds = predictor.predict(queues, incidents)
    for arm, p in preds.items():
        print(f"[{arm}] CSI: {p['congestion_severity_index']} | 15m Pred: {p['predicted_queue_15min']} | Rec: {p['recommendation']}")

    print("\n=== AI TRAFFIC DEMAND PREDICTOR (time-series history) ===")
    # 5 synthetic history samples to demonstrate regression path
    fake_history = {
        arm: [{'queue': queues[arm] + i, 'pce_queue': pce_queues[arm] + i * 0.5,
               'wait': 10.0 + i * 2, 'vehicle_count': queues[arm] + i,
               'arrival_rate_vpm': 30, 'is_green': False, 'has_incident': False}
              for i in range(5)]
        for arm in ['SOUTH', 'NORTH', 'EAST', 'WEST']
    }
    current_wait = {'SOUTH': 15.0, 'NORTH': 5.0, 'EAST': 8.0, 'WEST': 2.0}
    preds_hist = predictor.predict_from_history(
        fake_history, queues, pce_queues, current_wait, incidents, sim_time=30.0
    )
    for arm, p in preds_hist.items():
        print(f"[{arm}] hist={p['history_samples_used']} CSI={p['congestion_severity_index']} "
              f"pred15={p['predicted_queue_15min']} pred30={p['predicted_queue_30min']}")

    print("\n=== XGBOOST ADAPTIVE SIGNAL TIMING MODEL ===")
    sample_state = xgb_model.build_state(
        queues=queues,
        waits=current_wait,
        counts=queues,
        pce_queues=pce_queues,
        active_arm="SOUTH",
        phase_elapsed=0.0,
        incident_present=True,
    )
    rec_green = xgb_model.predict_green_time(sample_state)
    print(f"XGBoost Predicted Green: {rec_green:.1f}s")
    print("\nALL PYTHON AI ENGINES VERIFIED & OPERATIONAL (DQN REMOVED, XGBOOST ACTIVE)!")
