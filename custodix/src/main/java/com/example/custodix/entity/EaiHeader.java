package com.example.custodix.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "EAI_HEADER", schema = "UCUSTOI0")
@Getter
@Setter
@NoArgsConstructor
public class EaiHeader {

    @Id
    @Column(name = "ID_")
    private Long id;

    @Column(name = "CREATIONDATE_")
    private LocalDateTime creationDate;

    @Column(name = "CREATORUSERID_")
    private String creatorUserId;

    @Column(name = "HEADERNAME_")
    private String headerName;

    @Column(name = "HEADERTYPE_")
    private String headerType;

    // HEADERVALUE_ est un BLOB — ignoré pour les KPIs

    @Column(name = "TYPE_")
    private String type;

    @Column(name = "UPDATEDATE_")
    private LocalDateTime updateDate;

    @Column(name = "UPDATORUSERID_")
    private String updatorUserId;

    @Column(name = "VERSION_")
    private Long version;

    @Column(name = "MESSAGE_ID_")
    private Long messageId;
}
