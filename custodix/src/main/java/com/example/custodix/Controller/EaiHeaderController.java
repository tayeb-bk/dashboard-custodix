package com.example.custodix.Controller;

import com.example.custodix.dto.EaiKpiSummaryDTO;
import com.example.custodix.dto.TimelinePointDTO;
import com.example.custodix.service.EaiHeaderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/eai-headers")
@CrossOrigin(origins = "*")
public class EaiHeaderController {

    @Autowired
    private EaiHeaderService service;

    // ===== 4 KPI Summary Cards =====
    @GetMapping("/kpis")
    public EaiKpiSummaryDTO getKpis() {
        return service.getSummary();
    }

    // ===== Stats groupées =====
    @GetMapping("/stats/header-name")
    public List<Object[]> statsByHeaderName() {
        return service.getStatsByHeaderName();
    }

    @GetMapping("/stats/type")
    public List<Object[]> statsByType() {
        return service.getStatsByType();
    }

    @GetMapping("/stats/header-type")
    public List<Object[]> statsByHeaderType() {
        return service.getStatsByHeaderType();
    }

    @GetMapping("/stats/creator")
    public List<Object[]> statsByCreator() {
        return service.getStatsByCreator();
    }

    // ===== Timeline =====
    @GetMapping("/kpi/timeline")
    public List<TimelinePointDTO> timeline(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "auto") String bucket,
            @RequestParam(required = false) String headerName,
            @RequestParam(required = false) String type) {

        LocalDateTime fromDate = from != null ? LocalDateTime.parse(from) : null;
        LocalDateTime toDate   = to   != null ? LocalDateTime.parse(to)   : null;
        return service.getTimeline(fromDate, toDate, bucket, headerName, type);
    }

    // ===== Liste paginée =====
    @GetMapping
    public Map<String, Object> getPaginated(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String headerName,
            @RequestParam(required = false) String type) {
        LocalDateTime fromDate = from != null ? LocalDateTime.parse(from) : null;
        LocalDateTime toDate   = to   != null ? LocalDateTime.parse(to)   : null;
        return service.getPaginated(page, size, fromDate, toDate, headerName, type);
    }
}
