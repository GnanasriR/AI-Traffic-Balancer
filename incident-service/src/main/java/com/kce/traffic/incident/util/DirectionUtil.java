package com.kce.traffic.incident.util;

import java.util.Set;

public class DirectionUtil {

    private static final Set<String> VALID_DIRECTIONS = Set.of(
            "SOUTH", "NORTH", "EAST", "WEST",
            "S", "N", "E", "W"
    );

    public static String validateAndNormalize(String rawDir) {
        if (rawDir == null || rawDir.isBlank()) {
            throw new IllegalArgumentException("Direction cannot be null or empty. Allowed directions: SOUTH, NORTH, EAST, WEST (or S, N, E, W)");
        }
        String normalized = rawDir.trim().toUpperCase();
        if (!VALID_DIRECTIONS.contains(normalized)) {
            throw new IllegalArgumentException("Invalid direction: '" + rawDir + "'. Allowed directions: SOUTH, NORTH, EAST, WEST (or S, N, E, W)");
        }
        return switch (normalized) {
            case "S", "SOUTH" -> "SOUTH";
            case "N", "NORTH" -> "NORTH";
            case "E", "EAST" -> "EAST";
            case "W", "WEST" -> "WEST";
            default -> throw new IllegalArgumentException("Invalid direction: '" + rawDir + "'");
        };
    }

    public static String toShortCode(String normalizedDir) {
        if (normalizedDir == null) return "S";
        return switch (normalizedDir.toUpperCase()) {
            case "SOUTH", "S" -> "S";
            case "NORTH", "N" -> "N";
            case "EAST", "E" -> "E";
            case "WEST", "W" -> "W";
            default -> "S";
        };
    }
}
