package com.kce.traffic.junction.model;

public enum ArmDirection {
    SOUTH("S", "South Approach"),
    NORTH("N", "North Approach"),
    EAST("E", "East Approach"),
    WEST("W", "West Approach"),
    PEDESTRIAN_SCRAMBLE("PED", "Exclusive Pedestrian Scramble Phase (All Vehicles RED)");

    private final String code;
    private final String fullName;

    ArmDirection(String code, String fullName) {
        this.code = code;
        this.fullName = fullName;
    }

    public String getCode() { return code; }
    public String getFullName() { return fullName; }
}
