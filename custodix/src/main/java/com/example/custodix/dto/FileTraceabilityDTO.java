package com.example.custodix.dto;

import java.time.LocalDateTime;
import java.util.List;

public class FileTraceabilityDTO {
    // Informations Fichier Entrant (FileIn)
    private Long fileInId;
    private String fileName;
    private String contract;
    private String workflow;
    private LocalDateTime receivingDate;
    
    // Informations Flux Associé (FlowFlow de réception)
    private String flowStatus;
    private String routeId;
    private String flowTypeName;
    private Double amount;
    private String sender;
    private String receiver;
    private LocalDateTime flowCreationDate;
    private LocalDateTime flowUpdateDate;
    
    // Latences précalculées (en millisecondes)
    private Long integrationDurationMs; // Temps entre la réception physique et la création du flux moteur
    private Long processingDurationMs;  // Temps de traitement interne du flux moteur

    // Liste des Expéditions (FileOut)
    private List<ExpeditionDetail> expeditions;

    // Getters and Setters
    public Long getFileInId() {
        return fileInId;
    }

    public void setFileInId(Long fileInId) {
        this.fileInId = fileInId;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getContract() {
        return contract;
    }

    public void setContract(String contract) {
        this.contract = contract;
    }

    public String getWorkflow() {
        return workflow;
    }

    public void setWorkflow(String workflow) {
        this.workflow = workflow;
    }

    public LocalDateTime getReceivingDate() {
        return receivingDate;
    }

    public void setReceivingDate(LocalDateTime receivingDate) {
        this.receivingDate = receivingDate;
    }

    public String getFlowStatus() {
        return flowStatus;
    }

    public void setFlowStatus(String flowStatus) {
        this.flowStatus = flowStatus;
    }

    public String getRouteId() {
        return routeId;
    }

    public void setRouteId(String routeId) {
        this.routeId = routeId;
    }

    public String getFlowTypeName() {
        return flowTypeName;
    }

    public void setFlowTypeName(String flowTypeName) {
        this.flowTypeName = flowTypeName;
    }

    public Double getAmount() {
        return amount;
    }

    public void setAmount(Double amount) {
        this.amount = amount;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getReceiver() {
        return receiver;
    }

    public void setReceiver(String receiver) {
        this.receiver = receiver;
    }

    public LocalDateTime getFlowCreationDate() {
        return flowCreationDate;
    }

    public void setFlowCreationDate(LocalDateTime flowCreationDate) {
        this.flowCreationDate = flowCreationDate;
    }

    public LocalDateTime getFlowUpdateDate() {
        return flowUpdateDate;
    }

    public void setFlowUpdateDate(LocalDateTime flowUpdateDate) {
        this.flowUpdateDate = flowUpdateDate;
    }

    public Long getIntegrationDurationMs() {
        return integrationDurationMs;
    }

    public void setIntegrationDurationMs(Long integrationDurationMs) {
        this.integrationDurationMs = integrationDurationMs;
    }

    public Long getProcessingDurationMs() {
        return processingDurationMs;
    }

    public void setProcessingDurationMs(Long processingDurationMs) {
        this.processingDurationMs = processingDurationMs;
    }

    public List<ExpeditionDetail> getExpeditions() {
        return expeditions;
    }

    public void setExpeditions(List<ExpeditionDetail> expeditions) {
        this.expeditions = expeditions;
    }

    // Classe interne pour le détail des livraisons (FileOut)
    public static class ExpeditionDetail {
        private Long fileOutId;
        private String destination;
        private String address;
        private String status;      // Statut du flux de sortie
        private String ackStatus;   // Confirmé (ACK), Erreur (NACK), Manquant (MISSING)
        private String errorCode;
        private String errorReason;
        private LocalDateTime ackDate;
        
        // Latence d'acquittement (temps entre envoi et réception de l'ACK)
        private Long ackDurationMs;

        // Getters and Setters
        public Long getFileOutId() {
            return fileOutId;
        }

        public void setFileOutId(Long fileOutId) {
            this.fileOutId = fileOutId;
        }

        public String getDestination() {
            return destination;
        }

        public void setDestination(String destination) {
            this.destination = destination;
        }

        public String getAddress() {
            return address;
        }

        public void setAddress(String address) {
            this.address = address;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public String getAckStatus() {
            return ackStatus;
        }

        public void setAckStatus(String ackStatus) {
            this.ackStatus = ackStatus;
        }

        public String getErrorCode() {
            return errorCode;
        }

        public void setErrorCode(String errorCode) {
            this.errorCode = errorCode;
        }

        public String getErrorReason() {
            return errorReason;
        }

        public void setErrorReason(String errorReason) {
            this.errorReason = errorReason;
        }

        public LocalDateTime getAckDate() {
            return ackDate;
        }

        public void setAckDate(LocalDateTime ackDate) {
            this.ackDate = ackDate;
        }

        public Long getAckDurationMs() {
            return ackDurationMs;
        }

        public void setAckDurationMs(Long ackDurationMs) {
            this.ackDurationMs = ackDurationMs;
        }
    }
}
