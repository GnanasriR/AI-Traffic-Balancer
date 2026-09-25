package com.kce.traffic.analytics.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * Payload for recording emergency vehicle preemption signal override events.
 * Duration must be positive (greater than zero).
 */
public record RecordPreemptionRequestDto(
    @NotBlank(message = "Username is required")
    String username,
    @NotBlank(message = "User role is required")
    String userRole,
    @NotBlank(message = "Junction ID is required")
    String junctionId,
    @NotBlank(message = "Direction is required")
    String direction,
    @Positive(message = "Duration seconds must be positive")
    Double durationSeconds
) {}
