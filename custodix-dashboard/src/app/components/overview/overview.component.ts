import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

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

  // ===== PHASE 3 : EXPÉDITION =====
  public expeditionFunnel = { recus: 0, livres: 0, livraisons: 0, ackConfirmes: 0 };
  public expeditionContrats: string[] = [];
  public selectedExpContrat: string | null = null;
  public expeditionAckOnly: boolean = false;
  public expeditionLoaded: boolean = false;
  public expeditionCouverturePct: number = 0;
  public expeditionAckPct: number = 0;
  public expeditionAckManquants: number = 0;
  public expeditionTotalLivraisons: number = 0;
  public expeditionAckAttendu: number = 0;
  public expeditionChartOptions!: Partial<ChartOptions> | any;
  public expeditionChartLoaded: boolean = false;

  // ===== PHASE 4 : PERFORMANCE & SLA (Système d'Orbites) =====
  public performanceLoaded: boolean = false;
  public perfRawData: any[] = [];
  public perfProcessedData: any[] = [];
  public perfContractsList: string[] = [];
  public selectedPerfContract: string = ''; // '' pour "Tous"
  public selectedPerfStep: 'all' | 't1' | 't2' | 't3' = 'all';

  // SLA Thresholds
  public perfT1SlaSec = 5;
  public perfT2SlaSec = 120;
  public perfT3SlaMin = 15;

  // Calculated Metrics for the current view
  public perfComplianceRate: number = 100;
  public perfTotalCount: number = 0;
  public perfTotalBreaches: number = 0;
  public perfAvgT1: number = 0;
  public perfAvgT2: number = 0;
  public perfAvgT3: number = 0;

  // Detailed Stats for active step focus
  public focusStepName: string = '';
  public focusStepAvg: string = '';
  public focusStepTarget: string = '';
  public focusStepCount: number = 0;
  public focusStepBreaches: number = 0;
  public focusStepCompliance: number = 100;
  public focusStepMaxDelay: string = '';
  public focusStepMaxContract: string = '';

  // Lists
  public perfTopRiskContracts: { name: string; breaches: number }[] = [];
  public perfTopRiskFiles: { fileInId: number; contract: string; t1: number; t2: number; t3: number; total: number }[] = [];

  // Proactive Alert Counter (T3 files waiting for ACK exceeding SLA)
  public perfProactiveRiskCount: number = 0;
  public Math = Math;

  private baseUrl = 'http://localhost:8080/api/filein';
  private flowUrl = 'http://localhost:8080/api/flows';
  private expeditionUrl = 'http://localhost:8080/api/expedition';

  constructor(private router: Router, private http: HttpClient) { }

  ngOnInit() {
    this.loadRealData();
    this.loadProcessingData();
    this.loadExpeditionData();
    this.loadPerformanceData();
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
          total: Number(r[0]) || 0,
          bloques: Number(r[1]) || 0,
          tauxErreur: Number(r[2]) || 0,
          leadTime: Number(r[3]) || 0
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

  // ===== PHASE 3 : EXPÉDITION =====
  loadExpeditionData() {
    this.http.get<any[]>(`${this.expeditionUrl}/contrats`).subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          this.expeditionContrats = res
            .map((r: any) => r[0]?.toString() || '')
            .filter(c => c !== '')
            .slice(0, 5);
        }
      }
    });
    this.loadExpeditionFunnel();
    this.loadExpeditionTimeline();
  }

  loadExpeditionFunnel(showLoader = true) {
    if (showLoader) this.expeditionLoaded = false;
    const params: any = {};
    if (this.selectedExpContrat) params['contrat'] = this.selectedExpContrat;
    if (this.expeditionAckOnly)  params['ackOnly']  = 'true';

    this.http.get<any[]>(`${this.expeditionUrl}/funnel`, { params }).subscribe({
      next: (res) => {
        if (res && res[0]) {
          const r = res[0];
          const recus      = Number(r[0]) || 0;
          const livres     = Number(r[1]) || 0;
          const livraisons = Number(r[2]) || 0;
          const ackConf    = Number(r[3]) || 0;
          this.expeditionFunnel = { recus, livres, livraisons, ackConfirmes: ackConf };
          this.expeditionCouverturePct = recus > 0 ? Math.round((livres / recus) * 100) : 0;
          this.loadExpeditionHero(params);
        }
        this.expeditionLoaded = true;
      },
      error: () => {
        this.expeditionLoaded = true;
      }
    });
  }

  loadExpeditionHero(params: any) {
    const hero$ = this.http.get<any[]>(`${this.expeditionUrl}/kpi/hero`, { params })
      .pipe(catchError(() => of([])));
    const manquants$ = this.http.get<any[]>(`${this.expeditionUrl}/ack/manquants`, { params })
      .pipe(catchError(() => of([])));

    forkJoin({ hero: hero$, manquants: manquants$ }).subscribe({
      next: ({ hero, manquants }) => {
        if (hero && hero[0]) {
          const total      = Number(hero[0][0]) || 0;
          const ackAttendu = Number(hero[0][1]) || 0;
          const ackRecus   = Number(hero[0][2]) || 0;
          this.expeditionTotalLivraisons = total;
          this.expeditionAckAttendu      = ackAttendu;
          this.expeditionAckPct          = ackAttendu > 0
            ? Math.round((ackRecus / ackAttendu) * 100) : 0;
        }
        if (manquants && manquants[0]) {
          this.expeditionAckManquants = Number(manquants[0][0]) || 0;
        } else {
          // Fallback : calcul local
          this.expeditionAckManquants = Math.max(
            0, this.expeditionAckAttendu - Math.round(this.expeditionAckPct * this.expeditionAckAttendu / 100)
          );
        }
      }
    });
  }

  loadExpeditionTimeline() {
    this.expeditionChartLoaded = false;
    const params: any = {};
    if (this.selectedExpContrat) params['contrat'] = this.selectedExpContrat;
    if (this.expeditionAckOnly) params['ackOnly'] = 'true';

    this.http.get<any[]>(`${this.expeditionUrl}/timeline`, { params }).subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          const totalSeries: any[] = [];
          const ackSeries: any[] = [];

          res.forEach(point => {
            let t = point[0]; // jour
            let d: Date;
            if (Array.isArray(t)) {
              d = new Date(t[0], t[1] - 1, t[2], t[3] || 0, t[4] || 0);
            } else {
              d = new Date(t);
            }
            const time = d.getTime();
            totalSeries.push([time, Number(point[1]) || 0]);
            ackSeries.push([time, Number(point[2]) || 0]);
          });

          totalSeries.sort((a, b) => a[0] - b[0]);
          ackSeries.sort((a, b) => a[0] - b[0]);

          this.initExpeditionChart(totalSeries, ackSeries);
        } else {
          this.initExpeditionChart([], []);
        }
        this.expeditionChartLoaded = true;
      },
      error: (err) => {
        console.error("Erreur chargement timeline expédition:", err);
        this.initExpeditionChart([], []);
        this.expeditionChartLoaded = true;
      }
    });
  }

  initExpeditionChart(totalData: any[], ackData: any[]) {
    this.expeditionChartOptions = {
      series: [
        { name: 'Total Livraisons', data: totalData },
        { name: 'Avec ACK requis', data: ackData }
      ],
      chart: {
        type: 'area',
        height: 160,
        toolbar: { show: false },
        background: 'transparent',
        sparkline: { enabled: false }
      },
      colors: ['#8b5cf6', '#6366f1'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.4,
          opacityTo: 0.05,
          stops: [0, 100]
        }
      },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 2 },
      xaxis: {
        type: 'datetime',
        labels: { style: { colors: '#cbd5e1', fontSize: '10px' } },
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

  selectExpContrat(contrat: string) {
    this.selectedExpContrat = this.selectedExpContrat === contrat ? null : contrat;
    this.loadExpeditionFunnel(false);     // pas de loader : refresh silencieux
    this.loadExpeditionTimeline();
  }

  toggleExpAckOnly() {
    this.expeditionAckOnly = !this.expeditionAckOnly;
    this.loadExpeditionFunnel(false);     // pas de loader : refresh silencieux
    this.loadExpeditionTimeline();
  }

  navigateToExpedition() {
    this.router.navigate(['/dashboard/file-out']);
  }

  getExpPctClass(pct: number): string {
    if (pct >= 80) return 'pct-green';
    if (pct >= 50) return 'pct-amber';
    return 'pct-red';
  }

  // Arc SVG pour jauges circulaires : rayon=36, circ=226.2
  getGaugeDashArray(pct: number): string {
    const circ = 226.2;
    const filled = Math.min(Math.max(pct, 0), 100) * (circ / 100);
    return `${filled.toFixed(1)} ${(circ - filled).toFixed(1)}`;
  }

  getGaugeColor(pct: number): string {
    if (pct >= 80) return '#34d399';
    if (pct >= 50) return '#fbbf24';
    return '#f87171';
  }

  // ===== PHASE 4 : PERFORMANCE & SLA (Système d'Orbites) =====
  loadPerformanceData() {
    this.http.get<any[]>('http://localhost:8080/api/performance/latencies').subscribe({
      next: (data) => {
        this.perfRawData = data || [];
        this.extractPerfContracts();
        this.processPerfData();
        this.calculatePerfMetrics();
        this.performanceLoaded = true;
      },
      error: (err) => {
        console.error("Erreur performance:", err);
        this.performanceLoaded = true;
      }
    });
  }

  extractPerfContracts() {
    const set = new Set<string>();
    this.perfRawData.forEach(item => {
      if (item.contract) set.add(item.contract);
    });
    this.perfContractsList = Array.from(set).sort();
  }

  processPerfData() {
    const sysDate = new Date().getTime();
    this.perfProcessedData = this.perfRawData.map(item => {
      const dReception = item.sendingDate ? new Date(item.sendingDate).getTime() : null;
      const dCreationFlow = item.creationDateFlow ? new Date(item.creationDateFlow).getTime() : null;
      const dUpdateFlow = item.updateDateFlow ? new Date(item.updateDateFlow).getTime() : null;
      const dAck = item.sendingDateAck ? new Date(item.sendingDateAck).getTime() : null;

      let t1 = 0;
      if (dCreationFlow && dReception) {
        t1 = Math.max(0, (dCreationFlow - dReception) / 1000);
      }

      let t2 = 0;
      if (dUpdateFlow && dCreationFlow) {
        t2 = Math.max(0, (dUpdateFlow - dCreationFlow) / 1000);
      }

      let t3 = 0;
      if (item.ackExpected === 1) {
        if (dAck && dUpdateFlow) {
          t3 = Math.max(0, (dAck - dUpdateFlow) / 1000);
        } else if (dUpdateFlow) {
          t3 = Math.max(0, (sysDate - dUpdateFlow) / 1000);
        }
      }

      const isT1Breached = t1 > this.perfT1SlaSec;
      const isT2Breached = t2 > this.perfT2SlaSec;
      const isT3Breached = item.ackExpected === 1 && t3 > (this.perfT3SlaMin * 60);
      const isBreached = isT1Breached || isT2Breached || isT3Breached;

      const isProactiveRisk = item.ackExpected === 1 && !dAck && t3 > (this.perfT3SlaMin * 60);

      return {
        ...item,
        t1,
        t2,
        t3,
        isT1Breached,
        isT2Breached,
        isT3Breached,
        isBreached,
        isProactiveRisk
      };
    });
  }

  selectPerfContract(contract: string) {
    this.selectedPerfContract = this.selectedPerfContract === contract ? '' : contract;
    this.calculatePerfMetrics();
  }

  selectPerfStep(step: 'all' | 't1' | 't2' | 't3') {
    this.selectedPerfStep = this.selectedPerfStep === step ? 'all' : step;
    this.calculatePerfMetrics();
  }

  calculatePerfMetrics() {
    const filtered = this.perfProcessedData.filter(item => {
      if (this.selectedPerfContract && item.contract !== this.selectedPerfContract) return false;
      return true;
    });

    let breachedCount = 0;
    let sumT1 = 0, sumT2 = 0, sumT3 = 0, countT3 = 0;
    let proactiveRiskCount = 0;
    const contractBreachesMap = new Map<string, number>();

    filtered.forEach(item => {
      if (item.isBreached) {
        breachedCount++;
        const c = item.contract || 'Inconnu';
        contractBreachesMap.set(c, (contractBreachesMap.get(c) || 0) + 1);
      }
      if (item.isProactiveRisk) {
        proactiveRiskCount++;
      }

      sumT1 += item.t1;
      sumT2 += item.t2;
      if (item.ackExpected === 1) {
        sumT3 += item.t3;
        countT3++;
      }
    });

    this.perfTotalCount = filtered.length;
    this.perfTotalBreaches = breachedCount;
    this.perfProactiveRiskCount = proactiveRiskCount;
    this.perfComplianceRate = this.perfTotalCount > 0
      ? Math.round(((this.perfTotalCount - breachedCount) * 1000 / this.perfTotalCount)) / 10
      : 100;

    this.perfAvgT1 = this.perfTotalCount > 0 ? sumT1 / this.perfTotalCount : 0;
    this.perfAvgT2 = this.perfTotalCount > 0 ? sumT2 / this.perfTotalCount : 0;
    this.perfAvgT3 = countT3 > 0 ? sumT3 / countT3 : 0;

    const sortedContracts = Array.from(contractBreachesMap.entries())
      .map(([name, breaches]) => ({ name, breaches }))
      .sort((a, b) => b.breaches - a.breaches)
      .slice(0, 3);
    this.perfTopRiskContracts = sortedContracts;

    const sortedFiles = [...filtered]
      .filter(item => item.isBreached)
      .sort((a, b) => {
        const totalA = a.t1 + a.t2 + (a.ackExpected === 1 ? a.t3 : 0);
        const totalB = b.t1 + b.t2 + (b.ackExpected === 1 ? b.t3 : 0);
        return totalB - totalA;
      })
      .slice(0, 3)
      .map(item => ({
        fileInId: item.fileInId,
        contract: item.contract,
        t1: item.t1,
        t2: item.t2,
        t3: item.t3,
        total: item.t1 + item.t2 + (item.ackExpected === 1 ? item.t3 : 0)
      }));
    this.perfTopRiskFiles = sortedFiles;

    if (this.selectedPerfStep === 't1') {
      this.focusStepName = "Intégration Physique (T1)";
      this.focusStepAvg = this.perfAvgT1.toFixed(2) + "s";
      this.focusStepTarget = `< ${this.perfT1SlaSec}s`;
      this.focusStepCount = this.perfTotalCount;
      const bCount = filtered.filter(item => item.isT1Breached).length;
      this.focusStepBreaches = bCount;
      this.focusStepCompliance = this.focusStepCount > 0
        ? Math.round(((this.focusStepCount - bCount) * 1000 / this.focusStepCount)) / 10
        : 100;

      let maxT1 = 0;
      let maxCont = 'N/A';
      filtered.forEach(item => {
        if (item.t1 > maxT1) {
          maxT1 = item.t1;
          maxCont = item.contract;
        }
      });
      this.focusStepMaxDelay = maxT1.toFixed(2) + "s";
      this.focusStepMaxContract = maxCont;

    } else if (this.selectedPerfStep === 't2') {
      this.focusStepName = "Traitement EAI (T2)";
      this.focusStepAvg = this.perfAvgT2.toFixed(1) + "s";
      this.focusStepTarget = `< ${this.perfT2SlaSec}s`;
      this.focusStepCount = this.perfTotalCount;
      const bCount = filtered.filter(item => item.isT2Breached).length;
      this.focusStepBreaches = bCount;
      this.focusStepCompliance = this.focusStepCount > 0
        ? Math.round(((this.focusStepCount - bCount) * 1000 / this.focusStepCount)) / 10
        : 100;

      let maxT2 = 0;
      let maxCont = 'N/A';
      filtered.forEach(item => {
        if (item.t2 > maxT2) {
          maxT2 = item.t2;
          maxCont = item.contract;
        }
      });
      this.focusStepMaxDelay = maxT2.toFixed(1) + "s";
      this.focusStepMaxContract = maxCont;

    } else if (this.selectedPerfStep === 't3') {
      this.focusStepName = "Attente Acquittement (T3)";
      this.focusStepAvg = (this.perfAvgT3 / 60).toFixed(1) + "m";
      this.focusStepTarget = `< ${this.perfT3SlaMin}m`;

      const t3Filtered = filtered.filter(item => item.ackExpected === 1);
      this.focusStepCount = t3Filtered.length;
      const bCount = t3Filtered.filter(item => item.isT3Breached).length;
      this.focusStepBreaches = bCount;
      this.focusStepCompliance = this.focusStepCount > 0
        ? Math.round(((this.focusStepCount - bCount) * 1000 / this.focusStepCount)) / 10
        : 100;

      let maxT3 = 0;
      let maxCont = 'N/A';
      t3Filtered.forEach(item => {
        if (item.t3 > maxT3) {
          maxT3 = item.t3;
          maxCont = item.contract;
        }
      });
      this.focusStepMaxDelay = (maxT3 / 60).toFixed(1) + "m";
      this.focusStepMaxContract = maxCont;
    }
  }

  getOrbitSpeed(step: 't1' | 't2' | 't3'): string {
    let ratio = 1;
    if (step === 't1') {
      ratio = this.perfAvgT1 / this.perfT1SlaSec;
    } else if (step === 't2') {
      ratio = this.perfAvgT2 / this.perfT2SlaSec;
    } else if (step === 't3') {
      ratio = (this.perfAvgT3 / 60) / this.perfT3SlaMin;
    }

    if (ratio <= 1) {
      const speed = 2 + ratio * 6;
      return `${speed.toFixed(1)}s`;
    } else {
      const speed = Math.min(30, 8 + (ratio - 1) * 10);
      return `${speed.toFixed(1)}s`;
    }
  }

  getOrbitColor(step: 't1' | 't2' | 't3'): string {
    let ratio = 1;
    if (step === 't1') {
      ratio = this.perfAvgT1 / this.perfT1SlaSec;
    } else if (step === 't2') {
      ratio = this.perfAvgT2 / this.perfT2SlaSec;
    } else if (step === 't3') {
      ratio = (this.perfAvgT3 / 60) / this.perfT3SlaMin;
    }

    if (ratio <= 0.8) return '#34d399'; // Vert
    if (ratio <= 1.0) return '#fbbf24'; // Jaune / Orange
    return '#f87171'; // Rouge
  }
}
