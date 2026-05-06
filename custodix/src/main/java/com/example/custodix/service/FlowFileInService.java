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
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
public class FlowFileInService {

    @Autowired
    private FlowFileInRepository repository;

    private String nullify(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private LocalDateTime parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            if (s.contains(" ")) s = s.replace(" ", "T");
            return LocalDateTime.parse(s, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(s + "T00:00:00", DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            } catch (Exception e2) {
                return null;
            }
        }
    }

    private String autoBucket(LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null) return "day";
        long hours = Duration.between(from, to).toHours();
        if (hours <= 48) return "hour";
        if (hours <= 90 * 24) return "day";
        return "month";
    }

    private LocalDateTime toLocalDateTime(Object obj) {
        if (obj instanceof java.sql.Timestamp ts) return ts.toLocalDateTime();
        return (LocalDateTime) obj;
    }

    public FlowFileInDTO.Summary getKpiSummary(Map<String, String> params) {
        String contrat = nullify(params.get("contrat"));
        String workflow = nullify(params.get("workflow"));
        LocalDateTime from = parseDate(params.get("from"));
        LocalDateTime to = parseDate(params.get("to"));

        Object[] r = repository.getKpiSummary(contrat, workflow, from, to).get(0);
        return new FlowFileInDTO.Summary(
                ((Number) r[0]).longValue(),
                ((Number) r[1]).longValue(),
                ((Number) r[2]).doubleValue(),
                ((Number) r[3]).longValue(),
                ((Number) r[4]).longValue(),
                ((Number) r[5]).longValue());
    }

    public List<TimelinePointDTO> getTimeline(LocalDateTime from, LocalDateTime to,
            String bucket, String workflow, String contrat) {
        String resolved = "auto".equalsIgnoreCase(bucket) ? autoBucket(from, to) : bucket;
        String w = nullify(workflow);
        String c = nullify(contrat);

        List<Object[]> rows = switch (resolved) {
            case "hour" -> repository.timelineHour(from, to, w, c);
            case "month" -> repository.timelineMonth(from, to, w, c);
            default -> repository.timelineDay(from, to, w, c);
        };

        return rows.stream().map(r -> new TimelinePointDTO(
                toLocalDateTime(r[0]),
                ((Number) r[1]).longValue())).toList();
    }

    public List<Map<String, Object>> getTimelineWithBaseline(LocalDateTime from, LocalDateTime to,
            String workflow, String contrat) {
        String w = nullify(workflow);
        String c = nullify(contrat);
        return repository.timelineWithBaseline(from, to, w, c).stream().map(r -> Map.<String, Object>of(
            "bucket",    toLocalDateTime(r[0]).toString(),
            "total",     ((Number) r[1]).longValue(),
            "avg",       ((Number) r[2]).longValue(),
            "upper",     ((Number) r[3]).longValue(),
            "lower",     ((Number) r[4]).longValue()
        )).toList();
    }

    public List<FlowFileInDTO.HeatmapCell> getHeatmapData(Map<String, String> params) {
        String contrat = nullify(params.get("contrat"));
        String workflow = nullify(params.get("workflow"));
        LocalDateTime from = parseDate(params.get("from"));
        LocalDateTime to = parseDate(params.get("to"));

        return repository.getHeatmapData(contrat, workflow, from, to).stream().map(r -> new FlowFileInDTO.HeatmapCell(
                ((Number) r[0]).intValue(),
                ((Number) r[1]).intValue(),
                ((Number) r[2]).longValue())).toList();
    }

    public List<FlowFileInDTO.AnomalyPoint> getAnomaliesTimeline(Map<String, String> params) {
        String contrat = nullify(params.get("contrat"));
        String workflow = nullify(params.get("workflow"));
        LocalDateTime from = parseDate(params.get("from"));
        LocalDateTime to = parseDate(params.get("to"));

        return repository.getAnomaliesTimeline(contrat, workflow, from, to).stream().map(r -> new FlowFileInDTO.AnomalyPoint(
                toLocalDateTime(r[0]),
                ((Number) r[1]).longValue(),
                ((Number) r[2]).longValue(),
                ((Number) r[3]).longValue())).toList();
    }

    public List<FlowFileInDTO.NameCount> getTopWorkflows(Map<String, String> params) {
        String contrat = nullify(params.get("contrat"));
        LocalDateTime from = parseDate(params.get("from"));
        LocalDateTime to = parseDate(params.get("to"));

        return repository.getTopWorkflows(contrat, from, to).stream().map(r -> new FlowFileInDTO.NameCount(
                (String) r[0],
                ((Number) r[1]).longValue())).toList();
    }

    public List<FlowFileInDTO.ContractStats> getTopContracts(Map<String, String> params) {
        String workflow = nullify(params.get("workflow"));
        LocalDateTime from = parseDate(params.get("from"));
        LocalDateTime to = parseDate(params.get("to"));

        return repository.getTopContracts(workflow, from, to).stream().map(r -> new FlowFileInDTO.ContractStats(
                (String) r[0],
                ((Number) r[1]).longValue(),
                ((Number) r[2]).longValue())).toList();
    }

    public Page<FlowFileIn> getFileInPaginated(int page, int size,
            String workflow, String contrat, String checksum, String client, String fileName,
            LocalDateTime from, LocalDateTime to,
            Boolean isDuplicate, Boolean isManual) {
        PageRequest pr = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "sendingDate"));
        return repository.findAllFiltered(
                nullify(workflow),
                nullify(contrat),
                nullify(checksum),
                nullify(client),
                nullify(fileName),
                from, to,
                isDuplicate, isManual,
                pr);
    }

    public List<String> getDistinctWorkflows() {
        return repository.findDistinctWorkflows();
    }

    public List<String> getDistinctContracts() {
        return repository.findDistinctContracts();
    }

    public List<String> getDistinctClients() {
        return repository.findDistinctClients();
    }

    public List<String> getDistinctChecksums() {
        return repository.findDistinctChecksums();
    }
}
