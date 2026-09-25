package com.kce.traffic.incident.model;

import java.time.Instant;

public class EmergencyOverride {
    private boolean active;
    private String direction;
    private double initialDurationSeconds;
    private Instant activatedAt;
    private Instant expiresAt;

    public EmergencyOverride() {
        this.active = false;
        this.direction = null;
        this.initialDurationSeconds = 0.0;
        this.activatedAt = null;
        this.expiresAt = null;
    }

    public EmergencyOverride(String direction, double durationSeconds) {
        this.active = true;
        this.direction = direction;
        this.initialDurationSeconds = durationSeconds;
        this.activatedAt = Instant.now();
        this.expiresAt = this.activatedAt.plusMillis((long)(durationSeconds * 1000));
    }

    public boolean isActive() {
        if (!active || expiresAt == null) {
            return false;
        }
        if (Instant.now().isAfter(expiresAt)) {
            this.active = false;
            return false;
        }
        return true;
    }

    public void setActive(boolean active) {
        this.active = active;
        if (!active) {
            this.expiresAt = Instant.now();
        }
    }

    public String getDirection() {
        if (!isActive()) return null;
        return direction;
    }

    public void setDirection(String direction) { this.direction = direction; }

    public double getRemainingSeconds() {
        if (!active || expiresAt == null) {
            return 0.0;
        }
        long diffMillis = expiresAt.toEpochMilli() - Instant.now().toEpochMilli();
        if (diffMillis <= 0) {
            this.active = false;
            return 0.0;
        }
        return Math.round((diffMillis / 1000.0) * 10.0) / 10.0;
    }

    public void setRemainingSeconds(double remainingSeconds) {
        this.initialDurationSeconds = remainingSeconds;
        if (this.activatedAt != null) {
            this.expiresAt = this.activatedAt.plusMillis((long)(remainingSeconds * 1000));
        }
    }

    public double getInitialDurationSeconds() { return initialDurationSeconds; }

    public Instant getActivatedAt() { return activatedAt; }
    public void setActivatedAt(Instant activatedAt) { this.activatedAt = activatedAt; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
}
