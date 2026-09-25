package com.kce.traffic.user.service;

import com.kce.traffic.user.dto.AuthDto.*;
import com.kce.traffic.user.entity.ERole;
import com.kce.traffic.user.entity.User;
import com.kce.traffic.user.repository.UserRepository;
import com.kce.traffic.user.security.JwtUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

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
                .orElseThrow(() -> new RuntimeException("Invalid username or password"));

        if (!user.isActive()) {
            throw new RuntimeException("Account deactivated");
        }

        if (!passwordEncoder.matches(req.password(), user.getPassword())) {
            throw new RuntimeException("Invalid username or password");
        }

        String token = jwtUtils.generateToken(user.getUsername(), user.getRole().name());
        return new AuthResponse(token, user.getId(), user.getUsername(), user.getEmail(), user.getRole().name());
    }

    public ApiResponse register(SignupRequest req) {
        if (userRepository.existsByUsername(req.username())) {
            throw new RuntimeException("Username already in use");
        }
        if (userRepository.existsByEmail(req.email())) {
            throw new RuntimeException("Email already in use");
        }

        ERole role = ERole.ROLE_OPERATOR;
        if (req.role() != null) {
            String roleStr = req.role().toUpperCase();
            if (!roleStr.startsWith("ROLE_")) {
                roleStr = "ROLE_" + roleStr;
            }
            try {
                role = ERole.valueOf(roleStr);
            } catch (Exception ignored) {}
        }

        User user = new User(req.username(), req.email(), passwordEncoder.encode(req.password()), role);
        userRepository.save(user);

        return new ApiResponse(true, "User registered successfully");
    }

    public UserSummary getProfile(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return new UserSummary(user.getId(), user.getUsername(), user.getEmail(), user.getRole().name(), user.isActive());
    }

    public List<UserSummary> getAllUsers() {
        return userRepository.findAll().stream()
                .map(u -> new UserSummary(u.getId(), u.getUsername(), u.getEmail(), u.getRole().name(), u.isActive()))
                .toList();
    }
}