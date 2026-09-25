package com.kce.traffic.analytics.exception;

public class AnalyticsSessionNotFoundException extends RuntimeException {
    public AnalyticsSessionNotFoundException(String sessionId) {
        super("Traffic session not found with ID: " + sessionId);
    }
}
