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

  // ===== KPI Summary — avec filtres =====
  @Query(value = """
      SELECT
        COUNT(*)                                                             AS total,
        COUNT(DUPLICATED_ID_)                                                AS doublons,
        ROUND(COUNT(DUPLICATED_ID_) * 100.0 / COUNT(*), 2)                  AS taux_doublons,
        COUNT(MANUALFLOWINTEGRATION_ID_)                                     AS manuels,
        COUNT(DISTINCT WORKFLOWID_)                                          AS workflows_distincts,
        COUNT(DISTINCT PASSEDCONTRACTIDENTIFIER_)                            AS contrats_distincts
      FROM UCUSTOI0.FLOW_FILEIN
      WHERE (:contrat  IS NULL OR PASSEDCONTRACTIDENTIFIER_ = :contrat)
        AND (:workflow IS NULL OR WORKFLOWID_ = :workflow)
        AND (:fromDate IS NULL OR SENDINGDATE_ >= :fromDate)
        AND (:toDate   IS NULL OR SENDINGDATE_ <= :toDate)
      """, nativeQuery = true)
  List<Object[]> getKpiSummary(
      @Param("contrat") String contrat,
      @Param("workflow") String workflow,
      @Param("fromDate") LocalDateTime fromDate,
      @Param("toDate") LocalDateTime toDate
  );

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
      @Param("from") LocalDateTime from,
      @Param("to") LocalDateTime to,
      @Param("workflow") String workflow,
      @Param("contrat") String contrat);

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
      @Param("from") LocalDateTime from,
      @Param("to") LocalDateTime to,
      @Param("workflow") String workflow,
      @Param("contrat") String contrat);

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
      @Param("from") LocalDateTime from,
      @Param("to") LocalDateTime to,
      @Param("workflow") String workflow,
      @Param("contrat") String contrat);

  // ===== Timeline enrichie : Volume réel + Moyenne mobile 7j + Intervalle de confiance =====
  @Query(value = """
      SELECT
        bucket,
        total,
        ROUND(AVG(total) OVER (ORDER BY bucket ROWS BETWEEN 6 PRECEDING AND CURRENT ROW))    AS moving_avg,
        ROUND(AVG(total) OVER (ORDER BY bucket ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
            + COALESCE(STDDEV(total) OVER (ORDER BY bucket ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 0)) AS upper_band,
        GREATEST(0,
          ROUND(AVG(total) OVER (ORDER BY bucket ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
            - COALESCE(STDDEV(total) OVER (ORDER BY bucket ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 0))
        ) AS lower_band
      FROM (
        SELECT
          TRUNC(SENDINGDATE_, 'DD') AS bucket,
          COUNT(*) AS total
        FROM UCUSTOI0.FLOW_FILEIN
        WHERE (:from     IS NULL OR SENDINGDATE_              >= :from)
          AND (:to       IS NULL OR SENDINGDATE_              <= :to)
          AND (:workflow IS NULL OR WORKFLOWID_               = :workflow)
          AND (:contrat  IS NULL OR PASSEDCONTRACTIDENTIFIER_ = :contrat)
        GROUP BY TRUNC(SENDINGDATE_, 'DD')
      )
      ORDER BY bucket
      """, nativeQuery = true)
  List<Object[]> timelineWithBaseline(
      @Param("from") LocalDateTime from,
      @Param("to") LocalDateTime to,
      @Param("workflow") String workflow,
      @Param("contrat") String contrat);

  // ===== Heatmap =====
  @Query(value = """
      SELECT
        TO_NUMBER(TO_CHAR(SENDINGDATE_, 'D'))    AS day_of_week,
        TO_NUMBER(TO_CHAR(SENDINGDATE_, 'HH24')) AS hour_of_day,
        COUNT(*)                                 AS total
      FROM UCUSTOI0.FLOW_FILEIN
      WHERE (:contrat  IS NULL OR PASSEDCONTRACTIDENTIFIER_ = :contrat)
        AND (:workflow IS NULL OR WORKFLOWID_ = :workflow)
        AND (:fromDate IS NULL OR SENDINGDATE_ >= :fromDate)
        AND (:toDate   IS NULL OR SENDINGDATE_ <= :toDate)
      GROUP BY TO_CHAR(SENDINGDATE_, 'D'), TO_CHAR(SENDINGDATE_, 'HH24')
      ORDER BY day_of_week, hour_of_day
      """, nativeQuery = true)
  List<Object[]> getHeatmapData(
      @Param("contrat") String contrat,
      @Param("workflow") String workflow,
      @Param("fromDate") LocalDateTime fromDate,
      @Param("toDate") LocalDateTime toDate
  );

  // ===== Évolution anomalies (doublons + manuels) par mois =====
  @Query(value = """
      SELECT
        TRUNC(SENDINGDATE_, 'MM')              AS bucket,
        COUNT(*)                               AS total,
        COUNT(DUPLICATED_ID_)                  AS doublons,
        COUNT(MANUALFLOWINTEGRATION_ID_)        AS manuels
      FROM UCUSTOI0.FLOW_FILEIN
      WHERE (:contrat  IS NULL OR PASSEDCONTRACTIDENTIFIER_ = :contrat)
        AND (:workflow IS NULL OR WORKFLOWID_ = :workflow)
        AND (:fromDate IS NULL OR SENDINGDATE_ >= :fromDate)
        AND (:toDate   IS NULL OR SENDINGDATE_ <= :toDate)
      GROUP BY TRUNC(SENDINGDATE_, 'MM')
      ORDER BY bucket
      """, nativeQuery = true)
  List<Object[]> getAnomaliesTimeline(
      @Param("contrat") String contrat,
      @Param("workflow") String workflow,
      @Param("fromDate") LocalDateTime fromDate,
      @Param("toDate") LocalDateTime toDate
  );

  // ===== Top Workflows =====
  @Query(value = """
      SELECT
        NVL(WORKFLOWID_, 'NON DEFINI') AS workflow,
        COUNT(*)                       AS total
      FROM UCUSTOI0.FLOW_FILEIN
      WHERE WORKFLOWID_ IS NOT NULL
        AND (:contrat  IS NULL OR PASSEDCONTRACTIDENTIFIER_ = :contrat)
        AND (:fromDate IS NULL OR SENDINGDATE_ >= :fromDate)
        AND (:toDate   IS NULL OR SENDINGDATE_ <= :toDate)
      GROUP BY WORKFLOWID_
      ORDER BY total DESC
      FETCH FIRST 10 ROWS ONLY
      """, nativeQuery = true)
  List<Object[]> getTopWorkflows(
      @Param("contrat") String contrat,
      @Param("fromDate") LocalDateTime fromDate,
      @Param("toDate") LocalDateTime toDate
  );

  // ===== Top Contrats =====
  @Query(value = """
      SELECT
        PASSEDCONTRACTIDENTIFIER_      AS contrat,
        COUNT(*)                       AS total,
        COUNT(DUPLICATED_ID_)          AS doublons
      FROM UCUSTOI0.FLOW_FILEIN
      WHERE PASSEDCONTRACTIDENTIFIER_ IS NOT NULL
        AND (:workflow IS NULL OR WORKFLOWID_ = :workflow)
        AND (:fromDate IS NULL OR SENDINGDATE_ >= :fromDate)
        AND (:toDate   IS NULL OR SENDINGDATE_ <= :toDate)
      GROUP BY PASSEDCONTRACTIDENTIFIER_
      ORDER BY total DESC
      FETCH FIRST 10 ROWS ONLY
      """, nativeQuery = true)
  List<Object[]> getTopContracts(
      @Param("workflow") String workflow,
      @Param("fromDate") LocalDateTime fromDate,
      @Param("toDate") LocalDateTime toDate
  );

  // ===== Table paginée =====
  @Query("""
      SELECT f FROM FlowFileIn f WHERE
        (:workflow    IS NULL OR f.workflowId               = :workflow)    AND
        (:contrat     IS NULL OR f.passedContractIdentifier = :contrat)     AND
        (:checksum    IS NULL OR LOWER(f.checksum)          LIKE LOWER(CONCAT('%', :checksum, '%'))) AND
        (:client      IS NULL OR LOWER(f.clientIdentifier)  LIKE LOWER(CONCAT('%', :client, '%')))   AND
        (:fileName    IS NULL OR LOWER(f.initiationFile)    LIKE LOWER(CONCAT('%', :fileName, '%'))) AND
        (:from        IS NULL OR f.sendingDate              >= :from)       AND
        (:to          IS NULL OR f.sendingDate              <= :to)         AND
        (:isDuplicate IS NULL OR (:isDuplicate = true AND f.duplicatedId IS NOT NULL) OR (:isDuplicate = false AND f.duplicatedId IS NULL)) AND
        (:isManual    IS NULL OR (:isManual = true AND f.manualFlowIntegrationId IS NOT NULL) OR (:isManual = false AND f.manualFlowIntegrationId IS NULL))
      """)
  Page<FlowFileIn> findAllFiltered(
      @Param("workflow") String workflow,
      @Param("contrat") String contrat,
      @Param("checksum") String checksum,
      @Param("client") String client,
      @Param("fileName") String fileName,
      @Param("from") LocalDateTime from,
      @Param("to") LocalDateTime to,
      @Param("isDuplicate") Boolean isDuplicate,
      @Param("isManual") Boolean isManual,
      Pageable pageable);

  @Query("SELECT DISTINCT f.workflowId FROM FlowFileIn f WHERE f.workflowId IS NOT NULL ORDER BY f.workflowId")
  List<String> findDistinctWorkflows();

  @Query("SELECT DISTINCT f.passedContractIdentifier FROM FlowFileIn f WHERE f.passedContractIdentifier IS NOT NULL ORDER BY f.passedContractIdentifier")
  List<String> findDistinctContracts();

  @Query("SELECT DISTINCT f.clientIdentifier FROM FlowFileIn f WHERE f.clientIdentifier IS NOT NULL ORDER BY f.clientIdentifier")
  List<String> findDistinctClients();

  @Query(value = "SELECT DISTINCT CHECKSUM_ FROM UCUSTOI0.FLOW_FILEIN WHERE CHECKSUM_ IS NOT NULL AND ROWNUM <= 300 ORDER BY CHECKSUM_", nativeQuery = true)
  List<String> findDistinctChecksums();
}
