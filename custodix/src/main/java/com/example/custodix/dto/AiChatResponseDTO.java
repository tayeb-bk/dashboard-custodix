package com.example.custodix.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
@AllArgsConstructor
public class AiChatResponseDTO {

    private String answer;
    private String sql;
    private List<String> columns;
    private List<Map<String, Object>> results;
    private int rowCount;
    private String error;

    // Constructeur succès
    public static AiChatResponseDTO success(String answer, String sql, List<String> columns,
                                            List<Map<String, Object>> results) {
        return new AiChatResponseDTO(answer, sql, columns, results, results.size(), null);
    }

    // Constructeur erreur
    public static AiChatResponseDTO failure(String sql, String errorMessage) {
        return new AiChatResponseDTO(null, sql, List.of(), List.of(), 0, errorMessage);
    }
}
