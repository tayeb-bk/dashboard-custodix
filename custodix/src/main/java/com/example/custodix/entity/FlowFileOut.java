package com.example.custodix.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "FLOW_FILEOUT", schema = "UCUSTOI0")
@Getter
@Setter
@NoArgsConstructor
public class FlowFileOut {

    @Id
    @Column(name = "ID_")
    private Long id;

    @Column(name = "FILEIN_ID_")
    private Long fileInId;

    @Column(name = "FILE_ID_")
    private Long fileId;

    @Column(name = "DESTINATIONINFO_ID_")
    private Long destinationInfoId;

    @Column(name = "ACKEXPECTED_")
    private Integer ackExpected;

    @Column(name = "USEDADDRESS_", length = 1020)
    private String usedAddress;
}
