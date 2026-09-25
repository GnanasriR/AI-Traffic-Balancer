package com.kce.traffic.analytics.dto;

import java.time.Instant;

public record PreemptionLogDto(
    String logId,
    String sessionId,
    String username,
    String userRole,
    String junctionId,
    String direction,
    double durationSeconds,
    Instant triggeredAt
) {}
