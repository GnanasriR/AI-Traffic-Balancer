package com.kce.traffic.user.repository;

import com.kce.traffic.user.entity.ERole;
import com.kce.traffic.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);

    /** Used by the last-active-admin guard before demoting/deactivating/deleting an Admin. */
    long countByRoleAndActiveTrue(ERole role);
}