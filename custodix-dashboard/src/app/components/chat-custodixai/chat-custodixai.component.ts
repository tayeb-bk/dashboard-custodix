import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiChatService, AiChatResponse } from '../../services/ai-chat.service';
import { finalize } from 'rxjs';

interface ChatMessage {
  type: 'user' | 'bot';
  text: string;
  sql?: string;
  columns?: string[];
  results?: any[];
  error?: boolean;
}

@Component({
  selector: 'app-chat-custodixai',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-custodixai.component.html',
  styleUrls: ['./chat-custodixai.component.css']
})
export class ChatCustodixaiComponent {
  private aiService = inject(AiChatService);

  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  messages: ChatMessage[] = [];
  question: string = '';
  isLoading: boolean = false;

  constructor() {
    // Message d'accueil
    this.messages.push({
      type: 'bot',
      text: 'Bonjour ! Je suis Custodix AI 🤖. Posez-moi des questions sur vos flux financiers et EAI, je générerai le SQL et vous afficherai les résultats !'
    });
  }

  sendMessage() {
    if (!this.question.trim() || this.isLoading) return;

    const userQ = this.question.trim();
    this.question = '';

    // Ajoute le message de l'utilisateur
    this.messages.push({ type: 'user', text: userQ });
    this.scrollToBottom();

    this.isLoading = true;

    this.aiService.askQuestion({ question: userQ })
      .pipe(finalize(() => {
        this.isLoading = false;
        this.scrollToBottom();
      }))
      .subscribe({
        next: (res: AiChatResponse) => {
          if (res.error) {
            this.messages.push({ type: 'bot', text: res.error, error: true });
          } else {
            this.messages.push({
              type: 'bot',
              text: res.answer || `Recherche terminée ! ${res.rowCount} ligne(s) trouvée(s).`,
              columns: res.columns,
              results: res.results
            });
          }
        },
        error: (err) => {
          this.messages.push({
            type: 'bot',
            text: 'Désolé, une erreur technique est survenue impossible de joindre le pont IA.',
            error: true
          });
          console.error(err);
        }
      });
  }

  // Permet au chat de défiler vers le bas quand un message arrive
  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      } catch (err) {}
    }, 100);
  }
}
