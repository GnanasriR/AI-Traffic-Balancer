package com.kce.traffic.optimizer.service;

import com.kce.traffic.optimizer.model.Approach;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.Map;

@Service
public class WebsterOptimizerService {

    private static final double SATURATION_FLOW_PCU_PER_HOUR = 1800.0;
    private static final int LOST_TIME_PER_VEHICLE_PHASE_S = 4; // 3s yellow + 1s all-red clearance
    private static final int NUMBER_OF_VEHICLE_PHASES = 4;
    private static final int PEDESTRIAN_SCRAMBLE_DURATION_S = 20; // 20s geometry-calculated scramble phase

    public record CycleAllocation(int optimalCycleLength, Map<Approach, Integer> greenSplits) {}

    /**
     * Webster Formula with PCE-Weighted Demand Input:
     * C_0 = (1.5 * L + 5) / (1 - Y)
     * where:
     * L = total lost time per cycle = (4 vehicle phases * 4s lost time) + 20s Pedestrian Scramble = 36s
     * Y = sum of critical flow ratios (pce_flow_i / saturation_flow)
     */
    public CycleAllocation calculateOptimalTimingPCE(Map<Approach, Double> pceQueueCounts) {
        int vehiclePhaseLostTime = NUMBER_OF_VEHICLE_PHASES * LOST_TIME_PER_VEHICLE_PHASE_S; // 16s
        int totalLostTime = vehiclePhaseLostTime + PEDESTRIAN_SCRAMBLE_DURATION_S; // 36s

        double sumOfFlowRatios = 0.0;
        Map<Approach, Double> flowRatios = new EnumMap<>(Approach.class);

        for (Approach approach : Approach.values()) {
            double effectivePceQueue = pceQueueCounts.getOrDefault(approach, 5.0);
            // Convert PCE demand into equivalent flow (PCU/hr)
            double estimatedFlowPcu = Math.max(80.0, effectivePceQueue * 35.0);
            double y = estimatedFlowPcu / SATURATION_FLOW_PCU_PER_HOUR;
            flowRatios.put(approach, y);
            sumOfFlowRatios += y;
        }

        // Cap Y to 0.75 for non-runaway cycle stability
        double cappedSumOfFlowRatios = Math.min(0.75, Math.max(0.20, sumOfFlowRatios));

        // Webster Formula
        double websterCycle = (1.5 * totalLostTime + 5.0) / (1.0 - cappedSumOfFlowRatios);
        int cycleLength = (int) Math.round(Math.clamp(websterCycle, 60, 120));

        // Calculate green splits: g_i = (CycleLength - TotalLostTime) * (y_i / Y)
        int effectiveVehicleGreenTotal = cycleLength - totalLostTime;
        Map<Approach, Integer> greenSplits = new EnumMap<>(Approach.class);

        int allocatedSum = 0;
        for (Approach approach : Approach.values()) {
            double proportion = flowRatios.get(approach) / sumOfFlowRatios;
            int g = (int) Math.round(effectiveVehicleGreenTotal * proportion);
            g = Math.clamp(g, 8, 50);
            greenSplits.put(approach, g);
            allocatedSum += g;
        }

        int diff = effectiveVehicleGreenTotal - allocatedSum;
        greenSplits.compute(Approach.NORTH, (k, v) -> (v == null ? 15 : v) + diff);

        return new CycleAllocation(cycleLength, greenSplits);
    }
}