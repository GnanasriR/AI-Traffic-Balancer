package com.kce.traffic.analytics.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "TRAFFIC_SESSIONS")
public class TrafficSessionEntity {

    @Id
    @Column(name = "SESSION_ID", nullable = false, length = 64)
    private String sessionId;

    @Column(name = "TIMESTAMP", nullable = false)
    private Instant timestamp;

    @Column(name = "DELAY_REDUCTION_PCT")
    private double delayReductionPercentage;

    @Column(name = "AVG_WAIT_TIME_SEC")
    private double avgWaitTimeSeconds;

    @Column(name = "TOTAL_CLEARED_VEHICLES")
    private int totalClearedVehicles;

    @Column(name = "COMPLETED_CYCLES")
    private int completedCycles;

    @Column(name = "CONTROL_MODE", length = 32)
    private String controlMode;

    public TrafficSessionEntity() {
        this.timestamp = Instant.now();
    }

    public TrafficSessionEntity(String sessionId, double delayReductionPercentage, double avgWaitTimeSeconds, int totalClearedVehicles, int completedCycles, String controlMode) {
        this.sessionId = sessionId;
        this.timestamp = Instant.now();
        this.delayReductionPercentage = delayReductionPercentage;
        this.avgWaitTimeSeconds = avgWaitTimeSeconds;
        this.totalClearedVehicles = totalClearedVehicles;
        this.completedCycles = completedCycles;
        this.controlMode = controlMode;
    }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public double getDelayReductionPercentage() { return delayReductionPercentage; }
    public void setDelayReductionPercentage(double delayReductionPercentage) { this.delayReductionPercentage = delayReductionPercentage; }

    public double getAvgWaitTimeSeconds() { return avgWaitTimeSeconds; }
    public void setAvgWaitTimeSeconds(double avgWaitTimeSeconds) { this.avgWaitTimeSeconds = avgWaitTimeSeconds; }

    public int getTotalClearedVehicles() { return totalClearedVehicles; }
    public void setTotalClearedVehicles(int totalClearedVehicles) { this.totalClearedVehicles = totalClearedVehicles; }

    public int getCompletedCycles() { return completedCycles; }
    public void setCompletedCycles(int completedCycles) { this.completedCycles = completedCycles; }

    public String getControlMode() { return controlMode; }
    public void setControlMode(String controlMode) { this.controlMode = controlMode; }
}
