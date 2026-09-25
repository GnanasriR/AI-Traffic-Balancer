package com.kce.traffic.optimizer.controller;

import com.kce.traffic.optimizer.dto.OptimizerDto.*;
import com.kce.traffic.optimizer.model.Approach;
import com.kce.traffic.optimizer.model.TrafficPlan;
import com.kce.traffic.optimizer.service.PythonSimulatorClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * No longer drives its own simulation. Every endpoint here either reads from or writes to the
 * Python simulator (traffic_simulator/server.py), which is the single source of truth.
 */
@RestController
@RequestMapping("/api/v1/optimizer")
public class OptimizerController {

    private static final Logger log = LoggerFactory.getLogger(OptimizerController.class);

    private final PythonSimulatorClient pythonSimulatorClient;

    public OptimizerController(PythonSimulatorClient pythonSimulatorClient) {
        this.pythonSimulatorClient = pythonSimulatorClient;
    }

    @GetMapping("/snapshot")
    public ResponseEntity<?> getSnapshot() {
        try {
            return ResponseEntity.ok(pythonSimulatorClient.getSnapshot());
        } catch (Exception e) {
            log.warn("Python simulator unreachable: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new ApiResponse(false, "Python simulator unreachable: " + e.getMessage()));
        }
    }

    @PostMapping("/plan")
    public ResponseEntity<ApiResponse> setPlan(@RequestBody SetPlanRequest request) {
        // Python's signal_controller only has two modes (ADAPTIVE_AI / FIXED). Java's TrafficPlan
        // still has a third value, ACTUATED, with no Python equivalent yet — it is mapped to FIXED
        // and logged so nobody assumes actuated behaviour is actually running.
        if (request.plan() == TrafficPlan.ACTUATED) {
            log.warn("TrafficPlan.ACTUATED requested but the Python simulator has no actuated mode; falling back to FIXED.");
        }
        boolean adaptiveOn = request.plan() == TrafficPlan.ADAPTIVE;
        try {
            pythonSimulatorClient.postControl("adaptive", Map.of("on", adaptiveOn));
            return ResponseEntity.ok(new ApiResponse(true, "Plan changed to " + request.plan()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new ApiResponse(false, "Python simulator unreachable: " + e.getMessage()));
        }
    }

    @PostMapping("/override")
    public ResponseEntity<ApiResponse> manualOverride(@RequestBody OverridePhaseRequest request) {
        try {
            pythonSimulatorClient.postControl("override", Map.of(
                    "dir", toReactDir(request.approach()),
                    "duration", request.durationSeconds()
            ));
            return ResponseEntity.ok(new ApiResponse(true,
                    "Manual phase override dispatched: " + request.approach() + " GREEN for " + request.durationSeconds() + "s"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new ApiResponse(false, "Python simulator unreachable: " + e.getMessage()));
        }
    }

    @PostMapping("/internal/preemption")
    public ResponseEntity<ApiResponse> internalPreemption(@RequestBody PreemptionEvent event) {
        try {
            pythonSimulatorClient.postControl("emergency", Map.of("dir", toReactDir(event.approach())));
            return ResponseEntity.ok(new ApiResponse(true, "Preemption state updated"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new ApiResponse(false, "Python simulator unreachable: " + e.getMessage()));
        }
    }

    @PostMapping("/internal/incident")
    public ResponseEntity<ApiResponse> internalIncident(@RequestBody IncidentReport report) {
        // Note: Python's toggle_incident just flips a single active/inactive flag per approach —
        // it has no `lane` concept and no explicit on/off, only toggle. report.lane() and
        // report.blocked() are accepted here for API compatibility but are NOT forwarded 1:1;
        // a caller that expects to explicitly set blocked=true/false will instead see it toggle
        // each time this is called.
        try {
            pythonSimulatorClient.postControl("toggle_incident", Map.of("dir", toReactDir(report.approach())));
            return ResponseEntity.ok(new ApiResponse(true,
                    "Incident toggle sent (Python toggles state; it does not set an explicit blocked flag or lane)"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new ApiResponse(false, "Python simulator unreachable: " + e.getMessage()));
        }
    }

    private static String toReactDir(Approach approach) {
        return switch (approach) {
            case NORTH -> "N";
            case SOUTH -> "S";
            case EAST -> "E";
            case WEST -> "W";
        };
    }
}
