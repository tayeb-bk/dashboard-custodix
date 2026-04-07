package com.example.custodix.entity;

// src/main/java/com/example/custodix/entity/FlowFlow.java

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;

import java.time.LocalDateTime;

@Entity
@Table(name = "FLOW_FLOW", schema = "UCUSTOI0")
@Getter
@Setter
@NoArgsConstructor
public class FlowFlow {

    @jakarta.persistence.Id
    @Id
    @Column(name = "ID_")
    private Long id;

    @Column(name = "STATUS_")
    private String status;

    @Column(name = "TYPE_")
    private String type;

    @Column(name = "FLOWTYPE_NAME_")
    private String flowTypeName;

    @Column(name = "CREATIONDATE_")
    private LocalDateTime creationDate;

    @Column(name = "UPDATEDATE_")
    private LocalDateTime updateDate;

    @Column(name = "SENDER_IDENTIFIER_")
    private String senderIdentifier;

    @Column(name = "RECEIVER_IDENTIFIER_")
    private String receiverIdentifier;

    @Column(name = "ROUTE_ROUTEID_")
    private String routeId;

    @Column(name = "AMOUNT1_")
    private Double amount1;


}