package com.example.custodix.Repository;

import com.example.custodix.entity.FlowFileIn;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface FlowFileInRepository extends JpaRepository<FlowFileIn, Long> {

    // ===== KPI Summary — colonnes réellement peuplées =====
    @Query(value = """
        SELECT
          COUNT(*)                                                             AS total,
          COUNT(DUPLICATED_ID_)                                                AS doublons,
          ROUND(COUNT(DUPLICATED_ID_) * 100.0 / COUNT(*), 2)                  AS taux_doublons,
          COUNT(MANUALFLOWINTEGRATION_ID_)                                     AS manuels,
          COUNT(DISTINCT WORKFLOWID_)                                          AS workflows_distincts,
          COUNT(DISTINCT PASSEDCONTRACTIDENTIFIER_)                            AS contrats_distincts
        FROM UCUSTOI0.FLOW_FILEIN
        """, nativeQuery = true)
    List<Object[]> getKpiSummary();

    // ===== Timeline par heure =====
    @Query(value = """
        SELECT TRUNC(SENDINGDATE_, 'HH24') AS bucket, COUNT(*) AS total
        FROM UCUSTOI0.FLOW_FILEIN
        WHERE (:from     IS NULL OR SENDINGDATE_                 >= :from)
          AND (:to       IS NULL OR SENDINGDATE_                 <= :to)
          AND (:workflow IS NULL OR WORKFLOWID_                  = :workflow)
          AND (:contrat  IS NULL OR PASSEDCONTRACTIDENTIFIER_    = :contrat)
        GROUP BY TRUNC(SENDINGDATE_, 'HH24')
        ORDER BY bucket
        """, nativeQuery = true)
    List<Object[]> timelineHour(
        @Param("from")     LocalDateTime from,
        @Param("to")       LocalDateTime to,
        @Param("workflow") String workflow,
        @Param("contrat")  String contrat
    );

    // ===== Timeline par jour =====
    @Query(value = """
        SELECT TRUNC(SENDINGDATE_, 'DD') AS bucket, COUNT(*) AS total
        FROM UCUSTOI0.FLOW_FILEIN
        WHERE (:from     IS NULL OR SENDINGDATE_                 >= :from)
          AND (:to       IS NULL OR SENDINGDATE_                 <= :to)
          AND (:workflow IS NULL OR WORKFLOWID_                  = :workflow)
          AND (:contrat  IS NULL OR PASSEDCONTRACTIDENTIFIER_    = :contrat)
        GROUP BY TRUNC(SENDINGDATE_, 'DD')
        ORDER BY bucket
        """, nativeQuery = true)
    List<Object[]> timelineDay(
        @Param("from")     LocalDateTime from,
        @Param("to")       LocalDateTime to,
        @Param("workflow") String workflow,
        @Param("contrat")  String contrat
    );

    // ===== Timeline par mois =====
    @Query(value = """
        SELECT TRUNC(SENDINGDATE_, 'MM') AS bucket, COUNT(*) AS total
        FROM UCUSTOI0.FLOW_FILEIN
        WHERE (:from     IS NULL OR SENDINGDATE_                 >= :from)
          AND (:to       IS NULL OR SENDINGDATE_                 <= :to)
          AND (:workflow IS NULL OR WORKFLOWID_                  = :workflow)
          AND (:contrat  IS NULL OR PASSEDCONTRACTIDENTIFIER_    = :contrat)
        GROUP BY TRUNC(SENDINGDATE_, 'MM')
        ORDER BY bucket
        """, nativeQuery = true)
    List<Object[]> timelineMonth(
        @Param("from")     LocalDateTime from,
        @Param("to")       LocalDateTime to,
        @Param("workflow") String workflow,
        @Param("contrat")  String contrat
    );

    // ===== Heatmap =====
    @Query(value = """
        SELECT
          TO_NUMBER(TO_CHAR(SENDINGDATE_, 'D'))    AS day_of_week,
          TO_NUMBER(TO_CHAR(SENDINGDATE_, 'HH24')) AS hour_of_day,
          COUNT(*)                                 AS total
        FROM UCUSTOI0.FLOW_FILEIN
        GROUP BY TO_CHAR(SENDINGDATE_, 'D'), TO_CHAR(SENDINGDATE_, 'HH24')
        ORDER BY day_of_week, hour_of_day
        """, nativeQuery = true)
    List<Object[]> getHeatmapData();

    // ===== Évolution anomalies (doublons + manuels) par mois =====
    @Query(value = """
        SELECT
          TRUNC(SENDINGDATE_, 'MM')              AS bucket,
          COUNT(*)                               AS total,
          COUNT(DUPLICATED_ID_)                  AS doublons,
          COUNT(MANUALFLOWINTEGRATION_ID_)        AS manuels
        FROM UCUSTOI0.FLOW_FILEIN
        GROUP BY TRUNC(SENDINGDATE_, 'MM')
        ORDER BY bucket
        """, nativeQuery = true)
    List<Object[]> getAnomaliesTimeline();

    // ===== Top Workflows =====
    @Query(value = """
        SELECT
          NVL(WORKFLOWID_, 'NON DEFINI') AS workflow,
          COUNT(*)                       AS total
        FROM UCUSTOI0.FLOW_FILEIN
        WHERE WORKFLOWID_ IS NOT NULL
        GROUP BY WORKFLOWID_
        ORDER BY total DESC
        FETCH FIRST 10 ROWS ONLY
        """, nativeQuery = true)
    List<Object[]> getTopWorkflows();

    // ===== Top Contrats =====
    @Query(value = """
        SELECT
          PASSEDCONTRACTIDENTIFIER_      AS contrat,
          COUNT(*)                       AS total,
          COUNT(DUPLICATED_ID_)          AS doublons
        FROM UCUSTOI0.FLOW_FILEIN
        WHERE PASSEDCONTRACTIDENTIFIER_ IS NOT NULL
        GROUP BY PASSEDCONTRACTIDENTIFIER_
        ORDER BY total DESC
        FETCH FIRST 10 ROWS ONLY
        """, nativeQuery = true)
    List<Object[]> getTopContracts();

    // ===== Table paginée — filtres sur colonnes réelles uniquement =====
    @Query("""
        SELECT f FROM FlowFileIn f WHERE
          (:workflow    IS NULL OR f.workflowId               = :workflow)    AND
          (:contrat     IS NULL OR f.passedContractIdentifier = :contrat)     AND
          (:from        IS NULL OR f.sendingDate              >= :from)       AND
          (:to          IS NULL OR f.sendingDate              <= :to)         AND
          (:isDuplicate IS NULL OR
            (:isDuplicate = true  AND f.duplicatedId IS NOT NULL) OR
            (:isDuplicate = false AND f.duplicatedId IS NULL))                AND
          (:isManual    IS NULL OR
            (:isManual   = true  AND f.manualFlowIntegrationId IS NOT NULL) OR
            (:isManual   = false AND f.manualFlowIntegrationId IS NULL))
        """)
    Page<FlowFileIn> findAllFiltered(
        @Param("workflow")    String workflow,
        @Param("contrat")     String contrat,
        @Param("from")        LocalDateTime from,
        @Param("to")          LocalDateTime to,
        @Param("isDuplicate") Boolean isDuplicate,
        @Param("isManual")    Boolean isManual,
        Pageable pageable
    );

    // ===== Valeurs distinctes pour dropdowns =====
    @Query("SELECT DISTINCT f.workflowId               FROM FlowFileIn f WHERE f.workflowId IS NOT NULL               ORDER BY f.workflowId")
    List<String> findDistinctWorkflows();

    @Query("SELECT DISTINCT f.passedContractIdentifier FROM FlowFileIn f WHERE f.passedContractIdentifier IS NOT NULL ORDER BY f.passedContractIdentifier")
    List<String> findDistinctContracts();
}
