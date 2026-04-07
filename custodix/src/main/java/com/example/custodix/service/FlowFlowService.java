package com.example.custodix.service;

import com.example.custodix.Repository.FlowFlowRepository;
import com.example.custodix.dto.TimelinePointDTO;
import com.example.custodix.entity.FlowFlow;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class FlowFlowService {

    @Autowired
    private FlowFlowRepository repository;

    // Liste des 20 premiers flux
    public List<FlowFlow> getAllFlows() {
        return repository.findAll().stream().limit(20).toList();
    }

    // Statistiques par statut
    public List<Object[]> getStatsByStatus() {
        return repository.countByStatus();
    }

    // Statistiques par type
    public List<Object[]> getStatsByType() {
        return repository.countByFlowType();
    }


/// //////////////////////////1errrr

    public List<TimelinePointDTO> getTimeline(String status, LocalDateTime from, LocalDateTime to, String bucket,
                                              String type, String flowType, String routeId, String sender, String receiver) {

        List<Object[]> rows = switch (bucket) {
            case "hour" -> repository.timelineHour(status, from, to, type, flowType, routeId, sender, receiver);
            case "month" -> repository.timelineMonth(status, from, to, type, flowType, routeId, sender, receiver);
            default -> repository.timelineDay(status, from, to, type, flowType, routeId, sender, receiver);
        };

        return rows.stream()
                .map(r -> {
                    Object bucketObj = r[0];
                    LocalDateTime bucketValue;
                    if (bucketObj instanceof java.sql.Timestamp ts) {
                        bucketValue = ts.toLocalDateTime();
                    } else {
                        bucketValue = (LocalDateTime) bucketObj;
                    }
                    return new TimelinePointDTO(bucketValue, ((Number) r[1]).longValue());
                })
                .toList();
    }
}