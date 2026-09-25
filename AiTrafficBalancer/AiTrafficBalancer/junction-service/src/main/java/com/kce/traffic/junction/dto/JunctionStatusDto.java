package com.kce.traffic.junction.dto;

import com.kce.traffic.junction.model.ArmDirection;
import com.kce.traffic.junction.model.PhaseState;

import java.util.List;
import java.util.Map;

public record JunctionStatusDto(
    String id,
    String name,
    String mode,
    int stage,
    ArmDirection activeArm,
    PhaseState phaseState,
    double remainingSeconds,
    double allocatedGreenSeconds,
    List<String> activePedestrianCrossings,
    Map<String, Integer> queues,
    Map<String, Double> maxWaitTimes
) {}
