package com.example.custodix.service;

import com.example.custodix.Repository.EaiHeaderRepository;
import com.example.custodix.dto.EaiKpiSummaryDTO;
import com.example.custodix.dto.TimelinePointDTO;
import com.example.custodix.entity.EaiHeader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class EaiHeaderService {

    @Autowired
    private EaiHeaderRepository repository;

    // ===== Fetch by Message ID =====
    public List<EaiHeader> getByMessageId(Long messageId) {
        return repository.findByMessageId(messageId);
    }

    // ===== 4 KPI Cards =====
    public EaiKpiSummaryDTO getSummary() {
        long total            = repository.countTotal();
        long last24h          = repository.countSince(LocalDateTime.now().minusHours(24));
        long distinctMessages = repository.countDistinctMessages();
        long distinctCreators = repository.countDistinctCreators();
        return new EaiKpiSummaryDTO(total, last24h, distinctMessages, distinctCreators);
    }

    // ===== Grouped Stats =====
    public List<Object[]> getStatsByHeaderName() { return repository.countByHeaderName(); }
    public List<Object[]> getStatsByType()        { return repository.countByType(); }
    public List<Object[]> getStatsByHeaderType()  { return repository.countByHeaderType(); }
    public List<Object[]> getStatsByCreator()     { return repository.countByCreator(); }

    // ===== Widget File-In =====
    public List<Object[]> getWorkflowHeaderMatrix(String workflow) {
        return repository.getWorkflowHeaderMatrix(workflow == null || workflow.isBlank() ? null : workflow);
    }
    public List<Object[]> getHeaderCoverage(String workflow) {
        return repository.getHeaderCoverageByWorkflow(workflow == null || workflow.isBlank() ? null : workflow);
    }

    public Map<String, Object> getWorkflowTechnicalProfile(String workflow) {
        Long distinctHeaders = repository.countDistinctHeadersByWorkflow(workflow);
        List<Object[]> topHeaderRow = repository.getTopHeaderForWorkflow(workflow);
        
        String topHeader = "N/A";
        if (topHeaderRow != null && !topHeaderRow.isEmpty()) {
            topHeader = (String) topHeaderRow.get(0)[0];
        }

        return Map.of(
            "workflow", workflow,
            "distinctHeaders", distinctHeaders != null ? distinctHeaders : 0,
            "topHeader", topHeader,
            "status", distinctHeaders != null && distinctHeaders > 3 ? "Complet" : "Partiel"
        );
    }

    // ===== Timeline =====
    public List<TimelinePointDTO> getTimeline(LocalDateTime from, LocalDateTime to,
                                              String bucket, String headerName, String type) {
        String b = "auto".equals(bucket) ? autoBucket(from, to) : bucket;

        List<Object[]> rows = switch (b) {
            case "hour"  -> repository.timelineHour(from, to, headerName, type);
            case "month" -> repository.timelineMonth(from, to, headerName, type);
            default      -> repository.timelineDay(from, to, headerName, type);
        };

        return rows.stream().map(r -> {
            LocalDateTime bucketValue = (r[0] instanceof Timestamp ts)
                    ? ts.toLocalDateTime()
                    : (LocalDateTime) r[0];
            return new TimelinePointDTO(bucketValue, ((Number) r[1]).longValue());
        }).toList();
    }

    // ===== Paginated list =====
    public Map<String, Object> getPaginated(int page, int size, LocalDateTime from, LocalDateTime to, String headerName, String type) {
        int offset       = page * size;
        List<EaiHeader> content = repository.findPaginated(from, to, headerName, type, offset, size);
        long total       = repository.countPaginated(from, to, headerName, type);
        long totalPages  = (total + size - 1) / size;
        return Map.of(
                "content",       content,
                "totalElements", total,
                "totalPages",    totalPages,
                "currentPage",   page
        );
    }

    // ===== Auto bucket helper =====
    private String autoBucket(LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null) return "day";
        long hours = Duration.between(from, to).toHours();
        if (hours <= 48)       return "hour";
        if (hours <= 90 * 24)  return "day";
        return "month";
    }
}
