package com.kce.traffic.incident;

import com.kce.traffic.incident.dto.*;
import com.kce.traffic.incident.exception.IncidentNotFoundException;
import com.kce.traffic.incident.model.Incident;
import com.kce.traffic.incident.model.IncidentStatus;
import com.kce.traffic.incident.model.IncidentType;
import com.kce.traffic.incident.service.IncidentServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class IncidentServiceTest {

    private IncidentServiceImpl incidentService;

    @BeforeEach
    void setUp() {
        incidentService = new IncidentServiceImpl();
        ReflectionTestUtils.setField(incidentService, "maxEmergencyDurationSeconds", 300.0);
        ReflectionTestUtils.setField(incidentService, "defaultCapacityImpact", 0.50);
    }

    @Test
    @DisplayName("Create valid collision incident")
    void testCreateCollisionIncident() {
        CreateIncidentRequestDto dto = new CreateIncidentRequestDto(
                "SOUTH", "COLLISION", "Accident at S", "Two cars collided", 0, 0.25, 60
        );
        IncidentResponseDto response = incidentService.createIncident(dto);

        assertNotNull(response);
        assertEquals(1, response.activeIncidents().size());
        Incident incident = response.activeIncidents().get(0);
        assertEquals("SOUTH", incident.getDirection());
        assertEquals(IncidentType.COLLISION, incident.getType());
        assertEquals("Accident at S", incident.getTitle());
        assertEquals(0.25, incident.getCapacityImpact());
        assertEquals(IncidentStatus.ACTIVE, incident.getStatus());
    }

    @Test
    @DisplayName("Create valid roadwork incident")
    void testCreateRoadworkIncident() {
        CreateIncidentRequestDto dto = new CreateIncidentRequestDto(
                "north", "ROADWORK", null, "Road maintenance", 1, null, null
        );
        IncidentResponseDto response = incidentService.createIncident(dto);

        assertEquals(1, response.activeIncidents().size());
        Incident incident = response.activeIncidents().get(0);
        assertEquals("NORTH", incident.getDirection());
        assertEquals(IncidentType.ROADWORK, incident.getType());
        assertEquals("Roadwork on NORTH approach", incident.getTitle());
        assertEquals(0.50, incident.getCapacityImpact()); // Default for ROADWORK
    }

    @Test
    @DisplayName("Create valid vehicle breakdown incident")
    void testCreateBreakdownIncident() {
        CreateIncidentRequestDto dto = new CreateIncidentRequestDto(
                "EAST", "VEHICLE_BREAKDOWN", "Stalled Bus", "Bus engine broke down", null, 0.50, null
        );
        IncidentResponseDto response = incidentService.createIncident(dto);

        assertEquals(1, response.activeIncidents().size());
        Incident incident = response.activeIncidents().get(0);
        assertEquals("EAST", incident.getDirection());
        assertEquals(IncidentType.VEHICLE_BREAKDOWN, incident.getType());
        assertEquals("Stalled Bus", incident.getTitle());
    }

    @Test
    @DisplayName("Reject invalid incident type")
    void testInvalidIncidentType() {
        CreateIncidentRequestDto dto = new CreateIncidentRequestDto(
                "SOUTH", "INVALID_TYPE_XYZ", "Title", "Desc", null, null, null
        );
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                incidentService.createIncident(dto)
        );
        assertTrue(ex.getMessage().contains("Invalid incident type"));
    }

    @Test
    @DisplayName("Reject invalid direction")
    void testInvalidDirection() {
        CreateIncidentRequestDto dto = new CreateIncidentRequestDto(
                "ABC_DIRECTION", "COLLISION", "Title", "Desc", null, null, null
        );
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                incidentService.createIncident(dto)
        );
        assertTrue(ex.getMessage().contains("Invalid direction"));
    }

    @Test
    @DisplayName("Incident lifecycle: create -> active -> clear -> cleared")
    void testIncidentLifecycleClear() {
        CreateIncidentRequestDto createDto = new CreateIncidentRequestDto(
                "WEST", "COLLISION", "Collision W", "Desc", 0, 0.30, null
        );
        IncidentResponseDto createResp = incidentService.createIncident(createDto);
        String incidentId = createResp.activeIncidents().get(0).getId();

        // Retrieve by ID
        Incident fetched = incidentService.getIncidentById(incidentId);
        assertEquals(IncidentStatus.ACTIVE, fetched.getStatus());

        // Clear incident
        IncidentResponseDto clearResp = incidentService.clearIncident(incidentId);
        assertEquals(0, clearResp.activeIncidents().size());

        Incident clearedFetched = incidentService.getIncidentById(incidentId);
        assertEquals(IncidentStatus.CLEARED, clearedFetched.getStatus());
        assertFalse(clearedFetched.isActive());
    }

    @Test
    @DisplayName("Incident lifecycle: automatic expiration when duration passes")
    void testIncidentExpiration() throws InterruptedException {
        CreateIncidentRequestDto createDto = new CreateIncidentRequestDto(
                "SOUTH", "OTHER", "Short Incident", "Desc", 0, 0.50, 1 // 1 second duration
        );
        IncidentResponseDto response = incidentService.createIncident(createDto);
        String incidentId = response.activeIncidents().get(0).getId();

        // Immediately active
        assertTrue(incidentService.getIncidentById(incidentId).isActive());

        // Wait 1.1s for expiration
        Thread.sleep(1100);

        // Fetch status - should now be EXPIRED and inactive
        Incident expiredIncident = incidentService.getIncidentById(incidentId);
        assertEquals(IncidentStatus.EXPIRED, expiredIncident.getStatus());
        assertFalse(expiredIncident.isActive());

        IncidentResponseDto statusResp = incidentService.getIncidentStatus();
        assertEquals(0, statusResp.activeIncidents().size());
    }

    @Test
    @DisplayName("Clear non-existent incident throws IncidentNotFoundException (404)")
    void testClearNonExistentIncident() {
        assertThrows(IncidentNotFoundException.class, () ->
                incidentService.clearIncident("inc-non-existent-id")
        );
    }

    @Test
    @DisplayName("Emergency dispatch valid emergency and auto-expiration")
    void testEmergencyDispatchAndAutoExpiration() throws InterruptedException {
        EmergencyRequestDto dto = new EmergencyRequestDto("WEST", 1.0); // 1 second emergency
        IncidentResponseDto resp = incidentService.activateEmergency(dto);

        assertTrue(resp.emergencyStatus().isActive());
        assertEquals("WEST", resp.emergencyStatus().getDirection());

        // Wait 1.1s for auto-expiration
        Thread.sleep(1100);

        assertFalse(resp.emergencyStatus().isActive());
        assertEquals(0.0, resp.emergencyStatus().getRemainingSeconds());
    }

    @Test
    @DisplayName("Reject emergency with zero duration")
    void testEmergencyZeroDuration() {
        EmergencyRequestDto dto = new EmergencyRequestDto("NORTH", 0.0);
        assertThrows(IllegalArgumentException.class, () ->
                incidentService.activateEmergency(dto)
        );
    }

    @Test
    @DisplayName("Reject emergency with negative duration")
    void testEmergencyNegativeDuration() {
        EmergencyRequestDto dto = new EmergencyRequestDto("NORTH", -10.0);
        assertThrows(IllegalArgumentException.class, () ->
                incidentService.activateEmergency(dto)
        );
    }

    @Test
    @DisplayName("Reject emergency exceeding maximum allowed duration")
    void testEmergencyExceedsMaxDuration() {
        EmergencyRequestDto dto = new EmergencyRequestDto("NORTH", 500.0); // Max is 300
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                incidentService.activateEmergency(dto)
        );
        assertTrue(ex.getMessage().contains("exceeds maximum allowed duration"));
    }
}
