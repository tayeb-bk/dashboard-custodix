package com.example.custodix.service;

import com.example.custodix.Repository.TraceabilityRepository;
import com.example.custodix.dto.FileTraceabilityDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TraceabilityService {

    @Autowired
    private TraceabilityRepository repository;

    // Effectue la recherche paginée et formate le résultat sous forme de Maps typées pour Angular
    public Page<Map<String, Object>> searchFiles(String searchTerm, String contrat, String workflow, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Object[]> rawPage = repository.searchFiles(
            (searchTerm != null && !searchTerm.isBlank()) ? searchTerm : null,
            (contrat != null && !contrat.isBlank()) ? contrat : null,
            (workflow != null && !workflow.isBlank()) ? workflow : null,
            pageable
        );

        List<Map<String, Object>> content = rawPage.getContent().stream().map(row -> {
            Map<String, Object> map = new HashMap<>();
            map.put("fileInId", row[0] != null ? ((Number) row[0]).longValue() : null);
            map.put("fileName", row[1]);
            map.put("receivingDate", convertToLocalDateTime(row[2]));
            map.put("contract", row[3]);
            map.put("workflow", row[4]);
            map.put("flowStatus", row[5]);
            return map;
        }).collect(Collectors.toList());

        return new PageImpl<>(content, pageable, rawPage.getTotalElements());
    }

    // Récupère l'arbre complet d'un fichier et de ses flux
    public FileTraceabilityDTO getTraceabilityDetails(Long fileInId) {
        List<Object[]> rawFileIn = repository.getFileInTraceabilityDetails(fileInId);
        if (rawFileIn.isEmpty()) {
            return null;
        }

        Object[] fileInRow = rawFileIn.get(0);
        FileTraceabilityDTO dto = new FileTraceabilityDTO();
        
        // Mapping FileIn (Reçu)
        dto.setFileInId(fileInRow[0] != null ? ((Number) fileInRow[0]).longValue() : null);
        dto.setFileName((String) fileInRow[1]);
        dto.setReceivingDate(convertToLocalDateTime(fileInRow[2]));
        dto.setContract((String) fileInRow[3]);
        dto.setWorkflow((String) fileInRow[4]);
        
        // Mapping FlowFlow (Traitement)
        dto.setFlowStatus((String) fileInRow[5]);
        dto.setRouteId((String) fileInRow[6]);
        dto.setFlowTypeName((String) fileInRow[7]);
        dto.setAmount(fileInRow[8] != null ? ((Number) fileInRow[8]).doubleValue() : null);
        dto.setSender((String) fileInRow[9]);
        dto.setReceiver((String) fileInRow[10]);
        dto.setFlowCreationDate(convertToLocalDateTime(fileInRow[11]));
        dto.setFlowUpdateDate(convertToLocalDateTime(fileInRow[12]));

        // Calculs des latences de traitement interne
        if (dto.getReceivingDate() != null && dto.getFlowCreationDate() != null) {
            dto.setIntegrationDurationMs(Duration.between(dto.getReceivingDate(), dto.getFlowCreationDate()).toMillis());
        } else {
            dto.setIntegrationDurationMs(0L);
        }

        if (dto.getFlowCreationDate() != null && dto.getFlowUpdateDate() != null) {
            dto.setProcessingDurationMs(Duration.between(dto.getFlowCreationDate(), dto.getFlowUpdateDate()).toMillis());
        } else {
            dto.setProcessingDurationMs(0L);
        }

        // Mapping des expéditions liées (FileOut + ACKs)
        List<Object[]> rawFileOut = repository.getFileOutTraceabilityDetails(fileInId);
        List<FileTraceabilityDTO.ExpeditionDetail> expeditions = new ArrayList<>();

        for (Object[] row : rawFileOut) {
            FileTraceabilityDTO.ExpeditionDetail exp = new FileTraceabilityDTO.ExpeditionDetail();
            exp.setFileOutId(row[0] != null ? ((Number) row[0]).longValue() : null);
            exp.setDestination(row[1] != null ? row[1].toString() : "NON_DEFINI");
            exp.setAddress((String) row[2]);
            exp.setStatus((String) row[3]);
            
            // Traitement du statut de confirmation (ACK)
            String ackType = (String) row[4];
            LocalDateTime ackDate = convertToLocalDateTime(row[5]);
            String errorCode = (String) row[6];
            String errorReason = (String) row[7];

            exp.setAckDate(ackDate);
            exp.setErrorCode(errorCode);
            exp.setErrorReason(errorReason);

            if (ackType == null) {
                exp.setAckStatus("MISSING"); // En attente
            } else if (ackType.equalsIgnoreCase("ACK") || ackType.equalsIgnoreCase("OK")) {
                exp.setAckStatus("ACK");     // Validé
            } else {
                exp.setAckStatus("NACK");    // Rejeté
            }

            // Calcul du temps d'attente / d'arrivée de l'ACK
            if (dto.getFlowUpdateDate() != null && ackDate != null) {
                exp.setAckDurationMs(Duration.between(dto.getFlowUpdateDate(), ackDate).toMillis());
            } else if (dto.getFlowCreationDate() != null && ackDate != null) {
                exp.setAckDurationMs(Duration.between(dto.getFlowCreationDate(), ackDate).toMillis());
            } else {
                exp.setAckDurationMs(null);
            }

            expeditions.add(exp);
        }

        dto.setExpeditions(expeditions);
        return dto;
    }

    // Méthode de conversion générique et sécurisée pour LocalDateTime
    private LocalDateTime convertToLocalDateTime(Object obj) {
        if (obj == null) return null;
        if (obj instanceof LocalDateTime) {
            return (LocalDateTime) obj;
        }
        if (obj instanceof java.sql.Timestamp) {
            return ((java.sql.Timestamp) obj).toLocalDateTime();
        }
        if (obj instanceof java.sql.Date) {
            return new java.sql.Timestamp(((java.sql.Date) obj).getTime()).toLocalDateTime();
        }
        return null;
    }
}
