package com.example.custodix.dto;

import java.time.LocalDateTime;

public record PerformanceLatencyDTO(
    Long fileInId,  
    String contract,
    String workflow,
    Integer priority,
    LocalDateTime sendingDate,
    LocalDateTime creationDateFlow,
    LocalDateTime updateDateFlow,
    LocalDateTime sendingDateAck,
    Integer ackExpected,
    String status
) {}
