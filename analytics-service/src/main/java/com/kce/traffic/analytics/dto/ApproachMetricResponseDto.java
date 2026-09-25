package com.kce.traffic.analytics.dto;

import java.time.Instant;

/**
 * Clean DTO representing an ingested approach metric observation without exposing JPA entities.
 */
public record ApproachMetricResponseDto(
    Long id,
    String sessionId,
    String direction,
    int vehicleCount,
    int queueLength,
    double averageWaitTime,
    double maximumWaitTime,
    double averageSpeed,
    int vehiclesCleared,
    boolean incidentBlocked,
    Instant timestamp
) {}
