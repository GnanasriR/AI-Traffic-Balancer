package com.kce.traffic.user.dto;

public class AuthDto {

    public record LoginRequest(String username, String password) {}

    public record SignupRequest(String username, String email, String password, String role) {}

    public record AuthResponse(String token, Long id, String username, String email, String role) {}

    public record ApiResponse(boolean success, String message) {}

    public record UserSummary(Long id, String username, String email, String role, boolean active) {}
}