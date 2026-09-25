package com.kce.traffic.analytics.repository;

import com.kce.traffic.analytics.entity.TrafficSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TrafficSessionRepository extends JpaRepository<TrafficSessionEntity, String> {
}
