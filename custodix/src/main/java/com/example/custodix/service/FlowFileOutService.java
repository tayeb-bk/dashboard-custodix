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

    public List<Object[]> getTimeline(String contrat, LocalDateTime from, LocalDateTime to) {
        return repository.getTimelineByDay(blankToNull(contrat), from, to);
    }

    public List<Object[]> getTopContrats() {
        return repository.getTopContrats();
    }

    public List<Object[]> getTopDestinations() {
        return repository.getTopDestinations();
    }

    public List<Object[]> getAckDistribution() {
        return repository.getAckDistribution();
    }

    public List<Object[]> getAckConfirmations() {
        return repository.getAckConfirmations();
    }

    public Page<com.example.custodix.dto.FlowFileOutProjection> getJournalPaginated(
            String contrat, Integer ackExpected,
            LocalDateTime fromDate, LocalDateTime toDate,
            int page, int size) {
        return repository.getJournalPaginated(
                blankToNull(contrat),
                ackExpected,
                fromDate,
                toDate,
                PageRequest.of(page, size)
        );
    }
}
