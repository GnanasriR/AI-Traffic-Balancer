package com.kce.traffic.user.security;

import com.kce.traffic.user.entity.ERole;
import com.kce.traffic.user.entity.User;
import com.kce.traffic.user.repository.UserRepository;
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class JwtSecurityIntegrationTests {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @BeforeEach
    void seed() {
        userRepository.deleteAll();
        userRepository.save(new User("jwtuser", "jwtuser@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_OPERATOR));
        User inactive = new User("jwtinactive", "jwtinactive@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_OPERATOR);
        inactive.setActive(false);
        userRepository.save(inactive);
    }

    @Test
    void validTokenIsAccepted() throws Exception {
        String token = TestJwtSupport.validToken("jwtuser", "ROLE_OPERATOR");
        mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void expiredTokenIsRejected() throws Exception {
        String token = TestJwtSupport.expiredToken("jwtuser", "ROLE_OPERATOR");
        mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tamperedTokenIsRejected() throws Exception {
        String token = TestJwtSupport.tamperedToken("jwtuser", "ROLE_OPERATOR");
        mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void wrongSignatureTokenIsRejected() throws Exception {
        String token = TestJwtSupport.wrongSignatureToken("jwtuser", "ROLE_OPERATOR");
        mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenForInactiveUserIsRejectedEvenThoughSignatureIsValid() throws Exception {
        // The DB is the source of truth for "active", not the token - a token issued
        // before deactivation must stop working immediately.
        String token = TestJwtSupport.validToken("jwtinactive", "ROLE_OPERATOR");
        mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenRoleClaimIsIgnoredInFavorOfDatabaseRole() throws Exception {
        // Forge a token claiming ROLE_ADMIN for a user who is actually ROLE_OPERATOR in the DB.
        // JwtAuthFilter must derive authority from the DB, not trust this claim.
        String forged = TestJwtSupport.validToken("jwtuser", "ROLE_ADMIN");
        mockMvc.perform(get("/api/v1/admin/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + forged))
                .andExpect(status().isForbidden());
    }
}
