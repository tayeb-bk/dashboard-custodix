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
