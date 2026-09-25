package com.kce.traffic.analytics.repository;

import com.kce.traffic.analytics.entity.TrafficSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TrafficSessionRepository extends JpaRepository<TrafficSessionEntity, String> {
    Optional<TrafficSessionEntity> findBySessionId(String sessionId);
    List<TrafficSessionEntity> findByStatus(String status);
    List<TrafficSessionEntity> findByJunctionId(String junctionId);
    Optional<TrafficSessionEntity> findTopByStatusOrderByStartTimeDesc(String status);
    Optional<TrafficSessionEntity> findTopByOrderByStartTimeDesc();
}
