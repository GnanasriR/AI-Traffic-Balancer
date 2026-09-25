package com.kce.traffic.incident.service;

import com.kce.traffic.incident.dto.*;
import com.kce.traffic.incident.exception.IncidentNotFoundException;
import com.kce.traffic.incident.model.EmergencyOverride;
import com.kce.traffic.incident.model.Incident;
import com.kce.traffic.incident.model.IncidentStatus;
import com.kce.traffic.incident.model.IncidentType;
import com.kce.traffic.incident.util.DirectionUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class IncidentServiceImpl implements IncidentService {

    private static final Logger log = LoggerFactory.getLogger(IncidentServiceImpl.class);

    private final Map<String, Incident> incidentStore = new ConcurrentHashMap<>();
    private volatile EmergencyOverride emergencyOverride = new EmergencyOverride();

    @Value("${incident.emergency.max-duration:300.0}")
    private double maxEmergencyDurationSeconds;

    @Value("${incident.default-capacity-impact:0.50}")
    private double defaultCapacityImpact;

    private final org.springframework.web.client.RestClient restClient;

    public IncidentServiceImpl() {
        this("http://localhost:8000");
    }

    public IncidentServiceImpl(@Value("${python.simulator.base-url:http://localhost:8000}") String pythonUrl) {
        org.springframework.web.client.RestClient client = null;
        try {
            client = org.springframework.web.client.RestClient.builder().baseUrl(pythonUrl).build();
        } catch (Exception ignored) {}
        this.restClient = client;
    }

    private void notifyPythonSimulator(String action, Map<String, Object> payload) {
        if (restClient == null) return;
        try {
            restClient.post()
                    .uri("/api/control/{action}", action)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[SIMULATOR SYNC] Successfully forwarded {} to Python simulation", action);
        } catch (Exception e) {
            log.debug("[SIMULATOR SYNC] Could not forward {} to Python simulator: {}", action, e.getMessage());
        }
    }

    @Override
    public IncidentResponseDto getIncidentStatus() {
        cleanExpiredIncidents();
        return buildResponse("Active incident status retrieved successfully");
    }

    @Override
    public IncidentResponseDto createIncident(CreateIncidentRequestDto dto) {
        String dir = DirectionUtil.validateAndNormalize(dto.direction());
        IncidentType type = IncidentType.parseType(dto.type());

        String id = "inc-" + UUID.randomUUID().toString().substring(0, 8);
        
        String title = (dto.title() != null && !dto.title().isBlank())
                ? dto.title().trim()
                : generateDefaultTitle(type, dir);

        String desc = (dto.description() != null && !dto.description().isBlank())
                ? dto.description().trim()
                : "Incident (" + type.name() + ") reported on " + dir + " approach.";

        Incident incident = new Incident(id, dir, type, title, desc);
        
        if (dto.lane() != null) {
            incident.setLane(dto.lane());
        }
        if (dto.capacityImpact() != null) {
            if (dto.capacityImpact() <= 0 || dto.capacityImpact() > 1.0) {
                throw new IllegalArgumentException("Capacity impact must be between 0.0 and 1.0 (e.g. 0.50 for 50%)");
            }
            incident.setCapacityImpact(dto.capacityImpact());
        }
        if (dto.durationSeconds() != null) {
            if (dto.durationSeconds() <= 0) {
                throw new IllegalArgumentException("Duration must be a positive integer");
            }
            incident.setDurationSeconds(dto.durationSeconds());
        }

        incidentStore.put(id, incident);
        log.info("Incident created: id={}, type={}, direction={}, title={}, capacityImpact={}", 
                id, type, dir, title, incident.getCapacityImpact());
        notifyPythonSimulator("incident", Map.of("dir", dir));

        return buildResponse("[INCIDENT CREATED] " + type.name() + " reported on " + dir + " approach");
    }

    @Override
    public IncidentResponseDto toggleIncident(IncidentToggleDto dto) {
        String rawDir = dto.getEffectiveDirection();
        String dir = DirectionUtil.validateAndNormalize(rawDir);

        // Check if an ACTIVE incident already exists on this approach direction
        Incident existing = incidentStore.values().stream()
                .filter(i -> i.getDirection().equalsIgnoreCase(dir) && i.getStatus() == IncidentStatus.ACTIVE)
                .findFirst()
                .orElse(null);

        if (existing != null) {
            existing.setStatus(IncidentStatus.CLEARED);
            existing.setActive(false);
            log.info("Incident toggled/cleared: id={}, direction={}", existing.getId(), dir);
            notifyPythonSimulator("toggle_incident", Map.of("dir", dir));
            return buildResponse("Incident cleared on " + dir + " approach — all lanes restored");
        } else {
            IncidentType type = IncidentType.parseType(dto.type());

            String id = "inc-" + UUID.randomUUID().toString().substring(0, 8);
            String title = (dto.title() != null && !dto.title().isBlank())
                    ? dto.title().trim()
                    : generateDefaultTitle(type, dir);

            String desc = (dto.description() != null && !dto.description().isBlank())
                    ? dto.description().trim()
                    : "Incident (" + type.name() + ") reported on " + dir + " approach.";

            Incident incident = new Incident(id, dir, type, title, desc);
            
            if (dto.lane() != null) {
                incident.setLane(dto.lane());
            }
            if (dto.capacityImpact() != null) {
                if (dto.capacityImpact() <= 0 || dto.capacityImpact() > 1.0) {
                    throw new IllegalArgumentException("Capacity impact must be between 0.0 and 1.0");
                }
                incident.setCapacityImpact(dto.capacityImpact());
            }
            if (dto.durationSeconds() != null) {
                if (dto.durationSeconds() <= 0) {
                    throw new IllegalArgumentException("Duration must be positive");
                }
                incident.setDurationSeconds(dto.durationSeconds());
            }

            incidentStore.put(id, incident);
            log.info("Incident activated via toggle: id={}, type={}, direction={}", id, type, dir);
            notifyPythonSimulator("toggle_incident", Map.of("dir", dir));
            return buildResponse("[INCIDENT ACTIVATED] " + type.name() + " reported on " + dir + " approach");
        }
    }

    @Override
    public IncidentResponseDto dispatchAmbulance(AmbulanceDispatchDto dto) {
        String dir = DirectionUtil.validateAndNormalize(dto.getEffectiveDirection());
        double duration = dto.getEffectiveDuration();
        validateEmergencyDuration(duration);

        emergencyOverride = new EmergencyOverride(dir, duration);
        log.info("Emergency activated: direction={}, duration={}s", dir, duration);
        notifyPythonSimulator("emergency", Map.of("dir", dir));
        return buildResponse("[AMBULANCE DISPATCHED] Priority corridor requested for Emergency Medical Unit on " + dir + " approach");
    }

    @Override
    public IncidentResponseDto activateEmergency(EmergencyRequestDto dto) {
        String dir = DirectionUtil.validateAndNormalize(dto.direction());
        double duration = dto.duration();
        validateEmergencyDuration(duration);

        emergencyOverride = new EmergencyOverride(dir, duration);
        log.info("Emergency override activated: direction={}, duration={}s", dir, duration);
        notifyPythonSimulator("emergency", Map.of("dir", dir));
        return buildResponse("[EMERGENCY ACTIVATED] Priority corridor requested for " + dir + " approach (" + duration + "s)");
    }

    @Override
    public IncidentResponseDto clearIncident(String incidentId) {
        Incident incident = incidentStore.get(incidentId);
        if (incident == null) {
            throw new IncidentNotFoundException("Incident ID " + incidentId + " not found");
        }
        incident.setStatus(IncidentStatus.CLEARED);
        incident.setActive(false);
        log.info("Incident cleared: id={}", incidentId);
        notifyPythonSimulator("toggle_incident", Map.of("dir", incident.getDirection()));
        return buildResponse("Incident " + incidentId + " cleared successfully");
    }

    @Override
    public IncidentResponseDto clearEmergency() {
        if (emergencyOverride != null) {
            emergencyOverride.setActive(false);
        }
        emergencyOverride = new EmergencyOverride();
        log.info("Emergency override cleared by operator");
        return buildResponse("Emergency preemption cleared by operator");
    }

    @Override
    public Incident getIncidentById(String incidentId) {
        Incident incident = incidentStore.get(incidentId);
        if (incident == null) {
            throw new IncidentNotFoundException("Incident ID " + incidentId + " not found");
        }
        incident.checkExpiration();
        return incident;
    }

    private void validateEmergencyDuration(double duration) {
        if (Double.isNaN(duration) || Double.isInfinite(duration) || duration <= 0) {
            throw new IllegalArgumentException("Emergency duration must be a positive number greater than 0");
        }
        if (duration > maxEmergencyDurationSeconds) {
            throw new IllegalArgumentException("Emergency duration (" + duration + "s) exceeds maximum allowed duration of " + maxEmergencyDurationSeconds + "s");
        }
    }

    private String generateDefaultTitle(IncidentType type, String direction) {
        String typeFormatted = type.name().replace("_", " ");
        return typeFormatted.substring(0, 1).toUpperCase() + typeFormatted.substring(1).toLowerCase() + " on " + direction + " approach";
    }

    private void cleanExpiredIncidents() {
        for (Incident incident : incidentStore.values()) {
            incident.checkExpiration();
        }
    }

    private IncidentResponseDto buildResponse(String message) {
        cleanExpiredIncidents();
        List<Incident> activeList = incidentStore.values().stream()
                .filter(i -> i.getStatus() == IncidentStatus.ACTIVE)
                .collect(Collectors.toList());
        return new IncidentResponseDto(activeList, emergencyOverride, message);
    }
}
