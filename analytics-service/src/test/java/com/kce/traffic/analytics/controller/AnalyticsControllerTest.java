package com.kce.traffic.analytics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kce.traffic.analytics.dto.CreateSessionRequestDto;
import com.kce.traffic.analytics.dto.RecordApproachMetricRequestDto;
import com.kce.traffic.analytics.dto.RecordPreemptionRequestDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AnalyticsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void testFullSessionLifecycleAndValidationFlow() throws Exception {
        // 1. Invalid Create Session - Negative Baseline -> 400 Bad Request
        CreateSessionRequestDto invalidBaselineDto = new CreateSessionRequestDto("JUNCTION-01", "ADAPTIVE_AI", -10.0);
        mockMvc.perform(post("/api/analytics/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidBaselineDto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Validation Failed")));

        // 2. Valid Create Session -> 201 Created
        CreateSessionRequestDto createDto = new CreateSessionRequestDto("JUNCTION-01", "ADAPTIVE_AI", 40.0);
        String responseContent = mockMvc.perform(post("/api/analytics/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sessionId", notNullValue()))
                .andExpect(jsonPath("$.status", is("ACTIVE")))
                .andReturn().getResponse().getContentAsString();

        String sessionId = objectMapper.readTree(responseContent).get("sessionId").asText();

        // 3. Record Approach Metric with Missing / Negative Fields -> 400 Bad Request
        String partialJson = "{\"direction\":\"NORTH\"}";
        mockMvc.perform(post("/api/analytics/sessions/" + sessionId + "/approaches")
                .contentType(MediaType.APPLICATION_JSON)
                .content(partialJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Validation Failed")));

        RecordApproachMetricRequestDto negativeMetricDto = new RecordApproachMetricRequestDto(
            "NORTH", -1, 4, 18.5, 30.0, 22.0, 8, false
        );
        mockMvc.perform(post("/api/analytics/sessions/" + sessionId + "/approaches")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(negativeMetricDto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)));

        // 4. Record Valid Approach Metric -> 201 Created returning DTO
        RecordApproachMetricRequestDto metricDto = new RecordApproachMetricRequestDto(
            "NORTH", 12, 4, 18.5, 30.0, 22.0, 8, false
        );
        mockMvc.perform(post("/api/analytics/sessions/" + sessionId + "/approaches")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(metricDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.direction", is("NORTH")))
                .andExpect(jsonPath("$.vehicleCount", is(12)));

        // 5. Complete Session -> 200 OK
        mockMvc.perform(post("/api/analytics/sessions/" + sessionId + "/complete"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("COMPLETED")));

        // 6. CSV Export for Invalid Session ID -> 404 Not Found
        mockMvc.perform(get("/api/analytics/export")
                .param("sessionId", "INVALID_SESSION_ID")
                .param("format", "csv"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)));

        // 7. Valid CSV Export -> 200 OK
        mockMvc.perform(get("/api/analytics/export")
                .param("sessionId", sessionId)
                .param("format", "CSV"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", containsString("text/csv")))
                .andExpect(content().string(containsString(sessionId)));
    }
}
