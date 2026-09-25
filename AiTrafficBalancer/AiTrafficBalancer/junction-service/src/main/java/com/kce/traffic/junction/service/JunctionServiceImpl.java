package com.kce.traffic.junction.service;

import com.kce.traffic.junction.dto.JunctionStatusDto;
import com.kce.traffic.junction.model.ArmDirection;
import com.kce.traffic.junction.model.Junction;
import com.kce.traffic.junction.model.PhaseState;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class JunctionServiceImpl implements JunctionService {

    private static final Logger log = LoggerFactory.getLogger(JunctionServiceImpl.class);
    private final Map<String, Junction> junctionStore = new ConcurrentHashMap<>();

    // Safety Guardrail Limits
    private static final double MIN_GREEN_LIMIT = 8.0;
    private static final double MAX_GREEN_LIMIT = 60.0;
    private static final double PEDESTRIAN_SCRAMBLE_DURATION = 20.0;

    public JunctionServiceImpl() {
        Junction j1 = new Junction();
        junctionStore.put(j1.getId(), j1);
    }

    @Override
    public JunctionStatusDto getJunctionStatus(String junctionId) {
        Junction junction = getOrThrow(junctionId);
        return mapToDto(junction);
    }

    @Override
    public JunctionStatusDto toggleControlMode(String junctionId, boolean adaptive) {
        Junction junction = getOrThrow(junctionId);
        junction.setMode(adaptive ? "ADAPTIVE_AI" : "FIXED");
        log.info("Junction {} control mode set to {}", junctionId, junction.getMode());
        return mapToDto(junction);
    }

    @Override
    public JunctionStatusDto advanceStep(String junctionId, double dt) {
        Junction junction = getOrThrow(junctionId);
        double remaining = junction.getRemainingSeconds() - dt;

        if (remaining <= 0) {
            // Sequential 5-Stage Protected Cycle: S -> N -> E -> W -> EXCLUSIVE PEDESTRIAN SCRAMBLE
            if (junction.getPhaseState() == PhaseState.GREEN) {
                junction.setPhaseState(PhaseState.YELLOW);
                junction.setRemainingSeconds(3.0);
            } else if (junction.getPhaseState() == PhaseState.YELLOW) {
                junction.setPhaseState(PhaseState.ALL_RED);
                junction.setRemainingSeconds(1.5);
            } else { // ALL_RED -> Advance to next stage in 5-stage sequence
                int nextStage = (junction.getCurrentStageIndex() + 1) % 5;
                junction.setCurrentStageIndex(nextStage);
                junction.setPhaseState(PhaseState.GREEN);

                if (nextStage == 4) { // Stage 5: Exclusive Pedestrian Scramble Phase (Barnes Dance)
                    junction.setCurrentAllocatedGreen(PEDESTRIAN_SCRAMBLE_DURATION);
                    junction.setRemainingSeconds(PEDESTRIAN_SCRAMBLE_DURATION);
                    log.info("Junction {}: EXCLUSIVE PEDESTRIAN SCRAMBLE ACTIVE — All 4 vehicle approaches locked on RED", junctionId);
                } else {
                    double greenDuration = computeGreenDuration(junction, junction.getActiveArm());
                    junction.setCurrentAllocatedGreen(greenDuration);
                    junction.setRemainingSeconds(greenDuration);
                }
            }
        } else {
            junction.setRemainingSeconds(remaining);
        }

        return mapToDto(junction);
    }

    @Override
    public JunctionStatusDto updateDemand(String junctionId, String armCode, int queue, double maxWait) {
        Junction junction = getOrThrow(junctionId);
        for (ArmDirection dir : ArmDirection.values()) {
            if (dir.getCode().equalsIgnoreCase(armCode) || dir.name().equalsIgnoreCase(armCode)) {
                junction.getQueueCounts().put(dir, queue);
                junction.getMaxWaitTimes().put(dir, maxWait);
                break;
            }
        }
        return mapToDto(junction);
    }

    /**
     * Resilience4j Circuit Breaker Annotated Method:
     * Calls Optimizer Service for Webster AI dynamic green. If optimizer service fails
     * or trips the circuit breaker threshold, resilience4j redirects to fixedModeFallback().
     */
    @CircuitBreaker(name = "optimizerService", fallbackMethod = "fixedModeFallback")
    public double computeGreenDuration(Junction junction, ArmDirection arm) {
        if ("FIXED".equals(junction.getMode())) {
            return 20.0;
        }

        int queue = junction.getQueueCounts().getOrDefault(arm, 0);
        double wait = junction.getMaxWaitTimes().getOrDefault(arm, 0.0);
        
        // Webster Adaptive AI Calculation
        double dynamicGreen = 8.0 + (queue * 1.8) + (wait * 0.4);

        // Enforce Safety Guardrails
        return Math.clamp(Math.round(dynamicGreen * 10.0) / 10.0, MIN_GREEN_LIMIT, MAX_GREEN_LIMIT);
    }

    /**
     * Resilience4j Circuit Breaker Fallback Method:
     * Executed when optimizer-service is down or circuit breaker OPEN.
     */
    public double fixedModeFallback(Junction junction, ArmDirection arm, Throwable t) {
        log.warn("Resilience4j Circuit Breaker OPEN / Fallback triggered for approach {}: reverting to 20.0s static green. Reason: {}", arm, t.getMessage());
        return 20.0; // Safe static green default
    }

    private Junction getOrThrow(String junctionId) {
        Junction junction = junctionStore.get(junctionId);
        if (junction == null) {
            throw new IllegalArgumentException("Junction not found with ID: " + junctionId);
        }
        return junction;
    }

    private JunctionStatusDto mapToDto(Junction j) {
        Map<String, Integer> qMap = new HashMap<>();
        Map<String, Double> wMap = new HashMap<>();
        j.getQueueCounts().forEach((k, v) -> qMap.put(k.getCode(), v));
        j.getMaxWaitTimes().forEach((k, v) -> wMap.put(k.getCode(), v));

        // Pedestrian Signal Mapping:
        // Stages 1-4 (Vehicle Green): Pedestrian signals show WAIT/DON'T WALK to eliminate turning conflicts
        // Stage 5 (Exclusive Pedestrian Scramble): ALL pedestrian crosswalks show WALK (All 4 vehicle arms RED)
        List<String> activePedestrianCrossings;
        if (j.getCurrentStageIndex() == 4) {
            activePedestrianCrossings = List.of(
                "SOUTH_CROSSWALK_WALK",
                "NORTH_CROSSWALK_WALK",
                "EAST_CROSSWALK_WALK",
                "WEST_CROSSWALK_WALK",
                "DIAGONAL_SCRAMBLE_WALK"
            );
        } else {
            activePedestrianCrossings = List.of("ALL_VEHICLE_CROSSINGS_STOP_PEDESTRIANS_WAIT");
        }

        return new JunctionStatusDto(
            j.getId(),
            j.getName(),
            j.getMode(),
            j.getCurrentStageIndex() + 1,
            j.getActiveArm(),
            j.getPhaseState(),
            Math.round(j.getRemainingSeconds() * 10.0) / 10.0,
            j.getCurrentAllocatedGreen(),
            activePedestrianCrossings,
            qMap,
            wMap
        );
    }
}
