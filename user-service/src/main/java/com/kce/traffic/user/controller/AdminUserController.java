package com.kce.traffic.user.controller;

import com.kce.traffic.user.dto.AuthDto.*;
import com.kce.traffic.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * All user-management operations live here, separate from AuthController, and
 * every endpoint requires ROLE_ADMIN. This is also enforced at the URL level
 * in SecurityConfig (/api/v1/admin/**), so method security and URL security
 * both have to agree for a request to succeed.
 */
@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class AdminUserController {

    private final UserService userService;

    public AdminUserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<List<UserSummary>> listUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @PostMapping
    public ResponseEntity<UserSummary> createUser(@Valid @RequestBody AdminCreateUserRequest req) {
        return ResponseEntity.ok(userService.createUserAsAdmin(req));
    }

    @PutMapping("/{id}/role")
    public ResponseEntity<UserSummary> updateRole(@PathVariable Long id, @Valid @RequestBody UpdateRoleRequest req,
                                                   Authentication authentication) {
        return ResponseEntity.ok(userService.updateRole(id, req.role(), authentication.getName()));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<UserSummary> updateStatus(@PathVariable Long id, @RequestBody UpdateStatusRequest req,
                                                     Authentication authentication) {
        return ResponseEntity.ok(userService.updateStatus(id, req.active(), authentication.getName()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteUser(@PathVariable Long id, Authentication authentication) {
        userService.deleteUser(id, authentication.getName());
        return ResponseEntity.ok(new ApiResponse(true, "User deleted"));
    }
}
