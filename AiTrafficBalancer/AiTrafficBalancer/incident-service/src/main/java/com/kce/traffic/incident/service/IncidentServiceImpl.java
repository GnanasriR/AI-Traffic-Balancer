package com.kce.traffic.incident.service;

import com.kce.traffic.incident.dto.AmbulanceDispatchDto;
import com.kce.traffic.incident.dto.IncidentResponseDto;
import com.kce.traffic.incident.dto.IncidentToggleDto;
import com.kce.traffic.incident.model.EmergencyOverride;
import com.kce.traffic.incident.model.Incident;
import com.kce.traffic.incident.model.IncidentType;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class IncidentServiceImpl implements IncidentService {

    private final Map<String, Incident> incidentStore = new ConcurrentHashMap<>();
    private volatile EmergencyOverride emergencyOverride = new EmergencyOverride();

    @Override
    public IncidentResponseDto getIncidentStatus() {
        return buildResponse("Active incident status retrieved successfully");
    }

    @Override
    public IncidentResponseDto toggleIncident(IncidentToggleDto dto) {
        String dir = dto.dir() != null ? dto.dir().toUpperCase() : "S";

        // Check if an incident already exists on this approach direction
        Incident existing = incidentStore.values().stream()
                .filter(i -> i.getDirection().equalsIgnoreCase(dir) && i.isActive())
                .findFirst()
                .orElse(null);

        if (existing != null) {
            existing.setActive(false);
            incidentStore.remove(existing.getId());
            return buildResponse("Incident cleared on " + dir + " approach — all lanes restored");
        } else {
            String id = "inc-" + UUID.randomUUID().toString().substring(0, 8);
            String title = "Collision on " + dir + " approach";
            String desc = dto.description() != null ? dto.description() : "Two vehicles collided before stop line. Lane 1 blocked — safety cones deployed.";
            
            Incident incident = new Incident(id, dir, IncidentType.COLLISION, title, desc);
            incidentStore.put(id, incident);
            return buildResponse("[INCIDENT ACTIVATED] Collision reported on " + dir + " approach — Lane 1 blocked");
        }
    }

    @Override
    public IncidentResponseDto dispatchAmbulance(AmbulanceDispatchDto dto) {
        String dir = dto.dir() != null ? dto.dir().toUpperCase() : "S";
        double duration = dto.priorityDurationSeconds() > 0 ? dto.priorityDurationSeconds() : 30.0;

        emergencyOverride = new EmergencyOverride(dir, duration);
        return buildResponse("[AMBULANCE DISPATCHED] Priority green corridor activated for Emergency Medical Unit on " + dir + " approach");
    }

    @Override
    public IncidentResponseDto clearIncident(String incidentId) {
        Incident removed = incidentStore.remove(incidentId);
        String msg = (removed != null) 
                ? "Incident " + incidentId + " cleared successfully" 
                : "Incident ID " + incidentId + " not found";
        return buildResponse(msg);
    }

    @Override
    public IncidentResponseDto clearEmergency() {
        emergencyOverride = new EmergencyOverride();
        return buildResponse("Emergency preemption cleared by operator — resuming standard cycle");
    }

    private IncidentResponseDto buildResponse(String message) {
        List<Incident> activeList = new ArrayList<>(incidentStore.values());
        return new IncidentResponseDto(activeList, emergencyOverride, message);
    }
}
