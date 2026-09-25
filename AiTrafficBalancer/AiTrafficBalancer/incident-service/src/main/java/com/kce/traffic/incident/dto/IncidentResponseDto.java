package com.kce.traffic.incident.dto;

import com.kce.traffic.incident.model.EmergencyOverride;
import com.kce.traffic.incident.model.Incident;

import java.util.List;

public record IncidentResponseDto(
    List<Incident> activeIncidents,
    EmergencyOverride emergencyStatus,
    String message
) {}
