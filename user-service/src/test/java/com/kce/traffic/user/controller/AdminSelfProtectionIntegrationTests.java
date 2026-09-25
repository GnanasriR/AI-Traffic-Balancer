package com.kce.traffic.user.controller;

import com.kce.traffic.user.entity.ERole;
import com.kce.traffic.user.entity.User;
import com.kce.traffic.user.repository.UserRepository;
import com.kce.traffic.user.security.TestJwtSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Covers section 1 of the security spec: an authenticated Admin can never modify
 * their own role/status/account through /api/v1/admin/users/{own-id}/**, even
 * though those same endpoints work fine against other users. Identity for the
 * self-check comes from the JWT (SecurityContext), never a client-supplied field.
 *
 * Also covers section 3: normal, permitted admin-on-admin and admin-on-other-role
 * operations still work, and non-admins are rejected by URL/method security.
 *
 * The "last active Admin" invariant (409) is a separate, narrower guarantee and
 * is covered directly at the service layer in UserServiceLastAdminGuardTests,
 * since - by construction - a non-self actor calling these endpoints must
 * themselves be an active Admin, so a legitimate third-party request can never
 * be the one that would take the active-Admin count to zero; only the guard's
 * own logic, not an end-to-end HTTP scenario, can meaningfully exercise it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminSelfProtectionIntegrationTests {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private Long adminAId;
    private Long adminBId;
    private Long operatorId;

    @BeforeEach
    void seedUsers() {
        userRepository.deleteAll();
        adminAId = userRepository.save(new User("admin_a", "admin_a@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_ADMIN)).getId();
        adminBId = userRepository.save(new User("admin_b", "admin_b@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_ADMIN)).getId();
        operatorId = userRepository.save(new User("operator_x", "operator_x@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_OPERATOR)).getId();
    }

    private String adminAToken() {
        return TestJwtSupport.validToken("admin_a", "ROLE_ADMIN");
    }

    // ---- Self-modification is always blocked, even with another active Admin around ----

    @Test
    void adminCannotChangeOwnRole() throws Exception {
        mockMvc.perform(put("/api/v1/admin/users/" + adminAId + "/role")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminAToken())
                        .contentType("application/json")
                        .content("{\"role\":\"ROLE_OPERATOR\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("You cannot modify your own administrator account."));
    }

    @Test
    void adminCannotDeactivateSelf() throws Exception {
        mockMvc.perform(put("/api/v1/admin/users/" + adminAId + "/status")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminAToken())
                        .contentType("application/json")
                        .content("{\"active\":false}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("You cannot modify your own administrator account."));
    }

    @Test
    void adminCannotDeleteSelf() throws Exception {
        mockMvc.perform(delete("/api/v1/admin/users/" + adminAId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminAToken()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("You cannot modify your own administrator account."));
    }

    // ---- Permitted operations: another admin, or a non-admin role, while an active admin remains ----

    @Test
    void adminCanModifyAnotherAdminWhenAtLeastOneActiveAdminRemains() throws Exception {
        mockMvc.perform(put("/api/v1/admin/users/" + adminBId + "/status")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminAToken())
                        .contentType("application/json")
                        .content("{\"active\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void adminCanModifyOperatorEmergencyAnalystUsers() throws Exception {
        mockMvc.perform(put("/api/v1/admin/users/" + operatorId + "/role")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminAToken())
                        .contentType("application/json")
                        .content("{\"role\":\"ROLE_ANALYST\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ROLE_ANALYST"));
    }

    @Test
    void nonAdminReceivesForbiddenForAdminEndpoints() throws Exception {
        String token = TestJwtSupport.validToken("operator_x", "ROLE_OPERATOR");
        mockMvc.perform(delete("/api/v1/admin/users/" + adminAId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isForbidden());
    }
}
