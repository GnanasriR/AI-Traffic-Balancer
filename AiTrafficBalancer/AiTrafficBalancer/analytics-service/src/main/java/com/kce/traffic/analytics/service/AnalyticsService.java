package com.kce.traffic.analytics.service;

import com.kce.traffic.analytics.dto.AnalyticsSummaryDto;
import com.kce.traffic.analytics.dto.ApproachPerformanceDto;
import com.kce.traffic.analytics.dto.SessionExportDto;

import java.util.List;

public interface AnalyticsService {
    AnalyticsSummaryDto getSummaryMetrics();
    List<ApproachPerformanceDto> getApproachPerformance();
    SessionExportDto exportSessionData(String format);
}
