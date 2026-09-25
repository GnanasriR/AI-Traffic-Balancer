package com.kce.traffic.optimizer.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kce.traffic.optimizer.dto.OptimizerDto.*;
import com.kce.traffic.optimizer.model.Approach;
import com.kce.traffic.optimizer.model.SignalColor;
import com.kce.traffic.optimizer.model.TrafficPlan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class TrafficSimulationEngine {

    private static final Logger log = LoggerFactory.getLogger(TrafficSimulationEngine.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private final WebsterOptimizerService websterOptimizerService;
    private final TrafficWebSocketHandler webSocketHandler;

    private TrafficPlan currentPlan = TrafficPlan.ADAPTIVE;
    private int currentStage = 1; // 1: SOUTH, 2: NORTH, 3: EAST, 4: WEST, 5: PED_SCRAMBLE
    private Approach currentPhase = Approach.SOUTH;
    private SignalColor currentColor = SignalColor.GREEN;

    private int phaseTimerSeconds = 25;
    private int cycleLength = 115;
    private long tickCounter = 0;
    private boolean loggedVerificationSnapshot = false;

    private boolean preemptionActive = false;
    private Approach preemptionApproach = null;

    private final Map<Approach, List<SimulatedVehicle>> approachVehicles = new EnumMap<>(Approach.class);
    private final Map<Approach, Integer> greenSplits = new EnumMap<>(Approach.class);
    private final Map<Approach, Boolean> blockedLanes = new EnumMap<>(Approach.class);

    private String lastExplanation = "System operational. Webster Adaptive AI Optimization with PCE active.";

    public static Approach assignMovement(Approach from, String turn) {
        return switch (from) {
            case NORTH -> "left".equals(turn) ? Approach.EAST : "right".equals(turn) ? Approach.WEST : Approach.SOUTH;
            case SOUTH -> "left".equals(turn) ? Approach.WEST : "right".equals(turn) ? Approach.EAST : Approach.NORTH;
            case EAST  -> "left".equals(turn) ? Approach.SOUTH : "right".equals(turn) ? Approach.NORTH : Approach.WEST;
            case WEST  -> "left".equals(turn) ? Approach.NORTH : "right".equals(turn) ? Approach.SOUTH : Approach.EAST;
        };
    }

    private static class SimulatedVehicle {
        String id;
        Approach dir;
        Approach to;
        double dist;
        double speed;
        String turn;
        String type;
        double lateralOffset;
        double pce;
        String otState = "NONE"; // "NONE", "PASSING", "ALONGSIDE", "FILTERING", "MERGING"
        double targetOtOffset = 0.0;
        String otTargetId = null;

        SimulatedVehicle(String id, Approach dir, Approach to, double dist, double speed, String turn, String type, double lateralOffset, double pce) {
            this.id = id;
            this.dir = dir;
            this.to = to;
            this.dist = dist;
            this.speed = speed;
            this.turn = turn;
            this.type = type;
            this.lateralOffset = lateralOffset;
            this.pce = pce;
        }

        VehicleDto toDto() {
            return new VehicleDto(id, dir.name(), to.name(), dist, speed, turn, type, lateralOffset, pce);
        }
    }

    public TrafficSimulationEngine(WebsterOptimizerService websterOptimizerService,
                                   TrafficWebSocketHandler webSocketHandler) {
        this.websterOptimizerService = websterOptimizerService;
        this.webSocketHandler = webSocketHandler;

        for (Approach app : Approach.values()) {
            approachVehicles.put(app, new ArrayList<>());
            seedInitialVehicles(app, 6);
        }

        greenSplits.put(Approach.NORTH, 20);
        greenSplits.put(Approach.SOUTH, 22);
        greenSplits.put(Approach.EAST, 18);
        greenSplits.put(Approach.WEST, 16);
    }

    private void seedInitialVehicles(Approach app, int count) {
        Random rand = new Random();
        for (int i = 0; i < count; i++) {
            double roll = rand.nextDouble();
            String type;
            double pce;
            double latOff;
            if (roll < 0.55) {
                type = "TWO_WHEELER"; pce = 0.5; latOff = rand.nextDouble() * 12.0 - 6.0;
            } else if (roll < 0.80) {
                type = "CAR"; pce = 1.0; latOff = 0.0;
            } else if (roll < 0.90) {
                type = "AUTO_RICKSHAW"; pce = 0.8; latOff = rand.nextDouble() * 8.0 - 4.0;
            } else if (roll < 0.97) {
                type = "BUS"; pce = 3.0; latOff = 0.0;
            } else {
                type = "TRUCK"; pce = 3.0; latOff = 0.0;
            }
            String turn = rand.nextDouble() < 0.40 ? "straight" : (rand.nextBoolean() ? "left" : "right");
            Approach to = assignMovement(app, turn);
            approachVehicles.get(app).add(new SimulatedVehicle(
                    "v_" + app.name() + "_" + i,
                    app,
                    to,
                    15.0 + i * 32.0,
                    14.0,
                    turn,
                    type,
                    latOff,
                    pce
            ));
        }
    }

    @Scheduled(fixedRateString = "${traffic.simulation.interval-ms:200}")
    public void simulationTick() {
        tickCounter++;
        double dt = 0.20; // 200 ms per tick

        // Smooth physics step executed on EVERY 200ms tick (5 Hz)
        stepVehiclePhysics(dt);

        // Every 5 ticks = 1 second countdown & spawn
        if (tickCounter % 5 == 0) {
            updateTrafficStateOneSecond();
        }

        SnapshotDto snapshot = buildCurrentSnapshot();

        if (!loggedVerificationSnapshot && tickCounter >= 5) {
            loggedVerificationSnapshot = true;
            try {
                String jsonLog = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(snapshot);
                log.info("\n=== VERIFIED WEBSOCKET SNAPSHOT PAYLOAD WITH VEHICLE TYPING & PCE METRICS ===\n{}", jsonLog);
            } catch (Exception e) {
                log.error("Failed to log verification snapshot JSON", e);
            }
        }

        webSocketHandler.broadcastSnapshot(snapshot);
    }

    private static double getVehicleLength(String type) {
        if ("BUS".equals(type) || "TRUCK".equals(type)) return 42.0;
        if ("AUTO_RICKSHAW".equals(type)) return 22.0;
        if ("TWO_WHEELER".equals(type)) return 16.0;
        return 28.0; // CAR
    }

    private static double getVehicleWidth(String type) {
        if ("BUS".equals(type) || "TRUCK".equals(type)) return 18.0;
        if ("AUTO_RICKSHAW".equals(type)) return 11.0;
        if ("TWO_WHEELER".equals(type)) return 7.0;
        return 15.0; // CAR
    }

    private void stepVehiclePhysics(double dt) {
        for (Approach app : Approach.values()) {
            List<SimulatedVehicle> list = approachVehicles.get(app);
            boolean isGreen = (currentColor == SignalColor.GREEN && currentPhase == app);
            double stopLine = (app == Approach.NORTH || app == Approach.SOUTH) ? 248.0 : 448.0;

            // Sort vehicles by distance descending (head of queue first)
            list.sort((SimulatedVehicle a, SimulatedVehicle b) -> Double.compare(b.dist, a.dist));

            // Pre-calculate candidate target lateral shifts for weaving & overtaking
            double[] candLats = new double[list.size()];
            for (int idx = 0; idx < list.size(); idx++) {
                SimulatedVehicle v = list.get(idx);
                if ("PASSING".equals(v.otState) || "ALONGSIDE".equals(v.otState) || "FILTERING".equals(v.otState)) {
                    double stepShift = (v.targetOtOffset - v.lateralOffset) * dt * 3.0;
                    candLats[idx] = v.lateralOffset + stepShift;
                } else if ("MERGING".equals(v.otState)) {
                    double stepShift = (0.0 - v.lateralOffset) * dt * 3.0;
                    candLats[idx] = v.lateralOffset + stepShift;
                } else if (("TWO_WHEELER".equals(v.type) || "AUTO_RICKSHAW".equals(v.type)) && v.dist < stopLine - 20) {
                    double targetShift = (idx % 2 == 0 ? 1.0 : -1.0) * ("TWO_WHEELER".equals(v.type) ? 5.0 : 3.0);
                    double stepShift = (targetShift - v.lateralOffset) * dt * 2.0;
                    candLats[idx] = v.lateralOffset + stepShift;
                } else {
                    candLats[idx] = v.lateralOffset;
                }
            }

            for (int i = 0; i < list.size(); i++) {
                SimulatedVehicle v = list.get(i);
                double vL = getVehicleLength(v.type);
                double vW = getVehicleWidth(v.type);
                double maxFreeSpeed = "TWO_WHEELER".equals(v.type) ? 140.0 : ("BUS".equals(v.type) || "TRUCK".equals(v.type) ? 95.0 : 120.0);

                // Overtaking & Queued Filtering Initiation for FLUID vehicles
                if ("NONE".equals(v.otState) && ("TWO_WHEELER".equals(v.type) || "AUTO_RICKSHAW".equals(v.type)) && v.dist < stopLine - 25) {
                    for (int j = 0; j < i; j++) {
                        SimulatedVehicle lead = list.get(j);
                        double distGap = lead.dist - v.dist;
                        double leadL = getVehicleLength(lead.type);
                        double reqDistGap = (vL + leadL) / 2.0 + 35.0;

                        // Case A: Moving overtake behind slower vehicle
                        boolean canMovingOvertake = (distGap > 0 && distGap < reqDistGap && lead.speed < maxFreeSpeed - 15.0 && isGreen);
                        // Case B: Stationary / Queued filtering alongside stopped vehicle at RED
                        boolean canQueuedFilter = (distGap > 0 && distGap < reqDistGap && lead.speed < 5.0 && !isGreen);

                        if (canMovingOvertake || canQueuedFilter) {
                            double sideOffset = (v.lateralOffset >= lead.lateralOffset) ? 14.0 : -14.0;
                            double testOtOffset = lead.lateralOffset + sideOffset;

                            boolean passClear = true;
                            for (int k = 0; k < list.size(); k++) {
                                if (k == i) continue;
                                SimulatedVehicle other = list.get(k);
                                double otherL = getVehicleLength(other.type);
                                double otherW = getVehicleWidth(other.type);
                                double reqLat = (vW + otherW) / 2.0 + 3.0;

                                if (Math.abs(v.dist - other.dist) < (vL + otherL) / 2.0 + 20.0) {
                                    if (Math.abs(testOtOffset - other.lateralOffset) < reqLat) {
                                        passClear = false;
                                        break;
                                    }
                                }
                            }

                            if (passClear) {
                                v.otState = canQueuedFilter ? "FILTERING" : "PASSING";
                                v.targetOtOffset = testOtOffset;
                                v.otTargetId = lead.id;
                                break;
                            }
                        }
                    }
                }

                // Update Overtaking State Machine
                if ("PASSING".equals(v.otState)) {
                    if (Math.abs(v.lateralOffset - v.targetOtOffset) < 1.0) {
                        v.otState = "ALONGSIDE";
                    }
                } else if ("ALONGSIDE".equals(v.otState)) {
                    SimulatedVehicle lead = null;
                    for (SimulatedVehicle cand : list) {
                        if (cand.id.equals(v.otTargetId)) { lead = cand; break; }
                    }
                    if (lead == null || v.dist > lead.dist + (vL + getVehicleLength(lead.type)) / 2.0 + 15.0) {
                        v.otState = "MERGING";
                    }
                } else if ("FILTERING".equals(v.otState)) {
                    if (isGreen) {
                        v.otState = "ALONGSIDE";
                    }
                } else if ("MERGING".equals(v.otState)) {
                    if (Math.abs(v.lateralOffset - 0.0) < 0.8) {
                        v.otState = "NONE";
                        v.lateralOffset = 0.0;
                    }
                }

                double limit = 1200.0; // Drive off screen past 1150px

                // Check against ALL vehicles ahead on the same approach
                for (int j = 0; j < i; j++) {
                    SimulatedVehicle lead = list.get(j);
                    double leadL = getVehicleLength(lead.type);
                    double leadW = getVehicleWidth(lead.type);

                    double reqLatGap = (vW + leadW) / 2.0 + 2.0; // 2px lateral buffer
                    double latDiff = Math.abs(v.lateralOffset - lead.lateralOffset);

                    if (latDiff < reqLatGap) { // Footprints overlap laterally
                        double reqDistGap = (vL + leadL) / 2.0 + 10.0; // 10px longitudinal safety buffer
                        double safeDist = lead.dist - reqDistGap;
                        if (safeDist < limit) {
                            limit = safeDist;
                        }
                    }
                }

                // FLUID vehicle lateral offset application with strict 2D safety
                double candLat = candLats[i];
                boolean canMoveLat = true;

                for (int k = 0; k < list.size(); k++) {
                    if (k == i) continue;
                    SimulatedVehicle other = list.get(k);
                    double otherL = getVehicleLength(other.type);
                    double otherW = getVehicleWidth(other.type);
                    double reqDistGap = (vL + otherL) / 2.0 + 10.0;
                    double reqLatGap = (vW + otherW) / 2.0 + 3.0;

                    if (Math.abs(v.dist - other.dist) < reqDistGap) {
                        if (Math.abs(candLat - other.lateralOffset) < reqLatGap || Math.abs(candLat - candLats[k]) < reqLatGap) {
                            canMoveLat = false;
                            break;
                        }
                    }
                }

                if (canMoveLat) {
                    v.lateralOffset = candLat;
                }

                // Stop line enforcement on RED (unless past stopline)
                if (!isGreen && !preemptionActive) {
                    if (v.dist <= stopLine + 5.0) {
                        limit = Math.min(limit, stopLine);
                    }
                }

                // Target speed calculation with turn deceleration inside intersection
                double targetSpeed = maxFreeSpeed;
                if (v.dist > stopLine && v.dist < stopLine + 148.0 && !"straight".equals(v.turn)) {
                    targetSpeed = "left".equals(v.turn) ? 50.0 : 65.0; // Left is tighter inner turn, right is wider curve
                }

                double targetDist = Math.min(v.dist + targetSpeed * dt, limit);
                v.speed = Math.max(0, (targetDist - v.dist) / dt);
                v.dist = Math.max(v.dist, Math.min(targetDist, limit));

                // Strict stopline enforcement on RED
                if (!isGreen && !preemptionActive && v.dist >= stopLine && v.dist <= stopLine + 5.0) {
                    v.dist = stopLine;
                    v.speed = 0.0;
                }
            }

            // Remove vehicles that ran completely off screen (past 1150px)
            list.removeIf(v -> v.dist > 1150.0);
        }
    }

    private void updateTrafficStateOneSecond() {
        Random rand = new Random();

        // Natural vehicle spawning with Indian taxonomy and 2D footprint safety check
        for (Approach app : Approach.values()) {
            List<SimulatedVehicle> list = approachVehicles.get(app);
            if (rand.nextDouble() < 0.40 && list.size() < 25) {
                double roll = rand.nextDouble();
                String type;
                double pce;
                double latOff;
                if (roll < 0.55) {
                    type = "TWO_WHEELER"; pce = 0.5; latOff = rand.nextDouble() * 10.0 - 5.0;
                } else if (roll < 0.80) {
                    type = "CAR"; pce = 1.0; latOff = 0.0;
                } else if (roll < 0.90) {
                    type = "AUTO_RICKSHAW"; pce = 0.8; latOff = rand.nextDouble() * 6.0 - 3.0;
                } else if (roll < 0.97) {
                    type = "BUS"; pce = 3.0; latOff = 0.0;
                } else {
                    type = "TRUCK"; pce = 3.0; latOff = 0.0;
                }
                String turn = rand.nextDouble() < 0.40 ? "straight" : (rand.nextBoolean() ? "left" : "right");
                Approach to = assignMovement(app, turn);

                double spawnL = getVehicleLength(type);
                double spawnW = getVehicleWidth(type);
                boolean spawnClear = true;

                for (SimulatedVehicle existing : list) {
                    double existL = getVehicleLength(existing.type);
                    double existW = getVehicleWidth(existing.type);
                    double reqLatGap = (spawnW + existW) / 2.0 + 3.0;
                    double reqDistGap = (spawnL + existL) / 2.0 + 15.0;

                    if (existing.dist < reqDistGap && Math.abs(latOff - existing.lateralOffset) < reqLatGap) {
                        spawnClear = false;
                        break;
                    }
                }

                if (spawnClear) {
                    list.add(new SimulatedVehicle("v_" + System.currentTimeMillis() + "_" + rand.nextInt(100), app, to, 0.0, 15.0, turn, type, latOff, pce));
                }
            }
        }

        phaseTimerSeconds--;
        if (phaseTimerSeconds <= 0) {
            advancePhase();
        }
    }

    private void advancePhase() {
        if (preemptionActive && preemptionApproach != null) {
            currentPhase = preemptionApproach;
            currentColor = SignalColor.GREEN;
            phaseTimerSeconds = 20;
            lastExplanation = "Emergency Preemption: Green wave corridor active for approach " + preemptionApproach;
            return;
        }

        if (currentColor == SignalColor.GREEN) {
            currentColor = SignalColor.YELLOW;
            phaseTimerSeconds = 3;
            lastExplanation = "Phase transition: 3-second yellow clearance interval";
        } else if (currentColor == SignalColor.YELLOW) {
            currentColor = SignalColor.RED;
            phaseTimerSeconds = 1;
            lastExplanation = "All-red junction clearance safe interval";
        } else {
            currentStage = (currentStage % 5) + 1;
            switch (currentStage) {
                case 1 -> { currentPhase = Approach.SOUTH; currentColor = SignalColor.GREEN; }
                case 2 -> { currentPhase = Approach.NORTH; currentColor = SignalColor.GREEN; }
                case 3 -> { currentPhase = Approach.EAST;  currentColor = SignalColor.GREEN; }
                case 4 -> { currentPhase = Approach.WEST;  currentColor = SignalColor.GREEN; }
                case 5 -> { currentPhase = null;           currentColor = SignalColor.RED; }
            }

            if (currentStage == 5) {
                phaseTimerSeconds = 20;
                lastExplanation = "Stage 5: Exclusive Pedestrian Scramble Phase (Barnes Dance) — All vehicle signals RED, all crosswalks WALK";
            } else if (currentPlan == TrafficPlan.ADAPTIVE) {
                Map<Approach, Double> pceQueues = new EnumMap<>(Approach.class);
                for (Approach app : Approach.values()) {
                    double pceSum = approachVehicles.get(app).stream().mapToDouble(v -> v.pce).sum();
                    pceQueues.put(app, Math.max(1.0, pceSum));
                }
                var optimal = websterOptimizerService.calculateOptimalTimingPCE(pceQueues);
                cycleLength = optimal.optimalCycleLength();
                greenSplits.putAll(optimal.greenSplits());
                phaseTimerSeconds = greenSplits.getOrDefault(currentPhase, 20);
                lastExplanation = String.format("Webster AI: Granted %ds green to %s (PCE: %.1f, Cycle: %ds)",
                        phaseTimerSeconds, currentPhase, pceQueues.get(currentPhase), cycleLength);
            } else {
                phaseTimerSeconds = 20;
                lastExplanation = "Fixed-time plan: Standard 20s green assigned to " + currentPhase;
            }
        }
    }

    public synchronized void setPlan(TrafficPlan plan) {
        this.currentPlan = plan;
        this.lastExplanation = "Traffic plan switched by operator to " + plan;
        log.info("Plan changed to: {}", plan);
    }

    public synchronized void manualOverride(Approach approach, int durationSeconds) {
        this.currentPhase = approach;
        this.currentColor = SignalColor.GREEN;
        this.phaseTimerSeconds = Math.max(10, durationSeconds);
        this.lastExplanation = "Manual operator override granted " + phaseTimerSeconds + "s green to " + approach;
    }

    public synchronized void handlePreemption(Approach approach, boolean active) {
        this.preemptionActive = active;
        this.preemptionApproach = active ? approach : null;
        if (active) {
            this.currentPhase = approach;
            this.currentColor = SignalColor.GREEN;
            this.phaseTimerSeconds = 25;
            this.lastExplanation = "Emergency Preemption: High-priority green wave triggered on " + approach;
        } else {
            this.lastExplanation = "Emergency vehicle cleared. Normal adaptive cycle resuming.";
        }
    }

    public synchronized void handleIncident(Approach approach, int lane, boolean blocked) {
        this.blockedLanes.put(approach, blocked);
        this.lastExplanation = blocked
                ? String.format("Incident reported on %s lane %d. Safety cones active.", approach, lane)
                : String.format("Incident cleared on %s. Normal lane flow restored.", approach);
    }

    public SnapshotDto buildCurrentSnapshot() {
        Map<Approach, ApproachStatus> approachMap = new EnumMap<>(Approach.class);
        List<VehicleDto> vehicleDtos = new ArrayList<>();

        for (Approach app : Approach.values()) {
            SignalColor color;
            if (app == currentPhase && currentColor == SignalColor.GREEN) {
                color = SignalColor.GREEN;
            } else if (app == currentPhase && currentColor == SignalColor.YELLOW) {
                color = SignalColor.YELLOW;
            } else {
                color = SignalColor.RED;
            }

            List<SimulatedVehicle> list = approachVehicles.get(app);
            double stopLine = (app == Approach.NORTH || app == Approach.SOUTH) ? 248.0 : 448.0;
            int vehicleCount = list.size();
            int queueCount = (int) list.stream().filter(v -> v.dist < stopLine + 5.0).count();
            double effectivePce = list.stream().mapToDouble(v -> v.pce).sum();
            double flowRate = Math.round((queueCount * 45.5) * 10.0) / 10.0;
            double avgWait = Math.round((queueCount * 2.8) * 10.0) / 10.0;

            approachMap.put(app, new ApproachStatus(app, color, queueCount, vehicleCount, Math.round(effectivePce * 10.0) / 10.0, flowRate, avgWait));
            for (SimulatedVehicle v : list) {
                vehicleDtos.add(v.toDto());
            }
        }

        Map<String, String> crosswalks = new HashMap<>();
        if (currentStage == 5) {
            if (currentColor == SignalColor.GREEN || currentColor == SignalColor.RED) {
                crosswalks.put("N", "WALK"); crosswalks.put("S", "WALK");
                crosswalks.put("E", "WALK"); crosswalks.put("W", "WALK");
            } else {
                crosswalks.put("N", "CLEARANCE"); crosswalks.put("S", "CLEARANCE");
                crosswalks.put("E", "CLEARANCE"); crosswalks.put("W", "CLEARANCE");
            }
        } else {
            crosswalks.put("N", "DONT_WALK"); crosswalks.put("S", "DONT_WALK");
            crosswalks.put("E", "DONT_WALK"); crosswalks.put("W", "DONT_WALK");
        }

        return new SnapshotDto(
                System.currentTimeMillis(),
                currentPlan,
                currentPhase,
                currentColor,
                phaseTimerSeconds,
                cycleLength,
                approachMap,
                vehicleDtos,
                crosswalks,
                lastExplanation,
                preemptionActive,
                preemptionApproach
        );
    }
}