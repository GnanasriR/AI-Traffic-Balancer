package com.kce.traffic.analytics.dto;

import java.util.Map;

public record AnalyticsSummaryDto(
    double delayReductionPercent,
    double avgWaitTimeSeconds,
    int totalClearedVehicles,
    int totalCycles,
    String activeControlMode,
    Map<String, Double> approachDelaySavings
) {}
