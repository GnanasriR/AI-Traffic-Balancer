package com.kce.traffic.analytics.model;

import java.time.Instant;
import java.util.List;

public class TrafficSessionReport {
    private String sessionId;
    private Instant timestamp;
    private double delayReductionPercentage;
    private double avgWaitTimeSeconds;
    private int totalClearedVehicles;
    private int completedCycles;
    private String controlMode;
    private List<ApproachMetric> approachMetrics;

    public TrafficSessionReport() {
        this.timestamp = Instant.now();
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

    public List<ApproachMetric> getApproachMetrics() { return approachMetrics; }
    public void setApproachMetrics(List<ApproachMetric> approachMetrics) { this.approachMetrics = approachMetrics; }
}
