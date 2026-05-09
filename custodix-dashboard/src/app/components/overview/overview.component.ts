import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexDataLabels,
  ApexStroke,
  ApexTooltip,
  ApexFill,
  ApexGrid,
  ApexYAxis
} from 'ng-apexcharts';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  tooltip: ApexTooltip;
  dataLabels: ApexDataLabels;
  fill: ApexFill;
  grid: ApexGrid;
  colors: string[];
};

export interface RouteDisplay {
  id: string;
  name: string;
  sender: string;
  receiver: string;
  count: number;
  errors: number;
  errorRate: number;
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, HttpClientModule],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.css'
})
export class OverviewComponent implements OnInit {
  
  public receptionChartOptions!: Partial<ChartOptions> | any;
  public totalFiles: number = 0;
  public topSenders: any[] = [];
  public chartLoaded: boolean = false;

  // ===== PHASE 2 : TRAITEMENT =====
  public processingKpi: { total: number; bloques: number; tauxErreur: number; leadTime: number } | null = null;
  public topRoutes: RouteDisplay[] = [];
  public selectedRoute: RouteDisplay | null = null;
  public processingLoaded: boolean = false;

  private baseUrl = 'http://localhost:8080/api/filein';
  private flowUrl = 'http://localhost:8080/api/flows';

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit() {
    this.loadRealData();
    this.loadProcessingData();
  }

  loadRealData() {
    // 1. Fetch KPI Summary for Total Volume
    this.http.get<any>(`${this.baseUrl}/kpi/summary`).subscribe(res => {
      this.totalFiles = res?.totalFiles || 0;
    });

    // 2. Fetch Top Senders
    this.http.get<any[]>(`${this.baseUrl}/contracts/top`).subscribe(res => {
      // Take top 3
      if (res && res.length > 0) {
        this.topSenders = res.slice(0, 3).map((item, index) => ({
          rank: index + 1,
          name: item.contrat || 'Inconnu',
          value: item.total || 0
        }));
      }
    });

    // 3. Fetch Timeline Data
    this.http.get<any[]>(`${this.baseUrl}/timeline?bucket=day`).subscribe(res => {
      if (res && res.length > 0) {
        const seriesData = res.map(point => {
          let t = point.bucket;
          let d: Date;
          if (Array.isArray(t)) {
             // Spring Boot might serialize LocalDateTime as [yyyy, MM, dd, HH, mm]
             d = new Date(t[0], t[1] - 1, t[2], t[3] || 0, t[4] || 0);
          } else {
             d = new Date(t);
          }
          return [d.getTime(), point.total || 0];
        });
        
        // Sort data by time ascending just in case
        seriesData.sort((a, b) => a[0] - b[0]);
        this.initReceptionChart(seriesData);
      } else {
        this.initReceptionChart([]);
      }
      this.chartLoaded = true;
    }, error => {
      console.error("Erreur chargement timeline:", error);
      this.initReceptionChart([]);
      this.chartLoaded = true;
    });
  }

