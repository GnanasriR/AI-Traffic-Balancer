package com.kce.traffic.incident.controller;

import com.kce.traffic.incident.dto.*;
import com.kce.traffic.incident.model.Incident;
import com.kce.traffic.incident.service.IncidentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "*")
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

    @GetMapping("/{id}")
    public ResponseEntity<Incident> getIncidentById(@PathVariable String id) {
        return ResponseEntity.ok(incidentService.getIncidentById(id));
    }

    @PostMapping
    public ResponseEntity<IncidentResponseDto> createIncident(@Valid @RequestBody CreateIncidentRequestDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(incidentService.createIncident(dto));
    }

    @PostMapping("/toggle")
    public ResponseEntity<IncidentResponseDto> toggleIncident(@RequestBody IncidentToggleDto dto) {
        return ResponseEntity.ok(incidentService.toggleIncident(dto));
    }

    @PostMapping("/ambulance")
    public ResponseEntity<IncidentResponseDto> dispatchAmbulance(@RequestBody AmbulanceDispatchDto dto) {
        return ResponseEntity.ok(incidentService.dispatchAmbulance(dto));
    }

    @PostMapping("/emergency")
    public ResponseEntity<IncidentResponseDto> activateEmergency(@Valid @RequestBody EmergencyRequestDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(incidentService.activateEmergency(dto));
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
