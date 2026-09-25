package com.kce.traffic.analytics.dto;

import java.time.Instant;
import java.util.List;

public record SessionExportDto(
    String sessionId,
    Instant exportedAt,
    AnalyticsSummaryDto summary,
    List<ApproachPerformanceDto> approaches,
    String exportFormat
) {}
