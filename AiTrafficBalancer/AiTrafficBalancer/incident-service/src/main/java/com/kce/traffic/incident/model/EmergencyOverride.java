package com.kce.traffic.incident.model;

import java.time.Instant;

public class EmergencyOverride {
    private boolean active;
    private String direction;
    private double remainingSeconds;
    private Instant activatedAt;

    public EmergencyOverride() {
        this.active = false;
        this.remainingSeconds = 0.0;
    }

    public EmergencyOverride(String direction, double remainingSeconds) {
        this.active = true;
        this.direction = direction;
        this.remainingSeconds = remainingSeconds;
        this.activatedAt = Instant.now();
    }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }

    public double getRemainingSeconds() { return remainingSeconds; }
    public void setRemainingSeconds(double remainingSeconds) { this.remainingSeconds = remainingSeconds; }

    public Instant getActivatedAt() { return activatedAt; }
    public void setActivatedAt(Instant activatedAt) { this.activatedAt = activatedAt; }
}
