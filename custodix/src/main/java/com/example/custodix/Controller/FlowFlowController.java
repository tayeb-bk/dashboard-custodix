package com.example.custodix.Controller;

import com.example.custodix.dto.TimelinePointDTO;
import com.example.custodix.entity.FlowFlow;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import com.example.custodix.service.FlowFlowService;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/flows")
@CrossOrigin(origins = "*")
public class FlowFlowController {

    @Autowired
    private FlowFlowService service;

    @GetMapping
    public List<FlowFlow> getAll() {
        return service.getAllFlows();
    }

    @GetMapping("/stats/status")
    public List<Object[]> statsByStatus() {
        return service.getStatsByStatus();
    }

    @GetMapping("/stats/type")
    public List<Object[]> statsByType() {
        return service.getStatsByType();
    }

    /// //////////////////////////////////1errr
    private String autoBucket(LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null)
            return "day";
        long hours = Duration.between(from, to).toHours();
        if (hours <= 48)
            return "hour";
        if (hours <= 90 * 24)
            return "day";
        return "month";
    }

    @GetMapping("/kpi/timeline")
    public List<TimelinePointDTO> timeline(@RequestParam String status,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "auto") String bucket,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String flowType,
            @RequestParam(required = false) String routeId,
            @RequestParam(required = false) String sender,
            @RequestParam(required = false) String receiver) {

        LocalDateTime fromDate = (from == null ? null : LocalDateTime.parse(from));
        LocalDateTime toDate = (to == null ? null : LocalDateTime.parse(to));
        String b = bucket.equals("auto") ? autoBucket(fromDate, toDate) : bucket;

        return service.getTimeline(status, fromDate, toDate, b, type, flowType, routeId, sender, receiver);
    }

    /// ////////////////////////// Nouveaux KPIs
    @GetMapping("/stats/volume-by-status")
    public List<Object[]> getVolumeByStatus() {
        return service.getVolumeByStatus();
    }

    @GetMapping("/stats/top-routes")
    public List<Object[]> getTop5Routes() {
        return service.getTop5Routes();
    }

    @GetMapping("/stats/lead-time-trends")
    public List<Object[]> getLeadTimeTrends() {
        return service.getLeadTimeTrends();
    }
}