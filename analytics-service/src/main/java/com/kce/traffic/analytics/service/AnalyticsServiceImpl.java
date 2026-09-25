package com.kce.traffic.analytics.service;

import com.kce.traffic.analytics.dto.*;
import com.kce.traffic.analytics.entity.ApproachMetricEntity;
import com.kce.traffic.analytics.entity.PreemptionLogEntity;
import com.kce.traffic.analytics.entity.TrafficSessionEntity;
import com.kce.traffic.analytics.exception.AnalyticsSessionNotFoundException;
import com.kce.traffic.analytics.exception.SessionAlreadyCompletedException;
import com.kce.traffic.analytics.repository.ApproachMetricRepository;
import com.kce.traffic.analytics.repository.PreemptionLogRepository;
import com.kce.traffic.analytics.repository.TrafficSessionRepository;
import com.kce.traffic.analytics.util.DirectionUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class AnalyticsServiceImpl implements AnalyticsService {

    private static final List<String> ALL_DIRECTIONS = List.of("NORTH", "SOUTH", "EAST", "WEST");

    private final TrafficSessionRepository sessionRepository;
    private final ApproachMetricRepository approachMetricRepository;
    private final PreemptionLogRepository preemptionLogRepository;

    @Value("${analytics.default-approach-capacity:#{null}}")
    private Double defaultApproachCapacity;

    public AnalyticsServiceImpl(
            TrafficSessionRepository sessionRepository,
            ApproachMetricRepository approachMetricRepository,
            PreemptionLogRepository preemptionLogRepository) {
        this.sessionRepository = sessionRepository;
        this.approachMetricRepository = approachMetricRepository;
        this.preemptionLogRepository = preemptionLogRepository;
    }

    @Override
    @Transactional
    public SessionDetailDto createSession(CreateSessionRequestDto request) {
        String sessionId = "SESS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        TrafficSessionEntity entity = new TrafficSessionEntity(
            sessionId,
            request.junctionId(),
            request.controlMode(),
            request.baselineAvgWaitSeconds()
        );
        TrafficSessionEntity saved = sessionRepository.save(entity);
        return mapToSessionDetail(saved);
    }

    @Override
    @Transactional
    public SessionDetailDto completeSession(String sessionId) {
        TrafficSessionEntity session = findSessionById(sessionId);
        if ("COMPLETED".equalsIgnoreCase(session.getStatus())) {
            throw new SessionAlreadyCompletedException("Cannot complete an already completed session: " + sessionId);
        }

        session.setStatus("COMPLETED");
        session.setEndTime(Instant.now());
        recalculateSessionAggregates(session);

        TrafficSessionEntity saved = sessionRepository.save(session);
        return mapToSessionDetail(saved);
    }

    @Override
    @Transactional
    public ApproachMetricResponseDto recordApproachMetric(String sessionId, RecordApproachMetricRequestDto request) {
        TrafficSessionEntity session = findSessionById(sessionId);

        if ("COMPLETED".equalsIgnoreCase(session.getStatus())) {
            throw new SessionAlreadyCompletedException("Cannot add metrics to a completed analytics session");
        }

        String normalizedDir = DirectionUtil.normalizeDirection(request.direction());

        ApproachMetricEntity metric = new ApproachMetricEntity(
            sessionId,
            normalizedDir,
            request.vehicleCount(),
            request.queueLength(),
            request.averageWaitTime(),
            request.maximumWaitTime(),
            request.averageSpeed(),
            request.vehiclesCleared(),
            Boolean.TRUE.equals(request.incidentBlocked())
        );

        ApproachMetricEntity saved = approachMetricRepository.save(metric);

        // Update session live statistics
        recalculateSessionAggregates(session);
        sessionRepository.save(session);

        return mapToApproachMetricResponseDto(saved);
    }

    @Override
    @Transactional
    public PreemptionLogDto recordPreemption(String sessionId, RecordPreemptionRequestDto request) {
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException("Session ID is required to record a preemption event");
        }

        TrafficSessionEntity session = findSessionById(sessionId);
        if ("COMPLETED".equalsIgnoreCase(session.getStatus())) {
            throw new SessionAlreadyCompletedException("Cannot add preemption event to a completed analytics session");
        }

        String normalizedDir = DirectionUtil.normalizeDirection(request.direction());
        String logId = "PRE-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        double duration = request.durationSeconds() != null ? request.durationSeconds() : 0.0;

        PreemptionLogEntity entity = new PreemptionLogEntity(
            logId,
            sessionId,
            request.username(),
            request.userRole(),
            request.junctionId(),
            normalizedDir,
            duration
        );

        PreemptionLogEntity saved = preemptionLogRepository.save(entity);
        return mapToPreemptionDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public SessionDetailDto getSessionDetail(String sessionId) {
        TrafficSessionEntity session = findSessionById(sessionId);
        return mapToSessionDetail(session);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TrafficSessionResponseDto> getAllSessions() {
        return sessionRepository.findAll().stream()
            .map(this::mapToSessionResponse)
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public AnalyticsSummaryDto getSummaryMetrics() {
        TrafficSessionEntity session = findLatestOrActiveSession();
        if (session == null) {
            return new AnalyticsSummaryDto(
                0.0, 0.0, 0, 0, "NONE",
                Map.of("N", 0.0, "S", 0.0, "E", 0.0, "W", 0.0)
            );
        }
        return getSummaryMetricsForSession(session.getSessionId());
    }

    @Override
    @Transactional(readOnly = true)
    public AnalyticsSummaryDto getSummaryMetricsForSession(String sessionId) {
        TrafficSessionEntity session = findSessionById(sessionId);

        List<ApproachMetricEntity> metrics = approachMetricRepository.findBySessionIdOrderByTimestampAsc(sessionId);
        Map<String, Double> approachSavings = new LinkedHashMap<>();

        Double baseline = session.getBaselineAvgWaitSeconds();

        for (String dir : ALL_DIRECTIONS) {
            String shortCode = DirectionUtil.toShortCode(dir);
            List<ApproachMetricEntity> dirMetrics = metrics.stream()
                .filter(m -> dir.equalsIgnoreCase(m.getDirection()))
                .toList();

            if (dirMetrics.isEmpty() || baseline == null || baseline <= 0) {
                approachSavings.put(shortCode, 0.0);
            } else {
                double avgWait = dirMetrics.stream().mapToDouble(ApproachMetricEntity::getAverageWaitTime).average().orElse(0.0);
                // Signed improvement vs session baseline: positive = improvement, negative = deterioration
                double pct = ((baseline - avgWait) / baseline) * 100.0;
                approachSavings.put(shortCode, Math.round(pct * 10.0) / 10.0);
            }
        }

        double delayReduction = session.getDelayReductionPercentage() != null ? session.getDelayReductionPercentage() : 0.0;

        return new AnalyticsSummaryDto(
            Math.round(delayReduction * 10.0) / 10.0,
            Math.round(session.getAvgWaitTimeSeconds() * 10.0) / 10.0,
            session.getTotalClearedVehicles(),
            session.getCompletedCycles(),
            session.getControlMode() != null ? session.getControlMode() : "ADAPTIVE_AI",
            approachSavings
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<ApproachPerformanceDto> getApproachPerformance() {
        TrafficSessionEntity session = findLatestOrActiveSession();
        if (session == null) {
            return ALL_DIRECTIONS.stream()
                .map(dir -> new ApproachPerformanceDto(
                    DirectionUtil.toShortCode(dir),
                    DirectionUtil.toFullName(dir),
                    0, 0.0, 0, null, false
                ))
                .toList();
        }
        return getApproachPerformanceForSession(session.getSessionId());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ApproachPerformanceDto> getApproachPerformanceForSession(String sessionId) {
        List<ApproachMetricEntity> metrics = approachMetricRepository.findBySessionIdOrderByTimestampAsc(sessionId);
        List<ApproachPerformanceDto> result = new ArrayList<>();

        for (String dir : ALL_DIRECTIONS) {
            String shortCode = DirectionUtil.toShortCode(dir);
            String fullName = DirectionUtil.toFullName(dir);

            List<ApproachMetricEntity> dirMetrics = metrics.stream()
                .filter(m -> dir.equalsIgnoreCase(m.getDirection()))
                .toList();

            if (dirMetrics.isEmpty()) {
                result.add(new ApproachPerformanceDto(shortCode, fullName, 0, 0.0, 0, null, false));
            } else {
                int lastQueue = dirMetrics.get(dirMetrics.size() - 1).getQueueLength();
                double avgWait = dirMetrics.stream().mapToDouble(ApproachMetricEntity::getAverageWaitTime).average().orElse(0.0);
                int totalCleared = dirMetrics.stream().mapToInt(ApproachMetricEntity::getVehiclesCleared).sum();
                boolean isBlocked = dirMetrics.stream().anyMatch(ApproachMetricEntity::isIncidentBlocked);

                Double capUtilization = null;
                if (defaultApproachCapacity != null && defaultApproachCapacity > 0) {
                    double avgQueue = dirMetrics.stream().mapToDouble(ApproachMetricEntity::getQueueLength).average().orElse(0.0);
                    capUtilization = Math.min(100.0, (avgQueue / defaultApproachCapacity) * 100.0);
                    capUtilization = Math.round(capUtilization * 10.0) / 10.0;
                }

                result.add(new ApproachPerformanceDto(
                    shortCode,
                    fullName,
                    lastQueue,
                    Math.round(avgWait * 10.0) / 10.0,
                    totalCleared,
                    capUtilization,
                    isBlocked
                ));
            }
        }
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public SessionExportDto exportSessionData(String sessionId, String format) {
        validateExportFormat(format);

        String targetSessionId = sessionId;
        if (targetSessionId != null && !targetSessionId.isBlank()) {
            findSessionById(targetSessionId);
        } else {
            TrafficSessionEntity latest = findLatestOrActiveSession();
            targetSessionId = (latest != null) ? latest.getSessionId() : "NONE";
        }

        String fmt = format.toUpperCase(Locale.ROOT);

        AnalyticsSummaryDto summary;
        List<ApproachPerformanceDto> approaches;

        if ("NONE".equalsIgnoreCase(targetSessionId)) {
            summary = getSummaryMetrics();
            approaches = getApproachPerformance();
        } else {
            summary = getSummaryMetricsForSession(targetSessionId);
            approaches = getApproachPerformanceForSession(targetSessionId);
        }

        return new SessionExportDto(
            targetSessionId,
            Instant.now(),
            summary,
            approaches,
            fmt
        );
    }

    @Override
    @Transactional(readOnly = true)
    public String exportSessionCsv(String sessionId) {
        String targetSessionId = sessionId;
        if (targetSessionId != null && !targetSessionId.isBlank()) {
            findSessionById(targetSessionId);
        } else {
            TrafficSessionEntity latest = findLatestOrActiveSession();
            targetSessionId = (latest != null) ? latest.getSessionId() : "NONE";
        }

        StringBuilder csv = new StringBuilder();
        csv.append("sessionId,timestamp,direction,vehicleCount,queueLength,averageWaitTime,maximumWaitTime,averageSpeed,vehiclesCleared,incidentBlocked\n");

        if (!"NONE".equalsIgnoreCase(targetSessionId)) {
            List<ApproachMetricEntity> metrics = approachMetricRepository.findBySessionIdOrderByTimestampAsc(targetSessionId);
            for (ApproachMetricEntity m : metrics) {
                csv.append(escapeCsvField(m.getSessionId())).append(",")
                   .append(m.getTimestamp()).append(",")
                   .append(escapeCsvField(m.getDirection())).append(",")
                   .append(m.getVehicleCount()).append(",")
                   .append(m.getQueueLength()).append(",")
                   .append(m.getAverageWaitTime()).append(",")
                   .append(m.getMaximumWaitTime()).append(",")
                   .append(m.getAverageSpeed()).append(",")
                   .append(m.getVehiclesCleared()).append(",")
                   .append(m.isIncidentBlocked()).append("\n");
            }
        }
        return csv.toString();
    }

    // --- Private Helper Methods ---

    private void validateExportFormat(String format) {
        if (format == null || format.isBlank()) {
            throw new IllegalArgumentException("Unsupported export format: null. Supported formats: json, csv");
        }
        String lower = format.trim().toLowerCase(Locale.ROOT);
        if (!"json".equals(lower) && !"csv".equals(lower)) {
            throw new IllegalArgumentException("Unsupported export format: " + format + ". Supported formats: json, csv");
        }
    }

    private String escapeCsvField(String field) {
        if (field == null) {
            return "";
        }
        if (field.contains(",") || field.contains("\"") || field.contains("\n") || field.contains("\r")) {
            return "\"" + field.replace("\"", "\"\"") + "\"";
        }
        return field;
    }

    private TrafficSessionEntity findSessionById(String sessionId) {
        return sessionRepository.findBySessionId(sessionId)
            .orElseThrow(() -> new AnalyticsSessionNotFoundException(sessionId));
    }

    private TrafficSessionEntity findLatestOrActiveSession() {
        return sessionRepository.findTopByStatusOrderByStartTimeDesc("ACTIVE")
            .orElseGet(() -> sessionRepository.findTopByOrderByStartTimeDesc().orElse(null));
    }

    private void recalculateSessionAggregates(TrafficSessionEntity session) {
        List<ApproachMetricEntity> metrics = approachMetricRepository.findBySessionIdOrderByTimestampAsc(session.getSessionId());
        if (metrics.isEmpty()) {
            session.setAvgWaitTimeSeconds(0.0);
            session.setAvgQueueLength(0.0);
            session.setTotalVehicles(0);
            session.setTotalClearedVehicles(0);
            session.setCompletedCycles(0);
            session.setDelayReductionPercentage(0.0);
            return;
        }

        double avgWait = metrics.stream().mapToDouble(ApproachMetricEntity::getAverageWaitTime).average().orElse(0.0);
        double avgQueue = metrics.stream().mapToDouble(ApproachMetricEntity::getQueueLength).average().orElse(0.0);
        int peakVehicles = metrics.stream().mapToInt(ApproachMetricEntity::getVehicleCount).max().orElse(0);
        int totalCleared = metrics.stream().mapToInt(ApproachMetricEntity::getVehiclesCleared).sum();

        session.setAvgWaitTimeSeconds(avgWait);
        session.setAvgQueueLength(avgQueue);
        session.setTotalVehicles(peakVehicles);
        session.setTotalClearedVehicles(totalCleared);
        session.setCompletedCycles(0);
        session.setTimestamp(Instant.now());

        Double baseline = session.getBaselineAvgWaitSeconds();
        if (baseline != null && baseline > 0) {
            double reduction = ((baseline - avgWait) / baseline) * 100.0;
            session.setDelayReductionPercentage(reduction);
        } else {
            session.setDelayReductionPercentage(0.0);
        }
    }

    private SessionDetailDto mapToSessionDetail(TrafficSessionEntity session) {
        List<ApproachPerformanceDto> approaches = getApproachPerformanceForSession(session.getSessionId());

        List<PreemptionLogEntity> logs = preemptionLogRepository.findBySessionIdOrderByTriggeredAtDesc(session.getSessionId());
        List<PreemptionLogDto> logDtos = logs.stream()
            .map(this::mapToPreemptionDto)
            .toList();

        return new SessionDetailDto(
            session.getSessionId(),
            session.getJunctionId(),
            session.getStartTime(),
            session.getEndTime(),
            session.getStatus(),
            session.getControlMode(),
            session.getBaselineAvgWaitSeconds(),
            session.getDelayReductionPercentage(),
            Math.round(session.getAvgWaitTimeSeconds() * 10.0) / 10.0,
            Math.round(session.getAvgQueueLength() * 10.0) / 10.0,
            session.getTotalVehicles(), // peak vehicle count
            session.getTotalVehicles(),
            session.getTotalClearedVehicles(),
            session.getCompletedCycles(),
            approaches,
            logDtos
        );
    }

    private TrafficSessionResponseDto mapToSessionResponse(TrafficSessionEntity session) {
        return new TrafficSessionResponseDto(
            session.getSessionId(),
            session.getJunctionId(),
            session.getStartTime(),
            session.getEndTime(),
            session.getStatus(),
            session.getControlMode(),
            session.getBaselineAvgWaitSeconds(),
            session.getDelayReductionPercentage(),
            Math.round(session.getAvgWaitTimeSeconds() * 10.0) / 10.0,
            Math.round(session.getAvgQueueLength() * 10.0) / 10.0,
            session.getTotalVehicles(), // peak vehicle count
            session.getTotalVehicles(),
            session.getTotalClearedVehicles(),
            session.getCompletedCycles()
        );
    }

    private ApproachMetricResponseDto mapToApproachMetricResponseDto(ApproachMetricEntity entity) {
        return new ApproachMetricResponseDto(
            entity.getId(),
            entity.getSessionId(),
            entity.getDirection(),
            entity.getVehicleCount(),
            entity.getQueueLength(),
            entity.getAverageWaitTime(),
            entity.getMaximumWaitTime(),
            entity.getAverageSpeed(),
            entity.getVehiclesCleared(),
            entity.isIncidentBlocked(),
            entity.getTimestamp()
        );
    }

    private PreemptionLogDto mapToPreemptionDto(PreemptionLogEntity entity) {
        return new PreemptionLogDto(
            entity.getLogId(),
            entity.getSessionId(),
            entity.getUsername(),
            entity.getUserRole(),
            entity.getJunctionId(),
            entity.getDirection(),
            entity.getDurationSeconds(),
            entity.getTriggeredAt()
        );
    }
}
