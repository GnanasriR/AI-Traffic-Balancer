package com.kce.traffic.incident.dto;

public record AmbulanceDispatchDto(
    String dir,
    String direction,
    Double priorityDurationSeconds,
    Double duration,
    Double durationSeconds
) {
    public AmbulanceDispatchDto(String dir, double priorityDurationSeconds) {
        this(dir, null, priorityDurationSeconds, null, null);
    }

    public String getEffectiveDirection() {
        if (direction != null && !direction.isBlank()) {
            return direction;
        }
        return dir;
    }

    public double getEffectiveDuration() {
        if (duration != null && duration > 0) {
            return duration;
        }
        if (durationSeconds != null && durationSeconds > 0) {
            return durationSeconds;
        }
        if (priorityDurationSeconds != null && priorityDurationSeconds > 0) {
            return priorityDurationSeconds;
        }
        return 0.0;
    }
}
