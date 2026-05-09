import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Flow {

  private apiUrl = 'http://localhost:8080/api/flows';

  constructor(private http: HttpClient) { }

  getAllFlows(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getStatsByStatus(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stats/status`);
  }

  getStatsByType(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stats/type`);
  }

  getStatsByRealType(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stats/real-type`);
  }

  getFinancialVolumeByStatus(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stats/volume-by-status`);
  }

  getTopRoutes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stats/top-routes`);
  }

  getLeadTimeTrends(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stats/lead-time-trends`);
  }

  getTimeline(params: {
    status: string;
    from?: string;
    to?: string;
    bucket?: string;
    type?: string;
    flowType?: string;
    routeId?: string;
    sender?: string;
    receiver?: string;
  }): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/kpi/timeline`, { params: params as any });
  }

  getKpiSummary(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/kpi/summary`);
  }

  getFlowsPaginated(params: {
    page: number;
    size: number;
    status?: string;
    type?: string;
    flowType?: string;
    from?: string;
    to?: string;
    scoreLevel?: string;
  }): Observable<any> {
    const cleanParams: any = { page: params.page, size: params.size };
    if (params.status) cleanParams['status'] = params.status;
    if (params.type) cleanParams['type'] = params.type;
    if (params.flowType) cleanParams['flowType'] = params.flowType;
    if (params.from) cleanParams['from'] = params.from;
    if (params.to) cleanParams['to'] = params.to;
    if (params.scoreLevel) cleanParams['scoreLevel'] = params.scoreLevel;
    return this.http.get<any>(`${this.apiUrl}/paginated`, { params: cleanParams });
  }

}
