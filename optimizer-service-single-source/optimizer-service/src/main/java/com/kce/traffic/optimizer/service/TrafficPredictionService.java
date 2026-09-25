package com.kce.traffic.optimizer.service;

import com.kce.traffic.optimizer.dto.PredictionResponseDto;
import com.kce.traffic.optimizer.model.Approach;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TrafficPredictionService {

    private static final int LANE_CAPACITY = 22;
    private static final int HISTORY_WINDOW = 20;


    private final Map<Approach, Deque<Integer>> queueHistory = new ConcurrentHashMap<>();
    private final Map<Approach, Deque<Integer>> countHistory = new ConcurrentHashMap<>();

    public record ApproachTelemetry(
        int queue,
        int count,
        double waitTime,
        double demandRate,
        boolean isGreen,
        boolean isIncidentActive
    ) {}

    public List<PredictionResponseDto> predictTrafficSurges(Map<Approach, Integer> currentQueues, Map<Approach, Boolean> incidents) {
        Map<Approach, ApproachTelemetry> telemetryMap = new EnumMap<>(Approach.class);
        for (Approach a : Approach.values()) {
            int q = currentQueues.getOrDefault(a, 0);
            boolean inc = incidents != null && incidents.getOrDefault(a, false);
            telemetryMap.put(a, new ApproachTelemetry(q, Math.max(q, q + 3), 10.0, 1.0, false, inc));
        }
        return predictWithTelemetry(telemetryMap);
    }

    public List<PredictionResponseDto> predictWithTelemetry(Map<Approach, ApproachTelemetry> telemetryMap) {
        List<PredictionResponseDto> predictions = new ArrayList<>();

        for (Approach approach : Approach.values()) {
            ApproachTelemetry t = telemetryMap.getOrDefault(approach, new ApproachTelemetry(0, 0, 0, 1.0, false, false));
            int instantaneousQueue = t.queue();
            int totalVehiclesOnArm = Math.max(instantaneousQueue, t.count());
            boolean isGreen = t.isGreen();
            boolean isIncidentActive = t.isIncidentActive();
            double demandRate = Math.max(0.2, t.demandRate());

            // 1. Maintain rolling time-series history
            Deque<Integer> qHist = queueHistory.computeIfAbsent(approach, k -> new ArrayDeque<>());
            Deque<Integer> cHist = countHistory.computeIfAbsent(approach, k -> new ArrayDeque<>());
            synchronized (qHist) {
                qHist.addLast(instantaneousQueue);
                if (qHist.size() > HISTORY_WINDOW) qHist.removeFirst();
            }
            synchronized (cHist) {
                cHist.addLast(totalVehiclesOnArm);
                if (cHist.size() > HISTORY_WINDOW) cHist.removeFirst();
            }

            double avgHistoricalQueue = qHist.stream().mapToInt(Integer::intValue).average().orElse(instantaneousQueue);

            // Effective queue for forecast base — green arm with empty queue uses history to avoid collapse
            double effectiveCycleQueue = isGreen && instantaneousQueue < 2
                ? Math.max(avgHistoricalQueue * 0.7, 1.0)
                : Math.max((double) instantaneousQueue, avgHistoricalQueue * 0.75);

            // Per-approach arrival vs service balance.
            // demandRate scale: 1.0 = 20 vpm, 3.0 = 60 vpm, 4.25 = 85 vpm
            // Green arm gets proportional discharge; red arm accumulates at full arrival rate
            double arrivalPerCycle = demandRate * 2.4;          // vehicles arriving per 2-min mini-cycle
            double dischargePerCycle = isGreen ? (demandRate * 2.4 * 0.85) // ~85% discharged when green
                                               : (demandRate * 2.4 * 0.20); // only 20% slots available when red
            double netAccumPerCycle = Math.max(-3.0, arrivalPerCycle - dischargePerCycle);
            if (isIncidentActive) netAccumPerCycle = Math.max(netAccumPerCycle, netAccumPerCycle * 1.4);

            // Forecast over 15 min (~7 cycles) and 30 min (~14 cycles)
            int pred15 = (int) Math.round(Math.max(2, effectiveCycleQueue + (netAccumPerCycle * 7.0)));
            int pred30 = (int) Math.round(Math.max(3, effectiveCycleQueue + (netAccumPerCycle * 14.0)));

            pred15 = Math.min(55, pred15);
            pred30 = Math.min(75, pred30);

            // CSI: driven by instantaneous queue depth + wait time + demand pressure
            double queuePressure  = Math.min(0.55, instantaneousQueue / 15.0);
            double waitPressure   = Math.min(0.25, t.waitTime() / 120.0);
            double demandPressure = Math.min(0.20, (demandRate - 0.5) / 18.0);
            double greenRelief    = isGreen ? -0.12 : 0.0;
            double incidentBoost  = isIncidentActive ? 0.20 : 0.0;
            double csi = Math.min(0.98, Math.max(0.12,
                Math.round((queuePressure + waitPressure + demandPressure + greenRelief + incidentBoost) * 100.0) / 100.0));

            
            String trend;
            if (pred15 > effectiveCycleQueue + 3) {
                trend = "UPWARD_SURGE";
            } else if (pred15 < effectiveCycleQueue - 3) {
                trend = "DECAYING";
            } else {
                trend = "STABLE";
            }

            double spillbackMins;
            if (isIncidentActive || csi >= 0.75) {
                int remainingSpace = Math.max(1, LANE_CAPACITY - instantaneousQueue);
                spillbackMins = Math.round((remainingSpace / Math.max(0.5, arrivalPerCycle - 2.0)) * 10.0) / 10.0;
                spillbackMins = Math.max(1.5, Math.min(30.0, spillbackMins));
            } else {
                spillbackMins = 99.0;
            }

          
            String recommendation;
            if (csi >= 0.75) {
                recommendation = "CRITICAL: Proactively allocate +" + Math.min(14, Math.max(6, (int)(effectiveCycleQueue * 1.5))) + "s green time to " + approach.name() + " approach";
            } else if (csi >= 0.45) {
                recommendation = "MODERATE: Extend green split by +4s to prevent arrival queue accumulation";
            } else {
                recommendation = "OPTIMAL: Standard Webster cycle sufficient for free-flow clearance";
            }

            predictions.add(new PredictionResponseDto(
                approach.name(),
                instantaneousQueue,
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
