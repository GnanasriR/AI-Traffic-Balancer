package com.kce.traffic.incident.dto;

public record AmbulanceDispatchDto(
    String dir,
    double priorityDurationSeconds
) {}
