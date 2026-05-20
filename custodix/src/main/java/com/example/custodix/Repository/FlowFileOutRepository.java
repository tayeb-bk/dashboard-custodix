package com.example.custodix.Repository;

import com.example.custodix.entity.FlowFileOut;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository Expédition (Étape 3 — FileOut).
 *
 * ARCHITECTURE DES DONNÉES VALIDÉE PAR DIAGNOSTIC SQL :
 *  - FLOW_FILEOUT.FILEIN_ID_ → FLOW_FILEIN.ID_ : 100% match (jointure principale)
 *  - FLOW_INCOMINGACKNOWLEGEMENT.ACKEDFILEOUT_ID_ → FLOW_FILEOUT.ID_ : 285 ACKs réels
 *  - FILE_ID_ (FLOW_FLOW) = NULL pour tous → jamais utilisé
 *  - XCHANGER_FLOWSTATISTICS via FLOW_FLOW → 0 match → supprimé
 *  - USEDADDRESS_ = NULL pour tous → supprimé
 */
@Repository
public interface FlowFileOutRepository extends JpaRepository<FlowFileOut, Long> {

    // =========================================================================
    // KPI HERO (Widget 0 + Widget 1)
    // Retourne une ligne :
    // [0] livraisons (COUNT FileOut), [1] ackAttendu, [2] ackRecus, [3] fileInTotal,
    // [4] destinations, [5] fichiersLivres (COUNT DISTINCT FILEIN_ID_)
    // =========================================================================
    @Query(value = """
            SELECT
                (SELECT COUNT(*) FROM UCUSTOI0.FLOW_FILEOUT)                                        AS total,
                (SELECT COUNT(*) FROM UCUSTOI0.FLOW_FILEOUT WHERE ACKEXPECTED_ = 1)                 AS ack_attendu,
                (SELECT COUNT(*) FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT
                    WHERE ACKEDFILEOUT_ID_ IS NOT NULL)                                             AS ack_recus,
                (SELECT COUNT(*) FROM UCUSTOI0.FLOW_FILEIN)                                         AS filein_total,
                (SELECT COUNT(DISTINCT DESTINATIONINFO_ID_) FROM UCUSTOI0.FLOW_FILEOUT
                    WHERE DESTINATIONINFO_ID_ IS NOT NULL)                                          AS destinations,
                (SELECT COUNT(DISTINCT FILEIN_ID_) FROM UCUSTOI0.FLOW_FILEOUT)                    AS fichiers_livres
            FROM DUAL
            """, nativeQuery = true)
    List<Object[]> getHeroKpi();



    // =========================================================================
    // WIDGET 2 — Funnel pipeline (4 paliers, filtrable)
    // [0] fichiersRecus, [1] fichiersLivres, [2] livraisons, [3] ackConfirmes
    // Filtres : contrat, fromDate, toDate sur FLOW_FILEIN.SENDINGDATE_
    // ackOnly=1 : périmètre livraisons ACKEXPECTED_=1 uniquement
    // =========================================================================
    @Query(value = """
            SELECT
                (SELECT COUNT(*) FROM UCUSTOI0.FLOW_FILEIN fi
                 WHERE (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
                   AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
                   AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
                   AND (:ackOnly IS NULL OR EXISTS (
                       SELECT 1 FROM UCUSTOI0.FLOW_FILEOUT fo2
                       WHERE fo2.FILEIN_ID_ = fi.ID_ AND fo2.ACKEXPECTED_ = 1)))     AS fichiers_recus,
                (SELECT COUNT(DISTINCT fo.FILEIN_ID_) FROM UCUSTOI0.FLOW_FILEOUT fo
                 JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
                 WHERE (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
                   AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
                   AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
                   AND (:ackOnly IS NULL OR fo.ACKEXPECTED_ = 1))                     AS fichiers_livres,
                (SELECT COUNT(*) FROM UCUSTOI0.FLOW_FILEOUT fo
                 JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
                 WHERE (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
                   AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
                   AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
                   AND (:ackOnly IS NULL OR fo.ACKEXPECTED_ = 1))                     AS livraisons,
                (SELECT COUNT(*) FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack
                 JOIN UCUSTOI0.FLOW_FILEOUT fo ON fo.ID_ = ack.ACKEDFILEOUT_ID_
                 JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
                 WHERE ack.ACKEDFILEOUT_ID_ IS NOT NULL
                   AND (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
                   AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
                   AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
                   AND (:ackOnly IS NULL OR fo.ACKEXPECTED_ = 1))                     AS ack_confirmes
            FROM DUAL
            """, nativeQuery = true)
    List<Object[]> getPipelineFunnel(
            @Param("contrat") String contrat,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate") java.time.LocalDateTime toDate,
            @Param("ackOnly") Integer ackOnly);

