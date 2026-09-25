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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** ADMIN can reach /api/v1/admin/**; OPERATOR, EMERGENCY and ANALYST cannot. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminRbacIntegrationTests {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @BeforeEach
    void seedUsers() {
        userRepository.deleteAll();
        userRepository.save(new User("rbac_admin", "rbac_admin@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_ADMIN));
        userRepository.save(new User("rbac_operator", "rbac_operator@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_OPERATOR));
        userRepository.save(new User("rbac_emergency", "rbac_emergency@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_EMERGENCY));
        userRepository.save(new User("rbac_analyst", "rbac_analyst@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_ANALYST));
    }

    @Test
    void adminCanListUsers() throws Exception {
        String token = TestJwtSupport.validToken("rbac_admin", "ROLE_ADMIN");
        mockMvc.perform(get("/api/v1/admin/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void operatorCannotAccessAdmin() throws Exception {
        String token = TestJwtSupport.validToken("rbac_operator", "ROLE_OPERATOR");
        mockMvc.perform(get("/api/v1/admin/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void emergencyCannotAccessAdmin() throws Exception {
        String token = TestJwtSupport.validToken("rbac_emergency", "ROLE_EMERGENCY");
        mockMvc.perform(get("/api/v1/admin/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void analystCannotAccessAdmin() throws Exception {
        String token = TestJwtSupport.validToken("rbac_analyst", "ROLE_ANALYST");
        mockMvc.perform(get("/api/v1/admin/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void nonAdminCannotChangeOwnRoleViaAdminEndpoint() throws Exception {
        Long operatorId = userRepository.findByUsername("rbac_operator").orElseThrow().getId();
        String token = TestJwtSupport.validToken("rbac_operator", "ROLE_OPERATOR");
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/v1/admin/users/" + operatorId + "/role")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType("application/json")
                        .content("{\"role\":\"ROLE_ADMIN\"}"))
                .andExpect(status().isForbidden());
    }
}
