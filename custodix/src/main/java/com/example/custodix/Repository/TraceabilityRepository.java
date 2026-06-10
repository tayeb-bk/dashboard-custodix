package com.example.custodix.Repository;

import com.example.custodix.entity.FlowFileIn;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TraceabilityRepository extends JpaRepository<FlowFileIn, Long> {

    // Recherche paginée avec filtres multicritères sur les fichiers entrants et leurs flux
    @Query(value = """
        SELECT 
            fi.ID_ as fileInId, 
            fi.INITIATIONFILE_ as fileName, 
            fi.SENDINGDATE_ as receivingDate,
            fi.PASSEDCONTRACTIDENTIFIER_ as contract, 
            fi.WORKFLOWID_ as workflow,
            ff.STATUS_ as flowStatus
        FROM UCUSTOI0.FLOW_FILEIN fi
        LEFT JOIN UCUSTOI0.FLOW_FLOW ff ON ff.ID_ = fi.ID_
        WHERE (:searchTerm IS NULL 
               OR LOWER(fi.INITIATIONFILE_) LIKE LOWER('%' || :searchTerm || '%')
               OR TO_CHAR(fi.ID_) = :searchTerm)
          AND (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
          AND (:workflow IS NULL OR fi.WORKFLOWID_ = :workflow)
        ORDER BY fi.SENDINGDATE_ DESC NULLS LAST, fi.ID_ DESC
        """, 
        countQuery = """
        SELECT COUNT(fi.ID_)
        FROM UCUSTOI0.FLOW_FILEIN fi
        WHERE (:searchTerm IS NULL 
               OR LOWER(fi.INITIATIONFILE_) LIKE LOWER('%' || :searchTerm || '%')
               OR TO_CHAR(fi.ID_) = :searchTerm)
          AND (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
          AND (:workflow IS NULL OR fi.WORKFLOWID_ = :workflow)
        """, 
        nativeQuery = true)
    Page<Object[]> searchFiles(
        @Param("searchTerm") String searchTerm,
        @Param("contrat") String contrat,
        @Param("workflow") String workflow,
        Pageable pageable);

    // Détails de la réception (Fichier physique + Flux logique de traitement)
    @Query(value = """
        SELECT 
            fi.ID_ as fileInId, 
            fi.INITIATIONFILE_ as fileName, 
            fi.SENDINGDATE_ as receivingDate,
            fi.PASSEDCONTRACTIDENTIFIER_ as contract, 
            fi.WORKFLOWID_ as workflow,
            ff.STATUS_ as flowStatus, 
            ff.ROUTE_ROUTEID_ as routeId, 
            ff.FLOWTYPE_NAME_ as flowTypeName,
            ff.AMOUNT1_ as amount,
            ff.SENDER_IDENTIFIER_ as sender,
            ff.RECEIVER_IDENTIFIER_ as receiver,
            ff.CREATIONDATE_ as flowCreationDate,
            ff.UPDATEDATE_ as flowUpdateDate
        FROM UCUSTOI0.FLOW_FILEIN fi
        LEFT JOIN UCUSTOI0.FLOW_FLOW ff ON ff.ID_ = fi.ID_
        WHERE fi.ID_ = :id
        """, nativeQuery = true)
    List<Object[]> getFileInTraceabilityDetails(@Param("id") Long id);

    // Liste des expéditions de sortie (FileOut) et leurs ACKs pour un fichier d'entrée donné
    @Query(value = """
        SELECT 
            fo.ID_ as fileOutId, 
            fo.DESTINATIONINFO_ID_ as destination, 
            fo.USEDADDRESS_ as address,
            ff.STATUS_ as status,
            ack.ACKNOWLEDGEMENTTYPE_ as ackType,
            ack.FILEOUTSENDINGDATE_ as ackDate,
            ack.ERRORCODE_ as errorCode,
            ack.ERRORREASON_ as errorReason
        FROM UCUSTOI0.FLOW_FILEOUT fo
        LEFT JOIN UCUSTOI0.FLOW_FLOW ff ON ff.ID_ = fo.ID_
        LEFT JOIN UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack ON ack.ACKEDFILEOUT_ID_ = fo.ID_
        WHERE fo.FILEIN_ID_ = :fileInId
        ORDER BY fo.ID_ ASC
        """, nativeQuery = true)
    List<Object[]> getFileOutTraceabilityDetails(@Param("fileInId") Long fileInId);
}
