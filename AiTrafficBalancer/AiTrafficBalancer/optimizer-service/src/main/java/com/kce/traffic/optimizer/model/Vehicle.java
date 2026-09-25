package com.kce.traffic.optimizer.model;

public class Vehicle {
    private String id;
    private VehicleType type;
    private Approach origin;
    private double dist;
    private double speed;
    private double lateralOffset; // [-18.0 to +18.0] across approach width
    private boolean isAmbulance;
    private double waitTime;
    private boolean stopped;

    public Vehicle() {
        this.type = VehicleType.CAR;
        this.dist = 0.0;
        this.speed = 0.0;
        this.lateralOffset = 0.0;
    }

    public Vehicle(String id, VehicleType type, Approach origin) {
        this.id = id;
        this.type = type;
        this.origin = origin;
        this.dist = 0.0;
        this.speed = 0.0;
        this.lateralOffset = "FLUID".equals(type.getLaneDiscipline()) ? (Math.random() * 8.0 - 4.0) : 0.0;
        this.isAmbulance = false;
        this.waitTime = 0.0;
        this.stopped = false;
    }

    public boolean overlaps(Vehicle other) {
        if (other == null || other == this) return false;
        // Bounding box collision check: 1D longitudinal dist + 2D lateral offset
        double longitudinalGap = Math.abs(this.dist - other.dist);
        double minLongitudinalRequired = (this.type.getLength() + other.type.getLength()) / 2.0;

        double lateralGap = Math.abs(this.lateralOffset - other.lateralOffset);
        double minLateralRequired = (this.type.getWidth() + other.type.getWidth()) / 2.0;

        return longitudinalGap < minLongitudinalRequired && lateralGap < minLateralRequired;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public VehicleType getType() { return type; }
    public void setType(VehicleType type) { this.type = type; }

    public Approach getOrigin() { return origin; }
    public void setOrigin(Approach origin) { this.origin = origin; }

    public double getDist() { return dist; }
    public void setDist(double dist) { this.dist = dist; }

    public double getSpeed() { return speed; }
    public void setSpeed(double speed) { this.speed = speed; }

    public double getLateralOffset() { return lateralOffset; }
    public void setLateralOffset(double lateralOffset) { this.lateralOffset = lateralOffset; }

    public boolean isAmbulance() { return isAmbulance; }
    public void setAmbulance(boolean ambulance) { isAmbulance = ambulance; }

    public double getWaitTime() { return waitTime; }
    public void setWaitTime(double waitTime) { this.waitTime = waitTime; }

    public boolean isStopped() { return stopped; }
    public void setStopped(boolean stopped) { this.stopped = stopped; }
}
