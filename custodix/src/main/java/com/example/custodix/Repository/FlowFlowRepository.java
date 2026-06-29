package com.example.custodix.Repository;

import com.example.custodix.entity.FlowFlow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface FlowFlowRepository extends JpaRepository<FlowFlow, Long> {

  // Pagination filtrée avec intégration du calcul de Score IA métier en SQL
  @Query("SELECT f FROM FlowFlow f WHERE " +
         "(:status IS NULL OR f.status = :status) AND " +
         "(:type IS NULL OR f.type = :type) AND " +
         "(:flowType IS NULL OR f.flowTypeName = :flowType) AND " +
         "(:startDate IS NULL OR f.creationDate >= :startDate) AND " +
         "(:endDate IS NULL OR f.creationDate <= :endDate) AND " +
         "(:scoreLevel IS NULL OR " +
         "  (:scoreLevel = 'critique'  AND (f.status IN ('InTechnicalError', 'Blocked', 'InBusinessError', 'Rejected', 'InitiationFailed', 'Nacked', 'SubWorkflowInTechnicalError') OR (f.status IN ('WaitAction', 'WaitProcessing', 'InitiationError', 'NoContractFound', 'MarkedForSuspension') AND (f.creationDate < :yesterday OR f.flowTypeName IN ('FT_MT502', 'FT_MT546', 'FT_MT509', 'FT_MT544', 'FT_MT545', 'FT_MT547', 'FT_MT515', 'GENERALI_MT535_FT', 'GENERALI_MT566_FT', 'GENERALI_MX515_FT', 'GENERALI_MT515_FT', 'MT54x'))))) OR " +
         "  (:scoreLevel = 'vigilance' AND ((f.status IN ('WaitAction', 'WaitProcessing', 'InitiationError', 'NoContractFound', 'MarkedForSuspension') AND f.creationDate >= :yesterday AND (f.flowTypeName IS NULL OR f.flowTypeName NOT IN ('FT_MT502', 'FT_MT546', 'FT_MT509', 'FT_MT544', 'FT_MT545', 'FT_MT547', 'FT_MT515', 'GENERALI_MT535_FT', 'GENERALI_MT566_FT', 'GENERALI_MX515_FT', 'GENERALI_MT515_FT', 'MT54x'))) OR (f.status NOT IN ('Processed', 'Sent', 'Acked', 'SentAndWaitingAck', 'Initiated', 'Completed', 'Canceled', 'InTechnicalError', 'Blocked', 'InBusinessError', 'Rejected', 'InitiationFailed', 'Nacked', 'SubWorkflowInTechnicalError', 'WaitAction', 'WaitProcessing', 'InitiationError', 'NoContractFound', 'MarkedForSuspension') AND (f.creationDate < :yesterday OR f.flowTypeName IN ('FT_MT502', 'FT_MT546', 'FT_MT509', 'FT_MT544', 'FT_MT545', 'FT_MT547', 'FT_MT515', 'GENERALI_MT535_FT', 'GENERALI_MT566_FT', 'GENERALI_MX515_FT', 'GENERALI_MT515_FT', 'MT54x'))))) OR " +
         "  (:scoreLevel = 'ok'        AND (f.status IN ('Processed', 'Sent', 'Acked', 'SentAndWaitingAck', 'Initiated', 'Completed', 'Canceled') OR (f.status NOT IN ('Processed', 'Sent', 'Acked', 'SentAndWaitingAck', 'Initiated', 'Completed', 'Canceled', 'InTechnicalError', 'Blocked', 'InBusinessError', 'Rejected', 'InitiationFailed', 'Nacked', 'SubWorkflowInTechnicalError', 'WaitAction', 'WaitProcessing', 'InitiationError', 'NoContractFound', 'MarkedForSuspension') AND f.creationDate >= :yesterday AND (f.flowTypeName IS NULL OR f.flowTypeName NOT IN ('FT_MT502', 'FT_MT546', 'FT_MT509', 'FT_MT544', 'FT_MT545', 'FT_MT547', 'FT_MT515', 'GENERALI_MT535_FT', 'GENERALI_MT566_FT', 'GENERALI_MX515_FT', 'GENERALI_MT515_FT', 'MT54x'))))) " +
         ")")
  Page<FlowFlow> findAllFiltered(
         @Param("status")     String status,
         @Param("type")       String type,
         @Param("flowType")   String flowType,
         @Param("startDate")  LocalDateTime startDate,
         @Param("endDate")    LocalDateTime endDate,
         @Param("scoreLevel") String scoreLevel,
         @Param("yesterday")  LocalDateTime yesterday,
         Pageable pageable);

  @Query("SELECT f.status, COUNT(f) FROM FlowFlow f GROUP BY f.status")
  List<Object[]> countByStatus();

  @Query("SELECT f.flowTypeName, COUNT(f) FROM FlowFlow f GROUP BY f.flowTypeName")
  List<Object[]> countByFlowType();

  @Query("SELECT f.type, COUNT(f) FROM FlowFlow f GROUP BY f.type")
  List<Object[]> countByRealType();

  // HOUR (tous statuts — pour l'Overview)
  @Query(value = """
      SELECT TRUNC(CREATIONDATE_, 'HH24') AS bucket, COUNT(*) AS total, 'ALL' as category
      FROM UCUSTOI0.FLOW_FLOW
      GROUP BY TRUNC(CREATIONDATE_, 'HH24')
      ORDER BY bucket
      """, nativeQuery = true)
  List<Object[]> timelineAllHour();

  // HOUR (avec status)
  @Query(value = """
      SELECT TRUNC(CREATIONDATE_, 'HH24') AS bucket, COUNT(*) AS total, SENDER_IDENTIFIER_ as category
      FROM UCUSTOI0.FLOW_FLOW
      WHERE STATUS_ = :status
        AND (:fromDate IS NULL OR CREATIONDATE_ >= :fromDate)
        AND (:toDate   IS NULL OR CREATIONDATE_ <= :toDate)
        AND (:type IS NULL OR TYPE_ = :type)
        AND (:flowType IS NULL OR FLOWTYPE_NAME_ = :flowType)
        AND (:routeId IS NULL OR ROUTE_ROUTEID_ = :routeId)
        AND (:sender IS NULL OR SENDER_IDENTIFIER_ = :sender)
        AND (:receiver IS NULL OR RECEIVER_IDENTIFIER_ = :receiver)
      GROUP BY TRUNC(CREATIONDATE_, 'HH24'), SENDER_IDENTIFIER_
      ORDER BY bucket
      """, nativeQuery = true)
  List<Object[]> timelineHour(@Param("status") String status,
      @Param("fromDate") LocalDateTime from,
      @Param("toDate") LocalDateTime to,
      @Param("type") String type,
      @Param("flowType") String flowType,
      @Param("routeId") String routeId,
      @Param("sender") String sender,
      @Param("receiver") String receiver);

  // DAY (tous statuts — pour l'Overview)
  @Query(value = """
      SELECT TRUNC(CREATIONDATE_, 'DD') AS bucket, COUNT(*) AS total, 'ALL' as category
      FROM UCUSTOI0.FLOW_FLOW
      GROUP BY TRUNC(CREATIONDATE_, 'DD')
      ORDER BY bucket
      """, nativeQuery = true)
  List<Object[]> timelineAllDay();

  // DAY (avec status)
  @Query(value = """
      SELECT TRUNC(CREATIONDATE_, 'DD') AS bucket, COUNT(*) AS total, SENDER_IDENTIFIER_ as category
      FROM UCUSTOI0.FLOW_FLOW
      WHERE STATUS_ = :status
        AND (:fromDate IS NULL OR CREATIONDATE_ >= :fromDate)
        AND (:toDate   IS NULL OR CREATIONDATE_ <= :toDate)
        AND (:type IS NULL OR TYPE_ = :type)
        AND (:flowType IS NULL OR FLOWTYPE_NAME_ = :flowType)
        AND (:routeId IS NULL OR ROUTE_ROUTEID_ = :routeId)
        AND (:sender IS NULL OR SENDER_IDENTIFIER_ = :sender)
        AND (:receiver IS NULL OR RECEIVER_IDENTIFIER_ = :receiver)
      GROUP BY TRUNC(CREATIONDATE_, 'DD'), SENDER_IDENTIFIER_
      ORDER BY bucket
      """, nativeQuery = true)
  List<Object[]> timelineDay(@Param("status") String status,
      @Param("fromDate") LocalDateTime from,
      @Param("toDate") LocalDateTime to,
      @Param("type") String type,
      @Param("flowType") String flowType,
      @Param("routeId") String routeId,
      @Param("sender") String sender,
      @Param("receiver") String receiver);

  // MONTH (tous statuts — pour l'Overview)
  @Query(value = """
      SELECT TRUNC(CREATIONDATE_, 'MM') AS bucket, COUNT(*) AS total, 'ALL' as category
      FROM UCUSTOI0.FLOW_FLOW
      GROUP BY TRUNC(CREATIONDATE_, 'MM')
      ORDER BY bucket
      """, nativeQuery = true)
  List<Object[]> timelineAllMonth();

  // MONTH (avec status)
  @Query(value = """
      SELECT TRUNC(CREATIONDATE_, 'MM') AS bucket, COUNT(*) AS total, SENDER_IDENTIFIER_ as category
      FROM UCUSTOI0.FLOW_FLOW
      WHERE STATUS_ = :status
        AND (:fromDate IS NULL OR CREATIONDATE_ >= :fromDate)
        AND (:toDate   IS NULL OR CREATIONDATE_ <= :toDate)
        AND (:type IS NULL OR TYPE_ = :type)
        AND (:flowType IS NULL OR FLOWTYPE_NAME_ = :flowType)
        AND (:routeId IS NULL OR ROUTE_ROUTEID_ = :routeId)
        AND (:sender IS NULL OR SENDER_IDENTIFIER_ = :sender)
        AND (:receiver IS NULL OR RECEIVER_IDENTIFIER_ = :receiver)
      GROUP BY TRUNC(CREATIONDATE_, 'MM'), SENDER_IDENTIFIER_
      ORDER BY bucket
      """, nativeQuery = true)
  List<Object[]> timelineMonth(@Param("status") String status,
      @Param("fromDate") LocalDateTime from,
      @Param("toDate") LocalDateTime to,
      @Param("type") String type,
      @Param("flowType") String flowType,
      @Param("routeId") String routeId,
      @Param("sender") String sender,
      @Param("receiver") String receiver);

  /// ////////////////////////// Nouveaux KPIs (Tableau d'Objects pour suivre le format existant)

  // KPI 1 : Financial Volume By Status
  @Query("SELECT f.status, SUM(f.amount1), COUNT(f) " +
         "FROM FlowFlow f GROUP BY f.status")
  List<Object[]> getFinancialVolumeByStatus();

  // KPI 2 : Average Lead Time Per Day
  @Query(value = "SELECT TO_CHAR(CREATIONDATE_, 'YYYY-MM-DD') as dateDay, " +
                 "AVG((CAST(UPDATEDATE_ AS DATE) - CAST(CREATIONDATE_ AS DATE)) * 24 * 60) as avgProcessingTimeMinutes " +
                 "FROM UCUSTOI0.FLOW_FLOW " +
                 "WHERE UPDATEDATE_ IS NOT NULL " +
                 "GROUP BY TO_CHAR(CREATIONDATE_, 'YYYY-MM-DD') " +
                 "ORDER BY dateDay", nativeQuery = true)
  List<Object[]> getAverageProcessingTimePerDay();

  // KPI 3 : Top Routes with multi-dimensional stats
  @Query(value = 
    "SELECT " +
    "  SENDER_IDENTIFIER_ as sender, " +
    "  RECEIVER_IDENTIFIER_ as receiver, " +
    "  ROUTE_ROUTEID_ as routeId, " +
    "  SUM(AMOUNT1_) as totalAmount, " +
    "  COUNT(*) as totalCount, " +
    "  SUM(CASE WHEN STATUS_ IN ('InTechnicalError','Blocked','Rejected','InBusinessError','InitiationError','InitiationFailed','Nacked') THEN 1 ELSE 0 END) as errorCount, " +
    "  AVG(CASE WHEN UPDATEDATE_ IS NOT NULL THEN (CAST(UPDATEDATE_ AS DATE) - CAST(CREATIONDATE_ AS DATE)) * 24 * 60 END) as avgLeadTime " +
    "FROM UCUSTOI0.FLOW_FLOW " +
    "GROUP BY SENDER_IDENTIFIER_, RECEIVER_IDENTIFIER_, ROUTE_ROUTEID_ " +
    "ORDER BY totalCount DESC", nativeQuery = true)
  List<Object[]> getTopRoutesWithStats();

  // KPI Summary : 4 métriques métier clés en une seule requête
  // Retourne Object[0]=total, [1]=bloqués, [2]=taux_erreur%, [3]=lead_time_moyen_minutes
  @Query(value =
    "SELECT " +
    "  COUNT(*), " +
    "  SUM(CASE WHEN STATUS_ IN ('InTechnicalError','Blocked','Rejected','InBusinessError','InitiationError','InitiationFailed','Nacked') THEN 1 ELSE 0 END), " +
    "  ROUND(SUM(CASE WHEN STATUS_ IN ('InTechnicalError','Blocked','Rejected','InBusinessError','InitiationError','InitiationFailed','Nacked') THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2), " +
    "  ROUND(AVG(CASE WHEN UPDATEDATE_ IS NOT NULL THEN (CAST(UPDATEDATE_ AS DATE) - CAST(CREATIONDATE_ AS DATE)) * 24 * 60 END), 2) " +
    "FROM UCUSTOI0.FLOW_FLOW",
    nativeQuery = true)
  List<Object[]> getKpiSummary();

}