package com.example.custodix.Controller;

import com.example.custodix.service.FlowFileOutService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Controller Expédition — Étape 3 du cycle de vie d'un flux EAI.
 *
 * BASE URL : /api/expedition
 *
 * ENDPOINTS DISPONIBLES :
 *   GET /kpi/hero              → KPIs du Widget 0 (total, ackAttendu, ackRecus, fileInTotal)
 *   GET /funnel                → Funnel pipeline inter-étapes (Widget 2)
 *   GET /timeline              → Évolution temporelle des expéditions (Widget 3)
 *   GET /top-contrats          → Performance par contrat SLA (Widget 4)
 *   GET /top-destinations      → Répartition livraisons par destination (Widget 5)
 *   GET /ack/distribution      → Distribution ACK attendu/non attendu (Widget 6A)
 *   GET /ack/confirmations     → ACKs réellement reçus par type (Widget 6B)
 *   GET /ack/manquants         → Nombre d'ACKs attendus sans confirmation (Widget 6C)
 *   GET /journal               → Table paginée des expéditions (Widget 7)
 */
@RestController
@RequestMapping("/api/expedition")
@CrossOrigin(origins = "*")
public class FlowFileOutController {

    @Autowired
    private FlowFileOutService service;

    // =========================================================================
    // WIDGET 0 + WIDGET 1 — KPI Hero
    // Source : FLOW_FILEOUT + FLOW_FILEIN + FLOW_INCOMINGACKNOWLEGEMENT
    // Retourne : [0] livraisons, [1] ackAttendu, [2] ackRecus, [3] fileInTotal,
    //            [4] destinations, [5] fichiersLivres (DISTINCT FILEIN_ID_)
    // =========================================================================
    @GetMapping("/kpi/hero")
    public List<Object[]> getHeroKpi(
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "false") boolean ackOnly) {
        return service.getHeroKpi(contrat, parseDateTime(from), parseDateTime(to), ackOnly);
    }

    @GetMapping("/contrats")
    public List<Object[]> getContrats() {
        return service.getContratsList();
    }



    // =========================================================================
    // WIDGET 2 — Funnel Pipeline (4 paliers, filtrable)
    // [0] recus, [1] fichiersLivres, [2] livraisons, [3] ackConfirmes
    // =========================================================================
    @GetMapping("/funnel")
    public List<Object[]> getPipelineFunnel(
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "false") boolean ackOnly) {
        return service.getPipelineFunnel(contrat, parseDateTime(from), parseDateTime(to), ackOnly);
    }

    private static LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String v = value.trim();
        if (v.length() == 10) {
            return LocalDateTime.parse(v + "T00:00:00");
        }
        return LocalDateTime.parse(v);
    }

    // =========================================================================
    // WIDGET 3 — Timeline des Expéditions
    // Source : FLOW_FILEOUT + FLOW_FILEIN via FILEIN_ID_
    // Paramètres optionnels : contrat, from (ISO datetime), to (ISO datetime)
    // Retourne : [0] jour, [1] total, [2] avecAck
    // =========================================================================
    @GetMapping("/timeline")
    public List<Object[]> getTimeline(
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) String workflow,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "false") boolean ackOnly) {
        return service.getTimeline(contrat, workflow, parseDateTime(from), parseDateTimeEnd(to), ackOnly);
    }

    @GetMapping("/workflows")
    public List<Object[]> getWorkflows() {
        return service.getWorkflowsList();
    }

    // =========================================================================
    // WIDGET 4 — Performance par partenaire (contrat SLA)
    // Mêmes filtres page que funnel : contrat, from, to, ackOnly
    // [0] contrat … [8] tauxAckPct — voir repository getContratsPerformance
    // =========================================================================
    @GetMapping("/top-contrats")
    public List<Object[]> getContratsPerformance(
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "false") boolean ackOnly) {
        return service.getContratsPerformance(contrat, parseDateTime(from), parseDateTimeEnd(to), ackOnly);
    }

    // =========================================================================
    // WIDGET 5 — Répartition par destination (canaux de sortie)
    // [0] destination … [4] ackManquants — filtres : contrat, from, to, ackOnly
    // =========================================================================
    @GetMapping("/top-destinations")
    public List<Object[]> getDestinationsRepartition(
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "false") boolean ackOnly) {
        return service.getDestinationsRepartition(contrat, parseDateTime(from), parseDateTimeEnd(to), ackOnly);
    }

    // =========================================================================
    // WIDGET 6A — Distribution ACK Attendu
    // Retourne : [0] typeAck (0=sans, 1=avec), [1] total
    // =========================================================================
    @GetMapping("/ack/distribution")
    public List<Object[]> getAckDistribution(
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) String workflow,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return service.getAckDistribution(contrat, workflow, parseDateTime(from), parseDateTimeEnd(to));
    }

    // =========================================================================
    // WIDGET 6B — Confirmations ACK Reçues
    // Source : FLOW_INCOMINGACKNOWLEGEMENT
    // Retourne : [0] type, [1] categorie, [2] total, [3] avecErreur
    // =========================================================================
    @GetMapping("/ack/confirmations")
    public List<Object[]> getAckConfirmations(
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) String workflow,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return service.getAckConfirmations(contrat, workflow, parseDateTime(from), parseDateTimeEnd(to));
    }

    // =========================================================================
    // WIDGET 6C — ACK Manquants (intelligence)
    // ACKEXPECTED_=1 sans aucune confirmation dans FLOW_INCOMINGACKNOWLEGEMENT
    // Retourne : [0] ackManquants
    // =========================================================================
    @GetMapping("/ack/manquants")
    public List<Object[]> getAckManquants(
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return service.getAckManquants(contrat, parseDateTime(from), parseDateTime(to));
    }

    @GetMapping("/ack/top-manquants")
    public List<Object[]> getAckTopManquants(
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) String workflow,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return service.getAckTopManquants(contrat, workflow, parseDateTime(from), parseDateTimeEnd(to));
    }

    @GetMapping("/ack/vieillissement")
    public List<Object[]> getAckVieillissement(
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) String workflow,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return service.getAckVieillissement(contrat, workflow, parseDateTime(from), parseDateTimeEnd(to));
    }

    // =========================================================================
    // WIDGET 7 — Journal d'Expédition Paginé
    // view=livraisons | non_livre — preset=ack_confirme | ack_manquant
    // Filtres alignés funnel/KPI : contrat, from, to, ackOnly, ackExpected (0/1), destination (W5)
    // =========================================================================
    @GetMapping("/journal")
    public Page<com.example.custodix.dto.FlowFileOutProjection> getJournal(
            @RequestParam(required = false, defaultValue = "livraisons") String view,
            @RequestParam(required = false) String preset,
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) Integer ackExpected,
            @RequestParam(required = false) String destination,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false, defaultValue = "false") boolean ackOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        String fromRaw = (from != null && !from.isBlank()) ? from : fromDate;
        String toRaw = (to != null && !to.isBlank()) ? to : toDate;
        LocalDateTime fromDt = parseDateTime(fromRaw);
        LocalDateTime toDt = parseDateTimeEnd(toRaw);
        return service.getJournalPaginated(
                view, preset, contrat, ackExpected, fromDt, toDt, ackOnly, destination, page, size);
    }

    private static LocalDateTime parseDateTimeEnd(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String v = value.trim();
        if (v.length() == 10) {
            return LocalDateTime.parse(v + "T23:59:59");
        }
        return LocalDateTime.parse(v);
    }
}
