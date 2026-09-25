package com.kce.traffic.analytics.util;

import java.util.Locale;

public class DirectionUtil {

    private DirectionUtil() {}

    public static String normalizeDirection(String direction) {
        if (direction == null || direction.isBlank()) {
            throw new IllegalArgumentException("Direction must not be empty");
        }
        String upper = direction.trim().toUpperCase(Locale.ROOT);
        return switch (upper) {
            case "NORTH", "N" -> "NORTH";
            case "SOUTH", "S" -> "SOUTH";
            case "EAST", "E" -> "EAST";
            case "WEST", "W" -> "WEST";
            default -> throw new IllegalArgumentException("Invalid direction: " + direction + ". Expected NORTH, SOUTH, EAST, or WEST.");
        };
    }

    public static String toShortCode(String direction) {
        String normalized = normalizeDirection(direction);
        return normalized.substring(0, 1);
    }

    public static String toFullName(String direction) {
        String normalized = normalizeDirection(direction);
        return switch (normalized) {
            case "NORTH" -> "North Approach";
            case "SOUTH" -> "South Approach";
            case "EAST" -> "East Approach";
            case "WEST" -> "West Approach";
            default -> normalized + " Approach";
        };
    }
}
