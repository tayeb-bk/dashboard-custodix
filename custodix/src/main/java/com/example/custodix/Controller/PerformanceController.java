package com.example.custodix.Controller;

import com.example.custodix.dto.PerformanceLatencyDTO;
import com.example.custodix.service.PerformanceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/performance")
@CrossOrigin(origins = "*")
public class PerformanceController {

    @Autowired
    private PerformanceService service;

    @GetMapping("/latencies")
    public List<PerformanceLatencyDTO> getLatencies(
        @RequestParam(required = false) String contract,
        @RequestParam(required = false) String workflow,
        @RequestParam(required = false) String from,
        @RequestParam(required = false) String to
    ) {
        LocalDateTime fromDate = (from != null && !from.isBlank()) ? LocalDateTime.parse(from) : null;
        LocalDateTime toDate = (to != null && !to.isBlank()) ? LocalDateTime.parse(to) : null;

        return service.getPerformanceLatencies(contract, workflow, fromDate, toDate);
    }
}
