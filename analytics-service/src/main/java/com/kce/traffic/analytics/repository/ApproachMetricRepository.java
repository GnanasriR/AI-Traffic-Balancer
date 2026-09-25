package com.kce.traffic.analytics.repository;

import com.kce.traffic.analytics.entity.ApproachMetricEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApproachMetricRepository extends JpaRepository<ApproachMetricEntity, Long> {
    List<ApproachMetricEntity> findBySessionIdOrderByTimestampAsc(String sessionId);
    List<ApproachMetricEntity> findBySessionIdAndDirectionOrderByTimestampAsc(String sessionId, String direction);
}
