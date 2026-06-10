import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TraceabilityService {

  private base = 'http://localhost:8080/api/traceability';

  constructor(private http: HttpClient) { }

  private buildParams(params: any): HttpParams {
    let p = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
      });
    }
    return p;
  }

  // Recherche paginée
  searchFiles(params: { searchTerm?: string; contrat?: string; workflow?: string; page: number; size: number }): Observable<any> {
    return this.http.get<any>(`${this.base}/search`, { params: this.buildParams(params) });
  }

  // Détails de traçabilité d'un fichier/flux
  getTraceabilityDetails(id: number): Observable<any> {
    return this.http.get<any>(`${this.base}/${id}`);
  }
}
