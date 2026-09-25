package com.kce.traffic.incident.service;

import com.kce.traffic.incident.dto.*;
import com.kce.traffic.incident.model.Incident;

public interface IncidentService {
    IncidentResponseDto getIncidentStatus();
    IncidentResponseDto createIncident(CreateIncidentRequestDto dto);
    IncidentResponseDto toggleIncident(IncidentToggleDto dto);
    IncidentResponseDto dispatchAmbulance(AmbulanceDispatchDto dto);
    IncidentResponseDto activateEmergency(EmergencyRequestDto dto);
    IncidentResponseDto clearIncident(String incidentId);
    IncidentResponseDto clearEmergency();
    Incident getIncidentById(String incidentId);
}
