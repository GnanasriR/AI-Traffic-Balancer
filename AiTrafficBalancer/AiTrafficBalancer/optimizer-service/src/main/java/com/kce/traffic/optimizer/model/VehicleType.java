package com.kce.traffic.optimizer.model;

public enum VehicleType {
    TWO_WHEELER(1.8, 0.6, 12.0, 3.5, 4.5, "FLUID", 0.3, 0.5),
    AUTO_RICKSHAW(2.6, 1.4, 9.0,  2.2, 3.5, "FLUID", 0.5, 0.8),
    CAR(4.2, 1.8, 13.0, 2.8, 4.0, "STRICT", 1.0, 1.0),
    BUS(10.0, 2.5, 8.5,  1.5, 3.0, "STRICT", 1.2, 3.0),
    TRUCK(10.0, 2.5, 8.0, 1.2, 2.8, "STRICT", 1.4, 3.0);

    private final double length;
    private final double width;
    private final double maxSpeed;
    private final double acceleration;
    private final double deceleration;
    private final String laneDiscipline; // "STRICT" or "FLUID"
    private final double minGapFraction;
    private final double pce; // Passenger Car Equivalent

    VehicleType(double length, double width, double maxSpeed, double acceleration, double deceleration, String laneDiscipline, double minGapFraction, double pce) {
        this.length = length;
        this.width = width;
        this.maxSpeed = maxSpeed;
        this.acceleration = acceleration;
        this.deceleration = deceleration;
        this.laneDiscipline = laneDiscipline;
        this.minGapFraction = minGapFraction;
        this.pce = pce;
    }

    public double getLength() { return length; }
    public double getWidth() { return width; }
    public double getMaxSpeed() { return maxSpeed; }
    public double getAcceleration() { return acceleration; }
    public double getDeceleration() { return deceleration; }
    public String getLaneDiscipline() { return laneDiscipline; }
    public double getMinGapFraction() { return minGapFraction; }
    public double getPce() { return pce; }
}
