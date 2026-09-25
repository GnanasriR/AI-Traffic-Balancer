package com.kce.traffic.analytics.service;

import com.kce.traffic.analytics.dto.*;

import java.util.List;

public interface AnalyticsService {
    SessionDetailDto createSession(CreateSessionRequestDto request);
    SessionDetailDto completeSession(String sessionId);
    ApproachMetricResponseDto recordApproachMetric(String sessionId, RecordApproachMetricRequestDto request);
    PreemptionLogDto recordPreemption(String sessionId, RecordPreemptionRequestDto request);
    SessionDetailDto getSessionDetail(String sessionId);
    List<TrafficSessionResponseDto> getAllSessions();

    AnalyticsSummaryDto getSummaryMetrics();
    AnalyticsSummaryDto getSummaryMetricsForSession(String sessionId);

    List<ApproachPerformanceDto> getApproachPerformance();
    List<ApproachPerformanceDto> getApproachPerformanceForSession(String sessionId);

    SessionExportDto exportSessionData(String sessionId, String format);
    String exportSessionCsv(String sessionId);
}
