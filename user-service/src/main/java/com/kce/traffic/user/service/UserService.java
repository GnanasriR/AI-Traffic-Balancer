package com.kce.traffic.user.service;

import com.kce.traffic.user.dto.AuthDto.*;
import com.kce.traffic.user.entity.ERole;
import com.kce.traffic.user.entity.User;
import com.kce.traffic.user.exception.DuplicateResourceException;
import com.kce.traffic.user.exception.InvalidCredentialsException;
import com.kce.traffic.user.exception.InvalidRoleException;
import com.kce.traffic.user.exception.LastAdminException;
import com.kce.traffic.user.exception.ResourceNotFoundException;
import com.kce.traffic.user.exception.SelfModificationException;
import com.kce.traffic.user.repository.UserRepository;
import com.kce.traffic.user.security.JwtUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtils jwtUtils) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByUsername(req.username())
                .or(() -> userRepository.findByEmail(req.username()))
                .orElseThrow(() -> new InvalidCredentialsException("Invalid username or password"));

        if (!user.isActive()) {
            // Deliberately the same status (401) as bad credentials would be an option too,
            // but the spec calls out "inactive user" as its own login-rejection case, so we
            // still return 401 here (not 403 - the client never authenticated at all).
            throw new InvalidCredentialsException("Account is deactivated");
        }

        if (!passwordEncoder.matches(req.password(), user.getPassword())) {
            throw new InvalidCredentialsException("Invalid username or password");
        }

        String token = jwtUtils.generateToken(user.getUsername(), user.getRole().name());
        return new AuthResponse(token, user.getId(), user.getUsername(), user.getEmail(), user.getRole().name());
    }

    /**
     * Public self-registration. Role is NEVER taken from the client - every
     * public signup is hardcoded to ROLE_OPERATOR. Admin/Emergency/Analyst
     * accounts can only be created via UserService#createUserAsAdmin.
     */
    @Transactional
    public ApiResponse register(SignupRequest req) {
        if (userRepository.existsByUsername(req.username())) {
            throw new DuplicateResourceException("Username already in use");
        }
        if (userRepository.existsByEmail(req.email())) {
            throw new DuplicateResourceException("Email already in use");
        }

        User user = new User(req.username(), req.email(), passwordEncoder.encode(req.password()), ERole.ROLE_OPERATOR);
        userRepository.save(user);

        return new ApiResponse(true, "User registered successfully");
    }

    public UserSummary getProfile(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return toSummary(user);
    }

    // ---- Admin-only operations (invoked only from AdminUserController, which is
    // itself locked to ROLE_ADMIN via @PreAuthorize) ----

    public List<UserSummary> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional
    public UserSummary createUserAsAdmin(AdminCreateUserRequest req) {
        if (userRepository.existsByUsername(req.username())) {
            throw new DuplicateResourceException("Username already in use");
        }
        if (userRepository.existsByEmail(req.email())) {
            throw new DuplicateResourceException("Email already in use");
        }

        ERole role = parseRole(req.role());
        User user = new User(req.username(), req.email(), passwordEncoder.encode(req.password()), role);
        userRepository.save(user);
        return toSummary(user);
    }

    @Transactional
    public UserSummary updateRole(Long userId, String requestedRole, String actingUsername) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        guardNotSelf(user, actingUsername);

        ERole newRole = parseRole(requestedRole);
        if (isLastActiveAdmin(user) && newRole != ERole.ROLE_ADMIN) {
            throw new LastAdminException("At least one active administrator must remain.");
        }

        user.setRole(newRole);
        userRepository.save(user);
        return toSummary(user);
    }

    @Transactional
    public UserSummary updateStatus(Long userId, boolean active, String actingUsername) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        guardNotSelf(user, actingUsername);

        if (!active && isLastActiveAdmin(user)) {
            throw new LastAdminException("At least one active administrator must remain.");
        }

        user.setActive(active);
        userRepository.save(user);
        return toSummary(user);
    }

    @Transactional
    public void deleteUser(Long userId, String actingUsername) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        guardNotSelf(user, actingUsername);

        if (isLastActiveAdmin(user)) {
            throw new LastAdminException("At least one active administrator must remain.");
        }

        userRepository.deleteById(userId);
    }

    /**
     * Blocks an Admin from changing their own role, deactivating themselves, or
     * deleting themselves. Identity is resolved from the authenticated JWT
     * principal (actingUsername), never from anything the client supplies about
     * "who I am" - only the target id in the URL is client-supplied.
     */
    private void guardNotSelf(User target, String actingUsername) {
        if (target.getUsername().equals(actingUsername)) {
            throw new SelfModificationException("You cannot modify your own administrator account.");
        }
    }

    /**
     * True if `user` is currently an active Admin and is the only active Admin
     * left in the system - i.e. removing their Admin status (via role change,
     * deactivation, or deletion) would leave zero active Admins.
     */
    private boolean isLastActiveAdmin(User user) {
        return user.isActive()
                && user.getRole() == ERole.ROLE_ADMIN
                && userRepository.countByRoleAndActiveTrue(ERole.ROLE_ADMIN) <= 1;
    }

    private ERole parseRole(String roleStr) {
        if (roleStr == null || roleStr.isBlank()) {
            throw new InvalidRoleException("Role is required");
        }
        String normalized = roleStr.toUpperCase();
        if (!normalized.startsWith("ROLE_")) {
            normalized = "ROLE_" + normalized;
        }
        try {
            return ERole.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            throw new InvalidRoleException("Invalid role: " + roleStr);
        }
    }

    private UserSummary toSummary(User u) {
        return new UserSummary(u.getId(), u.getUsername(), u.getEmail(), u.getRole().name(), u.isActive());
    }
}
