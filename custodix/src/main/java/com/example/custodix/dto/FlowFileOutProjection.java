package com.example.custodix.dto;

import java.time.LocalDateTime;

/**
 * Projection pour le Widget 7 — Journal d'Expédition.
 * Colonnes issues de la jointure FLOW_FILEOUT + FLOW_FILEIN + FLOW_INCOMINGACKNOWLEGEMENT.
 * Jointure validée : FLOW_FILEOUT.FILEIN_ID_ = FLOW_FILEIN.ID_ (100% match)
 */
public interface FlowFileOutProjection {

    Long getFoId();               // FLOW_FILEOUT.ID_ (null en vue non_livre)

    Long getFileInId();           // FLOW_FILEIN.ID_

    String getContrat();          // FLOW_FILEIN.PASSEDCONTRACTIDENTIFIER_

    String getWorkflow();         // FLOW_FILEIN.WORKFLOWID_

    LocalDateTime getDateEnvoi(); // FLOW_FILEIN.SENDINGDATE_

    String getPriorite();         // FLOW_FILEIN.PRIORITY_

    Integer getAckAttendu();      // FLOW_FILEOUT.ACKEXPECTED_ (0 ou 1)

    Long getDestination();        // FLOW_FILEOUT.DESTINATIONINFO_ID_

    String getStatutAck();        // 'Confirmé' ou '—'

    String getTypeAck();          // FLOW_INCOMINGACKNOWLEGEMENT.ACKNOWLEDGEMENTTYPE_
}
