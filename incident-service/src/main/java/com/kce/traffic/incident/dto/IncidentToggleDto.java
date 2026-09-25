package com.kce.traffic.incident.dto;

public record IncidentToggleDto(
    String dir,
    String direction,
    String type,
    String title,
    String description,
    Integer lane,
    Double capacityImpact,
    Integer durationSeconds
) {
    public IncidentToggleDto(String dir, String type, String description) {
        this(dir, null, type, null, description, null, null, null);
    }

    public String getEffectiveDirection() {
        if (direction != null && !direction.isBlank()) {
            return direction;
        }
        return dir;
    }
}
