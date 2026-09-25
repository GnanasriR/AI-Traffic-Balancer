package com.kce.traffic.user.controller;

import com.kce.traffic.user.dto.AuthDto.*;
import com.kce.traffic.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Identity-only endpoints. NO user-management here by design -
 * see AdminUserController for anything that manages other users.
 */
@RestController
@RequestMapping("/api/v1/auth")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(userService.login(req));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse> register(@Valid @RequestBody SignupRequest req) {
        return ResponseEntity.ok(userService.register(req));
    }

    @GetMapping("/me")
    public ResponseEntity<UserSummary> getMe(Authentication auth) {
        return ResponseEntity.ok(userService.getProfile(auth.getName()));
    }
}
