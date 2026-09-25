package com.kce.traffic.analytics.service;

import com.kce.traffic.analytics.dto.*;
import com.kce.traffic.analytics.exception.AnalyticsSessionNotFoundException;
import com.kce.traffic.analytics.exception.SessionAlreadyCompletedException;
import com.kce.traffic.analytics.repository.ApproachMetricRepository;
import com.kce.traffic.analytics.repository.PreemptionLogRepository;
import com.kce.traffic.analytics.repository.TrafficSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
class AnalyticsServiceTest {

    @Autowired
    private TrafficSessionRepository sessionRepository;

    @Autowired
    private ApproachMetricRepository approachMetricRepository;

    @Autowired
    private PreemptionLogRepository preemptionLogRepository;

    private AnalyticsServiceImpl analyticsService;

    @BeforeEach
    void setUp() {
        analyticsService = new AnalyticsServiceImpl(sessionRepository, approachMetricRepository, preemptionLogRepository);
    }

    @Test
    void testCreateAndGetSession() {
        CreateSessionRequestDto request = new CreateSessionRequestDto("J-101", "ADAPTIVE_AI", 30.0);
        SessionDetailDto session = analyticsService.createSession(request);

        assertNotNull(session.sessionId());
        assertEquals("J-101", session.junctionId());
        assertEquals("ACTIVE", session.status());
        assertEquals(30.0, session.baselineAvgWaitSeconds());

        SessionDetailDto fetched = analyticsService.getSessionDetail(session.sessionId());
        assertEquals(session.sessionId(), fetched.sessionId());

        List<TrafficSessionResponseDto> allSessions = analyticsService.getAllSessions();
        assertEquals(1, allSessions.size());
        assertEquals(session.sessionId(), allSessions.get(0).sessionId());
    }

    @Test
    void testRecordApproachMetricReturnsDtoNotEntity() {
        SessionDetailDto session = analyticsService.createSession(new CreateSessionRequestDto("J-101", "ADAPTIVE_AI", 30.0));
        RecordApproachMetricRequestDto metricDto = new RecordApproachMetricRequestDto("NORTH", 10, 3, 15.0, 25.0, 20.0, 5, false);

        ApproachMetricResponseDto response = analyticsService.recordApproachMetric(session.sessionId(), metricDto);
        assertNotNull(response.id());
        assertEquals(session.sessionId(), response.sessionId());
        assertEquals("NORTH", response.direction());
        assertEquals(10, response.vehicleCount());
    }

    @Test
    void testVehicleSemantics_PeakCountAndClearedSum() {
        SessionDetailDto session = analyticsService.createSession(new CreateSessionRequestDto("J-101", "ADAPTIVE_AI", 30.0));
        String sid = session.sessionId();

        analyticsService.recordApproachMetric(sid, new RecordApproachMetricRequestDto("SOUTH", 10, 5, 20.0, 35.0, 25.0, 5, false));
        analyticsService.recordApproachMetric(sid, new RecordApproachMetricRequestDto("SOUTH", 12, 6, 18.0, 30.0, 26.0, 7, false));
        analyticsService.recordApproachMetric(sid, new RecordApproachMetricRequestDto("SOUTH", 15, 8, 16.0, 25.0, 28.0, 4, false));

        SessionDetailDto updated = analyticsService.getSessionDetail(sid);
        assertEquals(15, updated.peakVehicleCount());
        assertEquals(15, updated.totalVehicles());
        assertEquals(16, updated.totalClearedVehicles());
        assertEquals(0, updated.completedCycles());
    }

    @Test
    void testDelayImprovementSignedCalculation() {
        // Baseline 40 seconds
        SessionDetailDto session = analyticsService.createSession(new CreateSessionRequestDto("J-101", "ADAPTIVE_AI", 40.0));
        String sid = session.sessionId();

        // 1. Actual 20 seconds -> 50% improvement
        analyticsService.recordApproachMetric(sid, new RecordApproachMetricRequestDto("SOUTH", 10, 5, 20.0, 30.0, 25.0, 5, false));
        AnalyticsSummaryDto summary1 = analyticsService.getSummaryMetricsForSession(sid);
        assertEquals(50.0, summary1.delayReductionPercent());
        assertEquals(50.0, summary1.approachDelaySavings().get("S"));

        // 2. Add sample with 60 seconds wait (average wait becomes 40s) -> 0% delay reduction
        analyticsService.recordApproachMetric(sid, new RecordApproachMetricRequestDto("SOUTH", 10, 5, 60.0, 70.0, 25.0, 5, false));
        AnalyticsSummaryDto summary2 = analyticsService.getSummaryMetricsForSession(sid);
        assertEquals(0.0, summary2.delayReductionPercent());

        // 3. Add sample with 100 seconds wait (average wait becomes 60s) -> -50% deterioration
        analyticsService.recordApproachMetric(sid, new RecordApproachMetricRequestDto("SOUTH", 10, 5, 100.0, 110.0, 25.0, 5, false));
        AnalyticsSummaryDto summary3 = analyticsService.getSummaryMetricsForSession(sid);
        assertEquals(-50.0, summary3.delayReductionPercent());
        assertEquals(-50.0, summary3.approachDelaySavings().get("S"));
    }

    @Test
    void testCannotAddMetricOrPreemptionToCompletedSession() {
        SessionDetailDto session = analyticsService.createSession(new CreateSessionRequestDto("J-101", "ADAPTIVE_AI", 30.0));
        String sid = session.sessionId();

        analyticsService.completeSession(sid);

        RecordApproachMetricRequestDto metric = new RecordApproachMetricRequestDto("NORTH", 10, 2, 15.0, 20.0, 30.0, 5, false);
        assertThrows(SessionAlreadyCompletedException.class, () -> analyticsService.recordApproachMetric(sid, metric));

        RecordPreemptionRequestDto preemption = new RecordPreemptionRequestDto("user", "ROLE", "J-101", "NORTH", 30.0);
        assertThrows(SessionAlreadyCompletedException.class, () -> analyticsService.recordPreemption(sid, preemption));
    }

    @Test
    void testPreemptionRequiresValidSession() {
        RecordPreemptionRequestDto preemption = new RecordPreemptionRequestDto("user", "ROLE", "J-101", "NORTH", 30.0);

        assertThrows(IllegalArgumentException.class, () -> analyticsService.recordPreemption(null, preemption));
        assertThrows(IllegalArgumentException.class, () -> analyticsService.recordPreemption("   ", preemption));
        assertThrows(AnalyticsSessionNotFoundException.class, () -> analyticsService.recordPreemption("NON_EXISTENT", preemption));
    }

    @Test
    void testExportCsvInvalidSessionThrowsNotFound() {
        assertThrows(AnalyticsSessionNotFoundException.class, () -> analyticsService.exportSessionCsv("INVALID_SESSION_ID"));
        assertThrows(AnalyticsSessionNotFoundException.class, () -> analyticsService.exportSessionData("INVALID_SESSION_ID", "csv"));
    }
}
