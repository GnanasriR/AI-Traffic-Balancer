package com.kce.traffic.incident.model;

import java.time.Instant;

public class Incident {
    private String id;
    private IncidentStatus status;
    private IncidentType type;
    private String direction; // "SOUTH", "NORTH", "EAST", "WEST"
    private int lane; // -1: ALL lanes, 0: Lane 1, 1: Lane 2
    private String title;
    private String description;
    private double capacityImpact; // e.g. 0.50 = 50% capacity remaining
    private Integer durationSeconds; // optional duration in seconds
    private double hazardZoneStart;
    private double hazardZoneEnd;
    private Instant createdAt;
    private Instant clearedAt;
    private Instant expiredAt;

    public Incident() {
        this.createdAt = Instant.now();
        this.status = IncidentStatus.ACTIVE;
        this.lane = -1;
        this.capacityImpact = 0.50;
        this.hazardZoneStart = 75.0;
        this.hazardZoneEnd = 215.0;
    }

    public Incident(String id, String direction, IncidentType type, String title, String description) {
        this();
        this.id = id;
        this.direction = direction;
        this.type = type;
        this.title = title;
        this.description = description;
        this.capacityImpact = defaultCapacityImpactForType(type);
    }

    public boolean isActive() {
        checkExpiration();
        return this.status == IncidentStatus.ACTIVE;
    }

    public void checkExpiration() {
        if (this.status == IncidentStatus.ACTIVE && this.durationSeconds != null && this.durationSeconds > 0) {
            Instant expiresAt = this.createdAt.plusSeconds(this.durationSeconds);
            if (Instant.now().isAfter(expiresAt)) {
                this.status = IncidentStatus.EXPIRED;
                this.expiredAt = expiresAt;
            }
        }
    }

    public static double defaultCapacityImpactForType(IncidentType type) {
        if (type == null) return 0.50;
        return switch (type) {
            case COLLISION -> 0.25;       // Major reduction (25% remaining)
            case VEHICLE_BREAKDOWN -> 0.50; // Moderate reduction (50% remaining)
            case ROADWORK -> 0.50;        // Moderate reduction (50% remaining)
            case EMERGENCY_AMBULANCE -> 0.75; // Minor reduction (75% remaining)
            case OTHER -> 0.75;           // Minor reduction (75% remaining)
        };
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public IncidentStatus getStatus() { 
        checkExpiration();
        return status; 
    }
    public void setStatus(IncidentStatus status) { this.status = status; }

    public void setActive(boolean active) {
        if (active) {
            this.status = IncidentStatus.ACTIVE;
        } else {
            this.status = IncidentStatus.CLEARED;
            this.clearedAt = Instant.now();
        }
    }

    public IncidentType getType() { return type; }
    public void setType(IncidentType type) { this.type = type; }

    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }

    public int getLane() { return lane; }
    public void setLane(int lane) { this.lane = lane; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public double getCapacityImpact() { return capacityImpact; }
    public void setCapacityImpact(double capacityImpact) { this.capacityImpact = capacityImpact; }

    public Integer getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }

    public double getHazardZoneStart() { return hazardZoneStart; }
    public void setHazardZoneStart(double hazardZoneStart) { this.hazardZoneStart = hazardZoneStart; }

    public double getHazardZoneEnd() { return hazardZoneEnd; }
    public void setHazardZoneEnd(double hazardZoneEnd) { this.hazardZoneEnd = hazardZoneEnd; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getClearedAt() { return clearedAt; }
    public void setClearedAt(Instant clearedAt) { this.clearedAt = clearedAt; }

    public Instant getExpiredAt() { return expiredAt; }
    public void setExpiredAt(Instant expiredAt) { this.expiredAt = expiredAt; }
}
