package com.kce.traffic.user.exception;

/** Maps to 400 Bad Request. Thrown when an admin supplies a role string that isn't a valid ERole. */
public class InvalidRoleException extends RuntimeException {
    public InvalidRoleException(String message) {
        super(message);
    }
}
