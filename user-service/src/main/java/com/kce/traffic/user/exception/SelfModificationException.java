package com.kce.traffic.user.exception;

/**
 * Maps to 403 Forbidden. Thrown when an authenticated Admin attempts to
 * change their own role, deactivate their own account, or delete their
 * own account via the Admin user-management endpoints.
 */
public class SelfModificationException extends RuntimeException {
    public SelfModificationException(String message) {
        super(message);
    }
}
