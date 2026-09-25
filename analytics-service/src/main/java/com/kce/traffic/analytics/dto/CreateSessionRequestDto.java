package com.kce.traffic.analytics.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * Request payload to initialize a new session-based analytics tracking session.
 */
public record CreateSessionRequestDto(
    @NotBlank(message = "Junction ID is required")
    String junctionId,
    String controlMode,
    @PositiveOrZero(message = "Baseline average wait seconds must be non-negative")
    Double baselineAvgWaitSeconds
) {}
