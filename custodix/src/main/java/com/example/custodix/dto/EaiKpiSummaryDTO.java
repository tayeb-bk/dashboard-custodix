package com.example.custodix.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class EaiKpiSummaryDTO {
    private long total;
    private long last24h;
    private long distinctMessages;
    private long distinctCreators;
}
