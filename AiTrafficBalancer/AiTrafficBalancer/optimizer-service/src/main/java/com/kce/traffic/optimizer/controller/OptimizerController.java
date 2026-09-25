package com.kce.traffic.optimizer.controller;

import com.kce.traffic.optimizer.dto.OptimizerDto.*;
import com.kce.traffic.optimizer.service.TrafficSimulationEngine;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/optimizer")
public class OptimizerController {

    private final TrafficSimulationEngine simulationEngine;

    public OptimizerController(TrafficSimulationEngine simulationEngine) {
        this.simulationEngine = simulationEngine;
    }

    @GetMapping("/snapshot")
    public ResponseEntity<SnapshotDto> getSnapshot() {
        return ResponseEntity.ok(simulationEngine.buildCurrentSnapshot());
    }

    @PostMapping("/plan")
    public ResponseEntity<ApiResponse> setPlan(@RequestBody SetPlanRequest request) {
        simulationEngine.setPlan(request.plan());
        return ResponseEntity.ok(new ApiResponse(true, "Plan changed to " + request.plan()));
    }

    @PostMapping("/override")
    public ResponseEntity<ApiResponse> manualOverride(@RequestBody OverridePhaseRequest request) {
        simulationEngine.manualOverride(request.approach(), request.durationSeconds());
        return ResponseEntity.ok(new ApiResponse(true, "Manual green override set for " + request.approach()));
    }

    @PostMapping("/internal/preemption")
    public ResponseEntity<ApiResponse> internalPreemption(@RequestBody PreemptionEvent event) {
        simulationEngine.handlePreemption(event.approach(), event.active());
        return ResponseEntity.ok(new ApiResponse(true, "Preemption state updated"));
    }

    @PostMapping("/internal/incident")
    public ResponseEntity<ApiResponse> internalIncident(@RequestBody IncidentReport report) {
        simulationEngine.handleIncident(report.approach(), report.lane(), report.blocked());
        return ResponseEntity.ok(new ApiResponse(true, "Incident state updated"));
    }
}