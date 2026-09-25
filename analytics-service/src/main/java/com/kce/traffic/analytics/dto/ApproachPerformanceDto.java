package com.kce.traffic.analytics.dto;

/**
 * Performance metrics breakdown for an approach direction.
 * Note: queueLength is observed queue length, clearedCount is cumulative cleared vehicles across interval observations,
 * capacityUtilizationPercent is null when road capacity configuration is unavailable.
 */
public record ApproachPerformanceDto(
    String direction,
    String fullName,
    int queueLength,
    double avgWaitSeconds,
    int clearedCount,
    Double capacityUtilizationPercent,
    boolean incidentBlocked
) {}
