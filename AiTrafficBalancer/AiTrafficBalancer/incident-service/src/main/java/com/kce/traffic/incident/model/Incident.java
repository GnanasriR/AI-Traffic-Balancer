package com.kce.traffic.incident.model;

import java.time.Instant;

public class Incident {
    private String id;
    private boolean active;
    private IncidentType type;
    private String direction; // "S", "N", "E", "W"
    private int lane; // 0: Lane 1, 1: Lane 2
    private String title;
    private String description;
    private double hazardZoneStart;
    private double hazardZoneEnd;
    private Instant createdAt;

    public Incident() {
        this.createdAt = Instant.now();
    }

    public Incident(String id, String direction, IncidentType type, String title, String description) {
        this.id = id;
        this.active = true;
        this.type = type;
        this.direction = direction;
        this.lane = 0;
        this.title = title;
        this.description = description;
        this.hazardZoneStart = 75.0;
        this.hazardZoneEnd = 215.0;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

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

    public double getHazardZoneStart() { return hazardZoneStart; }
    public void setHazardZoneStart(double hazardZoneStart) { this.hazardZoneStart = hazardZoneStart; }

    public double getHazardZoneEnd() { return hazardZoneEnd; }
    public void setHazardZoneEnd(double hazardZoneEnd) { this.hazardZoneEnd = hazardZoneEnd; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
