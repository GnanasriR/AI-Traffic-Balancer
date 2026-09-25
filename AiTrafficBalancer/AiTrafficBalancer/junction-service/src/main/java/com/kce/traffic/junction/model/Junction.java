package com.kce.traffic.junction.model;

import java.util.EnumMap;
import java.util.Map;

public class Junction {
    private String id;
    private String name;
    private String location;
    private String mode; // "ADAPTIVE_AI" or "FIXED"
    private int currentStageIndex; // 0: SOUTH, 1: NORTH, 2: EAST, 3: WEST
    private PhaseState phaseState;
    private double remainingSeconds;
    private double currentAllocatedGreen;
    private Map<ArmDirection, Integer> queueCounts;
    private Map<ArmDirection, Double> maxWaitTimes;

    public Junction() {
        this.id = "J1";
        this.name = "Gandhipuram Central";
        this.location = "Coimbatore Main Cross Road";
        this.mode = "ADAPTIVE_AI";
        this.currentStageIndex = 0;
        this.phaseState = PhaseState.GREEN;
        this.remainingSeconds = 20.0;
        this.currentAllocatedGreen = 20.0;
        this.queueCounts = new EnumMap<>(ArmDirection.class);
        this.maxWaitTimes = new EnumMap<>(ArmDirection.class);
        for (ArmDirection dir : ArmDirection.values()) {
            this.queueCounts.put(dir, 0);
            this.maxWaitTimes.put(dir, 0.0);
        }
    }

    public ArmDirection getActiveArm() {
        return ArmDirection.values()[currentStageIndex];
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }

    public int getCurrentStageIndex() { return currentStageIndex; }
    public void setCurrentStageIndex(int currentStageIndex) { this.currentStageIndex = currentStageIndex; }

    public PhaseState getPhaseState() { return phaseState; }
    public void setPhaseState(PhaseState phaseState) { this.phaseState = phaseState; }

    public double getRemainingSeconds() { return remainingSeconds; }
    public void setRemainingSeconds(double remainingSeconds) { this.remainingSeconds = remainingSeconds; }

    public double getCurrentAllocatedGreen() { return currentAllocatedGreen; }
    public void setCurrentAllocatedGreen(double currentAllocatedGreen) { this.currentAllocatedGreen = currentAllocatedGreen; }

    public Map<ArmDirection, Integer> getQueueCounts() { return queueCounts; }
    public Map<ArmDirection, Double> getMaxWaitTimes() { return maxWaitTimes; }
}
