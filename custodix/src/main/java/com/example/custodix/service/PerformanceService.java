package com.example.custodix.service;

import com.example.custodix.Repository.PerformanceRepository;
import com.example.custodix.dto.PerformanceLatencyDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PerformanceService {

    @Autowired
    private PerformanceRepository repository;

    public List<PerformanceLatencyDTO> getPerformanceLatencies(
        String contract,
        String workflow,
        LocalDateTime fromDate,
        LocalDateTime toDate
    ) {
        List<Object[]> rawData = repository.getPerformanceRawData(
            (contract != null && contract.isBlank()) ? null : contract,
            (workflow != null && workflow.isBlank()) ? null : workflow,
            fromDate,
            toDate
        );

        return rawData.stream()
            .map(r -> new PerformanceLatencyDTO(
                toLong(r[0]),
                r[1] != null ? r[1].toString() : null,
                r[2] != null ? r[2].toString() : null,
                toInteger(r[3]),
                toLocalDateTime(r[4]),
                toLocalDateTime(r[5]),
                toLocalDateTime(r[6]),
                toLocalDateTime(r[7]),
                toInteger(r[8]),
                r[9] != null ? r[9].toString() : null
            ))
            .toList();
    }

    private LocalDateTime toLocalDateTime(Object obj) {
        if (obj == null) return null;
        if (obj instanceof java.sql.Timestamp ts) {
            return ts.toLocalDateTime();
        }
        if (obj instanceof LocalDateTime ldt) {
            return ldt;
        }
        return null;
    }

    private Long toLong(Object obj) {
        if (obj == null) return null;
        if (obj instanceof Number num) {
            return num.longValue();
        }
        return null;
    }

    private Integer toInteger(Object obj) {
        if (obj == null) return null;
        if (obj instanceof Number num) {
            return num.intValue();
        }
        try {
            return Integer.parseInt(obj.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
