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
import java.util.Map;

@RestController
@RequestMapping("/api/filein")
@CrossOrigin(origins = "*")
public class FlowFileInController {

    @Autowired
    private FlowFileInService service;

    private LocalDateTime parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDateTime.parse(s.replace(" ", "T"));
        } catch (Exception e) {
            return null;
        }
    }

    @GetMapping("/kpi/summary")
    public FlowFileInDTO.Summary getKpiSummary(@RequestParam Map<String, String> params) {
        return service.getKpiSummary(params);
    }

    @GetMapping("/timeline")
    public List<TimelinePointDTO> getTimeline(@RequestParam Map<String, String> params) {
        String bucket = params.getOrDefault("bucket", "auto");
        String from = params.get("from");
        String to = params.get("to");
        String workflow = params.get("workflow");
        String contrat = params.get("contrat");
        return service.getTimeline(parseDate(from), parseDate(to), bucket, workflow, contrat);
    }

    @GetMapping("/timeline/baseline")
    public List<Map<String, Object>> getTimelineBaseline(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String workflow,
            @RequestParam(required = false) String contrat) {
        return service.getTimelineWithBaseline(parseDate(from), parseDate(to), workflow, contrat);
    }

    @GetMapping("/heatmap")
    public List<FlowFileInDTO.HeatmapCell> getHeatmap(@RequestParam Map<String, String> params) {
        return service.getHeatmapData(params);
    }

    @GetMapping("/anomalies/timeline")
    public List<FlowFileInDTO.AnomalyPoint> getAnomaliesTimeline(@RequestParam Map<String, String> params) {
        return service.getAnomaliesTimeline(params);
    }

    @GetMapping("/workflows/top")
    public List<FlowFileInDTO.NameCount> getTopWorkflows(@RequestParam Map<String, String> params) {
        return service.getTopWorkflows(params);
    }

    @GetMapping("/contracts/top")
    public List<FlowFileInDTO.ContractStats> getTopContracts(@RequestParam Map<String, String> params) {
        return service.getTopContracts(params);
    }

    @GetMapping("/paginated")
    public Page<FlowFileIn> getPaginated(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String workflow,
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) String checksum,
            @RequestParam(required = false) String client,
            @RequestParam(required = false) String fileName,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) Boolean isDuplicate,
            @RequestParam(required = false) Boolean isManual) {
        return service.getFileInPaginated(page, size, workflow, contrat, checksum, client, fileName,
                parseDate(from), parseDate(to), isDuplicate, isManual);
    }

    @GetMapping("/filters/workflows")
    public List<String> getFilterWorkflows() {
        return service.getDistinctWorkflows();
    }

    @GetMapping("/filters/contracts")
    public List<String> getFilterContracts() {
        return service.getDistinctContracts();
    }

    @GetMapping("/filters/clients")
    public List<String> getFilterClients() {
        return service.getDistinctClients();
    }

    @GetMapping("/filters/checksums")
    public List<String> getFilterChecksums() {
        return service.getDistinctChecksums();
    }
}
