package com.kce.traffic.optimizer.service;

import com.kce.traffic.optimizer.dto.PredictionResponseDto;
import com.kce.traffic.optimizer.model.Approach;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class TrafficPredictionService {

    private static final int LANE_CAPACITY = 22; // max vehicle queue length before intersection spillback

    /**
     * Predictive AI Time-Series Algorithm:
     * Predicts future queue length Q_(t+15) and Q_(t+30) using moving arrival trend,
     * calculates Congestion Severity Index (CSI), and forecasts spillback risk.
     */
    public List<PredictionResponseDto> predictTrafficSurges(Map<Approach, Integer> currentQueues, Map<Approach, Boolean> incidents) {
        List<PredictionResponseDto> predictions = new ArrayList<>();

        for (Approach approach : Approach.values()) {
            int queue = currentQueues.getOrDefault(approach, 0);
            boolean isIncidentActive = incidents != null && incidents.getOrDefault(approach, false);

            // 1. Arrival Rate & Trend Calculation
            double arrivalRatePerMin = queue > 0 ? (queue * 0.45) + 1.2 : 1.0;
            if (isIncidentActive) {
                arrivalRatePerMin *= 1.35; // Incident bottleneck multiplier
            }

            // 2. Future Queue Projections (15-min and 30-min horizon)
            int pred15 = (int) Math.round(queue + (arrivalRatePerMin * 0.8 * 3.5));
            int pred30 = (int) Math.round(queue + (arrivalRatePerMin * 1.4 * 5.0));

            // Cap projections to practical road capacity limits
            pred15 = Math.clamp(pred15, 0, 35);
            pred30 = Math.clamp(pred30, 0, 50);

            // 3. Congestion Severity Index (CSI) [0.0 - 1.0]
            double csi = (queue * 0.08) + (isIncidentActive ? 0.35 : 0.05);
            csi = Math.min(1.0, Math.max(0.0, Math.round(csi * 100.0) / 100.0));

            // 4. Trend Direction Classifier
            String trend;
            if (pred15 > queue + 2) {
                trend = "UPWARD_SURGE";
            } else if (pred15 < queue - 2) {
                trend = "DECAYING";
            } else {
                trend = "STABLE";
            }

            // 5. Estimated Spillback Minutes Calculation
            double spillbackMins;
            if (isIncidentActive) {
                int remainingSpace = Math.max(1, LANE_CAPACITY - queue);
                spillbackMins = Math.round((remainingSpace / (arrivalRatePerMin + 0.1)) * 10.0) / 10.0;
            } else {
                spillbackMins = 99.0; // Clear road - no spillback risk
            }

            // 6. AI Recommendation Generation
            String recommendation;
            if (csi > 0.70) {
                recommendation = "CRITICAL: Proactively allocate +" + Math.min(12, queue * 2) + "s green time to " + approach.name() + " approach";
            } else if (csi > 0.40) {
                recommendation = "MODERATE: Extend green split by +4s to prevent arrival queue accumulation";
            } else {
                recommendation = "OPTIMAL: Standard Webster cycle sufficient for free-flow clearance";
            }

            predictions.add(new PredictionResponseDto(
                approach.name(),
                queue,
                pred15,
                pred30,
                csi,
                trend,
                spillbackMins,
                recommendation
            ));
        }

        return predictions;
    }
}
