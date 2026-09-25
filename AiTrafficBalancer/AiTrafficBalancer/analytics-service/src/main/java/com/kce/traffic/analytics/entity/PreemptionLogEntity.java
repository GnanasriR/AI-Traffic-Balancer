package com.kce.traffic.analytics.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "PREEMPTION_LOGS")
public class PreemptionLogEntity {

    @Id
    @Column(name = "LOG_ID", nullable = false, length = 64)
    private String logId;

    @Column(name = "USERNAME", nullable = false, length = 64)
    private String username;

    @Column(name = "USER_ROLE", nullable = false, length = 32)
    private String userRole;

    @Column(name = "JUNCTION_ID", nullable = false, length = 32)
    private String junctionId;

    @Column(name = "DIRECTION", nullable = false, length = 8)
    private String direction;

    @Column(name = "DURATION_SECONDS")
    private double durationSeconds;

    @Column(name = "TRIGGERED_AT", nullable = false)
    private Instant triggeredAt;

    public PreemptionLogEntity() {
        this.triggeredAt = Instant.now();
    }

    public PreemptionLogEntity(String logId, String username, String userRole, String junctionId, String direction, double durationSeconds) {
        this.logId = logId;
        this.username = username;
        this.userRole = userRole;
        this.junctionId = junctionId;
        this.direction = direction;
        this.durationSeconds = durationSeconds;
        this.triggeredAt = Instant.now();
    }

    public String getLogId() { return logId; }
    public void setLogId(String logId) { this.logId = logId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getUserRole() { return userRole; }
    public void setUserRole(String userRole) { this.userRole = userRole; }

    public String getJunctionId() { return junctionId; }
    public void setJunctionId(String junctionId) { this.junctionId = junctionId; }

    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }

    public double getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(double durationSeconds) { this.durationSeconds = durationSeconds; }

    public Instant getTriggeredAt() { return triggeredAt; }
    public void setTriggeredAt(Instant triggeredAt) { this.triggeredAt = triggeredAt; }
}
