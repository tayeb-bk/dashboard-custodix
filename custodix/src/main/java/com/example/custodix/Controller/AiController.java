package com.example.custodix.Controller;

import com.example.custodix.dto.AiChatRequestDTO;
import com.example.custodix.dto.AiChatResponseDTO;
import com.example.custodix.service.AiChatService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class AiController {

    @Autowired
    private AiChatService aiChatService;

    /**
     * Endpoint principal : reçoit une question en langage naturel,
     * génère le SQL via Python/Llama3, l'exécute sur Oracle,
     * et retourne sql + résultats à Angular.
     *
     * POST /api/ai/chat
     * Body: { "question": "Combien de messages EAI aujourd'hui ?" }
     */
    @PostMapping("/chat")
    public ResponseEntity<AiChatResponseDTO> chat(@RequestBody AiChatRequestDTO request) {
        AiChatResponseDTO response = aiChatService.processQuestion(request);
        return ResponseEntity.ok(response);
    }
}
