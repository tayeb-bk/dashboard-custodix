package com.example.custodix.Repository;

import com.example.custodix.entity.FlowFileIn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PerformanceRepository extends JpaRepository<FlowFileIn, Long> {

    @Query(value = """
        SELECT 
            fi.ID_                          AS fileInId, 
            fi.PASSEDCONTRACTIDENTIFIER_    AS contract, 
            fi.WORKFLOWID_                  AS workflow,
            fi.PRIORITY_                    AS priority,
            fi.SENDINGDATE_                 AS sendingDate,
            ff.CREATIONDATE_                AS creationDateFlow,
            ff.UPDATEDATE_                  AS updateDateFlow,
            ack.FILEOUTSENDINGDATE_         AS sendingDateAck,
            fo.ACKEXPECTED_                 AS ackExpected,
            ff.STATUS_                      AS status
        FROM UCUSTOI0.FLOW_FILEIN fi
        LEFT JOIN UCUSTOI0.FLOW_FLOW ff ON ff.ID_ = fi.ID_
        LEFT JOIN UCUSTOI0.FLOW_FILEOUT fo ON fo.FILEIN_ID_ = fi.ID_
        LEFT JOIN UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack ON ack.ACKEDFILEOUT_ID_ = fo.ID_
        WHERE fi.SENDINGDATE_ IS NOT NULL
          AND (:contract IS NULL OR fi.PASSEDCONTRACTIDENTIFIER_ = :contract)
          AND (:workflow IS NULL OR fi.WORKFLOWID_ = :workflow)
          AND (:fromDate IS NULL OR fi.SENDINGDATE_ >= :fromDate)
          AND (:toDate IS NULL OR fi.SENDINGDATE_ <= :toDate)
        ORDER BY fi.SENDINGDATE_ DESC
        """, nativeQuery = true)
    List<Object[]> getPerformanceRawData(
        @Param("contract") String contract,
        @Param("workflow") String workflow,
        @Param("fromDate") LocalDateTime fromDate,
        @Param("toDate") LocalDateTime toDate
    );
}
