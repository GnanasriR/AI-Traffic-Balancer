package com.kce.traffic.user.controller;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kce.traffic.user.entity.ERole;
import com.kce.traffic.user.entity.User;
import com.kce.traffic.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthFlowIntegrationTests {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private final ObjectMapper strictMapper = new ObjectMapper();
    // A lenient mapper simulating a malicious client that sends an extra unknown
    // "role" field the server-side DTO doesn't even declare - proves the field
    // is structurally impossible to use, not just ignored by convention.
    private final ObjectMapper lenientMapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @BeforeEach
    void cleanDb() {
        userRepository.deleteAll();
    }

    @Test
    void validRegistrationCreatesRoleOperator() throws Exception {
        String body = strictMapper.writeValueAsString(new SignupPayload("alice", "alice@example.com", "Password123!"));

        mockMvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        User saved = userRepository.findByUsername("alice").orElseThrow();
        assertThat(saved.getRole()).isEqualTo(ERole.ROLE_OPERATOR);
    }

    @Test
    void clientCannotEscalateToAdminEvenIfRoleFieldIsInjected() throws Exception {
        String body = lenientMapper.writeValueAsString(
                new SignupPayloadWithRole("bob", "bob@example.com", "Password123!", "ROLE_ADMIN"));

        mockMvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body))
                .andExpect(status().isOk());

        User saved = userRepository.findByUsername("bob").orElseThrow();
        assertThat(saved.getRole()).isEqualTo(ERole.ROLE_OPERATOR);
    }

    @Test
    void clientCannotEscalateToEmergency() throws Exception {
        String body = lenientMapper.writeValueAsString(
                new SignupPayloadWithRole("carol", "carol@example.com", "Password123!", "ROLE_EMERGENCY"));
        mockMvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body))
                .andExpect(status().isOk());
        assertThat(userRepository.findByUsername("carol").orElseThrow().getRole()).isEqualTo(ERole.ROLE_OPERATOR);
    }

    @Test
    void clientCannotEscalateToAnalyst() throws Exception {
        String body = lenientMapper.writeValueAsString(
                new SignupPayloadWithRole("dave", "dave@example.com", "Password123!", "ROLE_ANALYST"));
        mockMvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body))
                .andExpect(status().isOk());
        assertThat(userRepository.findByUsername("dave").orElseThrow().getRole()).isEqualTo(ERole.ROLE_OPERATOR);
    }

    @Test
    void duplicateUsernameReturns409() throws Exception {
        userRepository.save(new User("erin", "erin@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_OPERATOR));
        String body = strictMapper.writeValueAsString(new SignupPayload("erin", "new@example.com", "Password123!"));
        mockMvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body))
                .andExpect(status().isConflict());
    }

    @Test
    void duplicateEmailReturns409() throws Exception {
        userRepository.save(new User("frank", "frank@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_OPERATOR));
        String body = strictMapper.writeValueAsString(new SignupPayload("newname", "frank@example.com", "Password123!"));
        mockMvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body))
                .andExpect(status().isConflict());
    }

    @Test
    void blankUsernameReturns400() throws Exception {
        String body = strictMapper.writeValueAsString(new SignupPayload("", "grace@example.com", "Password123!"));
        mockMvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void invalidEmailReturns400() throws Exception {
        String body = strictMapper.writeValueAsString(new SignupPayload("heidi", "not-an-email", "Password123!"));
        mockMvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void blankPasswordReturns400() throws Exception {
        String body = strictMapper.writeValueAsString(new SignupPayload("ivan", "ivan@example.com", ""));
        mockMvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validLoginReturnsJwt() throws Exception {
        userRepository.save(new User("judy", "judy@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_OPERATOR));
        String body = strictMapper.writeValueAsString(new LoginPayload("judy", "Password123!"));
        mockMvc.perform(post("/api/v1/auth/login").contentType("application/json").content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.role", is("ROLE_OPERATOR")));
    }

    @Test
    void wrongPasswordReturns401() throws Exception {
        userRepository.save(new User("mallory", "mallory@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_OPERATOR));
        String body = strictMapper.writeValueAsString(new LoginPayload("mallory", "WrongPassword!"));
        mockMvc.perform(post("/api/v1/auth/login").contentType("application/json").content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unknownUserReturns401() throws Exception {
        String body = strictMapper.writeValueAsString(new LoginPayload("ghost", "Whatever123!"));
        mockMvc.perform(post("/api/v1/auth/login").contentType("application/json").content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void inactiveUserReturns401() throws Exception {
        User u = new User("oscar", "oscar@example.com", passwordEncoder.encode("Password123!"), ERole.ROLE_OPERATOR);
        u.setActive(false);
        userRepository.save(u);
        String body = strictMapper.writeValueAsString(new LoginPayload("oscar", "Password123!"));
        mockMvc.perform(post("/api/v1/auth/login").contentType("application/json").content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meWithoutTokenIsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")); // no-op call just to exercise the client without auth below
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    private record SignupPayload(String username, String email, String password) {}
    private record SignupPayloadWithRole(String username, String email, String password, String role) {}
    private record LoginPayload(String username, String password) {}
}
