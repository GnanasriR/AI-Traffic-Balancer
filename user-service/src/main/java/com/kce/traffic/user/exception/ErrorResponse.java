package com.kce.traffic.user.exception;

import java.time.Instant;

/** Uniform error body. Deliberately excludes stack traces / internal exception details. */
public record ErrorResponse(Instant timestamp, int status, String error, String message, String path) {}
