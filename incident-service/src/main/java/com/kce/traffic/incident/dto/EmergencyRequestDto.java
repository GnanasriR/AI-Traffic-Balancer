package com.kce.traffic.incident.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record EmergencyRequestDto(
    @NotBlank(message = "Direction is required")
    String direction,
    @Positive(message = "Duration must be positive")
    double duration
) {}
