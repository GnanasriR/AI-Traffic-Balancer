package com.kce.traffic.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDto {

    public record LoginRequest(
            @NotBlank String username,
            @NotBlank String password
    ) {}

    /**
     * Public self-registration payload. Deliberately has NO role field:
     * every public signup is forced to ROLE_OPERATOR in UserService#register.
     * A client cannot request ADMIN/EMERGENCY/ANALYST through this endpoint.
     */
    public record SignupRequest(
            @NotBlank @Size(min = 3, max = 50) String username,
            @NotBlank @Email @Size(max = 100) String email,
            @NotBlank @Size(min = 8, max = 100) String password
    ) {}

    /**
     * Admin-only user creation. This is the ONLY place a role can be supplied
     * by a client, and it is still validated against ERole server-side.
     */
    public record AdminCreateUserRequest(
            @NotBlank @Size(min = 3, max = 50) String username,
            @NotBlank @Email @Size(max = 100) String email,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotBlank String role
    ) {}

    public record UpdateRoleRequest(@NotBlank String role) {}

    public record UpdateStatusRequest(boolean active) {}

    public record AuthResponse(String token, Long id, String username, String email, String role) {}

    public record ApiResponse(boolean success, String message) {}

    public record UserSummary(Long id, String username, String email, String role, boolean active) {}
}
