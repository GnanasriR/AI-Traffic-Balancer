package com.kce.traffic.analytics.exception;

public class SessionAlreadyCompletedException extends RuntimeException {
    public SessionAlreadyCompletedException(String sessionId) {
        super("Traffic session is already completed: " + sessionId);
    }
}
