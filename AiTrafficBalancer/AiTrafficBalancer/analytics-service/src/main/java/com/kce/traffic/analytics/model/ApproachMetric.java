package com.kce.traffic.analytics.model;

public class ApproachMetric {
    private String direction;
    private int currentQueue;
    private double avgWaitTimeSeconds;
    private int totalClearedVehicles;
    private boolean incidentActive;

    public ApproachMetric() {}

    public ApproachMetric(String direction, int currentQueue, double avgWaitTimeSeconds, int totalClearedVehicles, boolean incidentActive) {
        this.direction = direction;
        this.currentQueue = currentQueue;
        this.avgWaitTimeSeconds = avgWaitTimeSeconds;
        this.totalClearedVehicles = totalClearedVehicles;
        this.incidentActive = incidentActive;
    }

    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }

    public int getCurrentQueue() { return currentQueue; }
    public void setCurrentQueue(int currentQueue) { this.currentQueue = currentQueue; }

    public double getAvgWaitTimeSeconds() { return avgWaitTimeSeconds; }
    public void setAvgWaitTimeSeconds(double avgWaitTimeSeconds) { this.avgWaitTimeSeconds = avgWaitTimeSeconds; }

    public int getTotalClearedVehicles() { return totalClearedVehicles; }
    public void setTotalClearedVehicles(int totalClearedVehicles) { this.totalClearedVehicles = totalClearedVehicles; }

    public boolean isIncidentActive() { return incidentActive; }
    public void setIncidentActive(boolean incidentActive) { this.incidentActive = incidentActive; }
}
