package com.kce.traffic.analytics.controller;

import com.kce.traffic.analytics.dto.AnalyticsSummaryDto;
import com.kce.traffic.analytics.dto.ApproachPerformanceDto;
import com.kce.traffic.analytics.dto.SessionExportDto;
import com.kce.traffic.analytics.service.AnalyticsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/metrics")
    public ResponseEntity<AnalyticsSummaryDto> getSummaryMetrics() {
        return ResponseEntity.ok(analyticsService.getSummaryMetrics());
    }

    @GetMapping("/approaches")
    public ResponseEntity<List<ApproachPerformanceDto>> getApproachPerformance() {
        return ResponseEntity.ok(analyticsService.getApproachPerformance());
    }

    @GetMapping("/export")
    public ResponseEntity<SessionExportDto> exportSessionData(@RequestParam(defaultValue = "json") String format) {
        return ResponseEntity.ok(analyticsService.exportSessionData(format));
    }
}
