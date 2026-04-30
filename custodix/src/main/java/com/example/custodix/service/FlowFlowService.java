package com.example.custodix.service;

import com.example.custodix.Repository.FlowFlowRepository;
import com.example.custodix.dto.TimelinePointDTO;
import com.example.custodix.entity.FlowFlow;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class FlowFlowService {

    @Autowired
    private FlowFlowRepository repository;

    // Liste des 50 premiers flux
    public List<FlowFlow> getAllFlows() {
        return repository.findAll().stream().limit(50).toList();
    }

    // Statistiques par statut
    public List<Object[]> getStatsByStatus() {
        return repository.countByStatus();
    }

    // Statistiques par type
    public List<Object[]> getStatsByType() {
        return repository.countByFlowType();
    }

    public List<Object[]> getStatsByRealType() {
        return repository.countByRealType();
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
                    String category = r.length > 2 && r[2] != null ? r[2].toString() : "Inconnu";
                    return new TimelinePointDTO(bucketValue, ((Number) r[1]).longValue(), category);
                })
                .toList();
    }

    /// ////////////////////////// Nouveaux KPIs

    public List<Object[]> getVolumeByStatus() {
        return repository.getFinancialVolumeByStatus();
    }

    public List<Object[]> getTop5Routes() {
        return repository.getTopRoutesWithStats().stream()
                .limit(5)
                .toList();
    }

    public List<Object[]> getLeadTimeTrends() {
        return repository.getAverageProcessingTimePerDay();
    }

    public List<Object[]> getKpiSummary() {
        return repository.getKpiSummary();
    }

    // Pagination filtrée — accès à toutes les données avec filtres
    public Page<FlowFlow> getFlowsPaginated(int page, int size,
            String status, String type, String flowType,
            LocalDateTime from, LocalDateTime to, String scoreLevel) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "creationDate"));
        LocalDateTime yesterday = LocalDateTime.now().minusHours(24);
        
        return repository.findAllFiltered(
                (status   != null && status.isBlank())   ? null : status,
                (type     != null && type.isBlank())     ? null : type,
                (flowType != null && flowType.isBlank()) ? null : flowType,
                from, to, 
                (scoreLevel != null && scoreLevel.isBlank()) ? null : scoreLevel,
                yesterday,
                pageRequest);
    }
}