package com.example.custodix.Controller;

import com.example.custodix.dto.FlowFileInDTO;
import com.example.custodix.dto.TimelinePointDTO;
import com.example.custodix.entity.FlowFileIn;
import com.example.custodix.service.FlowFileInService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/filein")
@CrossOrigin(origins = "*")
public class FlowFileInController {

    @Autowired
    private FlowFileInService service;

    private LocalDateTime parseDate(String s) {
        return (s == null || s.isBlank()) ? null : LocalDateTime.parse(s);
    }

    @GetMapping("/kpi/summary")
    public FlowFileInDTO.Summary getKpiSummary() {
        return service.getKpiSummary();
    }

    @GetMapping("/timeline")
    public List<TimelinePointDTO> getTimeline(
        @RequestParam(defaultValue = "auto") String bucket,
        @RequestParam(required = false) String from,
        @RequestParam(required = false) String to,
        @RequestParam(required = false) String workflow,
        @RequestParam(required = false) String contrat
    ) {
        return service.getTimeline(parseDate(from), parseDate(to), bucket, workflow, contrat);
    }

    @GetMapping("/heatmap")
    public List<FlowFileInDTO.HeatmapCell> getHeatmap() {
        return service.getHeatmapData();
    }

    @GetMapping("/anomalies/timeline")
    public List<FlowFileInDTO.AnomalyPoint> getAnomaliesTimeline() {
        return service.getAnomaliesTimeline();
    }

    @GetMapping("/workflows/top")
    public List<FlowFileInDTO.NameCount> getTopWorkflows() {
        return service.getTopWorkflows();
    }

    @GetMapping("/contracts/top")
    public List<FlowFileInDTO.ContractStats> getTopContracts() {
        return service.getTopContracts();
    }

    @GetMapping("/paginated")
    public Page<FlowFileIn> getPaginated(
        @RequestParam(defaultValue = "0")  int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String workflow,
        @RequestParam(required = false) String contrat,
        @RequestParam(required = false) String from,
        @RequestParam(required = false) String to,
        @RequestParam(required = false) Boolean isDuplicate,
        @RequestParam(required = false) Boolean isManual
    ) {
        return service.getFileInPaginated(page, size, workflow, contrat,
            parseDate(from), parseDate(to), isDuplicate, isManual);
    }

    @GetMapping("/filters/workflows")
    public List<String> getFilterWorkflows() { return service.getDistinctWorkflows(); }

    @GetMapping("/filters/contracts")
    public List<String> getFilterContracts() { return service.getDistinctContracts(); }
}
