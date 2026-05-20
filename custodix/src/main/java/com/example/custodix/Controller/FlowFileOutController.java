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
 *   GET /top-contrats          → Classement des contrats (Widget 4)
 *   GET /top-destinations      → Répartition par destination (Widget 5)
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
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        LocalDateTime fromDate = (from != null && !from.isBlank()) ? LocalDateTime.parse(from) : null;
        LocalDateTime toDate   = (to   != null && !to.isBlank())   ? LocalDateTime.parse(to)   : null;
        return service.getTimeline(contrat, fromDate, toDate);
    }

    // =========================================================================
    // WIDGET 4 — Top Contrats / Partenaires
    // Source : FLOW_FILEOUT + FLOW_FILEIN via FILEIN_ID_
    // Retourne top 15 : [0] contrat, [1] total, [2] premiere, [3] derniere, [4] avecAck
    // =========================================================================
    @GetMapping("/top-contrats")
    public List<Object[]> getTopContrats() {
        return service.getTopContrats();
    }

    // =========================================================================
    // WIDGET 5 — Top Destinations
    // Source : FLOW_FILEOUT.DESTINATIONINFO_ID_
    // Retourne top 10 : [0] destination, [1] total, [2] pourcentage
    // =========================================================================
    @GetMapping("/top-destinations")
    public List<Object[]> getTopDestinations() {
        return service.getTopDestinations();
    }

    // =========================================================================
    // WIDGET 6A — Distribution ACK Attendu
    // Retourne : [0] typeAck (0=sans, 1=avec), [1] total
    // =========================================================================
    @GetMapping("/ack/distribution")
    public List<Object[]> getAckDistribution() {
        return service.getAckDistribution();
    }

    // =========================================================================
    // WIDGET 6B — Confirmations ACK Reçues
    // Source : FLOW_INCOMINGACKNOWLEGEMENT
    // Retourne : [0] type, [1] categorie, [2] total, [3] avecErreur
    // =========================================================================
    @GetMapping("/ack/confirmations")
    public List<Object[]> getAckConfirmations() {
        return service.getAckConfirmations();
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

    // =========================================================================
    // WIDGET 7 — Journal d'Expédition Paginé
    // Source : FLOW_FILEOUT + FLOW_FILEIN + FLOW_INCOMINGACKNOWLEGEMENT
    // Paramètres : contrat, ackExpected (0/1), from, to, page, size
    // Retourne : foId, contrat, workflow, dateEnvoi, priorite, ackAttendu, destination, statutAck
    // =========================================================================
    @GetMapping("/journal")
    public Page<com.example.custodix.dto.FlowFileOutProjection> getJournal(
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) Integer ackExpected,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size) {
        LocalDateTime from = (fromDate != null && !fromDate.isBlank()) ? LocalDateTime.parse(fromDate) : null;
        LocalDateTime to   = (toDate   != null && !toDate.isBlank())   ? LocalDateTime.parse(toDate)   : null;
        return service.getJournalPaginated(contrat, ackExpected, from, to, page, size);
    }
}
