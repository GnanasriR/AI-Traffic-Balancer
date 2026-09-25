package com.kce.traffic.analytics.controller;

import com.kce.traffic.analytics.dto.*;
import com.kce.traffic.analytics.service.AnalyticsService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Locale;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    // --- Session Lifecycle Endpoints ---

    @PostMapping("/sessions")
    public ResponseEntity<SessionDetailDto> createSession(@Valid @RequestBody CreateSessionRequestDto request) {
        SessionDetailDto session = analyticsService.createSession(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(session);
    }

    @PostMapping("/sessions/{sessionId}/complete")
    public ResponseEntity<SessionDetailDto> completeSession(@PathVariable String sessionId) {
        SessionDetailDto session = analyticsService.completeSession(sessionId);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/sessions/{sessionId}/approaches")
    public ResponseEntity<ApproachMetricResponseDto> recordApproachMetric(
            @PathVariable String sessionId,
            @Valid @RequestBody RecordApproachMetricRequestDto request) {
        ApproachMetricResponseDto metricDto = analyticsService.recordApproachMetric(sessionId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(metricDto);
    }

    @PostMapping("/sessions/{sessionId}/preemption")
    public ResponseEntity<PreemptionLogDto> recordPreemption(
            @PathVariable String sessionId,
            @Valid @RequestBody RecordPreemptionRequestDto request) {
        PreemptionLogDto log = analyticsService.recordPreemption(sessionId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(log);
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<SessionDetailDto> getSessionDetail(@PathVariable String sessionId) {
        SessionDetailDto session = analyticsService.getSessionDetail(sessionId);
        return ResponseEntity.ok(session);
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<TrafficSessionResponseDto>> getAllSessions() {
        return ResponseEntity.ok(analyticsService.getAllSessions());
    }

    // --- Performance & Summary Metrics Endpoints ---

    @GetMapping("/metrics")
    public ResponseEntity<AnalyticsSummaryDto> getSummaryMetrics(@RequestParam(required = false) String sessionId) {
        if (sessionId != null && !sessionId.isBlank()) {
            return ResponseEntity.ok(analyticsService.getSummaryMetricsForSession(sessionId));
        }
        return ResponseEntity.ok(analyticsService.getSummaryMetrics());
    }

    @GetMapping("/approaches")
    public ResponseEntity<List<ApproachPerformanceDto>> getApproachPerformance(@RequestParam(required = false) String sessionId) {
        if (sessionId != null && !sessionId.isBlank()) {
            return ResponseEntity.ok(analyticsService.getApproachPerformanceForSession(sessionId));
        }
        return ResponseEntity.ok(analyticsService.getApproachPerformance());
    }

    // --- Data Export Endpoint ---

    @GetMapping("/export")
    public ResponseEntity<?> exportSessionData(
            @RequestParam(required = false) String sessionId,
            @RequestParam(defaultValue = "json") String format) {

        if (format == null || format.isBlank()) {
            throw new IllegalArgumentException("Unsupported export format: null. Supported formats: json, csv");
        }

        String lowerFormat = format.trim().toLowerCase(Locale.ROOT);
        if ("csv".equals(lowerFormat)) {
            String csvData = analyticsService.exportSessionCsv(sessionId);
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"analytics_export.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csvData);
        } else if ("json".equals(lowerFormat)) {
            SessionExportDto exportDto = analyticsService.exportSessionData(sessionId, format);
            return ResponseEntity.ok(exportDto);
        } else {
            throw new IllegalArgumentException("Unsupported export format: " + format + ". Supported formats: json, csv");
        }
    }
}
