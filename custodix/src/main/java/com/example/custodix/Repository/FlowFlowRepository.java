package com.example.custodix.Repository;

import com.example.custodix.entity.FlowFlow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface FlowFlowRepository extends JpaRepository<FlowFlow, Long> {

  @Query("SELECT f.status, COUNT(f) FROM FlowFlow f GROUP BY f.status")
  List<Object[]> countByStatus();

  @Query("SELECT f.flowTypeName, COUNT(f) FROM FlowFlow f GROUP BY f.flowTypeName")
  List<Object[]> countByFlowType();

  // HOUR
  @Query(value = """
      SELECT TRUNC(CREATIONDATE_, 'HH24') AS bucket, COUNT(*) AS total
      FROM UCUSTOI0.FLOW_FLOW
      WHERE STATUS_ = :status
        AND (:fromDate IS NULL OR CREATIONDATE_ >= :fromDate)
        AND (:toDate   IS NULL OR CREATIONDATE_ <= :toDate)
        AND (:type IS NULL OR TYPE_ = :type)
        AND (:flowType IS NULL OR FLOWTYPE_NAME_ = :flowType)
        AND (:routeId IS NULL OR ROUTE_ROUTEID_ = :routeId)
        AND (:sender IS NULL OR SENDER_IDENTIFIER_ = :sender)
        AND (:receiver IS NULL OR RECEIVER_IDENTIFIER_ = :receiver)
      GROUP BY TRUNC(CREATIONDATE_, 'HH24')
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

  // DAY
  @Query(value = """
      SELECT TRUNC(CREATIONDATE_, 'DD') AS bucket, COUNT(*) AS total
      FROM UCUSTOI0.FLOW_FLOW
      WHERE STATUS_ = :status
        AND (:fromDate IS NULL OR CREATIONDATE_ >= :fromDate)
        AND (:toDate   IS NULL OR CREATIONDATE_ <= :toDate)
        AND (:type IS NULL OR TYPE_ = :type)
        AND (:flowType IS NULL OR FLOWTYPE_NAME_ = :flowType)
        AND (:routeId IS NULL OR ROUTE_ROUTEID_ = :routeId)
        AND (:sender IS NULL OR SENDER_IDENTIFIER_ = :sender)
        AND (:receiver IS NULL OR RECEIVER_IDENTIFIER_ = :receiver)
      GROUP BY TRUNC(CREATIONDATE_, 'DD')
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

  // MONTH
  @Query(value = """
      SELECT TRUNC(CREATIONDATE_, 'MM') AS bucket, COUNT(*) AS total
      FROM UCUSTOI0.FLOW_FLOW
      WHERE STATUS_ = :status
        AND (:fromDate IS NULL OR CREATIONDATE_ >= :fromDate)
        AND (:toDate   IS NULL OR CREATIONDATE_ <= :toDate)
        AND (:type IS NULL OR TYPE_ = :type)
        AND (:flowType IS NULL OR FLOWTYPE_NAME_ = :flowType)
        AND (:routeId IS NULL OR ROUTE_ROUTEID_ = :routeId)
        AND (:sender IS NULL OR SENDER_IDENTIFIER_ = :sender)
        AND (:receiver IS NULL OR RECEIVER_IDENTIFIER_ = :receiver)
      GROUP BY TRUNC(CREATIONDATE_, 'MM')
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

  // KPI 3 : Top Routes by Volume
  @Query("SELECT f.senderIdentifier, f.receiverIdentifier, f.routeId, SUM(f.amount1), COUNT(f) " +
         "FROM FlowFlow f " +
         "GROUP BY f.senderIdentifier, f.receiverIdentifier, f.routeId " +
         "ORDER BY SUM(f.amount1) DESC")
  List<Object[]> getTopRoutesByVolume();

}