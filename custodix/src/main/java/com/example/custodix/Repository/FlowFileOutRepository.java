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

    // =========================================================================
    // ACK GLOBAL NON CONFIRMÉ
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
    // ACK FILTRÉ NON CONFIRMÉ
    // =========================================================================
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

    // =========================================================================
    // OBTENIR LA LISTE DES CONTRATS DISPONIBLES
    // =========================================================================
    @Query(value = """
            SELECT DISTINCT fi.PASSEDCONTRACTIDENTIFIER_
            FROM UCUSTOI0.FLOW_FILEIN fi
            WHERE fi.PASSEDCONTRACTIDENTIFIER_ IS NOT NULL
            ORDER BY fi.PASSEDCONTRACTIDENTIFIER_
            FETCH FIRST 40 ROWS ONLY
            """, nativeQuery = true)
    List<Object[]> getContratsList();

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
              AND (:workflow IS NULL OR fi.WORKFLOWID_ = :workflow)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate   IS NULL OR fi.SENDINGDATE_ <= :toDate)
              AND (:ackOnly IS NULL OR fo.ACKEXPECTED_ = 1)
            GROUP BY TRUNC(fi.SENDINGDATE_)
            ORDER BY jour ASC
            """, nativeQuery = true)
    List<Object[]> getTimelineByDay(
            @Param("contrat") String contrat,
            @Param("workflow") String workflow,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate")   java.time.LocalDateTime toDate,
            @Param("ackOnly")  Integer ackOnly);

    // =========================================================================
    // OBTENIR LA LISTE DES WORKFLOWS DISPONIBLES
    // =========================================================================
    @Query(value = """
            SELECT DISTINCT fi.WORKFLOWID_
            FROM UCUSTOI0.FLOW_FILEOUT fo
            JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
            WHERE fi.WORKFLOWID_ IS NOT NULL
            ORDER BY fi.WORKFLOWID_
            FETCH FIRST 50 ROWS ONLY
            """, nativeQuery = true)
    List<Object[]> getWorkflowsList();

    // =========================================================================
    // PERFORMANCE PAR CONTRAT (Widget 4) — aligné funnel / KPI
    // Source : FLOW_FILEIN + FLOW_FILEOUT (+ ACK)
    // Filtres : contrat (focus), fromDate, toDate, ackOnly (même sémantique que funnel)
    // Retourne : [0] contrat, [1] fichiersRecus, [2] fichiersLivres, [3] livraisons,
    //            [4] couverturePct, [5] ackAttendu, [6] ackConfirmes, [7] ackManquants,
    //            [8] tauxAckPct (null si ackAttendu=0)
    // =========================================================================
    @Query(value = """
            SELECT
                fi.PASSEDCONTRACTIDENTIFIER_                                     AS contrat,
                COUNT(DISTINCT fi.ID_)                                           AS fichiers_recus,
                COUNT(DISTINCT fo.FILEIN_ID_)                                    AS fichiers_livres,
                COUNT(fo.ID_)                                                    AS livraisons,
                ROUND(CASE WHEN COUNT(DISTINCT fi.ID_) > 0
                    THEN COUNT(DISTINCT fo.FILEIN_ID_) * 100.0 / COUNT(DISTINCT fi.ID_)
                    ELSE 0 END, 1)                                             AS couverture_pct,
                COUNT(CASE WHEN fo.ACKEXPECTED_ = 1 THEN 1 END)                 AS ack_attendu,
                COUNT(CASE WHEN fo.ACKEXPECTED_ = 1 AND EXISTS (
                    SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT a
                    WHERE a.ACKEDFILEOUT_ID_ = fo.ID_) THEN 1 END)              AS ack_confirmes,
                COUNT(CASE WHEN fo.ACKEXPECTED_ = 1 AND NOT EXISTS (
                    SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT a
                    WHERE a.ACKEDFILEOUT_ID_ = fo.ID_) THEN 1 END)              AS ack_manquants,
                CASE WHEN COUNT(CASE WHEN fo.ACKEXPECTED_ = 1 THEN 1 END) > 0
                    THEN ROUND(
                        COUNT(CASE WHEN fo.ACKEXPECTED_ = 1 AND EXISTS (
                            SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT a
                            WHERE a.ACKEDFILEOUT_ID_ = fo.ID_) THEN 1 END) * 100.0
                        / COUNT(CASE WHEN fo.ACKEXPECTED_ = 1 THEN 1 END), 1)
                    ELSE NULL END                                              AS taux_ack_pct
            FROM UCUSTOI0.FLOW_FILEIN fi
            LEFT JOIN UCUSTOI0.FLOW_FILEOUT fo ON fo.FILEIN_ID_ = fi.ID_
                AND (:ackOnly IS NULL OR fo.ACKEXPECTED_ = 1)
            WHERE fi.PASSEDCONTRACTIDENTIFIER_ IS NOT NULL
              AND (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
              AND (:ackOnly IS NULL OR EXISTS (
                  SELECT 1 FROM UCUSTOI0.FLOW_FILEOUT fo2
                  WHERE fo2.FILEIN_ID_ = fi.ID_ AND fo2.ACKEXPECTED_ = 1))
            GROUP BY fi.PASSEDCONTRACTIDENTIFIER_
            HAVING COUNT(DISTINCT fi.ID_) > 0
            ORDER BY COUNT(fo.ID_) DESC
            FETCH FIRST 12 ROWS ONLY
            """, nativeQuery = true)
    List<Object[]> getContratsPerformance(
            @Param("contrat") String contrat,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate") java.time.LocalDateTime toDate,
            @Param("ackOnly") Integer ackOnly);

    // =========================================================================
    // RÉPARTITION PAR DESTINATION (Widget 5) — filtrable comme funnel
    // [0] destinationId, [1] livraisons, [2] fichiersDistinct, [3] ackAttendu, [4] ackManquants
    // =========================================================================
    @Query(value = """
            SELECT
                NVL(TO_CHAR(fo.DESTINATIONINFO_ID_), 'NON_DEFINI')              AS destination,
                COUNT(*)                                                         AS livraisons,
                COUNT(DISTINCT fo.FILEIN_ID_)                                    AS fichiers_distinct,
                COUNT(CASE WHEN fo.ACKEXPECTED_ = 1 THEN 1 END)                 AS ack_attendu,
                COUNT(CASE WHEN fo.ACKEXPECTED_ = 1 AND NOT EXISTS (
                    SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT a
                    WHERE a.ACKEDFILEOUT_ID_ = fo.ID_) THEN 1 END)              AS ack_manquants
            FROM UCUSTOI0.FLOW_FILEOUT fo
            JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
            WHERE (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
              AND (:ackOnly IS NULL OR fo.ACKEXPECTED_ = 1)
            GROUP BY fo.DESTINATIONINFO_ID_
            ORDER BY livraisons DESC
            FETCH FIRST 10 ROWS ONLY
            """, nativeQuery = true)
    List<Object[]> getDestinationsRepartition(
            @Param("contrat") String contrat,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate") java.time.LocalDateTime toDate,
            @Param("ackOnly") Integer ackOnly);

    // =========================================================================
    // ANALYSE ACK — Distribution (Widget 6)
    // Source : FLOW_FILEOUT.ACKEXPECTED_
    // Retourne : [0] typeAck (0=sans, 1=avec), [1] total
    // =========================================================================
    @Query(value = """
            SELECT
                fo.ACKEXPECTED_ AS type_ack,
                COUNT(*)        AS total
            FROM UCUSTOI0.FLOW_FILEOUT fo
            JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
            WHERE (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:workflow IS NULL OR fi.WORKFLOWID_ = :workflow)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate   IS NULL OR fi.SENDINGDATE_ <= :toDate)
            GROUP BY fo.ACKEXPECTED_
            ORDER BY fo.ACKEXPECTED_
            """, nativeQuery = true)
    List<Object[]> getAckDistribution(
            @Param("contrat") String contrat,
            @Param("workflow") String workflow,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate") java.time.LocalDateTime toDate);

    // =========================================================================
    // ANALYSE ACK — Confirmations reçues (Widget 6)
    // Source : FLOW_INCOMINGACKNOWLEGEMENT
    // Retourne : [0] type, [1] categorie, [2] total, [3] avecErreur
    // =========================================================================
    @Query(value = """
            SELECT
                NVL(ack.ACKNOWLEDGEMENTTYPE_, 'Non défini')         AS type_ack,
                'Standard'                                          AS categorie,
                COUNT(*)                                            AS total,
                COUNT(CASE WHEN UPPER(ack.ACKNOWLEDGEMENTTYPE_) IN ('NACK', 'ERROR', 'ERR') THEN 1 END) AS avec_erreur
            FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack
            JOIN UCUSTOI0.FLOW_FILEOUT fo ON fo.ID_ = ack.ACKEDFILEOUT_ID_
            JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
            WHERE (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:workflow IS NULL OR fi.WORKFLOWID_ = :workflow)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate   IS NULL OR fi.SENDINGDATE_ <= :toDate)
            GROUP BY ack.ACKNOWLEDGEMENTTYPE_
            ORDER BY total DESC
            """, nativeQuery = true)
    List<Object[]> getAckConfirmations(
            @Param("contrat") String contrat,
            @Param("workflow") String workflow,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate") java.time.LocalDateTime toDate);

    // =========================================================================
    // TABLE JOURNAL PAGINÉE — livraisons (Widget 7)
    // 1 ligne = 1 FLOW_FILEOUT. ACK via sous-requêtes (évite doublons si plusieurs ACK).
    // preset : ack_confirme | ack_manquant | null
    // =========================================================================
    @Query(value = """
            SELECT
                fo.ID_                                                           AS foId,
                fi.ID_                                                           AS fileInId,
                fi.PASSEDCONTRACTIDENTIFIER_                                     AS contrat,
                fi.WORKFLOWID_                                                   AS workflow,
                fi.SENDINGDATE_                                                  AS dateEnvoi,
                fi.PRIORITY_                                                     AS priorite,
                fo.ACKEXPECTED_                                                  AS ackAttendu,
                fo.DESTINATIONINFO_ID_                                           AS destination,
                CASE WHEN EXISTS (
                    SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT a
                    WHERE a.ACKEDFILEOUT_ID_ = fo.ID_) THEN 'Confirmé' ELSE '—' END AS statutAck,
                (SELECT MAX(a.ACKNOWLEDGEMENTTYPE_) FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT a
                    WHERE a.ACKEDFILEOUT_ID_ = fo.ID_)                           AS typeAck
            FROM UCUSTOI0.FLOW_FILEOUT fo
            JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
            WHERE (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:ackExpected IS NULL OR fo.ACKEXPECTED_ = :ackExpected)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate   IS NULL OR fi.SENDINGDATE_ <= :toDate)
              AND (:ackOnly IS NULL OR fo.ACKEXPECTED_ = 1)
              AND (:preset IS NULL
                   OR (:preset = 'ack_confirme' AND EXISTS (
                       SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT a
                       WHERE a.ACKEDFILEOUT_ID_ = fo.ID_))
                   OR (:preset = 'ack_manquant' AND fo.ACKEXPECTED_ = 1 AND NOT EXISTS (
                       SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT a
                       WHERE a.ACKEDFILEOUT_ID_ = fo.ID_)))
              AND (:destination IS NULL
                   OR (:destination = 'NON_DEFINI' AND fo.DESTINATIONINFO_ID_ IS NULL)
                   OR (:destination <> 'NON_DEFINI' AND TO_CHAR(fo.DESTINATIONINFO_ID_) = :destination))
            ORDER BY fi.SENDINGDATE_ DESC NULLS LAST, fo.ID_ DESC
            """, countQuery = """
            SELECT COUNT(fo.ID_)
            FROM UCUSTOI0.FLOW_FILEOUT fo
            JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
            WHERE (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:ackExpected IS NULL OR fo.ACKEXPECTED_ = :ackExpected)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate   IS NULL OR fi.SENDINGDATE_ <= :toDate)
              AND (:ackOnly IS NULL OR fo.ACKEXPECTED_ = 1)
              AND (:preset IS NULL
                   OR (:preset = 'ack_confirme' AND EXISTS (
                       SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT a
                       WHERE a.ACKEDFILEOUT_ID_ = fo.ID_))
                   OR (:preset = 'ack_manquant' AND fo.ACKEXPECTED_ = 1 AND NOT EXISTS (
                       SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT a
                       WHERE a.ACKEDFILEOUT_ID_ = fo.ID_)))
              AND (:destination IS NULL
                   OR (:destination = 'NON_DEFINI' AND fo.DESTINATIONINFO_ID_ IS NULL)
                   OR (:destination <> 'NON_DEFINI' AND TO_CHAR(fo.DESTINATIONINFO_ID_) = :destination))
            """, nativeQuery = true)
    org.springframework.data.domain.Page<com.example.custodix.dto.FlowFileOutProjection> getJournalLivraisonsPaginated(
            @Param("contrat")      String contrat,
            @Param("ackExpected")  Integer ackExpected,
            @Param("fromDate")     java.time.LocalDateTime fromDate,
            @Param("toDate")       java.time.LocalDateTime toDate,
            @Param("ackOnly")      Integer ackOnly,
            @Param("preset")       String preset,
            @Param("destination") String destination,
            org.springframework.data.domain.Pageable pageable);

    // =========================================================================
    // JOURNAL — fichiers reçus sans aucune livraison (palier funnel « reçus »)
    // =========================================================================
    @Query(value = """
            SELECT
                CAST(NULL AS NUMBER)                                             AS foId,
                fi.ID_                                                           AS fileInId,
                fi.PASSEDCONTRACTIDENTIFIER_                                     AS contrat,
                fi.WORKFLOWID_                                                   AS workflow,
                fi.SENDINGDATE_                                                  AS dateEnvoi,
                fi.PRIORITY_                                                     AS priorite,
                CAST(NULL AS NUMBER)                                             AS ackAttendu,
                CAST(NULL AS NUMBER)                                             AS destination,
                'Non livré'                                                      AS statutAck,
                CAST(NULL AS VARCHAR2(100))                                      AS typeAck
            FROM UCUSTOI0.FLOW_FILEIN fi
            WHERE NOT EXISTS (
                SELECT 1 FROM UCUSTOI0.FLOW_FILEOUT fo WHERE fo.FILEIN_ID_ = fi.ID_)
              AND (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate   IS NULL OR fi.SENDINGDATE_ <= :toDate)
            ORDER BY fi.SENDINGDATE_ DESC NULLS LAST, fi.ID_ DESC
            """, countQuery = """
            SELECT COUNT(fi.ID_)
            FROM UCUSTOI0.FLOW_FILEIN fi
            WHERE NOT EXISTS (
                SELECT 1 FROM UCUSTOI0.FLOW_FILEOUT fo WHERE fo.FILEIN_ID_ = fi.ID_)
              AND (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate   IS NULL OR fi.SENDINGDATE_ <= :toDate)
            """, nativeQuery = true)
    org.springframework.data.domain.Page<com.example.custodix.dto.FlowFileOutProjection> getJournalNonLivrePaginated(
            @Param("contrat")  String contrat,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate")   java.time.LocalDateTime toDate,
            org.springframework.data.domain.Pageable pageable);

    // =========================================================================
    // WIDGET 6 — Intelligence : Top partenaires avec ACK manquants
    // Retourne : [0] contrat, [1] ackManquants
    // =========================================================================
    @Query(value = """
            SELECT
                fi.PASSEDCONTRACTIDENTIFIER_                    AS contrat,
                COUNT(*)                                        AS ack_manquants
            FROM UCUSTOI0.FLOW_FILEOUT fo
            JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
            WHERE fo.ACKEXPECTED_ = 1
              AND fi.PASSEDCONTRACTIDENTIFIER_ IS NOT NULL
              AND (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:workflow IS NULL OR fi.WORKFLOWID_ = :workflow)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate   IS NULL OR fi.SENDINGDATE_ <= :toDate)
              AND NOT EXISTS (
                  SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack
                  WHERE ack.ACKEDFILEOUT_ID_ = fo.ID_
              )
            GROUP BY fi.PASSEDCONTRACTIDENTIFIER_
            ORDER BY ack_manquants DESC
            FETCH FIRST 5 ROWS ONLY
            """, nativeQuery = true)
    List<Object[]> getAckTopManquants(
            @Param("contrat") String contrat,
            @Param("workflow") String workflow,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate") java.time.LocalDateTime toDate);

    // =========================================================================
    // WIDGET 6 — Intelligence : Vieillissement des ACK manquants
    // Retourne : [0] tranche (label), [1] nb, [2] ordre (pour tri)
    // =========================================================================
    @Query(value = """
            SELECT
                CASE
                    WHEN TRUNC(SYSDATE - CAST(fi.SENDINGDATE_ AS DATE)) <= 1  THEN 'Moins de 24h'
                    WHEN TRUNC(SYSDATE - CAST(fi.SENDINGDATE_ AS DATE)) <= 7  THEN '2-7 jours'
                    WHEN TRUNC(SYSDATE - CAST(fi.SENDINGDATE_ AS DATE)) <= 30 THEN '8-30 jours'
                    ELSE '> 30 jours'
                END                                             AS tranche,
                COUNT(*)                                        AS nb,
                CASE
                    WHEN TRUNC(SYSDATE - CAST(fi.SENDINGDATE_ AS DATE)) <= 1  THEN 1
                    WHEN TRUNC(SYSDATE - CAST(fi.SENDINGDATE_ AS DATE)) <= 7  THEN 2
                    WHEN TRUNC(SYSDATE - CAST(fi.SENDINGDATE_ AS DATE)) <= 30 THEN 3
                    ELSE 4
                END                                             AS ordre
            FROM UCUSTOI0.FLOW_FILEOUT fo
            JOIN UCUSTOI0.FLOW_FILEIN fi ON fi.ID_ = fo.FILEIN_ID_
            WHERE fo.ACKEXPECTED_ = 1
              AND fi.SENDINGDATE_ IS NOT NULL
              AND (:contrat IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contrat)
              AND (:workflow IS NULL OR fi.WORKFLOWID_ = :workflow)
              AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
              AND (:toDate   IS NULL OR fi.SENDINGDATE_ <= :toDate)
              AND NOT EXISTS (
                  SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack
                  WHERE ack.ACKEDFILEOUT_ID_ = fo.ID_
              )
            GROUP BY
                CASE
                    WHEN TRUNC(SYSDATE - CAST(fi.SENDINGDATE_ AS DATE)) <= 1  THEN 'Moins de 24h'
                    WHEN TRUNC(SYSDATE - CAST(fi.SENDINGDATE_ AS DATE)) <= 7  THEN '2-7 jours'
                    WHEN TRUNC(SYSDATE - CAST(fi.SENDINGDATE_ AS DATE)) <= 30 THEN '8-30 jours'
                    ELSE '> 30 jours'
                END,
                CASE
                    WHEN TRUNC(SYSDATE - CAST(fi.SENDINGDATE_ AS DATE)) <= 1  THEN 1
                    WHEN TRUNC(SYSDATE - CAST(fi.SENDINGDATE_ AS DATE)) <= 7  THEN 2
                    WHEN TRUNC(SYSDATE - CAST(fi.SENDINGDATE_ AS DATE)) <= 30 THEN 3
                    ELSE 4
                END
            ORDER BY ordre ASC
            """, nativeQuery = true)
    List<Object[]> getAckVieillissement(
            @Param("contrat") String contrat,
            @Param("workflow") String workflow,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate") java.time.LocalDateTime toDate);
}
