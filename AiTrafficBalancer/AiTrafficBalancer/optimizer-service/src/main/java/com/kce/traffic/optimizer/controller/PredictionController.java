package com.kce.traffic.optimizer.controller;

import com.kce.traffic.optimizer.dto.PredictionResponseDto;
import com.kce.traffic.optimizer.model.Approach;
import com.kce.traffic.optimizer.service.TrafficPredictionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/optimizer/prediction")
public class PredictionController {

    private final TrafficPredictionService predictionService;

    public PredictionController(TrafficPredictionService predictionService) {
        this.predictionService = predictionService;
    }

    @GetMapping
    public ResponseEntity<List<PredictionResponseDto>> getPredictions(
            @RequestParam(defaultValue = "5") int southQueue,
            @RequestParam(defaultValue = "3") int northQueue,
            @RequestParam(defaultValue = "4") int eastQueue,
            @RequestParam(defaultValue = "1") int westQueue,
            @RequestParam(defaultValue = "false") boolean southIncident) {

        Map<Approach, Integer> queues = new EnumMap<>(Approach.class);
        queues.put(Approach.SOUTH, southQueue);
        queues.put(Approach.NORTH, northQueue);
        queues.put(Approach.EAST, eastQueue);
        queues.put(Approach.WEST, westQueue);

        Map<Approach, Boolean> incidents = new EnumMap<>(Approach.class);
        incidents.put(Approach.SOUTH, southIncident);

        List<PredictionResponseDto> predictions = predictionService.predictTrafficSurges(queues, incidents);
        return ResponseEntity.ok(predictions);
    }
}
