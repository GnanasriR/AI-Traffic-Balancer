package com.kce.traffic.optimizer.dto;

import com.kce.traffic.optimizer.model.Approach;
import com.kce.traffic.optimizer.model.TrafficPlan;

public class OptimizerDto {

    public record SetPlanRequest(TrafficPlan plan) {}

    public record OverridePhaseRequest(Approach approach, int durationSeconds) {}

    public record PreemptionEvent(Approach approach, boolean active, String vehicleType) {}

    public record IncidentReport(Approach approach, int lane, boolean blocked) {}

    public record ApiResponse(boolean success, String message) {}

    // VehicleDto, ApproachStatus and SnapshotDto were deleted: they modeled the OLD Java
    // TrafficSimulationEngine's snapshot shape, which never matched the Python simulator's
    // real /api/snapshot JSON (junction/control/traffic/network/events/emergency/explain/
    // incident/crosswalks). The snapshot is now passed through as a raw JsonNode — see
    // PythonSimulatorClient and OptimizerController#getSnapshot — so there is only ever one
    // schema to keep in sync with.
}
