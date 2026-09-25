package com.kce.traffic.analytics.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * Payload for recording approach metric observations.
 * All measurement fields are required to prevent fake zero observations.
 * Note: vehicleCount represents observed vehicles present at the observation timestamp.
 * vehiclesCleared represents vehicles cleared during this metric observation interval.
 */
public record RecordApproachMetricRequestDto(
    @NotBlank(message = "Direction is required")
    String direction,

    @NotNull(message = "Vehicle count is required")
    @PositiveOrZero(message = "Vehicle count must be non-negative")
    Integer vehicleCount,

    @NotNull(message = "Queue length is required")
    @PositiveOrZero(message = "Queue length must be non-negative")
    Integer queueLength,

    @NotNull(message = "Average wait time is required")
    @PositiveOrZero(message = "Average wait time must be non-negative")
    Double averageWaitTime,

    @NotNull(message = "Maximum wait time is required")
    @PositiveOrZero(message = "Maximum wait time must be non-negative")
    Double maximumWaitTime,

    @NotNull(message = "Average speed is required")
    @PositiveOrZero(message = "Average speed must be non-negative")
    Double averageSpeed,

    @NotNull(message = "Vehicles cleared is required")
    @PositiveOrZero(message = "Vehicles cleared must be non-negative")
    Integer vehiclesCleared,

    Boolean incidentBlocked
) {}
