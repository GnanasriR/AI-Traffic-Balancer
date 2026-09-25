package com.kce.traffic.incident.controller;

import com.kce.traffic.incident.dto.AmbulanceDispatchDto;
import com.kce.traffic.incident.dto.IncidentResponseDto;
import com.kce.traffic.incident.dto.IncidentToggleDto;
import com.kce.traffic.incident.service.IncidentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {

    private final IncidentService incidentService;

    public IncidentController(IncidentService incidentService) {
        this.incidentService = incidentService;
    }

    @GetMapping
    public ResponseEntity<IncidentResponseDto> getStatus() {
        return ResponseEntity.ok(incidentService.getIncidentStatus());
    }

    @PostMapping("/toggle")
    public ResponseEntity<IncidentResponseDto> toggleIncident(@RequestBody IncidentToggleDto dto) {
        return ResponseEntity.ok(incidentService.toggleIncident(dto));
    }

    @PostMapping("/ambulance")
    public ResponseEntity<IncidentResponseDto> dispatchAmbulance(@RequestBody AmbulanceDispatchDto dto) {
        return ResponseEntity.ok(incidentService.dispatchAmbulance(dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<IncidentResponseDto> clearIncident(@PathVariable String id) {
        return ResponseEntity.ok(incidentService.clearIncident(id));
    }

    @DeleteMapping("/emergency")
    public ResponseEntity<IncidentResponseDto> clearEmergency() {
        return ResponseEntity.ok(incidentService.clearEmergency());
    }
}
