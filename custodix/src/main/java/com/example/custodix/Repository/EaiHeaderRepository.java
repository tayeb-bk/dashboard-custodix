package com.example.custodix.Repository;

import com.example.custodix.entity.EaiHeader;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EaiHeaderRepository extends JpaRepository<EaiHeader, Long> {

    // ===== Summary KPIs =====

    @Query("SELECT h FROM EaiHeader h WHERE h.messageId = :messageId")
    List<EaiHeader> findByMessageId(@Param("messageId") Long messageId);

    @Query("SELECT COUNT(h) FROM EaiHeader h")
    long countTotal();

    @Query("SELECT COUNT(h) FROM EaiHeader h WHERE h.creationDate >= :since")
    long countSince(@Param("since") LocalDateTime since);

    @Query("SELECT COUNT(DISTINCT h.messageId) FROM EaiHeader h")
    long countDistinctMessages();

    @Query("SELECT COUNT(DISTINCT h.creatorUserId) FROM EaiHeader h")
    long countDistinctCreators();

    // ===== Grouped Stats =====

    @Query("SELECT h.headerName, COUNT(h) FROM EaiHeader h GROUP BY h.headerName ORDER BY COUNT(h) DESC")
    List<Object[]> countByHeaderName();

    @Query("SELECT h.type, COUNT(h) FROM EaiHeader h GROUP BY h.type ORDER BY COUNT(h) DESC")
    List<Object[]> countByType();

    @Query("SELECT h.headerType, COUNT(h) FROM EaiHeader h GROUP BY h.headerType ORDER BY COUNT(h) DESC")
    List<Object[]> countByHeaderType();

    @Query("SELECT h.creatorUserId, COUNT(h) FROM EaiHeader h GROUP BY h.creatorUserId ORDER BY COUNT(h) DESC")
    List<Object[]> countByCreator();

    // ===== Widget File-In : Top headers par workflow (Heatmap Origine) =====
    @Query(value = """
        SELECT f.WORKFLOWID_, h.HEADERNAME_, COUNT(*) AS cnt
        FROM UCUSTOI0.FLOW_FILEIN f
        JOIN UCUSTOI0.EAI_HEADER h ON h.MESSAGE_ID_ = f.ID_
        WHERE f.WORKFLOWID_ IS NOT NULL
          AND (:workflow IS NULL OR f.WORKFLOWID_ = :workflow)
        GROUP BY f.WORKFLOWID_, h.HEADERNAME_
        ORDER BY cnt DESC
        FETCH FIRST 300 ROWS ONLY
        """, nativeQuery = true)
    List<Object[]> getWorkflowHeaderMatrix(@Param("workflow") String workflow);

    // ===== Widget File-In : Taux de présence des headers critiques =====
    @Query(value = """
        SELECT
          h.HEADERNAME_,
          COUNT(DISTINCT h.MESSAGE_ID_) AS nb_files,
          ROUND(COUNT(DISTINCT h.MESSAGE_ID_) * 100.0 / (
              SELECT COUNT(DISTINCT MESSAGE_ID_) FROM UCUSTOI0.EAI_HEADER
              WHERE (:workflow IS NULL OR MESSAGE_ID_ IN (
                  SELECT ID_ FROM UCUSTOI0.FLOW_FILEIN WHERE WORKFLOWID_ = :workflow))
          ), 1) AS coverage_pct
        FROM UCUSTOI0.EAI_HEADER h
        JOIN UCUSTOI0.FLOW_FILEIN f ON f.ID_ = h.MESSAGE_ID_
        WHERE (:workflow IS NULL OR f.WORKFLOWID_ = :workflow)
        GROUP BY h.HEADERNAME_
        ORDER BY nb_files DESC
        FETCH FIRST 15 ROWS ONLY
        """, nativeQuery = true)
    List<Object[]> getHeaderCoverageByWorkflow(@Param("workflow") String workflow);

    @Query(value = """
        SELECT COUNT(DISTINCT HEADERNAME_) FROM UCUSTOI0.EAI_HEADER h
        JOIN UCUSTOI0.FLOW_FILEIN f ON f.ID_ = h.MESSAGE_ID_
        WHERE f.WORKFLOWID_ = :workflow
        """, nativeQuery = true)
    Long countDistinctHeadersByWorkflow(@Param("workflow") String workflow);

    @Query(value = """
        SELECT h.HEADERNAME_, COUNT(*) as total
        FROM UCUSTOI0.EAI_HEADER h
        JOIN UCUSTOI0.FLOW_FILEIN f ON f.ID_ = h.MESSAGE_ID_
        WHERE f.WORKFLOWID_ = :workflow
        GROUP BY h.HEADERNAME_
        ORDER BY total DESC
        FETCH FIRST 1 ROWS ONLY
        """, nativeQuery = true)
    List<Object[]> getTopHeaderForWorkflow(@Param("workflow") String workflow);

    // ===== Timeline — HOUR =====
    @Query(value = """
        SELECT TRUNC(CREATIONDATE_, 'HH24') AS bucket, COUNT(*) AS total
        FROM UCUSTOI0.EAI_HEADER
        WHERE (:fromDate IS NULL OR CREATIONDATE_ >= :fromDate)
          AND (:toDate   IS NULL OR CREATIONDATE_ <= :toDate)
          AND (:headerName IS NULL OR HEADERNAME_ = :headerName)
          AND (:type IS NULL OR TYPE_ = :type)
        GROUP BY TRUNC(CREATIONDATE_, 'HH24')
        ORDER BY bucket
        """, nativeQuery = true)
    List<Object[]> timelineHour(@Param("fromDate") LocalDateTime from,
                                @Param("toDate")   LocalDateTime to,
                                @Param("headerName") String headerName,
                                @Param("type")       String type);

    // ===== Timeline — DAY =====
    @Query(value = """
        SELECT TRUNC(CREATIONDATE_, 'DD') AS bucket, COUNT(*) AS total
        FROM UCUSTOI0.EAI_HEADER
        WHERE (:fromDate IS NULL OR CREATIONDATE_ >= :fromDate)
          AND (:toDate   IS NULL OR CREATIONDATE_ <= :toDate)
          AND (:headerName IS NULL OR HEADERNAME_ = :headerName)
          AND (:type IS NULL OR TYPE_ = :type)
        GROUP BY TRUNC(CREATIONDATE_, 'DD')
        ORDER BY bucket
        """, nativeQuery = true)
    List<Object[]> timelineDay(@Param("fromDate") LocalDateTime from,
                               @Param("toDate")   LocalDateTime to,
                               @Param("headerName") String headerName,
                               @Param("type")       String type);

    // ===== Timeline — MONTH =====
    @Query(value = """
        SELECT TRUNC(CREATIONDATE_, 'MM') AS bucket, COUNT(*) AS total
        FROM UCUSTOI0.EAI_HEADER
        WHERE (:fromDate IS NULL OR CREATIONDATE_ >= :fromDate)
          AND (:toDate   IS NULL OR CREATIONDATE_ <= :toDate)
          AND (:headerName IS NULL OR HEADERNAME_ = :headerName)
          AND (:type IS NULL OR TYPE_ = :type)
        GROUP BY TRUNC(CREATIONDATE_, 'MM')
        ORDER BY bucket
        """, nativeQuery = true)
    List<Object[]> timelineMonth(@Param("fromDate") LocalDateTime from,
                                 @Param("toDate")   LocalDateTime to,
                                 @Param("headerName") String headerName,
                                 @Param("type")       String type);

    // ===== Paginated List (Oracle native) =====
    @Query(value = """
        SELECT * FROM UCUSTOI0.EAI_HEADER
        WHERE (:fromDate IS NULL OR CREATIONDATE_ >= :fromDate)
          AND (:toDate IS NULL OR CREATIONDATE_ <= :toDate)
          AND (:headerName IS NULL OR HEADERNAME_ = :headerName)
          AND (:type IS NULL OR TYPE_ = :type)
        ORDER BY CREATIONDATE_ DESC
        OFFSET :offset ROWS FETCH NEXT :size ROWS ONLY
        """, nativeQuery = true)
    List<EaiHeader> findPaginated(
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            @Param("headerName") String headerName,
            @Param("type") String type,
            @Param("offset") int offset, 
            @Param("size") int size);

    @Query(value = """
        SELECT COUNT(*) FROM UCUSTOI0.EAI_HEADER
        WHERE (:fromDate IS NULL OR CREATIONDATE_ >= :fromDate)
          AND (:toDate IS NULL OR CREATIONDATE_ <= :toDate)
          AND (:headerName IS NULL OR HEADERNAME_ = :headerName)
          AND (:type IS NULL OR TYPE_ = :type)
        """, nativeQuery = true)
    long countPaginated(
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            @Param("headerName") String headerName,
            @Param("type") String type);
}
