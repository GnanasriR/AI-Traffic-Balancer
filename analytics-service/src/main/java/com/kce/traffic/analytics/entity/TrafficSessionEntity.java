package com.kce.traffic.analytics.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "TRAFFIC_SESSIONS")
public class TrafficSessionEntity {

    @Id
    @Column(name = "SESSION_ID", nullable = false, length = 64)
    private String sessionId;

    @Column(name = "JUNCTION_ID", nullable = false, length = 64)
    private String junctionId;

    @Column(name = "START_TIME", nullable = false)
    private Instant startTime;

    @Column(name = "END_TIME")
    private Instant endTime;

    @Column(name = "STATUS", nullable = false, length = 32)
    private String status; // ACTIVE, COMPLETED

    @Column(name = "TIMESTAMP", nullable = false)
    private Instant timestamp;

    @Column(name = "DELAY_REDUCTION_PCT")
    private Double delayReductionPercentage;

    @Column(name = "BASELINE_AVG_WAIT_SEC")
    private Double baselineAvgWaitSeconds;

    @Column(name = "AVG_WAIT_TIME_SEC")
    private double avgWaitTimeSeconds;

    @Column(name = "AVG_QUEUE_LENGTH")
    private double avgQueueLength;

    /**
     * Represents peak (maximum) observed vehicle count present across session metric samples.
     */
    @Column(name = "TOTAL_VEHICLES")
    private int totalVehicles;

    /**
     * Cumulative total vehicles cleared across interval observations.
     */
    @Column(name = "TOTAL_CLEARED_VEHICLES")
    private int totalClearedVehicles;

    @Column(name = "COMPLETED_CYCLES")
    private int completedCycles;

    @Column(name = "CONTROL_MODE", length = 32)
    private String controlMode;

    public TrafficSessionEntity() {
        this.startTime = Instant.now();
        this.timestamp = Instant.now();
        this.status = "ACTIVE";
        this.controlMode = "ADAPTIVE_AI";
    }

    public TrafficSessionEntity(String sessionId, String junctionId, String controlMode, Double baselineAvgWaitSeconds) {
        this();
        this.sessionId = sessionId;
        this.junctionId = junctionId;
        if (controlMode != null && !controlMode.isBlank()) {
            this.controlMode = controlMode;
        }
        this.baselineAvgWaitSeconds = baselineAvgWaitSeconds;
    }

    // Getters and Setters
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getJunctionId() { return junctionId; }
    public void setJunctionId(String junctionId) { this.junctionId = junctionId; }

    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }

    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public Double getDelayReductionPercentage() { return delayReductionPercentage; }
    public void setDelayReductionPercentage(Double delayReductionPercentage) { this.delayReductionPercentage = delayReductionPercentage; }

    public Double getBaselineAvgWaitSeconds() { return baselineAvgWaitSeconds; }
    public void setBaselineAvgWaitSeconds(Double baselineAvgWaitSeconds) { this.baselineAvgWaitSeconds = baselineAvgWaitSeconds; }

    public double getAvgWaitTimeSeconds() { return avgWaitTimeSeconds; }
    public void setAvgWaitTimeSeconds(double avgWaitTimeSeconds) { this.avgWaitTimeSeconds = avgWaitTimeSeconds; }

    public double getAvgQueueLength() { return avgQueueLength; }
    public void setAvgQueueLength(double avgQueueLength) { this.avgQueueLength = avgQueueLength; }

    public int getTotalVehicles() { return totalVehicles; }
    public void setTotalVehicles(int totalVehicles) { this.totalVehicles = totalVehicles; }

    public int getTotalClearedVehicles() { return totalClearedVehicles; }
    public void setTotalClearedVehicles(int totalClearedVehicles) { this.totalClearedVehicles = totalClearedVehicles; }

    public int getCompletedCycles() { return completedCycles; }
    public void setCompletedCycles(int completedCycles) { this.completedCycles = completedCycles; }

    public String getControlMode() { return controlMode; }
    public void setControlMode(String controlMode) { this.controlMode = controlMode; }
}
