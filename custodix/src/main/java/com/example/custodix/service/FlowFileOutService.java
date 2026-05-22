package com.example.custodix.service;

import com.example.custodix.Repository.FlowFileOutRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class FlowFileOutService {

    @Autowired
    private FlowFileOutRepository repository;

    private static String blankToNull(String s) {
        return (s != null && !s.isBlank()) ? s.trim() : null;
    }

    private static Integer ackOnlyFlag(Boolean ackOnly) {
        return Boolean.TRUE.equals(ackOnly) ? 1 : null;
    }

    // ===== KPI Hero (Widget 0 + 1) — global ou filtré =====
    public List<Object[]> getHeroKpi(String contrat, LocalDateTime from, LocalDateTime to, Boolean ackOnly) {
        String c = blankToNull(contrat);
        if (c == null && from == null && to == null && !Boolean.TRUE.equals(ackOnly)) {
            return repository.getHeroKpi();
        }
        return repository.getHeroKpiFiltered(c, from, to, ackOnlyFlag(ackOnly));
    }

    public List<Object[]> getAckManquants(String contrat, LocalDateTime from, LocalDateTime to) {
        String c = blankToNull(contrat);
        if (c == null && from == null && to == null) {
            return repository.getAckManquants();
        }
        return repository.getAckManquantsFiltered(c, from, to);
    }

    // ===== Funnel (Widget 2) =====
    // [0] recus, [1] fichiersLivres, [2] livraisons, [3] ackConfirmes
    public List<Object[]> getPipelineFunnel(String contrat, LocalDateTime from, LocalDateTime to, Boolean ackOnly) {
        return repository.getPipelineFunnel(blankToNull(contrat), from, to, ackOnlyFlag(ackOnly));
    }

    public List<Object[]> getContratsList() {
        return repository.getContratsList();
    }

    public List<Object[]> getTimeline(String contrat, String workflow, LocalDateTime from, LocalDateTime to, Boolean ackOnly) {
        return repository.getTimelineByDay(
                blankToNull(contrat), blankToNull(workflow), from, to, ackOnlyFlag(ackOnly));
    }

    public List<Object[]> getWorkflowsList() {
        return repository.getWorkflowsList();
    }

    /** Widget 4 — Performance par partenaire (contrat SLA), filtrable comme le funnel */
    public List<Object[]> getContratsPerformance(
            String contrat, LocalDateTime from, LocalDateTime to, Boolean ackOnly) {
        return repository.getContratsPerformance(
                blankToNull(contrat), from, to, ackOnlyFlag(ackOnly));
    }

    /** Widget 5 — Répartition des livraisons par destination (canal de sortie) */
    public List<Object[]> getDestinationsRepartition(
            String contrat, LocalDateTime from, LocalDateTime to, Boolean ackOnly) {
        return repository.getDestinationsRepartition(
                blankToNull(contrat), from, to, ackOnlyFlag(ackOnly));
    }

    public List<Object[]> getAckDistribution(String contrat, String workflow, LocalDateTime from, LocalDateTime to) {
        return repository.getAckDistribution(blankToNull(contrat), blankToNull(workflow), from, to);
    }

    public List<Object[]> getAckConfirmations(String contrat, String workflow, LocalDateTime from, LocalDateTime to) {
        return repository.getAckConfirmations(blankToNull(contrat), blankToNull(workflow), from, to);
    }

    public List<Object[]> getAckTopManquants(String contrat, String workflow, LocalDateTime from, LocalDateTime to) {
        return repository.getAckTopManquants(blankToNull(contrat), blankToNull(workflow), from, to);
    }

    public List<Object[]> getAckVieillissement(String contrat, String workflow, LocalDateTime from, LocalDateTime to) {
        return repository.getAckVieillissement(blankToNull(contrat), blankToNull(workflow), from, to);
    }

    private static String blankPreset(String preset) {
        if (preset == null || preset.isBlank()) return null;
        String p = preset.trim().toLowerCase();
        if ("ack_confirme".equals(p) || "ack_manquant".equals(p)) return p;
        return null;
    }

    /**
     * Widget 7 — Journal paginé.
     * view : livraisons (défaut) | non_livre (fichiers reçus sans FileOut)
     * preset : ack_confirme | ack_manquant (livraisons uniquement)
     */
    private static String blankDestination(String destination) {
        if (destination == null || destination.isBlank()) {
            return null;
        }
        return destination.trim();
    }

    public Page<com.example.custodix.dto.FlowFileOutProjection> getJournalPaginated(
            String view,
            String preset,
            String contrat,
            Integer ackExpected,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            Boolean ackOnly,
            String destination,
            int page,
            int size) {
        String c = blankToNull(contrat);
        var pageable = PageRequest.of(Math.max(0, page), Math.min(200, Math.max(1, size)));
        if ("non_livre".equalsIgnoreCase(blankToNull(view))) {
            return repository.getJournalNonLivrePaginated(c, fromDate, toDate, pageable);
        }
        return repository.getJournalLivraisonsPaginated(
                c,
                ackExpected,
                fromDate,
                toDate,
                ackOnlyFlag(ackOnly),
                blankPreset(preset),
                blankDestination(destination),
                pageable
        );
    }
}
