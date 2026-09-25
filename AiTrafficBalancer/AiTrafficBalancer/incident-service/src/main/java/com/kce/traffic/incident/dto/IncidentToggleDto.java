package com.kce.traffic.incident.dto;

public record IncidentToggleDto(
    String dir,
    String type,
    String description
) {}
