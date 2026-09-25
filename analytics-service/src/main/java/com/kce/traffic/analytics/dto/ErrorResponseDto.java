package com.kce.traffic.analytics.dto;

import java.time.Instant;

public record ErrorResponseDto(
    Instant timestamp,
    int status,
    String error,
    String message,
    String path
) {
    public ErrorResponseDto(int status, String error, String message, String path) {
        this(Instant.now(), status, error, message, path);
    }
}
