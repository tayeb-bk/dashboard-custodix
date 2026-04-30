import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexAxisChartSeries, ApexNonAxisChartSeries, ApexChart,
  ApexXAxis, ApexYAxis, ApexStroke, ApexDataLabels,
  ApexTooltip, ApexPlotOptions, ApexGrid, ApexFill,
  ApexLegend, ApexResponsive
} from 'ng-apexcharts';
import { FlowFileInService } from '../../services/flow-filein.service';

@Component({
  selector: 'app-flow-filein',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './flow-filein.component.html',
  styleUrl: './flow-filein.component.css'
})
export class FlowFileInComponent implements OnInit {

  // ===== KPI =====
  kpi: any = null;

  // ===== Timeline =====
  timelineFilter = { from: '', to: '', workflow: '', contrat: '', bucket: 'auto' };
  timelineSeries: ApexAxisChartSeries = [];
  timelineChart: ApexChart = { type: 'area', height: 230, toolbar: { show: false }, animations: { enabled: true, speed: 600 } };
  timelineXAxis: ApexXAxis = { type: 'datetime', labels: { style: { colors: '#64748b', fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } };
  timelineYAxis: ApexYAxis = { labels: { style: { colors: '#64748b', fontSize: '11px' } } };
  timelineStroke: ApexStroke = { curve: 'smooth', width: 2 };
  timelineFill: ApexFill = { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 100] } };
  timelineGrid: ApexGrid = { borderColor: 'rgba(148, 163, 184, 0.2)', strokeDashArray: 4 };
  timelineTooltip: ApexTooltip = { theme: 'light', x: { format: 'dd MMM yyyy HH:mm' } };
  timelineColors = ['#6366f1'];

  // ===== Heatmap =====
  heatmapSeries: ApexAxisChartSeries = [];
  heatmapChart: ApexChart = { type: 'heatmap', height: 260, toolbar: { show: false } };
  heatmapPlotOptions: ApexPlotOptions = {
    heatmap: {
      shadeIntensity: 0.5, radius: 4,
      colorScale: {
        ranges: [
          { from: 0,    to: 0,     color: '#f8fafc', name: 'Aucun' },
          { from: 1,    to: 50,    color: '#c7d2fe', name: 'Faible' },
          { from: 51,   to: 300,   color: '#818cf8', name: 'Moyen' },
          { from: 301,  to: 2000,  color: '#4f46e5', name: 'Élevé' },
          { from: 2001, to: 99999, color: '#9333ea', name: 'Très élevé' }
        ]
      }
    }
  };
  heatmapDataLabels: ApexDataLabels = { enabled: false };
  heatmapXAxis: ApexXAxis = {
    categories: ['00h','01h','02h','03h','04h','05h','06h','07h','08h','09h',
                 '10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h','21h','22h','23h'],
    labels: { style: { colors: '#64748b', fontSize: '10px' } }
  };
  heatmapTooltip: ApexTooltip = { theme: 'light' };

  // ===== Anomalies Timeline =====
  anomaliesSeries: ApexAxisChartSeries = [];
  anomaliesChart: ApexChart = { type: 'area', height: 260, toolbar: { show: false }, animations: { enabled: true, speed: 500 } };
  anomaliesXAxis: ApexXAxis = { type: 'datetime', labels: { style: { colors: '#64748b', fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } };
  anomaliesYAxis: ApexYAxis = { labels: { style: { colors: '#64748b', fontSize: '11px' } } };
  anomaliesStroke: ApexStroke = { curve: 'smooth', width: [2, 2, 2] };
  anomaliesFill: ApexFill = { type: 'gradient', gradient: { shadeIntensity: 0.5, opacityFrom: 0.2, opacityTo: 0.02 } };
  anomaliesColors = ['#6366f1', '#f43f5e', '#f59e0b'];
  anomaliesGrid: ApexGrid = { borderColor: 'rgba(148, 163, 184, 0.2)', strokeDashArray: 4 };
  anomaliesTooltip: ApexTooltip = { theme: 'light', x: { format: 'MMM yyyy' } };
  anomaliesLegend: ApexLegend = { position: 'top', labels: { colors: '#64748b' } };

  // ===== Top Workflows =====
  topWorkflows: any[] = [];

  // ===== Top Contrats =====
  topContracts: any[] = [];
  contractSeries: ApexNonAxisChartSeries = [];
  contractChart: ApexChart = { type: 'donut', height: 280, animations: { enabled: true } };
  contractLabels: string[] = [];
  contractColors = ['#6366f1','#a855f7','#06b6d4','#10b981','#f59e0b','#f43f5e','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];
  contractLegend: ApexLegend = { position: 'bottom', labels: { colors: '#64748b' }, fontSize: '11px' };
  contractTooltip: ApexTooltip = { theme: 'light' };
  contractResponsive: ApexResponsive[] = [{ breakpoint: 480, options: { chart: { height: 220 } } }];

  // ===== Table =====
  tableRows: any[] = [];
  tablePage = 0;
  tableSize = 15;
  tableTotalPages = 0;
  tableTotalElements = 0;
  tableLoading = false;
  tableFilter = {
    workflow: '', contrat: '', from: '', to: '',
    isDuplicate: null as boolean | null,
    isManual: null as boolean | null
  };

  // ===== Filter Options =====
  filterWorkflows: string[] = [];
  filterContracts: string[] = [];

  // ===== Detail Panel =====
  selectedFile: any = null;
  showDetailPanel = false;

  // ===== Widget Info Popovers =====
  activeWidget: string | null = null;

  readonly widgetInfo: Record<string, { icon: string; title: string; what: string; how: string; action: string }> = {
    totalFiles: {
      icon: '📂', title: 'Total Fichiers Reçus',
      what: 'Nombre total de fichiers entrants reçus par la plateforme Custodix depuis l\'origine des données.',
      how: 'Calculé par COUNT(*) sur la table FLOW_FILEIN du schéma UCUSTOI0.',
      action: 'Sert de référence de volume. Une chute soudaine peut indiquer un problème d\'alimentation côté expéditeur.'
    },
    duplicates: {
      icon: '♻️', title: 'Taux de Doublons',
      what: 'Proportion de fichiers reçus en double — un même fichier traité plusieurs fois peut causer des erreurs métier.',
      how: 'COUNT(DUPLICATED_ID_) / COUNT(*) × 100. La colonne DUPLICATED_ID_ pointe vers le fichier original.',
      action: 'Un taux > 5% est critique. Investiguer les expéditeurs qui envoient des doublons en filtrant le tableau ci-dessous.'
    },
    manual: {
      icon: '🖐️', title: 'Intégrations Manuelles',
      what: 'Fichiers ayant nécessité une intervention humaine pour être intégrés — signe d\'une anomalie ou d\'un fichier non standard.',
      how: 'COUNT(MANUALFLOWINTEGRATION_ID_). La présence d\'un ID indique qu\'un opérateur a manuellement déclenché l\'intégration.',
      action: 'Si le nombre augmente, investiguer les causes. Utiliser le filtre "Manuels seulement" dans le tableau pour identifier les fichiers concernés.'
    },
    workflows: {
      icon: '🔄', title: 'Workflows Distincts',
      what: 'Nombre de workflows de traitement différents actifs — représente la diversité des types de flux traités.',
      how: 'COUNT(DISTINCT WORKFLOWID_). 80.4% des fichiers ont un workflow identifié.',
      action: 'Identifier les workflows les plus chargés dans le graphique "Top 10 Workflows" pour anticiper les surcharges.'
    },
    contracts: {
      icon: '📋', title: 'Contrats SLA Distincts',
      what: 'Nombre de contrats SLA différents référencés dans les fichiers reçus — représente les engagements de qualité de service.',
      how: 'COUNT(DISTINCT PASSEDCONTRACTIDENTIFIER_). 50.3% des fichiers ont un contrat identifié.',
      action: 'Un contrat SLA identifié permet de prioriser le traitement. Filtrer par contrat dans le tableau pour voir les fichiers à traiter en priorité.'
    },
    timeline: {
      icon: '📈', title: 'Volume de Réception',
      what: 'Évolution temporelle du nombre de fichiers reçus. Permet de détecter les pics ou les creux d\'activité.',
      how: 'Agrégation des fichiers par heure, jour ou mois (auto-sélection selon la plage choisie). Filtrable par workflow ou contrat.',
      action: 'Un creux anormal indique que des expéditeurs ont arrêté d\'envoyer. Comparer avec la période précédente pour confirmer.'
    },
    heatmap: {
      icon: '🔥', title: 'Heatmap d\'Activité',
      what: 'Carte de chaleur montrant l\'intensité de réception des fichiers selon le jour de la semaine et l\'heure de la journée.',
      how: 'Agrégation par TO_CHAR(SENDINGDATE_, "D") et TO_CHAR(SENDINGDATE_, "HH24"). Couleur = densité de fichiers.',
      action: 'Identifiez les plages horaires à risque (peu d\'activité la nuit = normal, mais un pic nocturne inhabituel mérite attention).'
    },
    anomaliesChart: {
      icon: '📉', title: 'Évolution des Anomalies',
      what: 'Suivi dans le temps du volume total, des doublons et des intégrations manuelles. Permet de voir si les anomalies augmentent.',
      how: 'Agrégation mensuelle des COUNT(*), COUNT(DUPLICATED_ID_) et COUNT(MANUALFLOWINTEGRATION_ID_).',
      action: 'Si la courbe des doublons ou des manuels monte, déclencher une investigation sur la qualité des fichiers entrants.'
    },
    topWorkflows: {
      icon: '🔄', title: 'Top 10 Workflows',
      what: 'Classement des workflows de traitement les plus utilisés — permet d\'identifier les canaux les plus sollicités.',
      how: 'GROUP BY WORKFLOWID_ ORDER BY COUNT(*) DESC — sur les 72,355 fichiers ayant un workflow identifié (80.4%).',
      action: 'Les workflows en tête de classement sont critiques. Une panne sur l\'un d\'eux impacte le plus grand nombre de fichiers.'
    },
    topContracts: {
      icon: '📋', title: 'Répartition Contrats SLA',
      what: 'Proportion de fichiers rattachés à chaque contrat SLA — visualise quels contrats génèrent le plus de trafic.',
      how: 'GROUP BY PASSEDCONTRACTIDENTIFIER_ sur les 45,273 fichiers avec contrat identifié (50.3%).',
      action: 'Les contrats dominants représentent les engagements les plus critiques. Prioriser leur traitement en cas d\'incident.'
    }
  };

  toggleWidget(key: string, event: Event): void {
    event.stopPropagation();
    this.activeWidget = this.activeWidget === key ? null : key;
  }
  closeWidget(): void { this.activeWidget = null; }

  constructor(private svc: FlowFileInService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadKpi();
    this.loadTimeline();
    this.loadHeatmap();
    this.loadAnomaliesTimeline();
    this.loadTopWorkflows();
    this.loadTopContracts();
    this.loadTable();
    this.loadFilterOptions();
  }

  // ===== Loaders =====

  loadKpi(): void {
    this.svc.getKpiSummary().subscribe(d => { this.kpi = d; this.cdr.markForCheck(); });
  }

  loadTimeline(): void {
    const p: any = { bucket: this.timelineFilter.bucket };
    if (this.timelineFilter.from)     p.from     = this.timelineFilter.from     + ':00';
    if (this.timelineFilter.to)       p.to       = this.timelineFilter.to       + ':00';
    if (this.timelineFilter.workflow) p.workflow = this.timelineFilter.workflow;
    if (this.timelineFilter.contrat)  p.contrat  = this.timelineFilter.contrat;
    this.svc.getTimeline(p).subscribe(rows => {
      this.timelineSeries = [{
        name: 'Fichiers reçus',
        data: rows.map(r => [new Date(r.bucket).getTime(), r.total])
      }];
      this.cdr.markForCheck();
    });
  }

  loadHeatmap(): void {
    this.svc.getHeatmap().subscribe(rows => {
      const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      const matrix: { [day: number]: number[] } = {};
      for (let d = 1; d <= 7; d++) matrix[d] = new Array(24).fill(0);
      rows.forEach((r: any) => { if (matrix[r.dayOfWeek]) matrix[r.dayOfWeek][r.hourOfDay] = r.total; });
      this.heatmapSeries = days.map((name, i) => ({
        name,
        data: matrix[i + 1].map((val, h) => ({ x: `${h}h`, y: val }))
      }));
      this.cdr.markForCheck();
    });
  }

  loadAnomaliesTimeline(): void {
    this.svc.getAnomaliesTimeline().subscribe(rows => {
      this.anomaliesSeries = [
        { name: 'Total fichiers', data: rows.map((r: any) => [new Date(r.bucket).getTime(), r.total]) },
        { name: 'Doublons',       data: rows.map((r: any) => [new Date(r.bucket).getTime(), r.doublons]) },
        { name: 'Manuels',        data: rows.map((r: any) => [new Date(r.bucket).getTime(), r.manuels]) }
      ];
      this.cdr.markForCheck();
    });
  }

  loadTopWorkflows(): void {
    this.svc.getTopWorkflows().subscribe(rows => {
      this.topWorkflows = rows;
      this.cdr.markForCheck();
    });
  }

  loadTopContracts(): void {
    this.svc.getTopContracts().subscribe(rows => {
      this.topContracts = rows;
      this.contractLabels = rows.map((r: any) =>
        r.contrat?.length > 20 ? r.contrat.slice(0, 20) + '…' : r.contrat
      );
      this.contractSeries = rows.map((r: any) => r.total) as number[];
      this.cdr.markForCheck();
    });
  }

  loadFilterOptions(): void {
    this.svc.getFilterWorkflows().subscribe(d => { this.filterWorkflows = d; });
    this.svc.getFilterContracts().subscribe(d => { this.filterContracts = d; });
  }

  loadTable(): void {
    this.tableLoading = true;
    const p: any = { page: this.tablePage, size: this.tableSize };
    if (this.tableFilter.workflow)           p.workflow    = this.tableFilter.workflow;
    if (this.tableFilter.contrat)            p.contrat     = this.tableFilter.contrat;
    if (this.tableFilter.from)               p.from        = this.tableFilter.from + ':00';
    if (this.tableFilter.to)                 p.to          = this.tableFilter.to   + ':00';
    if (this.tableFilter.isDuplicate !== null) p.isDuplicate = this.tableFilter.isDuplicate;
    if (this.tableFilter.isManual    !== null) p.isManual    = this.tableFilter.isManual;
    this.svc.getFiltered(p).subscribe((page: any) => {
      this.tableRows          = page.content;
      this.tableTotalPages    = page.totalPages;
      this.tableTotalElements = page.totalElements;
      this.tableLoading       = false;
      this.cdr.markForCheck();
    });
  }

  // ===== Actions =====

  applyTableFilters(): void { this.tablePage = 0; this.loadTable(); }
  resetTableFilters(): void {
    this.tableFilter = { workflow: '', contrat: '', from: '', to: '', isDuplicate: null, isManual: null };
    this.tablePage = 0;
    this.loadTable();
  }
  prevPage(): void { if (this.tablePage > 0) { this.tablePage--; this.loadTable(); } }
  nextPage(): void { if (this.tablePage < this.tableTotalPages - 1) { this.tablePage++; this.loadTable(); } }

  toggleQuickFilter(field: 'isDuplicate' | 'isManual', value: boolean): void {
    this.tableFilter[field] = this.tableFilter[field] === value ? null : value;
    this.applyTableFilters();
  }

  onTimelineFilterChange(): void { this.loadTimeline(); }

  openDetail(file: any): void  { this.selectedFile = file; this.showDetailPanel = true; }
  closeDetail(): void           { this.showDetailPanel = false; this.selectedFile = null; }

  getWorkflowMax(): number { return Math.max(...this.topWorkflows.map((w: any) => w.total), 1); }
  getContractMax(): number { return Math.max(...this.topContracts.map((c: any) => c.total), 1); }

  getDupColor(rate: number): string {
    if (rate > 10) return '#f43f5e';
    if (rate > 3)  return '#f59e0b';
    return '#10b981';
  }
}
