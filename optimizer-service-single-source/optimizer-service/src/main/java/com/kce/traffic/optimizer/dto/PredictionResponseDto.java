package com.kce.traffic.optimizer.dto;

public record PredictionResponseDto(
    String approach,
    int currentQueue,
    int predictedQueue15Min,
    int predictedQueue30Min,
    double congestionSeverityIndex, // 0.0 (Free Flow) to 1.0 (Gridlock)
    String trendDirection,           // "UPWARD_SURGE", "STABLE", "DECAYING"
    double estimatedSpillbackMinutes,
    String recommendation
) {}
