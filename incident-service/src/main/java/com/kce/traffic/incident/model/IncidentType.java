package com.kce.traffic.incident.model;

public enum IncidentType {
    COLLISION,
    ROADWORK,
    VEHICLE_BREAKDOWN,
    EMERGENCY_AMBULANCE,
    OTHER;

    public static IncidentType parseType(String typeStr) {
        if (typeStr == null || typeStr.isBlank()) {
            return COLLISION;
        }
        String normalized = typeStr.trim().toUpperCase().replace(" ", "_");
        for (IncidentType type : IncidentType.values()) {
            if (type.name().equals(normalized)) {
                return type;
            }
        }
        // Aliases
        if ("BREAKDOWN".equals(normalized)) {
            return VEHICLE_BREAKDOWN;
        }
        if ("AMBULANCE".equals(normalized)) {
            return EMERGENCY_AMBULANCE;
        }
        throw new IllegalArgumentException("Invalid incident type: '" + typeStr + "'. Allowed types: COLLISION, ROADWORK, VEHICLE_BREAKDOWN, EMERGENCY_AMBULANCE, OTHER");
    }
}
