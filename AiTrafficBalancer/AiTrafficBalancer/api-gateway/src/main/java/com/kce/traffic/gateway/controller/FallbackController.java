package com.kce.traffic.gateway.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/fallback")
public class FallbackController {

    private ResponseEntity<?> unavailable(String serviceName) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "message", serviceName + " is temporarily unavailable. Please try again in a moment.",
                "status", 503
        ));
    }

    @GetMapping("/optimizer-service")
    public ResponseEntity<?> optimizerGetFallback() {
        return unavailable("Optimizer service");
    }

    @PostMapping("/optimizer-service")
    public ResponseEntity<?> optimizerPostFallback() {
        return unavailable("Optimizer service");
    }

    @GetMapping("/preemption-service")
    public ResponseEntity<?> preemptionGetFallback() {
        return unavailable("Preemption service");
    }

    @PostMapping("/preemption-service")
    public ResponseEntity<?> preemptionPostFallback() {
        return unavailable("Preemption service");
    }

    @GetMapping("/incident-service")
    public ResponseEntity<?> incidentGetFallback() {
        return unavailable("Incident service");
    }

    @PostMapping("/incident-service")
    public ResponseEntity<?> incidentPostFallback() {
        return unavailable("Incident service");
    }

    @PutMapping("/incident-service")
    public ResponseEntity<?> incidentPutFallback() {
        return unavailable("Incident service");
    }

    @GetMapping("/telemetry-service")
    public ResponseEntity<?> telemetryGetFallback() {
        return unavailable("Telemetry service");
    }

    @PostMapping("/telemetry-service")
    public ResponseEntity<?> telemetryPostFallback() {
        return unavailable("Telemetry service");
    }

    @GetMapping("/analytics-service")
    public ResponseEntity<?> analyticsGetFallback() {
        return unavailable("Analytics service");
    }

    @PostMapping("/analytics-service")
    public ResponseEntity<?> analyticsPostFallback() {
        return unavailable("Analytics service");
    }

    @PatchMapping("/analytics-service")
    public ResponseEntity<?> analyticsPatchFallback() {
        return unavailable("Analytics service");
    }
}