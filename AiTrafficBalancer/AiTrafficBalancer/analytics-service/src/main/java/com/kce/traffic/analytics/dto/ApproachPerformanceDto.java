package com.kce.traffic.analytics.dto;

public record ApproachPerformanceDto(
    String direction,
    String fullName,
    int queueLength,
    double avgWaitSeconds,
    int clearedCount,
    double capacityUtilizationPercent,
    boolean incidentBlocked
) {}
