package com.kce.traffic.user.service;

import com.kce.traffic.user.entity.ERole;
import com.kce.traffic.user.entity.User;
import com.kce.traffic.user.exception.LastAdminException;
import com.kce.traffic.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Section 2 of the security spec: the system must never reach zero active Admin
 * users. These tests exercise UserService directly (bypassing the HTTP/security
 * layer) because, in a real request, whoever is allowed to call an admin endpoint
 * on someone else is themselves an active Admin - so a genuine third-party HTTP
 * request could never be the one that drops the active-Admin count to zero (the
 * self-block in section 1 already stops the only remaining path). Testing the
 * guard here confirms the invariant holds regardless of who calls it or how.
 */
@SpringBootTest
@ActiveProfiles("test")
class UserServiceLastAdminGuardTests {

    @Autowired UserService userService;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private Long soleAdminId;

    @BeforeEach
    void seedSingleActiveAdmin() {
        userRepository.deleteAll();
        soleAdminId = userRepository.save(
                new User("sole_admin", "sole_admin@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_ADMIN)
        ).getId();
        userRepository.save(
                new User("bystander", "bystander@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_OPERATOR)
        );
    }

    @Test
    void cannotDeactivateTheLastActiveAdmin() {
        LastAdminException ex = assertThrows(LastAdminException.class,
                () -> userService.updateStatus(soleAdminId, false, "bystander"));
        assertEquals("At least one active administrator must remain.", ex.getMessage());
        assertTrue(userRepository.findById(soleAdminId).orElseThrow().isActive());
    }

    @Test
    void cannotDeleteTheLastActiveAdmin() {
        assertThrows(LastAdminException.class, () -> userService.deleteUser(soleAdminId, "bystander"));
        assertTrue(userRepository.existsById(soleAdminId));
    }

    @Test
    void cannotChangeTheLastActiveAdminsRoleAwayFromAdmin() {
        assertThrows(LastAdminException.class,
                () -> userService.updateRole(soleAdminId, "ROLE_OPERATOR", "bystander"));
        assertEquals(ERole.ROLE_ADMIN, userRepository.findById(soleAdminId).orElseThrow().getRole());
    }

    @Test
    void reactivatingTheLastAdminIsNotBlocked() {
        // Sanity check: the guard only blocks operations that would REMOVE admin
        // status from the last active admin, not unrelated calls with active=true.
        var summary = userService.updateStatus(soleAdminId, true, "bystander");
        assertTrue(summary.active());
    }

    @Test
    void secondActiveAdminCanBeModifiedFreely() {
        Long secondAdminId = userRepository.save(
                new User("second_admin", "second_admin@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_ADMIN)
        ).getId();

        // With two active admins, deactivating one is fine - one remains.
        var summary = userService.updateStatus(secondAdminId, false, "sole_admin");
        assertEquals(false, summary.active());
    }
}
