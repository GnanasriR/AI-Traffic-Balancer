package com.kce.traffic.incident.service;

import com.kce.traffic.incident.dto.AmbulanceDispatchDto;
import com.kce.traffic.incident.dto.IncidentResponseDto;
import com.kce.traffic.incident.dto.IncidentToggleDto;

public interface IncidentService {
    IncidentResponseDto getIncidentStatus();
    IncidentResponseDto toggleIncident(IncidentToggleDto dto);
    IncidentResponseDto dispatchAmbulance(AmbulanceDispatchDto dto);
    IncidentResponseDto clearIncident(String incidentId);
    IncidentResponseDto clearEmergency();
}
