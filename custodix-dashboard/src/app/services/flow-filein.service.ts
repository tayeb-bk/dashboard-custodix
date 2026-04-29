import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FlowFileInService {

  private base = 'http://localhost:8080/api/filein';

  constructor(private http: HttpClient) {}

  getKpiSummary(): Observable<any> {
    return this.http.get<any>(`${this.base}/kpi/summary`);
  }

  getTimeline(params: { bucket?: string; from?: string; to?: string; workflow?: string; contrat?: string }): Observable<any[]> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p = p.set(k, v); });
    return this.http.get<any[]>(`${this.base}/timeline`, { params: p });
  }

  getHeatmap(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/heatmap`);
  }

  getAnomaliesTimeline(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/anomalies/timeline`);
  }

  getTopWorkflows(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/workflows/top`);
  }

  getTopContracts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/contracts/top`);
  }

  getFiltered(params: any): Observable<any> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<any>(`${this.base}/paginated`, { params: p });
  }

  getFilterWorkflows(): Observable<string[]> { return this.http.get<string[]>(`${this.base}/filters/workflows`); }
  getFilterContracts(): Observable<string[]> { return this.http.get<string[]>(`${this.base}/filters/contracts`); }
}
