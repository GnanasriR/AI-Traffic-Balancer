package com.kce.traffic.user;

import com.kce.traffic.user.entity.ERole;
import com.kce.traffic.user.entity.User;
import com.kce.traffic.user.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
@EnableDiscoveryClient
public class UserServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(UserServiceApplication.class, args);
    }

    @Bean
    CommandLineRunner initUsers(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (!userRepository.existsByUsername("admin")) {
                userRepository.save(new User("admin", "admin@traffic.kce.ac.in", passwordEncoder.encode("Admin123!"), ERole.ROLE_ADMIN));
            }
            if (!userRepository.existsByUsername("operator")) {
                userRepository.save(new User("operator", "operator@traffic.kce.ac.in", passwordEncoder.encode("Operator123!"), ERole.ROLE_OPERATOR));
            }
            if (!userRepository.existsByUsername("ambulance_dispatch")) {
                userRepository.save(new User("ambulance_dispatch", "dispatch@emergency.kce.ac.in", passwordEncoder.encode("Dispatch123!"), ERole.ROLE_EMERGENCY));
            }
            if (!userRepository.existsByUsername("analyst")) {
                userRepository.save(new User("analyst", "analyst@traffic.kce.ac.in", passwordEncoder.encode("Analyst123!"), ERole.ROLE_ANALYST));
            }
        };
    }
}