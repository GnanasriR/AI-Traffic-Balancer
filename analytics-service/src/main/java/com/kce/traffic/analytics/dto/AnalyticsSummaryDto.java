package com.kce.traffic.analytics.dto;

import java.util.Map;

/**
 * Summary metrics for an analytics session.
 * Note: approachDelaySavings maps approach direction shortcodes (N, S, E, W) to percentage delay savings
 * evaluated against the overall junction baseline wait time (baselineAvgWaitSeconds).
 */
public record AnalyticsSummaryDto(
    double delayReductionPercent,
    double avgWaitTimeSeconds,
    int totalClearedVehicles,
    int totalCycles,
    String activeControlMode,
    Map<String, Double> approachDelaySavings
) {}
