import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Flow {

  private apiUrl = 'http://localhost:8080/api/flows';

  constructor(private http: HttpClient) {}

  getAllFlows(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getStatsByStatus(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stats/status`);
  }

  getStatsByType(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stats/type`);
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

}
