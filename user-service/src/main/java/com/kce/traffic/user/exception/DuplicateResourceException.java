package com.kce.traffic.user.exception;

/** Maps to 409 Conflict. Thrown on duplicate username/email during registration or admin creation. */
public class DuplicateResourceException extends RuntimeException {
    public DuplicateResourceException(String message) {
        super(message);
    }
}
