package com.kce.traffic.optimizer.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.kce.traffic.optimizer.dto.PredictionResponseDto;
import com.kce.traffic.optimizer.model.Approach;
import com.kce.traffic.optimizer.service.PythonSimulatorClient;
import com.kce.traffic.optimizer.service.TrafficPredictionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/optimizer/prediction")
public class PredictionController {

    private final TrafficPredictionService predictionService;
    private final PythonSimulatorClient pythonSimulatorClient;

    public PredictionController(TrafficPredictionService predictionService,
                                PythonSimulatorClient pythonSimulatorClient) {
        this.predictionService = predictionService;
        this.pythonSimulatorClient = pythonSimulatorClient;
    }

    /**
     * Pulls authoritative queue state and active incidents from the live Python simulation,
     * computes 15/30-minute surge forecasts, syncs them to Python, and returns them to the caller.
     */
    @GetMapping("/live")
    public ResponseEntity<List<PredictionResponseDto>> getLivePredictions() {
        JsonNode snapshot = pythonSimulatorClient.getSnapshot();
        JsonNode approaches = snapshot.path("approaches");

        JsonNode control = snapshot.path("control");
        JsonNode demand = control.path("demand");
        String activeArm = snapshot.path("activePhase").asText("");

        Map<Approach, TrafficPredictionService.ApproachTelemetry> telemetryMap = new EnumMap<>(Approach.class);
        String[] dirs = {"S", "N", "E", "W"};
        Approach[] appEnums = {Approach.SOUTH, Approach.NORTH, Approach.EAST, Approach.WEST};

        JsonNode inc = snapshot.path("incident");
        boolean incActive = inc.path("active").asBoolean(false);
        String incDir = inc.path("dir").asText("");

        for (int i = 0; i < dirs.length; i++) {
            String d = dirs[i];
            Approach app = appEnums[i];
            JsonNode appNode = approaches.path(d);

            int queue = appNode.path("queue").asInt(0);
            int count = appNode.path("count").asInt(queue);
            double wait = appNode.path("wait").asDouble(0.0);
            boolean isGreen = appNode.path("signalThrough").asBoolean(d.equalsIgnoreCase(activeArm));
            double demandRate = demand.path(d).asDouble(1.0);
            boolean isInc = incActive && d.equalsIgnoreCase(incDir);

            telemetryMap.put(app, new TrafficPredictionService.ApproachTelemetry(
                queue, count, wait, demandRate, isGreen, isInc
            ));
        }

        List<PredictionResponseDto> predictions = predictionService.predictWithTelemetry(telemetryMap);

        // Forward calculated predictions back to Python
        Map<String, Object> pythonPayload = new HashMap<>();
        for (PredictionResponseDto p : predictions) {
            pythonPayload.put(p.approach(), Map.of(
                "predicted_queue_15min", p.predictedQueue15Min(),
                "predicted_queue_30min", p.predictedQueue30Min(),
                "csi", p.congestionSeverityIndex(),
                "trend", p.trendDirection()
            ));
        }
        try {
            pythonSimulatorClient.postPrediction(pythonPayload);
        } catch (Exception ignored) {}

        return ResponseEntity.ok(predictions);
    }

    @GetMapping
    public ResponseEntity<List<PredictionResponseDto>> getPredictions(
            @RequestParam(required = false) Integer southQueue,
            @RequestParam(required = false) Integer northQueue,
            @RequestParam(required = false) Integer eastQueue,
            @RequestParam(required = false) Integer westQueue,
            @RequestParam(defaultValue = "false") boolean southIncident) {

        if (southQueue == null && northQueue == null && eastQueue == null && westQueue == null) {
            try {
                return getLivePredictions();
            } catch (Exception ignored) {
                // fall through to default values if Python is not running
            }
        }

        Map<Approach, Integer> queues = new EnumMap<>(Approach.class);
        queues.put(Approach.SOUTH, southQueue != null ? southQueue : 5);
        queues.put(Approach.NORTH, northQueue != null ? northQueue : 3);
        queues.put(Approach.EAST, eastQueue != null ? eastQueue : 4);
        queues.put(Approach.WEST, westQueue != null ? westQueue : 1);

        Map<Approach, Boolean> incidents = new EnumMap<>(Approach.class);
        incidents.put(Approach.SOUTH, southIncident);

        List<PredictionResponseDto> predictions = predictionService.predictTrafficSurges(queues, incidents);
        return ResponseEntity.ok(predictions);
    }
}
