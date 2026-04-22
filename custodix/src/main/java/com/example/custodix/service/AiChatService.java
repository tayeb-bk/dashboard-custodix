package com.example.custodix.service;

import com.example.custodix.dto.AiChatResponseDTO;
import com.example.custodix.dto.AiChatRequestDTO;
import com.example.custodix.dto.PythonSqlResponseDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class AiChatService {

    private static final Logger log = LoggerFactory.getLogger(AiChatService.class);

    // Mots-clés SQL dangereux — seules les requêtes SELECT sont autorisées
    private static final Set<String> DANGEROUS_KEYWORDS = Set.of(
            "DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE", "ALTER", "CREATE", "MERGE"
    );

    @Value("${ai.python.url:http://localhost:8000}")
    private String pythonBaseUrl;

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Étape 1 : Envoie la question au microservice Python (FastAPI).
     * Étape 2 : Valide le SQL reçu (sécurité).
     * Étape 3 : Exécute le SQL sur Oracle via JdbcTemplate.
     * Étape 4 : Retourne sql + colonnes + résultats à Angular.
     */
    public AiChatResponseDTO processQuestion(AiChatRequestDTO request) {
        String generatedSql = null;

        try {
            // ── Étape 1 : Appel Python (Intention ou SQL) ─────────────────
            log.info("Envoi de la question au Python AI : {}", request.getQuestion());

            String endpointSql = pythonBaseUrl + "/api/generate-sql";
            PythonSqlResponseDTO pythonResponse = restTemplate.postForObject(
                    endpointSql,
                    request,
                    PythonSqlResponseDTO.class
            );

            if (pythonResponse == null || pythonResponse.getSqlQuery() == null) {
                return AiChatResponseDTO.failure(null, "Le microservice Python n'a retourné aucune réponse.");
            }

            generatedSql = pythonResponse.getSqlQuery().trim();
            log.info("Réponse brute de Llama 3 : {}", generatedSql);

            // Cas A : L'IA a détecté une salutation / discussion (Commence par GREETINGS:)
            if (generatedSql.startsWith("GREETINGS:")) {
                String naturalAnswer = generatedSql.replace("GREETINGS:", "").trim();
                return AiChatResponseDTO.success(naturalAnswer, null, List.of(), List.of());
            }

            // Cas B : L'IA a généré du SQL
            // ── Étape 2 : Validation sécurité ───────────────────────────────
            String upperSql = generatedSql.toUpperCase();
            for (String keyword : DANGEROUS_KEYWORDS) {
                if (upperSql.contains(keyword)) {
                    log.warn("SQL dangereux bloqué : {}", generatedSql);
                    return AiChatResponseDTO.failure(generatedSql,
                            "Requête refusée : opération non autorisée.");
                }
            }

            if (!upperSql.startsWith("SELECT")) {
                return AiChatResponseDTO.failure(generatedSql,
                        "Seules les requêtes SELECT sont autorisées.");
            }

            // Nettoyage Oracle JDBC : enlever les points-virgules finaux
            String cleanJdbcSql = generatedSql.replaceAll(";+\\s*$", "");

            // ── Étape 3 : Exécution Oracle ──────────────────────────────────
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(cleanJdbcSql);

            List<String> columns = rows.isEmpty()
                    ? List.of()
                    : new ArrayList<>(rows.get(0).keySet());

            log.info("Résultats obtenus : {} ligne(s)", rows.size());

            // ── Étape 4 : Formatage Inteligent (2nd appel Python) ───────────
            String endpointFormat = pythonBaseUrl + "/api/format-answer";
            Map<String, Object> formatPayload = Map.of(
                    "question", request.getQuestion(),
                    "query", cleanJdbcSql,
                    "results", rows
            );
            
            com.example.custodix.dto.PythonFormatResponseDTO formatResponse = restTemplate.postForObject(
                    endpointFormat,
                    formatPayload,
                    com.example.custodix.dto.PythonFormatResponseDTO.class
            );

            String finalAnswer = (formatResponse != null && formatResponse.getAnswer() != null)
                    ? formatResponse.getAnswer()
                    : "Voici les résultats demandés :";

            return AiChatResponseDTO.success(finalAnswer, generatedSql, columns, rows);

        } catch (ResourceAccessException e) {
            log.error("Microservice Python injoignable sur {}", pythonBaseUrl);
            return AiChatResponseDTO.failure(generatedSql,
                    "Le serveur IA Python est injoignable. Vérifiez qu'il tourne sur le port 8000.");
        } catch (Exception e) {
            log.error("Erreur lors de l'exécution du SQL : {}", e.getMessage());
            return AiChatResponseDTO.failure(generatedSql,
                    "Erreur d'exécution SQL : " + e.getMessage());
        }
    }
}
