package com.kce.traffic.user.exception;

/**
 * Maps to 409 Conflict. Thrown when a role change, deactivation, or deletion
 * would leave the system with zero active Admin users.
 */
public class LastAdminException extends RuntimeException {
    public LastAdminException(String message) {
        super(message);
    }
}
