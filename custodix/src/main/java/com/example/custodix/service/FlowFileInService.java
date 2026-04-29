package com.example.custodix.service;

import com.example.custodix.Repository.FlowFileInRepository;
import com.example.custodix.dto.FlowFileInDTO;
import com.example.custodix.dto.TimelinePointDTO;
import com.example.custodix.entity.FlowFileIn;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class FlowFileInService {

    @Autowired
    private FlowFileInRepository repository;

    // ===== Helpers =====
    private String nullify(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private String autoBucket(LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null) return "day";
        long hours = Duration.between(from, to).toHours();
        if (hours <= 48)      return "hour";
        if (hours <= 90 * 24) return "day";
        return "month";
    }

    private LocalDateTime toLocalDateTime(Object obj) {
        if (obj instanceof java.sql.Timestamp ts) return ts.toLocalDateTime();
        return (LocalDateTime) obj;
    }

    // ===== KPI Summary =====
    public FlowFileInDTO.Summary getKpiSummary() {
        Object[] r = repository.getKpiSummary().get(0);
        return new FlowFileInDTO.Summary(
            ((Number) r[0]).longValue(),
            ((Number) r[1]).longValue(),
            ((Number) r[2]).doubleValue(),
            ((Number) r[3]).longValue(),
            ((Number) r[4]).longValue(),
            ((Number) r[5]).longValue()
        );
    }

    // ===== Timeline =====
    public List<TimelinePointDTO> getTimeline(LocalDateTime from, LocalDateTime to,
                                              String bucket, String workflow, String contrat) {
        String resolved = "auto".equalsIgnoreCase(bucket) ? autoBucket(from, to) : bucket;
        String w = nullify(workflow);
        String c = nullify(contrat);

        List<Object[]> rows = switch (resolved) {
            case "hour"  -> repository.timelineHour(from, to, w, c);
            case "month" -> repository.timelineMonth(from, to, w, c);
            default      -> repository.timelineDay(from, to, w, c);
        };

        return rows.stream().map(r -> new TimelinePointDTO(
            toLocalDateTime(r[0]),
            ((Number) r[1]).longValue()
        )).toList();
    }

    // ===== Heatmap =====
    public List<FlowFileInDTO.HeatmapCell> getHeatmapData() {
        return repository.getHeatmapData().stream().map(r ->
            new FlowFileInDTO.HeatmapCell(
                ((Number) r[0]).intValue(),
                ((Number) r[1]).intValue(),
                ((Number) r[2]).longValue()
            )
        ).toList();
    }

    // ===== Anomalies Timeline =====
    public List<FlowFileInDTO.AnomalyPoint> getAnomaliesTimeline() {
        return repository.getAnomaliesTimeline().stream().map(r ->
            new FlowFileInDTO.AnomalyPoint(
                toLocalDateTime(r[0]),
                ((Number) r[1]).longValue(),
                ((Number) r[2]).longValue(),
                ((Number) r[3]).longValue()
            )
        ).toList();
    }

    // ===== Top Workflows =====
    public List<FlowFileInDTO.NameCount> getTopWorkflows() {
        return repository.getTopWorkflows().stream().map(r ->
            new FlowFileInDTO.NameCount(
                (String) r[0],
                ((Number) r[1]).longValue()
            )
        ).toList();
    }

    // ===== Top Contrats =====
    public List<FlowFileInDTO.ContractStats> getTopContracts() {
        return repository.getTopContracts().stream().map(r ->
            new FlowFileInDTO.ContractStats(
                (String) r[0],
                ((Number) r[1]).longValue(),
                ((Number) r[2]).longValue()
            )
        ).toList();
    }

    // ===== Table paginée =====
    public Page<FlowFileIn> getFileInPaginated(int page, int size,
                                               String workflow, String contrat,
                                               LocalDateTime from, LocalDateTime to,
                                               Boolean isDuplicate, Boolean isManual) {
        PageRequest pr = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "sendingDate"));
        return repository.findAllFiltered(
            nullify(workflow),
            nullify(contrat),
            from, to,
            isDuplicate, isManual,
            pr
        );
    }

    // ===== Distinct values =====
    public List<String> getDistinctWorkflows() { return repository.findDistinctWorkflows(); }
    public List<String> getDistinctContracts() { return repository.findDistinctContracts(); }
}
