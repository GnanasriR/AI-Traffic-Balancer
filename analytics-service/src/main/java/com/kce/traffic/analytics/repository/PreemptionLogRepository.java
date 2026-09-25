package com.kce.traffic.analytics.repository;

import com.kce.traffic.analytics.entity.PreemptionLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PreemptionLogRepository extends JpaRepository<PreemptionLogEntity, String> {
    List<PreemptionLogEntity> findByJunctionIdOrderByTriggeredAtDesc(String junctionId);
    List<PreemptionLogEntity> findBySessionIdOrderByTriggeredAtDesc(String sessionId);
}
