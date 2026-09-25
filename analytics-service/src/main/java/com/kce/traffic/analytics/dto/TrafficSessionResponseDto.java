package com.kce.traffic.analytics.dto;

import java.time.Instant;

/**
 * Clean API response DTO representing traffic session metadata without exposing JPA entities.
 * Note: peakVehicleCount (and totalVehicles) represents maximum observed vehicle count across session metric samples.
 */
public record TrafficSessionResponseDto(
    String sessionId,
    String junctionId,
    Instant startTime,
    Instant endTime,
    String status,
    String controlMode,
    Double baselineAvgWaitSeconds,
    Double delayReductionPercentage,
    double avgWaitTimeSeconds,
    double avgQueueLength,
    int peakVehicleCount,
    int totalVehicles,
    int totalClearedVehicles,
    int completedCycles
) {}
