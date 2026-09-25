package com.kce.traffic.analytics.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "APPROACH_METRICS")
public class ApproachMetricEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @Column(name = "SESSION_ID", nullable = false, length = 64)
    private String sessionId;

    @Column(name = "DIRECTION", nullable = false, length = 8)
    private String direction; // SOUTH, NORTH, EAST, WEST

    @Column(name = "VEHICLE_COUNT", nullable = false)
    private int vehicleCount;

    @Column(name = "QUEUE_LENGTH", nullable = false)
    private int queueLength;

    @Column(name = "AVERAGE_WAIT_TIME", nullable = false)
    private double averageWaitTime;

    @Column(name = "MAXIMUM_WAIT_TIME", nullable = false)
    private double maximumWaitTime;

    @Column(name = "AVERAGE_SPEED", nullable = false)
    private double averageSpeed;

    @Column(name = "VEHICLES_CLEARED", nullable = false)
    private int vehiclesCleared;

    @Column(name = "INCIDENT_BLOCKED")
    private boolean incidentBlocked;

    @Column(name = "TIMESTAMP", nullable = false)
    private Instant timestamp;

    public ApproachMetricEntity() {
        this.timestamp = Instant.now();
    }

    public ApproachMetricEntity(String sessionId, String direction, int vehicleCount, int queueLength, double averageWaitTime, double maximumWaitTime, double averageSpeed, int vehiclesCleared, boolean incidentBlocked) {
        this();
        this.sessionId = sessionId;
        this.direction = direction;
        this.vehicleCount = vehicleCount;
        this.queueLength = queueLength;
        this.averageWaitTime = averageWaitTime;
        this.maximumWaitTime = maximumWaitTime;
        this.averageSpeed = averageSpeed;
        this.vehiclesCleared = vehiclesCleared;
        this.incidentBlocked = incidentBlocked;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }

    public int getVehicleCount() { return vehicleCount; }
    public void setVehicleCount(int vehicleCount) { this.vehicleCount = vehicleCount; }

    public int getQueueLength() { return queueLength; }
    public void setQueueLength(int queueLength) { this.queueLength = queueLength; }

    public double getAverageWaitTime() { return averageWaitTime; }
    public void setAverageWaitTime(double averageWaitTime) { this.averageWaitTime = averageWaitTime; }

    public double getMaximumWaitTime() { return maximumWaitTime; }
    public void setMaximumWaitTime(double maximumWaitTime) { this.maximumWaitTime = maximumWaitTime; }

    public double getAverageSpeed() { return averageSpeed; }
    public void setAverageSpeed(double averageSpeed) { this.averageSpeed = averageSpeed; }

    public int getVehiclesCleared() { return vehiclesCleared; }
    public void setVehiclesCleared(int vehiclesCleared) { this.vehiclesCleared = vehiclesCleared; }

    public boolean isIncidentBlocked() { return incidentBlocked; }
    public void setIncidentBlocked(boolean incidentBlocked) { this.incidentBlocked = incidentBlocked; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}
