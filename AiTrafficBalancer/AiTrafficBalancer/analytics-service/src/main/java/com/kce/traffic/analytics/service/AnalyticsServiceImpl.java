package com.kce.traffic.analytics.service;

import com.kce.traffic.analytics.dto.AnalyticsSummaryDto;
import com.kce.traffic.analytics.dto.ApproachPerformanceDto;
import com.kce.traffic.analytics.dto.SessionExportDto;
import com.kce.traffic.analytics.entity.TrafficSessionEntity;
import com.kce.traffic.analytics.repository.TrafficSessionRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
public class AnalyticsServiceImpl implements AnalyticsService {

    private final TrafficSessionRepository sessionRepository;

    public AnalyticsServiceImpl(TrafficSessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    @Override
    public AnalyticsSummaryDto getSummaryMetrics() {
        Map<String, Double> savings = new HashMap<>();
        savings.put("S", 35.4);
        savings.put("N", 32.1);
        savings.put("E", 28.6);
        savings.put("W", 41.2);

        return new AnalyticsSummaryDto(
            34.2,  // delayReductionPercent
            14.6,  // avgWaitTimeSeconds
            184,   // totalClearedVehicles
            12,    // totalCycles
            "ADAPTIVE_AI",
            savings
        );
    }

    @Override
    public List<ApproachPerformanceDto> getApproachPerformance() {
        return List.of(
            new ApproachPerformanceDto("S", "South Approach", 5, 18.2, 54, 72.5, false),
            new ApproachPerformanceDto("N", "North Approach", 3, 12.4, 48, 58.0, false),
            new ApproachPerformanceDto("E", "East Approach",  4, 15.1, 42, 64.0, false),
            new ApproachPerformanceDto("W", "West Approach",  1, 8.5,  40, 35.0, false)
        );
    }

    @Override
    public SessionExportDto exportSessionData(String format) {
        String sessionId = "SESS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String fmt = (format != null && format.equalsIgnoreCase("csv")) ? "CSV" : "JSON";

        AnalyticsSummaryDto summary = getSummaryMetrics();

        // Save session report to Oracle Database
        TrafficSessionEntity entity = new TrafficSessionEntity(
            sessionId,
            summary.delayReductionPercent(),
            summary.avgWaitTimeSeconds(),
            summary.totalClearedVehicles(),
            summary.totalCycles(),
            summary.activeControlMode()
        );
        sessionRepository.save(entity);

        return new SessionExportDto(
            sessionId,
            Instant.now(),
            summary,
            getApproachPerformance(),
            fmt
        );
    }
}
