package com.kce.traffic.optimizer.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.kce.traffic.optimizer.dto.PredictionResponseDto;
import com.kce.traffic.optimizer.model.Approach;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;


@Service
public class SnapshotRelayService {

    private static final Logger log = LoggerFactory.getLogger(SnapshotRelayService.class);

    private final PythonSimulatorClient pythonSimulatorClient;
    private final TrafficWebSocketHandler webSocketHandler;
    private final TrafficPredictionService trafficPredictionService;
    private final AnalyticsServiceClient analyticsServiceClient;
    private boolean lastEmergencyActive = false;

    public SnapshotRelayService(PythonSimulatorClient pythonSimulatorClient,
                                 TrafficWebSocketHandler webSocketHandler,
                                 TrafficPredictionService trafficPredictionService,
                                 AnalyticsServiceClient analyticsServiceClient) {
        this.pythonSimulatorClient = pythonSimulatorClient;
        this.webSocketHandler = webSocketHandler;
        this.trafficPredictionService = trafficPredictionService;
        this.analyticsServiceClient = analyticsServiceClient;
    }

    @Scheduled(fixedRateString = "${python.simulator.poll-interval-ms:200}")
    public void relayTick() {
        try {
            JsonNode snapshot = pythonSimulatorClient.getSnapshot();
            webSocketHandler.broadcastSnapshot(snapshot);
        } catch (Exception e) {
            log.warn("Could not reach Python simulator for snapshot poll: {}", e.getMessage());
        }
    }

    @Scheduled(fixedRate = 2000)
    public void pushPredictionsTick() {
        try {
            JsonNode snapshot = pythonSimulatorClient.getSnapshot();
            if (snapshot == null) return;
            JsonNode approaches = snapshot.path("approaches");
            JsonNode control   = snapshot.path("control");
            JsonNode phase     = snapshot.path("phase");
            JsonNode demandNode = control.path("demand");

            // Active arm code (e.g. "E") and phase state ("green"/"yellow"/"red")
            String activeArm  = phase.path("activeArm").asText("");
            String phaseState = phase.path("state").asText("red");

            // Incident direction
            JsonNode inc = snapshot.path("incident");
            String incDir = inc.path("active").asBoolean(false) ? inc.path("dir").asText("") : "";

            Map<String, Approach> codeToApproach = Map.of(
                "S", Approach.SOUTH, "N", Approach.NORTH, "E", Approach.EAST, "W", Approach.WEST
            );

            // Build full per-approach telemetry from the live Python snapshot
            Map<Approach, TrafficPredictionService.ApproachTelemetry> telemetryMap =
                    new java.util.EnumMap<>(Approach.class);

            for (Map.Entry<String, Approach> entry : codeToApproach.entrySet()) {
                String code    = entry.getKey();
                Approach appr  = entry.getValue();
                JsonNode a     = approaches.path(code);

                int    queue      = a.path("queue").asInt(0);
                int    count      = a.path("count").asInt(queue);
                double wait       = a.path("wait").asDouble(0.0);
                // demand comes from Python in veh/min; normalise to internal scale (1.0 = 20 vpm)
                double demandVpm  = Math.max(5.0, Math.min(85.0, demandNode.path(code).asDouble(20.0)));
                double demandRate = demandVpm / 20.0;
                boolean isGreen   = "green".equalsIgnoreCase(phaseState) && code.equals(activeArm);
                boolean isIncident = code.equals(incDir);

                telemetryMap.put(appr, new TrafficPredictionService.ApproachTelemetry(
                        queue, count, wait, demandRate, isGreen, isIncident));
            }

            List<PredictionResponseDto> predictions = trafficPredictionService.predictWithTelemetry(telemetryMap);

            Map<String, Object> pythonPayload = new HashMap<>();
            for (PredictionResponseDto p : predictions) {
                pythonPayload.put(p.approach(), Map.of(
                    "predicted_queue_15min", p.predictedQueue15Min(),
                    "predicted_queue_30min", p.predictedQueue30Min(),
                    "csi", p.congestionSeverityIndex(),
                    "trend", p.trendDirection()
                ));
            }
            pythonSimulatorClient.postPrediction(pythonPayload);
            log.debug("Successfully synced AI traffic predictions from Java Optimizer to Python simulation");
        } catch (Exception ignored) {
            // Python simulator may not be online yet
        }
    }

    @Scheduled(fixedRateString = "${analytics.service.sync-interval-ms:5000}")
    public void syncAnalyticsTick() {
        if (!analyticsServiceClient.isSyncEnabled()) return;
        try {
            JsonNode snapshot = pythonSimulatorClient.getSnapshot();
            if (snapshot == null) return;

            String junctionId = snapshot.path("junction").path("id").asText("J-101");
            String controlMode = snapshot.path("control").path("mode").asText("ADAPTIVE_AI");
            double baselineWait = snapshot.path("totals").path("baselineWait").asDouble(45.0);

            String sessionId = analyticsServiceClient.ensureActiveSession(junctionId, controlMode, baselineWait);
            if (sessionId == null) return;

            JsonNode approaches = snapshot.path("approaches");
            int totalCleared = snapshot.path("totals").path("cleared").asInt(0);

            Map<String, String> dirMap = Map.of("N", "NORTH", "S", "SOUTH", "E", "EAST", "W", "WEST");
            for (Map.Entry<String, String> entry : dirMap.entrySet()) {
                String code = entry.getKey();
                String fullName = entry.getValue();
                JsonNode a = approaches.path(code);
                if (a.isMissingNode()) continue;

                int count = a.path("count").asInt(0);
                int queue = a.path("queue").asInt(0);
                double wait = a.path("wait").asDouble(0.0);
                double maxWait = Math.max(wait * 1.4, wait);
                double speed = a.path("speed").asDouble(35.0);
                boolean incidentBlocked = snapshot.path("incident").path("active").asBoolean(false)
                        && code.equalsIgnoreCase(snapshot.path("incident").path("dir").asText(""));

                Map<String, Object> metricReq = Map.of(
                        "direction", fullName,
                        "vehicleCount", count,
                        "queueLength", queue,
                        "averageWaitTime", wait,
                        "maximumWaitTime", maxWait,
                        "averageSpeed", speed,
                        "vehiclesCleared", Math.max(0, totalCleared / 4),
                        "incidentBlocked", incidentBlocked
                );
                analyticsServiceClient.recordApproachMetric(sessionId, metricReq);
            }

            boolean emergencyActive = snapshot.path("emergency").path("active").asBoolean(false);
            if (emergencyActive && !lastEmergencyActive) {
                String targetArm = snapshot.path("emergency").path("targetArm").asText("NORTH");
                double duration = snapshot.path("emergency").path("remaining").asDouble(30.0);
                analyticsServiceClient.recordPreemption(sessionId, dirMap.getOrDefault(targetArm, targetArm), duration);
            }
            lastEmergencyActive = emergencyActive;

        } catch (Exception ignored) {
            
        }
    }
}