    // =========================================================================
    // KPI Hero filtré (mêmes filtres que le funnel)
    // =========================================================================
    @Query(value = """
            SELECT
                (SELECT COUNT(*) FROM UCUSTOI0.FLOW_FILEOUT fo
                 JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
                 WHERE (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
                   AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
                   AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
                   AND (:ackOnly IS NULL OR fo.ACKEXPECTED_ = 1))                     AS total,
                (SELECT COUNT(*) FROM UCUSTOI0.FLOW_FILEOUT fo
                 JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
                 WHERE fo.ACKEXPECTED_ = 1
                   AND (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
                   AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
                   AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
                   AND (:ackOnly IS NULL OR fo.ACKEXPECTED_ = 1))                     AS ack_attendu,
                (SELECT COUNT(*) FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack
                 JOIN UCUSTOI0.FLOW_FILEOUT fo ON fo.ID_ = ack.ACKEDFILEOUT_ID_
                 JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
                 WHERE ack.ACKEDFILEOUT_ID_ IS NOT NULL
                   AND (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
                   AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
                   AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
                   AND (:ackOnly IS NULL OR fo.ACKEXPECTED_ = 1))                     AS ack_recus,
                (SELECT COUNT(*) FROM UCUSTOI0.FLOW_FILEIN fi
                 WHERE (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
                   AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
                   AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
                   AND (:ackOnly IS NULL OR EXISTS (
                       SELECT 1 FROM UCUSTOI0.FLOW_FILEOUT fo2
                       WHERE fo2.FILEIN_ID_ = fi.ID_ AND fo2.ACKEXPECTED_ = 1)))     AS filein_total,
                (SELECT COUNT(DISTINCT fo.DESTINATIONINFO_ID_) FROM UCUSTOI0.FLOW_FILEOUT fo
                 JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
                 WHERE fo.DESTINATIONINFO_ID_ IS NOT NULL
                   AND (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
                   AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
                   AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
                   AND (:ackOnly IS NULL OR fo.ACKEXPECTED_ = 1))                     AS destinations,
                (SELECT COUNT(DISTINCT fo.FILEIN_ID_) FROM UCUSTOI0.FLOW_FILEOUT fo
                 JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
                 WHERE (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
                   AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
                   AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
                   AND (:ackOnly IS NULL OR fo.ACKEXPECTED_ = 1))                     AS fichiers_livres
            FROM DUAL
            """, nativeQuery = true)
    List<Object[]> getHeroKpiFiltered(
            @Param("contrat") String contrat,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate") java.time.LocalDateTime toDate,
            @Param("ackOnly") Integer ackOnly);

