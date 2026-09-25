package com.kce.traffic.user.exception;

/** Maps to 404 Not Found. Thrown when a requested user id/username does not exist. */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
