import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FlowFileInService {

  private base = 'http://localhost:8080/api/filein';

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

  getKpiSummary(params?: any): Observable<any> {
    return this.http.get<any>(`${this.base}/kpi/summary`, { params: this.buildParams(params) });
  }

  getTimeline(params?: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/timeline`, { params: this.buildParams(params) });
  }

  getTimelineBaseline(params?: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/timeline/baseline`, { params: this.buildParams(params) });
  }

  getHeatmap(params?: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/heatmap`, { params: this.buildParams(params) });
  }

  getAnomaliesTimeline(params?: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/anomalies/timeline`, { params: this.buildParams(params) });
  }

  getTopWorkflows(params?: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/workflows/top`, { params: this.buildParams(params) });
  }

  getTopContracts(params?: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/contracts/top`, { params: this.buildParams(params) });
  }

  getFiltered(params: any): Observable<any> {
    return this.http.get<any>(`${this.base}/paginated`, { params: this.buildParams(params) });
  }

  getFilterWorkflows(): Observable<string[]> { return this.http.get<string[]>(`${this.base}/filters/workflows`); }
  getFilterContracts(): Observable<string[]> { return this.http.get<string[]>(`${this.base}/filters/contracts`); }
  getFilterClients(): Observable<string[]> { return this.http.get<string[]>(`${this.base}/filters/clients`); }
  getFilterChecksums(): Observable<string[]> { return this.http.get<string[]>(`${this.base}/filters/checksums`); }

  getFileHeaders(messageId: number): Observable<any[]> {
    return this.http.get<any[]>(`http://localhost:8080/api/eai-headers/message/${messageId}`);
  }

  getWorkflowMatrix(workflow?: string): Observable<any[]> {
    const p = workflow ? { workflow } : {};
    return this.http.get<any[]>(`http://localhost:8080/api/eai-headers/filein/workflow-matrix`, { params: this.buildParams(p) });
  }

  getHeaderCoverage(workflow?: string): Observable<any[]> {
    const p = workflow ? { workflow } : {};
    return this.http.get<any[]>(`http://localhost:8080/api/eai-headers/filein/header-coverage`, { params: this.buildParams(p) });
  }

  getWorkflowProfile(workflow: string): Observable<any> {
    return this.http.get<any>(`http://localhost:8080/api/eai-headers/filein/workflow-profile/${workflow}`);
  }
}
