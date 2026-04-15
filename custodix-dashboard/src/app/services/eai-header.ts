import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EaiHeaderService {

  private api = 'http://localhost:8080/api/eai-headers';

  constructor(private http: HttpClient) {}

  getKpis(): Observable<{ total: number; last24h: number; distinctMessages: number; distinctCreators: number }> {
    return this.http.get<any>(`${this.api}/kpis`);
  }

  getStatsByHeaderName(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/stats/header-name`);
  }

  getStatsByType(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/stats/type`);
  }

  getStatsByHeaderType(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/stats/header-type`);
  }

  getStatsByCreator(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/stats/creator`);
  }

  getTimeline(params: {
    bucket?: string;
    from?: string;
    to?: string;
    headerName?: string;
    type?: string;
  }): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/kpi/timeline`, { params: params as any });
  }

  getPaginated(page: number, size: number, filters: any = {}): Observable<any> {
    const params: any = { page, size };
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.headerName) params.headerName = filters.headerName;
    if (filters.type) params.type = filters.type;
    return this.http.get<any>(`${this.api}`, { params });
  }
}
