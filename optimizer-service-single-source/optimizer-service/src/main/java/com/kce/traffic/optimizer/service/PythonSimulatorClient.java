package com.kce.traffic.optimizer.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * Thin HTTP client for the SignalSync Python AI Traffic Simulator (traffic_simulator/server.py),
 * which is the single source of truth for simulation physics, vehicle taxonomy and AI signal timing.
 */
@Service
public class PythonSimulatorClient {

    private final RestClient restClient;

    public PythonSimulatorClient(@Value("${python.simulator.base-url:http://localhost:8000}") String baseUrl) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(2500);
        requestFactory.setReadTimeout(2500);

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .defaultHeader("Connection", "close")
                .build();
    }

    /** GET /api/snapshot on the Python engine — current physics/AI state, verbatim. */
    public JsonNode getSnapshot() {
        return restClient.get()
                .uri("/api/snapshot")
                .retrieve()
                .body(JsonNode.class);
    }

    /**
     * POST /api/control/{action} on the Python engine.
     */
    public JsonNode postControl(String action, Map<String, Object> payload) {
        return restClient.post()
                .uri("/api/control/{action}", action)
                .body(payload)
                .retrieve()
                .body(JsonNode.class);
    }

    /**
     * POST /api/prediction/update on the Python engine.
     */
    public JsonNode postPrediction(Map<String, Object> predictionMap) {
        return restClient.post()
                .uri("/api/prediction/update")
                .body(predictionMap)
                .retrieve()
                .body(JsonNode.class);
    }
}
