import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexAxisChartSeries, ApexNonAxisChartSeries, ApexChart,
  ApexXAxis, ApexYAxis, ApexStroke, ApexDataLabels,
  ApexTooltip, ApexPlotOptions, ApexGrid, ApexFill,
  ApexLegend, ApexResponsive, ApexAnnotations
} from 'ng-apexcharts';
import { FlowFileInService } from '../../services/flow-filein.service';
import { AiChatService } from '../../services/ai-chat.service';

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
  kpiFilter = { contrat: '' };

  // ===== Timeline enrichie (Bande de Normalité) =====
  timelineFilter = { from: '', to: '', workflow: '', contrat: '', bucket: 'auto' };
  timelineSeries: ApexAxisChartSeries = [];
  timelineChart: ApexChart = {
    type: 'rangeArea', height: 300,
    toolbar: { show: false },
    animations: { enabled: true, speed: 700 }
  };
  timelineXAxis: ApexXAxis = {
    type: 'datetime',
    labels: { style: { colors: '#94a3b8', fontSize: '10px' }, datetimeFormatter: { day: 'dd MMM' } },
    axisBorder: { show: false }, axisTicks: { show: false }
  };
  timelineYAxis: ApexYAxis = { labels: { style: { colors: '#94a3b8', fontSize: '10px' } } };
  timelineStroke: ApexStroke = { curve: 'smooth', width: [0, 2.5, 1.5] };
  timelineDataLabels: ApexDataLabels = { enabled: false };
  timelineMarkers: any = { size: [0, 3, 0], hover: { size: 5 } };
  timelineFill: ApexFill = { opacity: [0.15, 0.9, 0.8] };
  timelineGrid: ApexGrid = { borderColor: 'rgba(148, 163, 184, 0.08)', strokeDashArray: 4 };
  timelineTooltip: ApexTooltip = {
    theme: 'light', shared: true,
    y: { formatter: (v: number) => v != null ? v.toLocaleString('fr-FR') + ' fichiers' : '-' }
  };
  timelineColors = ['#818cf8', '#6366f1', '#a855f7'];
  timelineLegend: ApexLegend = {
    show: true, position: 'top',
    labels: { colors: '#94a3b8' }, fontSize: '11px',
    markers: { size: 10 }
  };
  timelineAnnotations: ApexAnnotations = {};
  showAnomaliesOnTimeline = false;
  lastTimelineRows: any[] = [];

  // ===== Heatmap =====
  heatmapWeek: string = ''; // Format "YYYY-WXX"
  heatmapSeries: ApexAxisChartSeries = [];
  heatmapChart: ApexChart = { type: 'heatmap', height: 260, toolbar: { show: false } };
  heatmapPlotOptions: ApexPlotOptions = {
    heatmap: {
      shadeIntensity: 0.5, radius: 4,
      colorScale: {
        ranges: [
          { from: 0, to: 0, color: '#f8fafc', name: 'Aucun' },
          { from: 1, to: 50, color: '#c7d2fe', name: 'Faible' },
          { from: 51, to: 300, color: '#818cf8', name: 'Moyen' },
          { from: 301, to: 2000, color: '#4f46e5', name: 'Élevé' },
          { from: 2001, to: 99999, color: '#9333ea', name: 'Très élevé' }
        ]
      }
    }
  };
  heatmapDataLabels: ApexDataLabels = { enabled: false };
  heatmapXAxis: ApexXAxis = {
    categories: ['00h', '01h', '02h', '03h', '04h', '05h', '06h', '07h', '08h', '09h',
      '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h', '18h', '19h', '20h', '21h', '22h', '23h'],
    labels: { style: { colors: '#64748b', fontSize: '10px' } }
  };
  heatmapTooltip: ApexTooltip = { theme: 'light' };

  // ===== Anomalies Timeline =====
  anomaliesFilter = { from: '', to: '', workflow: '', contrat: '' };
  anomaliesSeries: ApexAxisChartSeries = [];
  anomaliesChart: ApexChart = { 
    type: 'line', height: 260, toolbar: { show: false }, animations: { enabled: true, speed: 800, animateGradually: { enabled: true, delay: 150 } }
  };
  anomaliesXAxis: ApexXAxis = { type: 'datetime', labels: { style: { colors: '#64748b', fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } };
  anomaliesYAxis: ApexYAxis = { min: 0, labels: { style: { colors: '#64748b', fontSize: '11px' } } };
  anomaliesStroke: ApexStroke = { curve: 'smooth', width: [0, 2, 2] };
  anomaliesFill: ApexFill = { 
    type: ['solid', 'gradient', 'gradient'], 
    opacity: [0.1, 0.5, 0.5],
    gradient: { shadeIntensity: 0.5, opacityFrom: 0.2, opacityTo: 0.02 } 
  };
  anomaliesColors = ['#6366f1', '#f43f5e', '#f59e0b'];
  anomaliesGrid: ApexGrid = { borderColor: 'rgba(148, 163, 184, 0.2)', strokeDashArray: 4 };
  anomaliesDataLabels: ApexDataLabels = { enabled: false, enabledOnSeries: undefined };
  anomaliesTooltip: ApexTooltip = { theme: 'light', x: { format: 'dd MMM yyyy' } };
  anomaliesLegend: ApexLegend = { position: 'top', labels: { colors: '#64748b' } };

  // ===== Top Workflows =====
  topWorkflows: any[] = [];
  selectedWorkflowFilter = '';

  // ===== Top Contrats =====
  topContracts: any[] = [];
  selectedContractFilter = '';
  contractSeries: ApexNonAxisChartSeries = [];
  contractChart: ApexChart = { 
    type: 'donut', height: 320, animations: { enabled: true, animateGradually: { enabled: true, delay: 150 } },
    events: {
      dataPointSelection: (e, chart, config) => {
        const clickedContract = this.contractLabels[config.dataPointIndex];
        this.onContractClick(clickedContract);
      }
    }
  };
  contractLabels: string[] = [];
  contractColors = ['#6366f1', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
  contractLegend: ApexLegend = { 
    position: 'right', 
    offsetY: 20,
    labels: { colors: '#64748b' }, 
    fontSize: '12px',
    markers: { shape: 'circle' },
    itemMargin: { vertical: 5 }
  };
  contractPlotOptions: ApexPlotOptions = {
    pie: {
      donut: {
        size: '75%',
        labels: {
          show: true,
          name: { show: true, fontSize: '12px', color: '#64748b', offsetY: -10 },
          value: { show: true, fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', offsetY: 5, formatter: (val: any) => parseInt(String(val), 10).toLocaleString() },
          total: {
            show: true,
            showAlways: true,
            label: 'Volume Total',
            fontSize: '14px',
            fontWeight: 600,
            color: '#64748b',
            formatter: (w) => w.globals.seriesTotals.reduce((a: any, b: any) => a + b, 0).toLocaleString()
          }
        }
      }
    }
  };
  contractTooltip: ApexTooltip = { theme: 'light', y: { formatter: (val) => val.toLocaleString() + ' fichiers' } };
  contractResponsive: ApexResponsive[] = [{ breakpoint: 480, options: { chart: { height: 260 }, legend: { position: 'bottom' } } }];

  // ===== Widget EAI (Origine + Traçabilité) =====
  eaiWorkflowFilter = '';
  eaiCoverageData: { name: string; count: number; pct: number }[] = [];
  eaiMatrixWorkflows: string[] = [];
  eaiMatrixHeaders: string[] = [];
  eaiMatrixData: { [wf: string]: { [hdr: string]: number } } = {};
  eaiWorkflowProfiles: { [wf: string]: any } = {};

  // ===== Table =====
  tableRows: any[] = [];
  tablePage = 0;
  tableSize = 15;
  tableTotalPages = 0;
  tableTotalElements = 0;
  tableLoading = false;
  tableFilter = {
    workflow: '', contrat: '', checksum: '', client: '', fileName: '', from: '', to: '',
    isDuplicate: null as boolean | null,
    isManual: null as boolean | null
  };

  // ===== Filter Options =====
  filterWorkflows: string[] = [];
  filterContracts: string[] = [];
  filterClients: string[] = [];
  filterChecksums: string[] = [];

  // ===== Detail Panel =====
  selectedFile: any = null;
  showDetailPanel = false;
  selectedFileHeaders: any[] = [];
  headersLoading = false;

  // ===== AI Translator =====
  isAiLoading = false;
  aiExplanation = '';

  // ===== Widget Info Popovers =====
  activeWidget: string | null = null;

  readonly widgetInfo: Record<string, { icon: string; title: string; what: string; how: string; action: string }> = {
    // ... widgetInfo unchanged ...
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
      icon: '📈', title: 'Surveillance Active du Volume de Réception',
      what: 'Graphique de surveillance qui compare le volume réel de fichiers reçus à un intervalle de normalité (calculé automatiquement).',
      how: 'La zone violette = Moyenne +/- 1 écart-type sur 7j. La courbe bleue = volume réel. Les points rouges (⚠️ Anomalie) = jours où le réel sort de la bande de normalité.',
      action: 'Utilisez les raccourcis (7j, 30j). Si un point rouge apparaît en haut : pic suspect (doublons ?). S\'il est en bas : chute anormale (panne expéditeur ?).'
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
    },
    traceability: {
      icon: '🧭', title: 'Indice de Traçabilité',
      what: 'Évalue si les fichiers reçus sont correctement "marqués" avec des en-têtes (EAI Headers) explicites (ex: MSG_SENDER, MSG_TYPE).',
      how: 'Moyenne du taux de présence des 4 en-têtes EAI les plus fréquents sur la plateforme.',
      action: 'Un score global < 80% signale une perte de visibilité métier. Surveillez les flux qui arrivent "anonymement".'
    },
    originMatrix: {
      icon: '🗺️', title: 'Cartographie des Origines',
      what: 'Matrice croisant les Workflows avec les En-têtes (Headers) EAI trouvés dans les messages.',
      how: 'Compte le nombre de fois où un Header spécifique est attaché aux fichiers passant par un Workflow donné.',
      action: 'Repérez les cases vides (0). Si un workflow critique n\'a aucun header de sécurité (ex: SECURITY_TOKEN), c\'est une faille de conformité.'
    },
    dataTable: {
      icon: '📑', title: 'Explorateur de Fichiers Entrants',
      what: 'Journal détaillé listant tous les fichiers interceptés à l\'étape de réception (Table FLOW_FILEIN).',
      how: 'Requêtage paginé sur Oracle. Les ID sont incrémentaux historiques, ce qui explique qu\'ils dépassent le volume actuel des données filtrées.',
      action: 'Utilisez les filtres et cliquez sur un fichier pour ouvrir le panneau latéral et activer l\'Assistant IA de qualification métier.'
    }
  };

  toggleWidget(key: string, event: Event): void {
    event.stopPropagation();
    this.activeWidget = this.activeWidget === key ? null : key;
  }
  closeWidget(): void { this.activeWidget = null; }

  constructor(private svc: FlowFileInService, private cdr: ChangeDetectorRef, private aiSvc: AiChatService) { }

  ngOnInit(): void {
    this.loadKpi();
    this.loadTimeline();
    this.loadHeatmap();
    this.loadAnomaliesTimeline();
    this.loadTopWorkflows();
    this.loadTopContracts();
    this.loadTable();
    this.loadFilterOptions();
    this.loadEaiWidget();
  }

  // ===== Loaders =====

  loadKpi(): void {
    this.svc.getKpiSummary().subscribe(d => { this.kpi = d; this.cdr.markForCheck(); });
  }

  loadTimeline(): void {
    const p: any = {};
    if (this.timelineFilter.from)     p.from     = this.timelineFilter.from + 'T00:00:00';
    if (this.timelineFilter.to)       p.to       = this.timelineFilter.to   + 'T23:59:59';
    if (this.timelineFilter.workflow) p.workflow  = this.timelineFilter.workflow;
    if (this.timelineFilter.contrat)  p.contrat   = this.timelineFilter.contrat;

    this.svc.getTimelineBaseline(p).subscribe((rows: any[]) => {
      this.lastTimelineRows = rows;
      this.timelineSeries = [
        {
          name: 'Zone normale (+/- 1s)',
          type: 'rangeArea',
          data: rows.map(r => ({ x: new Date(r['bucket']).getTime(), y: [r['lower'], r['upper']] }))
        },
        {
          name: 'Volume reel',
          type: 'area',
          data: rows.map(r => ({ x: new Date(r['bucket']).getTime(), y: r['total'] }))
        },
        {
          name: 'Moyenne 7j',
          type: 'line',
          data: rows.map(r => ({ x: new Date(r['bucket']).getTime(), y: r['avg'] }))
        }
      ];
      
      this.updateTimelineAnnotations();
    });
  }

  onTimelineFilterChange(): void {
    this.loadTimeline();
  }

  toggleAnomalies(): void {
    this.showAnomaliesOnTimeline = !this.showAnomaliesOnTimeline;
    this.updateTimelineAnnotations();
  }

  resetTimelineFilters(): void {
    this.timelineFilter = { from: '', to: '', workflow: '', contrat: '', bucket: 'auto' };
    this.loadTimeline();
  }

  updateTimelineAnnotations(): void {
    const annotations: any[] = [];
    if (this.showAnomaliesOnTimeline) {
      this.lastTimelineRows.forEach((r: any) => {
        if (r.total > r.upper || r.total < r.lower) {
          const diff = Math.round(r.total - r.avg);
          const sign = diff > 0 ? '+' : '';
          annotations.push({
            x: new Date(r.bucket).getTime(),
            y: r.total,
            marker: { size: 6, fillColor: '#ef4444', strokeColor: '#fff', strokeWidth: 2 },
            label: {
              text: `⚠️ Anomalie: ${r.total} flux (Écart: ${sign}${diff})`,
              style: { background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 600, padding: { left: 5, right: 5, top: 2, bottom: 2 } },
              offsetY: -10
            }
          });
        }
      });
    }
    this.timelineAnnotations = { points: annotations };
    this.cdr.markForCheck();
  }

  getDateOfISOWeek(w: number, y: number): Date {
    const simple = new Date(y, 0, 1 + (w - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    ISOweekStart.setHours(0, 0, 0, 0);
    return ISOweekStart;
  }

  onHeatmapWeekChange(): void {
    this.loadHeatmap();
  }

  resetHeatmapWeek(): void {
    this.heatmapWeek = '';
    this.loadHeatmap();
  }

  loadHeatmap(): void {
    const params: any = {};
    if (this.heatmapWeek) {
      const parts = this.heatmapWeek.split('-W');
      if (parts.length === 2) {
        const year = parseInt(parts[0], 10);
        const week = parseInt(parts[1], 10);
        const fromDate = this.getDateOfISOWeek(week, year);
        const toDate = new Date(fromDate);
        toDate.setDate(toDate.getDate() + 6); // Add 6 days to get Sunday
        toDate.setHours(23, 59, 59);

        const pad = (n: number) => n.toString().padStart(2, '0');
        params.from = `${fromDate.getFullYear()}-${pad(fromDate.getMonth() + 1)}-${pad(fromDate.getDate())}T00:00:00`;
        params.to = `${toDate.getFullYear()}-${pad(toDate.getMonth() + 1)}-${pad(toDate.getDate())}T23:59:59`;
      }
    }

    this.svc.getHeatmap(params).subscribe(rows => {
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
    const p: any = {};
    if (this.anomaliesFilter.from) p.from = this.anomaliesFilter.from + 'T00:00:00';
    if (this.anomaliesFilter.to) p.to = this.anomaliesFilter.to + 'T23:59:59';
    if (this.anomaliesFilter.workflow) p.workflow = this.anomaliesFilter.workflow;
    if (this.anomaliesFilter.contrat) p.contrat = this.anomaliesFilter.contrat;

    this.svc.getAnomaliesTimeline(p).subscribe(rows => {
      this.anomaliesSeries = [
        { name: 'Total fichiers', type: 'column', hidden: true, data: rows.map((r: any) => [new Date(r.bucket).getTime(), r.total]) } as any,
        { name: 'Doublons', type: 'area', data: rows.map((r: any) => [new Date(r.bucket).getTime(), r.doublons]) } as any,
        { name: 'Manuels', type: 'area', data: rows.map((r: any) => [new Date(r.bucket).getTime(), r.manuels]) } as any
      ];
      this.cdr.markForCheck();
    });
  }

  onAnomaliesFilterChange(): void {
    this.loadAnomaliesTimeline();
  }

  resetAnomaliesFilters(): void {
    this.anomaliesFilter = { from: '', to: '', workflow: '', contrat: '' };
    this.loadAnomaliesTimeline();
  }

  loadTopWorkflows(): void {
    const p: any = {};
    if (this.selectedContractFilter) p.contrat = this.selectedContractFilter;

    this.svc.getTopWorkflows(p).subscribe(rows => {
      this.topWorkflows = rows;
      this.cdr.markForCheck();
    });
  }

  loadTopContracts(): void {
    const p: any = {};
    if (this.selectedWorkflowFilter) p.workflow = this.selectedWorkflowFilter;

    this.svc.getTopContracts(p).subscribe(rows => {
      this.topContracts = rows;
      this.contractLabels = rows.map((r: any) =>
        r.contrat?.length > 20 ? r.contrat.slice(0, 20) + '…' : r.contrat
      );
      this.contractSeries = rows.map((r: any) => r.total) as number[];
      this.cdr.markForCheck();
    });
  }

  onWorkflowClick(wfName: string): void {
    if (this.selectedWorkflowFilter === wfName) {
      this.selectedWorkflowFilter = ''; // Toggle off
    } else {
      this.selectedWorkflowFilter = wfName;
    }
    this.loadTopContracts();
  }

  onContractClick(contractName: string): void {
    if (this.selectedContractFilter === contractName) {
      this.selectedContractFilter = ''; // Toggle off
    } else {
      this.selectedContractFilter = contractName;
    }
    this.loadTopWorkflows();
  }

  resetCrossFilters(): void {
    this.selectedWorkflowFilter = '';
    this.selectedContractFilter = '';
    this.loadTopWorkflows();
    this.loadTopContracts();
  }

  loadFilterOptions(): void {
    this.svc.getFilterWorkflows().subscribe(d => { this.filterWorkflows = d; });
    this.svc.getFilterContracts().subscribe(d => { this.filterContracts = d; });
    this.svc.getFilterClients().subscribe(d => { this.filterClients = d; });
    this.svc.getFilterChecksums().subscribe(d => { this.filterChecksums = d; });
  }

  eaiMatrixMax: number = 1;
  showEaiGlossary: boolean = false;

  loadEaiWidget(): void {
    const wf = this.eaiWorkflowFilter || undefined;

    // --- Sous-widget 1 : Couverture headers ---
    this.svc.getHeaderCoverage(wf).subscribe((rows: any[]) => {
      this.eaiCoverageData = rows.map(r => ({
        name: r[0] as string,
        count: Number(r[1]),
        pct: Number(r[2])
      }));
      this.cdr.markForCheck();
    });

    // --- Sous-widget 2 : Matrice Workflow × Header ---
    this.svc.getWorkflowMatrix(wf).subscribe((rows: any[]) => {
      const wfSet = new Set<string>();
      const hdrSet = new Set<string>();
      const raw: { wf: string; hdr: string; cnt: number }[] = [];
      let maxCount = 0;
      rows.forEach(r => {
        const w = r[0] as string, h = r[1] as string, c = Number(r[2]);
        if (c > maxCount) maxCount = c;
        wfSet.add(w); hdrSet.add(h);
        raw.push({ wf: w, hdr: h, cnt: c });
      });
      this.eaiMatrixMax = maxCount || 1;
      this.eaiMatrixWorkflows = Array.from(wfSet).slice(0, 12);
      this.eaiMatrixHeaders = Array.from(hdrSet).slice(0, 10);
      const matrix: { [wf: string]: { [hdr: string]: number } } = {};
      this.eaiMatrixWorkflows.forEach(w => { matrix[w] = {}; this.eaiMatrixHeaders.forEach(h => matrix[w][h] = 0); });
      raw.forEach(r => { if (matrix[r.wf] && this.eaiMatrixHeaders.includes(r.hdr)) matrix[r.wf][r.hdr] = r.cnt; });
      this.eaiMatrixData = matrix;
      this.cdr.markForCheck();
    });
  }

  onEaiWorkflowChange(): void { this.loadEaiWidget(); }
  
  getMatrixColor(val: number): string {
    if (!val || val === 0) return 'transparent';
    const intensity = Math.max(0.1, val / this.eaiMatrixMax);
    return `rgba(99, 102, 241, ${intensity})`;
  }

  getTextColor(val: number): string {
    if (!val || val === 0) return 'var(--text-primary)';
    const intensity = val / this.eaiMatrixMax;
    return intensity > 0.5 ? '#ffffff' : 'var(--text-primary)';
  }

  getTraceabilityScore(): number {
    if (!this.eaiCoverageData || this.eaiCoverageData.length === 0) return 0;
    const critical = ['CamelFileName', 'routeId', 'APP_REFERENCE'];
    let score = 0;
    let found = 0;
    this.eaiCoverageData.forEach(h => {
      if (critical.includes(h.name)) {
        if (h.name === 'CamelFileName') score += h.pct * 0.4;
        if (h.name === 'routeId') score += h.pct * 0.35;
        if (h.name === 'APP_REFERENCE') score += h.pct * 0.25;
        found++;
      }
    });
    return Math.round(score);
  }

  getMatrixIntensity(wf: string, hdr: string): number {
    const val = this.eaiMatrixData[wf]?.[hdr] || 0;
    if (val === 0) return 0.05;
    if (val < 10) return 0.3;
    if (val < 100) return 0.6;
    return 1;
  }

  getProfile(wf: string): void {
    if (this.eaiWorkflowProfiles[wf]) return;
    this.svc.getWorkflowProfile(wf).subscribe(p => {
      this.eaiWorkflowProfiles[wf] = p;
      this.cdr.markForCheck();
    });
  }

  loadTable(): void {
    this.tableLoading = true;
    const p: any = { page: this.tablePage, size: this.tableSize };
    if (this.tableFilter.workflow) p.workflow = this.tableFilter.workflow;
    if (this.tableFilter.contrat) p.contrat = this.tableFilter.contrat;
    if (this.tableFilter.checksum) p.checksum = this.tableFilter.checksum;
    if (this.tableFilter.client) p.client = this.tableFilter.client;
    if (this.tableFilter.fileName) p.fileName = this.tableFilter.fileName;
    if (this.tableFilter.from) p.from = this.tableFilter.from + ':00';
    if (this.tableFilter.to) p.to = this.tableFilter.to + ':00';
    if (this.tableFilter.isDuplicate !== null) p.isDuplicate = this.tableFilter.isDuplicate;
    if (this.tableFilter.isManual !== null) p.isManual = this.tableFilter.isManual;
    this.svc.getFiltered(p).subscribe((page: any) => {
      this.tableRows = page.content;
      this.tableTotalPages = page.totalPages;
      this.tableTotalElements = page.totalElements;
      this.tableLoading = false;
      this.cdr.markForCheck();
    });
  }

  // ===== Actions =====

  applyTableFilters(): void { this.tablePage = 0; this.loadTable(); }
  resetTableFilters(): void {
    this.tableFilter = { workflow: '', contrat: '', checksum: '', client: '', fileName: '', from: '', to: '', isDuplicate: null, isManual: null };
    this.tablePage = 0;
    this.loadTable();
  }
  prevPage(): void { if (this.tablePage > 0) { this.tablePage--; this.loadTable(); } }
  nextPage(): void { if (this.tablePage < this.tableTotalPages - 1) { this.tablePage++; this.loadTable(); } }

  toggleQuickFilter(field: 'isDuplicate' | 'isManual', value: boolean): void {
    this.tableFilter[field] = this.tableFilter[field] === value ? null : value;
    this.applyTableFilters();
  }

  clearFilter(field: keyof typeof this.tableFilter): void {
    if (field === 'isDuplicate' || field === 'isManual') {
      this.tableFilter[field] = null;
    } else {
      this.tableFilter[field] = '';
    }
    this.applyTableFilters();
  }

  copyToClipboard(text: string, event: Event): void {
    event.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      // Small feedback could be added here
      console.log('Copied to clipboard:', text);
    });
  }

  openDetail(file: any): void {
    this.selectedFile = file;
    this.showDetailPanel = true;
    this.selectedFileHeaders = [];
    this.headersLoading = true;
    this.isAiLoading = false;
    this.aiExplanation = '';

    if (file.id) {
      this.svc.getFileHeaders(file.id).subscribe({
        next: (headers) => {
          this.selectedFileHeaders = headers;
          this.headersLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.headersLoading = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  openDetailAndAnalyze(file: any, event: Event): void {
    event.stopPropagation();
    this.openDetail(file);
    // Slight delay to allow the panel to open and loading state to visually register
    setTimeout(() => {
      this.analyzeFileWithAI();
    }, 300);
  }

  analyzeFileWithAI(): void {
    if (!this.selectedFile) return;
    this.isAiLoading = true;
    this.aiExplanation = '';
    this.cdr.markForCheck();

    const wf = this.selectedFile.workflowId || 'non spécifié';
    const contrat = this.selectedFile.passedContractIdentifier || 'aucun contrat';
    const nbHeaders = this.selectedFileHeaders?.length || 0;
    
    // Le mot clé GREETINGS force le Python à ne pas exécuter de SQL, 
    // mais à juste répondre de manière conversationnelle !
    const prompt = `GREETINGS: Agis comme un expert EAI. Je consulte le fichier ID ${this.selectedFile.id}. Workflow: ${wf}. Contrat: ${contrat}. Ce fichier a ${nbHeaders} balises EAI Headers attachées. Fais-moi une petite synthèse de 2 phrases maximum pour expliquer à un métier si ce fichier est bien qualifié ou s'il manque des choses critiques. Ne fais pas de code.`;

    this.aiSvc.askQuestion({ question: prompt }).subscribe({
      next: (res) => {
        this.isAiLoading = false;
        this.aiExplanation = res.answer || "L'IA n'a pas pu formuler de réponse claire.";
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isAiLoading = false;
        this.aiExplanation = "Désolé, l'IA est injoignable pour le moment.";
        this.cdr.markForCheck();
      }
    });
  }

  closeDetail(): void {
    this.showDetailPanel = false;
    this.selectedFile = null;
    this.selectedFileHeaders = [];
  }

  getWorkflowMax(): number { return Math.max(...this.topWorkflows.map((w: any) => w.total), 1); }
  getContractMax(): number { return Math.max(...this.topContracts.map((c: any) => c.total), 1); }

  getDupColor(rate: number): string {
    if (rate > 10) return '#f43f5e';
    if (rate > 3) return '#f59e0b';
    return '#10b981';
  }
}
