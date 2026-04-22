import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AiChatRequest {
  question: string;
}

export interface AiChatResponse {
  answer: string;
  sql: string;
  columns: string[];
  results: any[];
  rowCount: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiChatService {
  private http = inject(HttpClient);
  // Backend Spring Boot
  private baseUrl = 'http://localhost:8080/api/ai';

  askQuestion(request: AiChatRequest): Observable<AiChatResponse> {
    return this.http.post<AiChatResponse>(`${this.baseUrl}/chat`, request);
  }
}
