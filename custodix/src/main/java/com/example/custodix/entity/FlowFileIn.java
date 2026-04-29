package com.example.custodix.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "FLOW_FILEIN", schema = "UCUSTOI0")
@Getter
@Setter
@NoArgsConstructor
public class FlowFileIn {

    @Id
    @Column(name = "ID_")
    private Long id;

    @Column(name = "SENDINGDATE_")
    private LocalDateTime sendingDate;

    @Column(name = "COMPLETECOUNT_")
    private Long completeCount;

    @Column(name = "CHECKSUM_")
    private String checksum;

    @Column(name = "INITIATIONFILE_")
    private String initiationFile;

    @Column(name = "PASSEDCONTRACTIDENTIFIER_")
    private String passedContractIdentifier;

    @Column(name = "PRIORITY_")
    private String priority;

    @Column(name = "TOTALSPLITCOUNT_")
    private Long totalSplitCount;

    @Column(name = "WORKFLOWID_")
    private String workflowId;

    @Column(name = "CLIENT_IDENTIFIER_")
    private String clientIdentifier;

    @Column(name = "UBSCRITPIONDETAILS_IDENTIFIER_")
    private String subscriptionDetailsIdentifier;

    @Column(name = "DUPLICATED_ID_")
    private Long duplicatedId;

    @Column(name = "FILE_ID_")
    private Long fileId;

    @Column(name = "GROUPE_IDENTIFIER_")
    private String groupeIdentifier;

    @Column(name = "LINKEDPORTION_ID_")
    private Long linkedPortionId;

    @Column(name = "MANUALFLOWINTEGRATION_ID_")
    private Long manualFlowIntegrationId;

    @Column(name = "RECONCILING_ID_")
    private Long reconcilingId;

    @Column(name = "HANGERINTERFACE_INTERFACENAME_")
    private String hangerInterfaceInterfaceName;
}
