package com.kce.traffic.incident.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record CreateIncidentRequestDto(
    @NotBlank(message = "Direction is required")
    String direction,
    String type,
    String title,
    String description,
    Integer lane,
    Double capacityImpact,
    @Positive(message = "Duration must be positive")
    Integer durationSeconds
) {}
