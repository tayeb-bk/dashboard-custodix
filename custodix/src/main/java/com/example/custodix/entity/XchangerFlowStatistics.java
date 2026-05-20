package com.example.custodix.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "XCHANGER_FLOWSTATISTICS", schema = "UCUSTOI0")
@Getter
@Setter
@NoArgsConstructor
public class XchangerFlowStatistics {

    @Id
    @Column(name = "ID_")
    private Long id;

    @Column(name = "AGGREGATEDSTATUS_", length = 100)
    private String aggregatedStatus;

    @Column(name = "CREATIONDATE_")
    private LocalDateTime creationDate;

    @Column(name = "UPDATEDATE_")
    private LocalDateTime updateDate;

    @Column(name = "EXECUTIONTIME_")
    private LocalDateTime executionTime;

    @Column(name = "EXECUTIONTIMEASLONG_")
    private Long executionTimeAsLong;

    @Column(name = "AGGREGATEDEXECUTIONTIME_")
    private LocalDateTime aggregatedExecutionTime;

    @Column(name = "AGGREGATEDEXECUTIONTIMEASLONG_")
    private Long aggregatedExecutionTimeAsLong;

    @Column(name = "TYPE_", length = 255)
    private String type;

    @Column(name = "FLOW_ID_")
    private Long flowId;
}
