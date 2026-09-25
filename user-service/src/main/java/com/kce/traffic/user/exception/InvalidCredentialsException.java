package com.kce.traffic.user.exception;

/** Maps to 401 Unauthorized. Thrown for bad username/password or a deactivated account at login. */
public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException(String message) {
        super(message);
    }
}