    @Query(value = """
            SELECT COUNT(*) AS ack_manquants
            FROM UCUSTOI0.FLOW_FILEOUT fo
            JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
            WHERE fo.ACKEXPECTED_ = 1
              AND NOT EXISTS (
                  SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack
                  WHERE ack.ACKEDFILEOUT_ID_ = fo.ID_)
              AND (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
            """, nativeQuery = true)
    List<Object[]> getAckManquantsFiltered(
            @Param("contrat") String contrat,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate") java.time.LocalDateTime toDate);

    @Query(value = """
            SELECT DISTINCT fi.PASSEDCONTRACTIDENTIFIER_
            FROM UCUSTOI0.FLOW_FILEIN fi
            WHERE fi.PASSEDCONTRACTIDENTIFIER_ IS NOT NULL
            ORDER BY fi.PASSEDCONTRACTIDENTIFIER_
            FETCH FIRST 40 ROWS ONLY
            """, nativeQuery = true)
    List<Object[]> getContratsList();

    // =========================================================================
    // TIMELINE DES EXPÉDITIONS (Widget 3)
    // Source : FLOW_FILEOUT + FLOW_FILEIN (via FILEIN_ID_)
    // Retourne : [0] jour, [1] total, [2] avecAck
    // =========================================================================
    @Query(value = """
            SELECT
                TRUNC(fi.SENDINGDATE_)                                           AS jour,
                COUNT(*)                                                         AS total,
                COUNT(CASE WHEN fo.ACKEXPECTED_ = 1 THEN 1 END)                 AS avec_ack
            FROM UCUSTOI0.FLOW_FILEOUT fo
            JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
            WHERE fi.SENDINGDATE_ IS NOT NULL
              AND (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate   IS NULL OR fi.SENDINGDATE_ <= :toDate)
            GROUP BY TRUNC(fi.SENDINGDATE_)
            ORDER BY jour ASC
            """, nativeQuery = true)
    List<Object[]> getTimelineByDay(
            @Param("contrat") String contrat,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate")   java.time.LocalDateTime toDate);

    // =========================================================================
    // TOP CONTRATS (Widget 4)
    // Source : FLOW_FILEOUT + FLOW_FILEIN (via FILEIN_ID_)
    // Retourne : [0] contrat, [1] total, [2] premiereExp, [3] derniereExp, [4] avecAck
    // =========================================================================
    @Query(value = """
            SELECT
                fi.PASSEDCONTRACTIDENTIFIER_                                     AS contrat,
                COUNT(*)                                                         AS total,
                MIN(fi.SENDINGDATE_)                                             AS premiere_expedition,
                MAX(fi.SENDINGDATE_)                                             AS derniere_expedition,
                COUNT(CASE WHEN fo.ACKEXPECTED_ = 1 THEN 1 END)                 AS avec_ack_attendu
            FROM UCUSTOI0.FLOW_FILEOUT fo
            JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
            WHERE fi.PASSEDCONTRACTIDENTIFIER_ IS NOT NULL
            GROUP BY fi.PASSEDCONTRACTIDENTIFIER_
            ORDER BY total DESC
            FETCH FIRST 15 ROWS ONLY
            """, nativeQuery = true)
    List<Object[]> getTopContrats();

    // =========================================================================
    // RÉPARTITION PAR DESTINATION (Widget 5)
    // Source : FLOW_FILEOUT.DESTINATIONINFO_ID_
    // Retourne : [0] destinationId, [1] total, [2] pourcentage
    // =========================================================================
    @Query(value = """
            SELECT
                NVL(TO_CHAR(fo.DESTINATIONINFO_ID_), 'Non défini')              AS destination,
                COUNT(*)                                                         AS total,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM UCUSTOI0.FLOW_FILEOUT), 1) AS pourcentage
            FROM UCUSTOI0.FLOW_FILEOUT fo
            GROUP BY fo.DESTINATIONINFO_ID_
            ORDER BY total DESC
            FETCH FIRST 10 ROWS ONLY
            """, nativeQuery = true)
    List<Object[]> getTopDestinations();

    // =========================================================================
    // ANALYSE ACK — Distribution (Widget 6)
    // Source : FLOW_FILEOUT.ACKEXPECTED_
    // Retourne : [0] typeAck (0=sans, 1=avec), [1] total
    // =========================================================================
    @Query(value = """
            SELECT
                ACKEXPECTED_    AS type_ack,
                COUNT(*)        AS total
            FROM UCUSTOI0.FLOW_FILEOUT
            GROUP BY ACKEXPECTED_
            ORDER BY ACKEXPECTED_
            """, nativeQuery = true)
    List<Object[]> getAckDistribution();

    // =========================================================================
    // ANALYSE ACK — Confirmations reçues (Widget 6)
    // Source : FLOW_INCOMINGACKNOWLEGEMENT
    // Retourne : [0] type, [1] categorie, [2] total, [3] avecErreur
    // =========================================================================
    @Query(value = """
            SELECT
                NVL(ACKNOWLEDGEMENTTYPE_, 'Non défini')             AS type_ack,
                NVL(ACKNOWLEDGEMENTCATEGORY_NAME_, 'Sans catégorie') AS categorie,
                COUNT(*)                                            AS total,
                COUNT(CASE WHEN ERRORCODE_ IS NOT NULL THEN 1 END) AS avec_erreur
            FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT
            GROUP BY ACKNOWLEDGEMENTTYPE_, ACKNOWLEDGEMENTCATEGORY_NAME_
            ORDER BY total DESC
            """, nativeQuery = true)
    List<Object[]> getAckConfirmations();

    // =========================================================================
    // ACK MANQUANTS (Widget 6 — section intelligence)
    // FileOut avec ACKEXPECTED_=1 sans aucune confirmation reçue
    // Retourne : [0] ackManquants
    // =========================================================================
    @Query(value = """
            SELECT COUNT(*) AS ack_manquants
            FROM UCUSTOI0.FLOW_FILEOUT fo
            WHERE fo.ACKEXPECTED_ = 1
              AND NOT EXISTS (
                  SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack
                  WHERE ack.ACKEDFILEOUT_ID_ = fo.ID_
              )
            """, nativeQuery = true)
    List<Object[]> getAckManquants();

    // =========================================================================
    // TABLE JOURNAL PAGINÉE (Widget 7)
    // Source : FLOW_FILEOUT + FLOW_FILEIN (via FILEIN_ID_) + ACK optionnel
    // Retourne : foId, contrat, workflow, dateEnvoi, priorite, ackAttendu, destination, statutAck
    // =========================================================================
    @Query(value = """
            SELECT
                fo.ID_                                                           AS foId,
                fi.PASSEDCONTRACTIDENTIFIER_                                     AS contrat,
                fi.WORKFLOWID_                                                   AS workflow,
                fi.SENDINGDATE_                                                  AS dateEnvoi,
                fi.PRIORITY_                                                     AS priorite,
                fo.ACKEXPECTED_                                                  AS ackAttendu,
                fo.DESTINATIONINFO_ID_                                           AS destination,
                CASE WHEN ack.ID_ IS NOT NULL THEN 'Confirmé' ELSE '—' END      AS statutAck,
                ack.ACKNOWLEDGEMENTTYPE_                                         AS typeAck
            FROM UCUSTOI0.FLOW_FILEOUT fo
            JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
            LEFT JOIN UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack ON ack.ACKEDFILEOUT_ID_ = fo.ID_
            WHERE (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:ackExpected IS NULL OR fo.ACKEXPECTED_ = :ackExpected)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate   IS NULL OR fi.SENDINGDATE_ <= :toDate)
            ORDER BY fi.SENDINGDATE_ DESC NULLS LAST
            """, countQuery = """
            SELECT COUNT(fo.ID_)
            FROM UCUSTOI0.FLOW_FILEOUT fo
            JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
            LEFT JOIN UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack ON ack.ACKEDFILEOUT_ID_ = fo.ID_
            WHERE (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:ackExpected IS NULL OR fo.ACKEXPECTED_ = :ackExpected)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate   IS NULL OR fi.SENDINGDATE_ <= :toDate)
            """, nativeQuery = true)
    org.springframework.data.domain.Page<com.example.custodix.dto.FlowFileOutProjection> getJournalPaginated(
            @Param("contrat")      String contrat,
            @Param("ackExpected")  Integer ackExpected,
            @Param("fromDate")     java.time.LocalDateTime fromDate,
            @Param("toDate")       java.time.LocalDateTime toDate,
            org.springframework.data.domain.Pageable pageable);
}
