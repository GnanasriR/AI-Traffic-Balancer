package com.kce.traffic.incident;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kce.traffic.incident.dto.AmbulanceDispatchDto;
import com.kce.traffic.incident.dto.CreateIncidentRequestDto;
import com.kce.traffic.incident.dto.EmergencyRequestDto;
import com.kce.traffic.incident.dto.IncidentToggleDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class IncidentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("GET /api/incidents returns HTTP 200 OK")
    void testGetStatus200() throws Exception {
        mockMvc.perform(get("/api/incidents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists())
                .andExpect(jsonPath("$.activeIncidents").isArray());
    }

    @Test
    @DisplayName("POST /api/incidents returns HTTP 201 Created")
    void testCreateIncident201() throws Exception {
        CreateIncidentRequestDto dto = new CreateIncidentRequestDto(
                "SOUTH", "COLLISION", "South Accident", "Collision on lane 1", 0, 0.25, 120
        );

        mockMvc.perform(post("/api/incidents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.activeIncidents").isArray())
                .andExpect(jsonPath("$.message").value("[INCIDENT CREATED] COLLISION reported on SOUTH approach"));
    }

    @Test
    @DisplayName("POST /api/incidents with invalid direction returns HTTP 400 Bad Request")
    void testCreateIncidentInvalidDirection400() throws Exception {
        CreateIncidentRequestDto dto = new CreateIncidentRequestDto(
                "INVALID_DIR", "COLLISION", "Title", "Desc", 0, 0.50, 60
        );

        mockMvc.perform(post("/api/incidents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Invalid direction: 'INVALID_DIR'. Allowed directions: SOUTH, NORTH, EAST, WEST (or S, N, E, W)"));
    }

    @Test
    @DisplayName("POST /api/incidents with invalid type returns HTTP 400 Bad Request")
    void testCreateIncidentInvalidType400() throws Exception {
        CreateIncidentRequestDto dto = new CreateIncidentRequestDto(
                "NORTH", "NON_EXISTENT_TYPE", "Title", "Desc", 0, 0.50, 60
        );

        mockMvc.perform(post("/api/incidents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Invalid incident type: 'NON_EXISTENT_TYPE'. Allowed types: COLLISION, ROADWORK, VEHICLE_BREAKDOWN, EMERGENCY_AMBULANCE, OTHER"));
    }

    @Test
    @DisplayName("POST /api/incidents/emergency returns HTTP 201 Created")
    void testEmergency201() throws Exception {
        EmergencyRequestDto dto = new EmergencyRequestDto("EAST", 45.0);

        mockMvc.perform(post("/api/incidents/emergency")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.emergencyStatus.active").value(true))
                .andExpect(jsonPath("$.emergencyStatus.direction").value("EAST"));
    }

    @Test
    @DisplayName("POST /api/incidents/emergency with negative duration returns HTTP 400 Bad Request")
    void testEmergencyNegativeDuration400() throws Exception {
        EmergencyRequestDto dto = new EmergencyRequestDto("EAST", -10.0);

        mockMvc.perform(post("/api/incidents/emergency")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    @DisplayName("DELETE /api/incidents/{nonExistentId} returns HTTP 404 Not Found")
    void testDeleteNonExistentIncident404() throws Exception {
        mockMvc.perform(delete("/api/incidents/inc-invalid-9999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("Incident ID inc-invalid-9999 not found"));
    }

    @Test
    @DisplayName("POST /api/incidents/toggle existing contract works cleanly")
    void testToggleIncidentContract() throws Exception {
        IncidentToggleDto dto = new IncidentToggleDto("W", "ROADWORK", "Roadwork on West");

        mockMvc.perform(post("/api/incidents/toggle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeIncidents").isArray());
    }

    @Test
    @DisplayName("POST /api/incidents/ambulance existing contract works cleanly")
    void testDispatchAmbulanceContract() throws Exception {
        AmbulanceDispatchDto dto = new AmbulanceDispatchDto("N", 30.0);

        mockMvc.perform(post("/api/incidents/ambulance")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emergencyStatus.active").value(true));
    }
}
