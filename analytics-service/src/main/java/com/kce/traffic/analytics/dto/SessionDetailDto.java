package com.kce.traffic.analytics.dto;

import java.time.Instant;
import java.util.List;

public record SessionDetailDto(
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
    int completedCycles,
    List<ApproachPerformanceDto> approaches,
    List<PreemptionLogDto> preemptionLogs
) {}
