package com.example.custodix.Controller;

import com.example.custodix.dto.FileTraceabilityDTO;
import com.example.custodix.service.TraceabilityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/traceability")
@CrossOrigin(origins = "*")
public class TraceabilityController {

    @Autowired
    private TraceabilityService service;

    // Point d'accès pour la console de recherche paginée
    @GetMapping("/search")
    public ResponseEntity<Page<Map<String, Object>>> searchFiles(
            @RequestParam(required = false) String searchTerm,
            @RequestParam(required = false) String contrat,
            @RequestParam(required = false) String workflow,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        Page<Map<String, Object>> results = service.searchFiles(searchTerm, contrat, workflow, page, size);
        return ResponseEntity.ok(results);
    }

    // Point d'accès pour obtenir l'arbre complet de traçabilité d'un fichier/flux
    @GetMapping("/{id}")
    public ResponseEntity<FileTraceabilityDTO> getTraceabilityDetails(@PathVariable Long id) {
        FileTraceabilityDTO details = service.getTraceabilityDetails(id);
        if (details == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(details);
    }
}
