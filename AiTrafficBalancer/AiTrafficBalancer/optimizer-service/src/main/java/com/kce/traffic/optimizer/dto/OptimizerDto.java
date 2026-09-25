package com.kce.traffic.optimizer.dto;

import com.kce.traffic.optimizer.model.Approach;
import com.kce.traffic.optimizer.model.SignalColor;
import com.kce.traffic.optimizer.model.TrafficPlan;

import java.util.List;
import java.util.Map;

public class OptimizerDto {

    public record SetPlanRequest(TrafficPlan plan) {}

    public record OverridePhaseRequest(Approach approach, int durationSeconds) {}

    public record PreemptionEvent(Approach approach, boolean active, String vehicleType) {}

    public record IncidentReport(Approach approach, int lane, boolean blocked) {}

    public record VehicleDto(
            String id,
            String dir,
            String to,
            double dist,
            double speed,
            String turn,
            String type,
            double lateralOffset,
            double pce
    ) {}

    public record ApproachStatus(
            Approach approach,
            SignalColor light,
            int queueCount,
            int vehicleCount,
            double effectivePce,
            double flowRatePcu,
            double averageWaitTimeSeconds
    ) {}

    public record SnapshotDto(
            long timestamp,
            TrafficPlan currentPlan,
            Approach activePhase,
            SignalColor activeColor,
            int phaseTimeRemaining,
            int cycleLength,
            Map<Approach, ApproachStatus> approaches,
            List<VehicleDto> vehicles,
            Map<String, String> crosswalks,
            String aiExplanation,
            boolean preemptionActive,
            Approach preemptionApproach
    ) {}

    public record ApiResponse(boolean success, String message) {}
}