  initReceptionChart(seriesData: any[]) {
    this.receptionChartOptions = {
      series: [{
        name: 'Fichiers Entrants',
        data: seriesData
      }],
      chart: {
        type: 'area',
        height: 280,
        toolbar: { 
          show: true,
          tools: {
            download: false,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        },
        background: 'transparent',
        sparkline: { enabled: false },
        animations: { enabled: false }
      },
      colors: ['#3b82f6'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [0, 100]
        }
      },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 2 },
      xaxis: {
        type: 'datetime',
        labels: { 
          style: { colors: '#cbd5e1', fontSize: '12px', fontWeight: 500 },
          datetimeUTC: false,
          format: 'dd MMM yyyy'
        },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: { 
          style: { colors: '#cbd5e1', fontSize: '12px', fontWeight: 500 },
          formatter: (value: number) => { return value ? value.toLocaleString('fr-FR') : '0'; }
        }
      },
      grid: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        strokeDashArray: 4,
        yaxis: { lines: { show: true } },
        xaxis: { lines: { show: false } }
      },
      tooltip: { 
        theme: 'dark',
        x: { format: 'dd MMM yyyy HH:mm' }
      }
    };
  }

  public processingChartOptions!: Partial<ChartOptions> | any;
  public processingChartLoaded: boolean = false;

  loadProcessingData() {
    // 1. KPI Summary (Total, Bloqués, Taux d'Erreur, Lead Time)
    this.http.get<any[]>(`${this.flowUrl}/kpi/summary`).subscribe(res => {
      if (res && res[0]) {
        const r = res[0];
        this.processingKpi = {
          total:      Number(r[0]) || 0,
          bloques:    Number(r[1]) || 0,
          tauxErreur: Number(r[2]) || 0,
          leadTime:   Number(r[3]) || 0
        };
      }
    });

    // 2. Top Routes Actives
    this.http.get<any[]>(`${this.flowUrl}/stats/top-routes`).subscribe(res => {
      if (res && res.length > 0) {
        this.topRoutes = res.slice(0, 4).map((r: any, i: number) => {
          const sender = r[0] || 'N/A';
          const receiver = r[1] || 'N/A';
          const routeId = r[2] || 'Route Inconnue';
          const count = Number(r[4]) || 0;
          const errors = Number(r[5]) || 0;
          
          // L'affichage doit se baser sur le routeId réel de la base, comme dans le composant flow-flow
          const name = `Route : ${routeId}`;

          return {
            id: `route-${i}`, name, routeId, sender, receiver, count, errors,
            errorRate: count > 0 ? (errors / count) * 100 : 0
          };
        });
      }
    });

    // 3. Timeline de Traitement (Pour le graphique)
    this.http.get<any[]>(`${this.flowUrl}/stats/timeline?bucket=day`).subscribe(res => {
      if (res && res.length > 0) {
        // Agréger par jour (car la requête peut renvoyer plusieurs expéditeurs pour la même date)
        const dateMap = new Map<number, number>();
        res.forEach(point => {
          let t = point.bucket;
          let d: Date;
          if (Array.isArray(t)) {
             d = new Date(t[0], t[1] - 1, t[2], t[3] || 0, t[4] || 0);
          } else {
             d = new Date(t);
          }
          const time = d.getTime();
          dateMap.set(time, (dateMap.get(time) || 0) + (point.total || 0));
        });

        const seriesData = Array.from(dateMap.entries()).sort((a, b) => a[0] - b[0]);
        this.initProcessingChart(seriesData);
      } else {
        this.initProcessingChart([]);
      }
      this.processingLoaded = true;
      this.processingChartLoaded = true;
    }, () => { 
      this.initProcessingChart([]);
      this.processingLoaded = true;
      this.processingChartLoaded = true;
    });
  }

  initProcessingChart(seriesData: any[]) {
    this.processingChartOptions = {
      series: [{ name: 'Activité Moteur (Flux/j)', data: seriesData }],
      chart: {
        type: 'area',
        height: 200,
        toolbar: { show: false },
        background: 'transparent',
        sparkline: { enabled: false }
      },
      colors: ['#06b6d4'],
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] }
      },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 2 },
      xaxis: {
        type: 'datetime',
        labels: { style: { colors: '#94a3b8', fontSize: '10px' } },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        show: false
      },
      grid: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } }
      },
      tooltip: { theme: 'dark', x: { format: 'dd MMM yyyy' } }
    };
  }

  get currentDisplayStats() {
    if (this.selectedRoute) {
      return {
        title: `Bilan : ${this.selectedRoute.name}`,
        total: this.selectedRoute.count,
        bloques: this.selectedRoute.errors,
        tauxErreur: this.selectedRoute.errorRate,
        isFiltered: true
      };
    }
    return {
      title: 'Bilan Global du Moteur',
      total: this.processingKpi?.total || 0,
      bloques: this.processingKpi?.bloques || 0,
      tauxErreur: this.processingKpi?.tauxErreur || 0,
      isFiltered: false
    };
  }

  selectRoute(route: RouteDisplay | null, event?: Event) {
    if (event) event.stopPropagation();
    if (this.selectedRoute?.id === route?.id) {
      this.selectedRoute = null; // toggle off
    } else {
      this.selectedRoute = route;
    }
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
