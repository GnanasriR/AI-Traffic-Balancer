package com.kce.traffic.junction.service;

import com.kce.traffic.junction.dto.JunctionStatusDto;

public interface JunctionService {
    JunctionStatusDto getJunctionStatus(String junctionId);
    JunctionStatusDto toggleControlMode(String junctionId, boolean adaptive);
    JunctionStatusDto advanceStep(String junctionId, double dt);
    JunctionStatusDto updateDemand(String junctionId, String armCode, int queue, double maxWait);
}
