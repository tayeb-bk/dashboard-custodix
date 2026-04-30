import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Flow } from '../../services/flow';
import { NgApexchartsModule } from "ng-apexcharts";
import {
  ApexAxisChartSeries,
  ApexNonAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexStroke,
  ApexDataLabels,
  ApexTooltip,
  ApexPlotOptions,
  ApexYAxis,
  ApexGrid,
  ApexFill,
  ApexLegend,
  ApexResponsive,
  ApexAnnotations
} from "ng-apexcharts";
import { FormsModule } from '@angular/forms';
import { NonPassiveWheelDirective } from '../overview/non-passive-wheel.directive';

const SLA_THRESHOLD_MIN = 30;

// Règles du scoring IA (exportées pour affichage dans la carte détail)
export const SCORING_RULES: Array<{ label: string; statuses: string[]; flowTypes?: string[]; points: number; description: string }> = [
  {
    label: 'Statut critique',
    statuses: ['InTechnicalError', 'Blocked', 'InBusinessError', 'Rejected', 'InitiationFailed', 'Nacked', 'SubWorkflowInTechnicalError'],
    points: 60,
    description: 'Flux en erreur technique, bloqué ou rejeté — intervention immédiate requise'
  },
  {
    label: 'Statut à surveiller',
    statuses: ['WaitAction', 'WaitProcessing', 'InitiationError', 'NoContractFound', 'MarkedForSuspension'],
    points: 30,
    description: 'Flux en attente d\'action ou de traitement — surveillance recommandée'
  },
  {
    label: 'Flux ancien non résolu',
    statuses: [],
    points: 20,
    description: 'Flux créé il y a plus de 24h sans atteindre un statut final — risque de blocage silencieux'
  },
  {
    label: 'Type de flux sensible (Swift/Generali)',
    statuses: [],
    flowTypes: [
      'FT_MT502', 'FT_MT546', 'FT_MT509', 'FT_MT544', 
      'FT_MT545', 'FT_MT547', 'FT_MT515', 'GENERALI_MT535_FT', 
      'GENERALI_MT566_FT', 'GENERALI_MX515_FT', 'GENERALI_MT515_FT', 
      'MT54x'
    ],
    points: 20,
    description: 'Flux de type Swift (MT/MX) ou Generali identifié comme sensible, nécessitant une priorité plus élevée'
  }
];

@Component({
  selector: 'app-flow-flow',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, FormsModule, NonPassiveWheelDirective],
  templateUrl: './flow-flow.component.html',
  styleUrl: './flow-flow.component.css'
})
export class FlowFlowComponent implements OnInit {

  // ===== KPI Summary =====
  kpiSummary: { total: number; bloques: number; tauxErreur: number; leadTime: number } | null = null;
  slaBadge: { label: string; css: string } = { label: '—', css: 'ok' };
  currentPeriodAvg: number = 0;
  selectedPointValue: number | null = null;
  selectedPointDate: string | null = null;

  // Popover explicatif pour chaque KPI card
  activeKpiCard: string | null = null;
  readonly kpiInfo: Record<string, { title: string; icon: string; what: string; how: string; action: string }> = {
    total: {
      title: 'Total Flux',
      icon: '📊',
      what: 'Nombre total de flux financiers enregistrés dans la base Oracle (table FLOW_FLOW).',
      how: 'Calculé avec COUNT(*) sur l’ensemble de la table FLOW_FLOW du schéma UCUSTOI0.',
      action: 'Sert de référence de volume pour tous les autres indicateurs. Une variation anormale peut indiquer un problème d’alimentation.'
    },
    bloques: {
      title: 'Flux Bloqués',
      icon: '🚨',
      what: 'Nombre de flux actuellement en état critique ou bloqué nécessitant une intervention humaine immédiate.',
      how: 'Somme des flux dont le statut est : InTechnicalError, Blocked, Rejected, InBusinessError, InitiationError, InitiationFailed, Nacked.',
      action: 'Si ce chiffre est supérieur à 0, une action urgente est requise. Cliquez sur Score IA dans le tableau pour identifier les flux concernés.'
    },
    taux: {
      title: 'Taux d’Erreur',
      icon: '⚠️',
      what: 'Pourcentage des flux en état d’erreur par rapport au volume total de la plateforme.',
      how: 'Calculé par : (Flux bloqués / Total flux) × 100. Seuil vert ≤ 5%, orange 5-15%, rouge > 15%.',
      action: 'Un taux supérieur à 15% indique une anomalie systémique. Déclencher une investigation sur les routes les plus chargées.'
    },
    leadtime: {
      title: 'Lead Time Moyen',
      icon: '⏱️',
      what: 'Temps moyen écoulé entre la création et la mise à jour d’un flux (temps de traitement bout-en-bout).',
      how: 'Calculé par : AVG(UPDATEDATE_ - CREATIONDATE_) × 24 × 60, exprimé en minutes. SLA fixé à 30 minutes.',
      action: 'Si le lead time dépasse 30 min, la plateforme ne respecte plus son SLA. Identifier les routes lentes via le graphique Lead Time.'
    },
    timeline: {
      title: 'Évolution Temporelle des Flux',
      icon: '📈',
      what: 'Affiche la dynamique et la tendance d\'apparition des flux pour un statut précis sur la période sélectionnée.',
      how: 'Regroupe et agrège les flux par intervalles de temps dynamiques (heures ou jours selon la période).',
      action: 'Cliquez sur le graphique "Volume par Statut" ci-dessous pour changer le statut analysé ici (ex: analysez les pics d\'erreurs).'
    },
    volume: {
      title: 'Volume par Statut',
      icon: '💰',
      what: 'Répartition du volume global des flux selon leur état actuel de traitement.',
      how: 'Agrégation des flux par statut. Les statuts mineurs sont regroupés sous "Autre" pour plus de lisibilité.',
      action: 'Cliquez sur un segment pour filtrer la timeline. Cliquez sur "Autre" pour voir le détail des statuts regroupés.'
    },
    routes: {
      title: 'Top 5 Routes',
      icon: '🛤️',
      what: 'Identification des 5 routes les plus actives ou critiques selon le mode choisi (Volume, Erreurs ou Délai).',
      how: 'Analyse des chemins Sender ➜ Receiver via les IDs de route. Les sparklines montrent la tendance sur 24h.',
      action: 'Cliquez sur une carte de route pour filtrer instantanément la timeline et analyser son comportement spécifique.'
    },
    flowtype: {
      title: 'Répartition par Type de Flux',
      icon: '🔀',
      what: 'Analyse volumétrique des flux financiers regroupés par leur nature technique (FlowType).',
      how: 'Agrégation automatique des flux par type. Les noms techniques sont simplifiés pour une meilleure lisibilité.',
      action: 'Détecter une suractivité inhabituelle sur un canal spécifique ou optimiser la gestion des types de flux dominants.'
    },
    leadtime_trends: {
      title: 'Performance & Respect SLA',
      icon: '⏱️',
      what: 'Analyse de la réactivité bout-en-bout de la plateforme (Délai moyen de traitement quotidien).',
      how: 'Calcul du temps écoulé entre la création et l\'état final. La ligne rouge (30 min) représente notre engagement de qualité contractuel (SLA).',
      action: 'Garantir la fluidité des échanges et prouver le respect des contrats de service. Un délai stable est le signe d\'une infrastructure saine.'
    }
  };

  toggleKpiCard(key: string, event: Event) {
    event.stopPropagation();
    this.activeKpiCard = this.activeKpiCard === key ? null : key;
  }

  // ===== Volume Donut Grouping =====
  volumeOtherDetails: { label: string; value: number; percentage: number }[] = [];
  showVolumeOther = false;
  selectedOtherStatus: string | null = null;

  closeKpiCard() { this.activeKpiCard = null; }

  // ===== Timeline =====
  timelineSeries: ApexAxisChartSeries = [];
  timelineChart!: ApexChart;
  timelineXAxis!: ApexXAxis;
  timelineStroke!: ApexStroke;
  timelineDataLabels!: ApexDataLabels;
  timelineTooltip!: ApexTooltip;
  timelineAnnotations!: ApexAnnotations;
  timelineColors: string[] = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#f43f5e', '#14b8a6', '#64748b', '#ec4899', '#3b82f6'];

  // ===== Filtres Timeline =====
  statusList: string[] = [
    'Processed', 'Sent', 'SubWorkflowInTechnicalError', 'WaitProcessing', 'Initial', 'Init',
    'WaitToBeSent', 'InTechnicalError', 'NoContractFound', 'InitiationError', 'Rejected',
    'InitiationFailed', 'InProcess', 'WaitAction', 'MarkedForSuspension', 'SubWorkflowInProcess',
    'InBusinessError', 'PutInQueueFailed', 'Blocked', 'Initiated', 'Acked', 'SentAndWaitingAck',
    'Nacked', 'Canceled'
  ];
  selectedStatus = 'Processed';
  selectedBucket = 'auto';
  fromDate = '';
  toDate = '';
  maxDate = '';
  selectedRouteId: string | null = null;
  selectedSender: string = '';
  timelineSenders: string[] = [];

  resetTimelineFilters() {
    this.selectedBucket = 'auto';
    this.fromDate = '';
    this.toDate = '';
    this.selectedRouteId = null;
    this.selectedSender = '';
    this.loadTimeline();
  }

  // ===== Flow Type Chart (Horizontal Bars) =====
  flowTypeSeries: any[] = [];
  showAllFlowTypes = false;
  flowTypeChart: any = {
    type: 'bar', height: 450, toolbar: { show: false },
    zoom: { enabled: false }, // Crucial : désactiver le zoom pour libérer la molette
    pan: { enabled: false }   // Crucial : désactiver le pan
  };
  flowTypePlotOptions: any = {
    bar: {
      horizontal: true,
      borderRadius: 4,
      barHeight: '70%',
      distributed: true, // Une couleur différente par barre
      dataLabels: { position: 'top' }
    }
  };
  flowTypeDataLabels: any = {
    enabled: true,
    textAnchor: 'start',
    style: { colors: ['#fff'], fontSize: '11px', fontWeight: 600 },
    formatter: (val: any, opt: any) => opt.w.globals.labels[opt.dataPointIndex],
    offsetX: 10
  };
  flowTypeXAxis: any = {
    categories: [],
    labels: { style: { colors: '#64748b' }, formatter: (val: any) => this.kFormat(val) },
    axisBorder: { show: false }
  };
  flowTypeYAxis: any = {
    labels: {
      show: true,
      style: { colors: '#94a3b8', fontSize: '12px', fontWeight: 500 }
    }
  };
  flowTypeFill: any = {
    type: 'solid',
    opacity: 0.85,
    colors: ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#f43f5e', '#14b8a6', '#64748b']
  };
  flowTypeTooltip: any = {
    theme: 'dark',
    y: { formatter: (val: any) => val.toLocaleString('fr-FR') + ' flux' }
  };

  // ===== Volume Donut =====
  volumeSeries: ApexNonAxisChartSeries = [];
  volumeLabels: string[] = [];
  volumeChart: ApexChart = {
    type: 'donut', height: 420,
    events: {
      dataPointSelection: (_e: any, _c: any, config: any) => {
        const s = config.w.config.labels[config.dataPointIndex];
        if (s === 'Autre') {
          this.showVolumeOther = !this.showVolumeOther;
        } else if (s && s !== this.selectedStatus) {
          this.selectedStatus = s;
          this.showVolumeOther = false;
          this.loadTimeline();
        }
      }
    }
  };
  volumeLegend: ApexLegend = {
    position: 'bottom', fontSize: '12px',
    labels: { colors: '#64748b' },
    markers: { size: 6, shape: 'circle' as any }
  };
  volumeResponsive: ApexResponsive[] = [
    { breakpoint: 480, options: { chart: { height: 260 }, legend: { position: 'bottom' } } }
  ];
  volumeColors = ['#10b981', '#e11d48', '#3b82f6', '#94a3b8'];
  volumePlotOptions: ApexPlotOptions = {
    pie: {
      donut: {
        size: '70%',
        labels: {
          show: true,
          name: { show: true, fontSize: '16px', fontWeight: 600, color: '#64748b', offsetY: -12 },
          value: { show: true, fontSize: '28px', fontWeight: 800, color: '#1e293b', offsetY: 12 },
          total: {
            show: true, label: 'Total Flux', fontSize: '14px', color: '#94a3b8',
            formatter: (w) => w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0).toLocaleString('fr-FR')
          }
        }
      }
    }
  };

  volumeStroke: ApexStroke = {
    show: true,
    width: 2,
    colors: ['#ffffff']
  };

  volumeFill: ApexFill = {
    type: 'gradient',
    gradient: {
      shade: 'light',
      type: 'horizontal',
      shadeIntensity: 0.2,
      opacityFrom: 0.95,
      opacityTo: 1,
      stops: [0, 100]
    }
  };

  selectOtherStatus(item: { label: string, value: number, percentage: number }) {
    this.selectedOtherStatus = item.label;

    // Mettre à jour le label central du donut
    this.volumePlotOptions = {
      ...this.volumePlotOptions,
      pie: {
        ...this.volumePlotOptions.pie,
        donut: {
          ...this.volumePlotOptions.pie?.donut,
          labels: {
            ...this.volumePlotOptions.pie?.donut?.labels,
            total: {
              ...this.volumePlotOptions.pie?.donut?.labels?.total,
              show: true,
              label: item.label,
              formatter: () => `${item.percentage.toFixed(1)}%`
            }
          }
        }
      }
    };

    // Charger la timeline pour ce statut précis
    this.selectedStatus = item.label;
    this.loadTimeline();
  }

  resetVolumeDonutLabel() {
    this.selectedOtherStatus = null;
    this.volumePlotOptions = {
      ...this.volumePlotOptions,
      pie: {
        ...this.volumePlotOptions.pie,
        donut: {
          ...this.volumePlotOptions.pie?.donut,
          labels: {
            ...this.volumePlotOptions.pie?.donut?.labels,
            total: {
              ...this.volumePlotOptions.pie?.donut?.labels?.total,
              label: 'Total Flux',
              formatter: (w) => w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0).toLocaleString('fr-FR')
            }
          }
        }
      }
    };
  }

  // ===== Top Routes =====
  routeMode: 'volume' | 'amount' | 'errors' | 'leadtime' = 'volume';
  topRoutesData: any[] = [];
  topRoutesSeries: ApexAxisChartSeries = [{ name: 'Nombre de flux', data: [] }];

  sparklineChart: ApexChart = { type: 'area', height: 35, sparkline: { enabled: true } };
  sparklineStroke: ApexStroke = { curve: 'smooth', width: 2 };
  sparklineTooltip: ApexTooltip = { fixed: { enabled: false } };
  topRoutesChart: ApexChart = {
    type: 'bar', height: 260, toolbar: { show: false },
    events: {
      dataPointSelection: (event, chartContext, config) => {
        const routeId = config.w.config.xaxis.categories[config.dataPointIndex];
        this.selectRoute(routeId);
      }
    }
  };
  topRoutesLegend: ApexLegend = { show: false };
  topRoutesYAxis: ApexYAxis = { labels: { show: false } };
  topRoutesXAxis: ApexXAxis = {
    categories: [],
    labels: { show: false }, // Masquer les labels répétitifs car on a les cards
    axisBorder: { show: false },
    axisTicks: { show: false }
  };
  topRoutesPlotOptions: ApexPlotOptions = { bar: { horizontal: true, borderRadius: 6, distributed: true, barHeight: '60%' } };
  topRoutesDataLabels: ApexDataLabels = {
    enabled: true, style: { colors: ['#fff'], fontSize: '11px', fontWeight: 700 },
    formatter: (val: any) => this.kFormat(val)
  };
  topRoutesFill: ApexFill = { colors: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'] };
  topRoutesTooltip: ApexTooltip = { y: { formatter: (val: any) => val.toLocaleString('fr-FR') + ' flux' } };

  // ===== Lead Time =====
  leadTimeSeries: ApexAxisChartSeries = [{ name: 'Lead Time Moy. (min)', data: [] }];
  leadTimeChart: ApexChart = {
    type: 'area', height: 260,
    toolbar: { show: true, tools: { download: false, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
    zoom: { enabled: true, type: 'x' },
    events: {
      mouseMove: (event, chartContext, config) => {
        const idx = config.dataPointIndex;
        if (idx !== -1 && this.leadTimeSeries[0]?.data?.[idx]) {
          const point: any = this.leadTimeSeries[0].data[idx];
          this.selectedPointValue = point.y;
          this.selectedPointDate = new Date(point.x).toLocaleDateString('fr-FR');
          this.cd.detectChanges(); // Forcer la mise à jour de la vue
        }
      },
      mouseLeave: () => {
        this.selectedPointValue = null;
        this.selectedPointDate = null;
        this.cd.detectChanges();
      }
    }
  };
  leadTimeMarkers: any = {
    size: 0,
    hover: { size: 6, sizeOffset: 3 }
  };
  leadTimeXAxis: ApexXAxis = { type: 'datetime', labels: { style: { colors: '#94a3b8', fontSize: '11px' } } };
  leadTimeStroke: ApexStroke = { curve: 'smooth', width: 3 };
  leadTimeDataLabels: ApexDataLabels = { enabled: false };
  leadTimeYAxis: ApexYAxis = { labels: { formatter: (val: number) => val != null ? val.toFixed(0) + ' min' : '' } };
  leadTimeFill: ApexFill = { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.03, stops: [0, 100] } };
  leadTimeTooltip: ApexTooltip = { x: { format: 'dd/MM/yyyy' }, y: { formatter: (val: any) => val.toFixed(1) + ' min' } };
  leadTimeAnnotations: ApexAnnotations = {
    yaxis: [{
      y: SLA_THRESHOLD_MIN, borderColor: '#ef4444', borderWidth: 2, strokeDashArray: 5,
      label: { text: 'SLA 30 min', style: { color: '#ef4444', background: 'rgba(239,68,68,0.08)', fontSize: '11px', fontWeight: 700 } }
    }]
  };

  // ===== TABLEAU PAGINÉ avec filtres =====
  tableFlows: any[] = [];
  tableLoading = false;
  tablePage = 0;
  tableSize = 20;
  tableTotalElements = 0;
  tableTotalPages = 0;

  // Filtres du tableau (indépendants des filtres timeline)
  tableFilterStatus = '';
  tableFilterType = '';
  tableFilterFlowType = '';
  tableFilterFrom = '';
  tableFilterTo = '';
  tableFilterScore = ''; // 'critique' | 'vigilance' | 'ok' | ''

  // Listes pour les selects du tableau
  allTypesList: string[] = [];
  allFlowTypesList: string[] = [];

  // ===== CARTE DÉTAIL =====
  selectedFlow: any = null;
  selectedFlowScore: { score: number; label: string; level: string; breakdown: any[] } | null = null;
  detailPanelOpen = false;

  constructor(private flowService: Flow, private cd: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.maxDate = this.toLocalInputValue(new Date());
    this.initChart();

    // KPI Summary
    this.flowService.getKpiSummary().subscribe(data => {
      if (data && data[0]) {
        const row = data[0];
        const total = Number(row[0]) || 0;
        const bloques = Number(row[1]) || 0;
        const taux = Number(row[2]) || 0;
        const leadTime = Number(row[3]) || 0;
        this.kpiSummary = { total, bloques, tauxErreur: taux, leadTime };
        this.slaBadge = leadTime <= SLA_THRESHOLD_MIN
          ? { label: `✅ SLA OK (${leadTime.toFixed(1)} min)`, css: 'ok' }
          : { label: `⚠️ Dépassé (${leadTime.toFixed(1)} min)`, css: leadTime > 60 ? 'danger' : 'warning' };
      }
    });

    // Charger les listes pour les filtres du tableau
    this.flowService.getStatsByStatus().subscribe(data => {
      this.statusList = data.map(d => d[0]);
      this.selectedStatus = this.statusList[0] || 'Processed';
    });

    this.flowService.getStatsByRealType().subscribe(data => {
      this.allTypesList = data.map(d => d[0]).filter(Boolean);
    });

    // Charts
    this.flowService.getFinancialVolumeByStatus().subscribe(data => this.loadVolumeChart(data));
    this.flowService.getTopRoutes().subscribe(data => this.loadTopRoutesChart(data));
    this.flowService.getLeadTimeTrends().subscribe(data => this.loadLeadTimeChart(data));
    this.loadFlowType();
    this.loadTimeline();

    // Tableau paginé
    this.loadTablePage();
  }

  // ===== Timeline =====
  loadTimeline() {
    const params: any = { status: this.selectedStatus, bucket: this.selectedBucket };
    if (this.fromDate) params.from = this.fromDate;
    if (this.toDate) params.to = this.toDate;
    if (this.selectedRouteId) params.routeId = this.selectedRouteId;
    if (this.selectedSender) params.sender = this.selectedSender;

    this.flowService.getTimeline(params).subscribe(data => {
      const rawData = data || [];
      
      // Extraction des dates uniques pour le padding
      const allDates = Array.from(new Set(rawData.map(d => new Date(d.bucket).getTime()))).sort((a, b) => a - b);
      
      // Extraction des expéditeurs uniques et regroupement
      const sendersMap = new Map<string, { x: number, y: number }[]>();
      
      // Mettre à jour la liste des expéditeurs pour le filtre (uniquement s'il n'y a pas de filtre expéditeur actif)
      if (!this.selectedSender) {
        this.timelineSenders = Array.from(new Set(rawData.map(d => d.category || 'Inconnu'))).sort();
      }

      rawData.forEach(d => {
        const sender = d.category || 'Inconnu';
        if (!sendersMap.has(sender)) {
          // Initialiser avec des 0 pour toutes les dates pour éviter les bugs du stacked area d'ApexCharts
          const emptyPadding = allDates.map(date => ({ x: date, y: 0 }));
          sendersMap.set(sender, emptyPadding);
        }
        
        const timestamp = new Date(d.bucket).getTime();
        const senderData = sendersMap.get(sender);
        if (senderData) {
          const point = senderData.find(p => p.x === timestamp);
          if (point) point.y = d.total;
        }
      });

      // Si top > 10 senders, on regroupe les petits dans "Autres" pour la lisibilité
      let finalSeries: any[] = [];
      if (sendersMap.size > 10 && !this.selectedSender) {
        const sortedSenders = Array.from(sendersMap.entries()).map(([name, data]) => {
          return { name, data, sum: data.reduce((acc, p) => acc + p.y, 0) };
        }).sort((a, b) => b.sum - a.sum);

        const top10 = sortedSenders.slice(0, 9);
        const others = sortedSenders.slice(9);

        finalSeries = top10.map(s => ({ name: s.name, data: s.data }));
        
        if (others.length > 0) {
          const othersData = allDates.map(date => {
            const sumForDate = others.reduce((acc, s) => {
              const p = s.data.find(dp => dp.x === date);
              return acc + (p ? p.y : 0);
            }, 0);
            return { x: date, y: sumForDate };
          });
          finalSeries.push({ name: 'Autres', data: othersData });
        }
      } else {
        finalSeries = Array.from(sendersMap.entries()).map(([name, data]) => ({ name, data }));
      }

      // Si aucune donnée, insérer une série vide
      if (finalSeries.length === 0) {
        finalSeries = [{ name: 'Flux', data: [] }];
      }

      this.timelineSeries = finalSeries;

      // Calcul de la moyenne globale pour l'annotation
      let avg = 0;
      if (allDates.length > 0) {
        const totalSum = rawData.reduce((acc, p) => acc + p.total, 0);
        avg = Math.round(totalSum / allDates.length);
      }
      
      this.timelineAnnotations = {
        yaxis: [{
          y: avg, borderColor: '#94a3b8', borderWidth: 1, strokeDashArray: 4,
          label: { text: `Moy. ${avg.toLocaleString('fr-FR')}`, style: { color: '#64748b', background: 'rgba(148,163,184,0.1)', fontSize: '11px' } }
        }]
      };
    });
    this.loadFlowType();
  }

  loadFlowType() {
    this.flowService.getStatsByType().subscribe(data => {
      let raw = (data || []).filter(d => d && d[0] != null && d[1] != null)
        .sort((a, b) => b[1] - a[1]);

      let finalData: any[] = [];

      if (this.showAllFlowTypes) {
        finalData = raw;
      } else {
        // Regroupement "Autres" pour les types < 1% du total
        const total = raw.reduce((sum, d) => sum + d[1], 0);
        const threshold = total * 0.01; // 1%

        const top = raw.filter(d => d[1] >= threshold).slice(0, 8);
        const others = raw.filter(d => d[1] < threshold || !top.includes(d));

        finalData = [...top];
        if (others.length > 0) {
          const othersSum = others.reduce((sum, d) => sum + d[1], 0);
          finalData.push(['Autres Types', othersSum]);
        }
      }

      const labels = finalData.map(d => this.formatType(d[0]));
      const values = finalData.map(d => d[1]);

      this.flowTypeSeries = [{ name: 'Flux', data: values }];
      this.flowTypeXAxis = { ...this.flowTypeXAxis, categories: labels };
      this.allFlowTypesList = raw.map(d => d[0]).filter(Boolean);

      // Ajuster la hauteur du contenu interne
      const chartHeight = Math.max(300, finalData.length * 40 + 60);
      this.flowTypeChart = { ...this.flowTypeChart, height: chartHeight };
    });
  }

  toggleFlowTypeView() {
    this.showAllFlowTypes = !this.showAllFlowTypes;
    this.loadFlowType();
  }

  loadVolumeChart(data: any[]) {
    const raw = (data || []).filter(d => d && d[0] != null);

    // Top 3 à garder
    const topLabels = ['Processed', 'Blocked', 'Sent'];
    const seriesMap: Record<string, number> = {};
    const otherDetails: { label: string, value: number }[] = [];

    let totalOther = 0;
    let totalAll = 0;

    raw.forEach(d => {
      const label = String(d[0]);
      const amount = d[1] != null ? Number(d[1]) : null;
      const count = d[2] != null ? Number(d[2]) : 0;
      const value = amount !== null && amount > 0 ? amount : count;

      totalAll += value;

      if (topLabels.includes(label)) {
        seriesMap[label] = value;
      } else {
        totalOther += value;
        otherDetails.push({ label, value });
      }
    });

    // Construire les séries finales
    const finalLabels: string[] = [];
    const finalSeries: number[] = [];
    const finalColors: string[] = [];

    // Ajouter les Top 3 (même si 0 pour garder l'ordre)
    const colorMap: Record<string, string> = {
      'Processed': '#10b981',
      'Blocked': '#ef4444',
      'Sent': '#6366f1',
      'Autre': '#94a3b8'
    };

    topLabels.forEach(label => {
      if (seriesMap[label] > 0) {
        finalLabels.push(label);
        finalSeries.push(seriesMap[label]);
        finalColors.push(colorMap[label]);
      }
    });

    // Ajouter "Autre"
    if (totalOther > 0) {
      finalLabels.push('Autre');
      finalSeries.push(totalOther);
      finalColors.push(colorMap['Autre']);

      // Détails de "Autre" triés par importance
      this.volumeOtherDetails = otherDetails
        .sort((a, b) => b.value - a.value)
        .map(d => ({
          ...d,
          percentage: totalAll > 0 ? (d.value / totalAll) * 100 : 0
        }));
    } else {
      this.volumeOtherDetails = [];
      this.showVolumeOther = false;
    }

    this.volumeLabels = finalLabels;
    this.volumeSeries = finalSeries;
    this.volumeColors = finalColors;
    this.resetVolumeDonutLabel();
  }

  loadTopRoutesChart(data: any[]) {
    // Ordre de la requête native : 
    // 0:sender, 1:receiver, 2:routeId, 3:totalAmount, 4:totalCount, 5:errorCount, 6:avgLeadTime
    this.topRoutesData = (data || []).map(d => ({
      sender: d[0] || 'Inconnu',
      receiver: d[1] || 'Inconnu',
      routeId: d[2] || 'Sans ID',
      amount: Number(d[3]) || 0,
      count: Number(d[4]) || 0,
      errors: Number(d[5]) || 0,
      leadTime: Number(d[6]) || 0,
      sparklineSeries: [{ name: 'Tendance', data: [] }] as ApexAxisChartSeries
    }));

    // Charger les sparklines pour chaque route
    this.topRoutesData.forEach(route => {
      this.flowService.getTimeline({ status: this.selectedStatus, routeId: route.routeId, bucket: 'hour' }).subscribe(history => {
        const points = (history || []).map((h: any) => h.total);
        route.sparklineSeries = [{ name: 'Volume', data: points }];
      });
    });

    this.updateRouteChartDisplay();
  }

  updateRouteChartDisplay() {
    // On trie dynamiquement selon le mode choisi
    const sorted = [...this.topRoutesData].sort((a, b) => {
      if (this.routeMode === 'amount') return b.amount - a.amount;
      if (this.routeMode === 'errors') return b.errors - a.errors;
      if (this.routeMode === 'leadtime') return b.leadTime - a.leadTime;
      return b.count - a.count;
    }).slice(0, 5);

    // Mise à jour de l'ancien graphique (pour compatibilité temporaire ou si on le garde)
    const categories = sorted.map(d => d.routeId);
    const seriesData = sorted.map(d => {
      if (this.routeMode === 'amount') return d.amount;
      if (this.routeMode === 'errors') return d.errors;
      if (this.routeMode === 'leadtime') return d.leadTime;
      return d.count;
    });

    this.topRoutesXAxis = { ...this.topRoutesXAxis, categories };
    this.topRoutesSeries = [{
      name: this.routeMode === 'amount' ? 'Montant (€)' : this.routeMode === 'errors' ? 'Erreurs' : this.routeMode === 'leadtime' ? 'Lead Time (min)' : 'Volume',
      data: seriesData
    }];
  }

  changeRouteMode(mode: 'volume' | 'errors' | 'leadtime') {
    this.routeMode = mode;
    this.updateRouteChartDisplay();
  }

  selectRoute(routeId: string) {
    if (this.selectedRouteId === routeId) {
      this.selectedRouteId = null; // Toggle off if clicked again
    } else {
      this.selectedRouteId = routeId;
    }
    this.loadTimeline();
  }

  loadLeadTimeChart(data: any[]) {
    const seriesData = (data || []).filter(d => d && d[0] && d[1] != null)
      .map(d => ({ x: new Date(d[0]).getTime(), y: parseFloat(Number(d[1]).toFixed(2)) }));
    this.leadTimeSeries = [{ name: 'Lead Time Moy. (min)', data: [...seriesData] }];

    // Calcul de la moyenne sur la période affichée
    if (seriesData.length > 0) {
      const sum = seriesData.reduce((acc, point) => acc + point.y, 0);
      this.currentPeriodAvg = sum / seriesData.length;
    } else {
      this.currentPeriodAvg = 0;
    }
  }

  reloadLeadTime() {
    this.flowService.getLeadTimeTrends().subscribe(data => this.loadLeadTimeChart(data));

    // Rafraîchir aussi le résumé KPI global pour la cohérence
    this.flowService.getKpiSummary().subscribe(data => {
      if (data && data[0]) {
        const row = data[0];
        this.kpiSummary = {
          total: Number(row[0]),
          bloques: Number(row[1]),
          tauxErreur: Number(row[2]),
          leadTime: Number(row[3])
        };
      }
    });
  }

  // ===== Tableau Paginé =====
  loadTablePage() {
    this.tableLoading = true;
    this.tableFlows = []; // Vider le tableau pour ne pas garder de vieilles données
    const params: any = {
      page: this.tablePage,
      size: this.tableSize
    };
    if (this.tableFilterStatus) params.status = this.tableFilterStatus;
    if (this.tableFilterType) params.type = this.tableFilterType;
    if (this.tableFilterFlowType) params.flowType = this.tableFilterFlowType;
    if (this.tableFilterFrom) params.from = this.tableFilterFrom;
    if (this.tableFilterTo) params.to = this.tableFilterTo;
    if (this.tableFilterScore) params.scoreLevel = this.tableFilterScore;

    this.flowService.getFlowsPaginated(params).subscribe({
      next: (page: any) => {
        let content = page.content || [];

        this.tableFlows = content;
        this.tableTotalElements = page.totalElements || 0;
        this.tableTotalPages = page.totalPages || 0;
        this.tableLoading = false;
      },
      error: (err) => {
        console.error("Erreur de pagination:", err);
        this.tableLoading = false;
        this.tableFlows = [];
      }
    });
  }

  applyTableFilters() {
    this.tablePage = 0;
    this.loadTablePage();
    this.closeDetail();
  }

  resetTableFilters() {
    this.tableFilterStatus = '';
    this.tableFilterType = '';
    this.tableFilterFlowType = '';
    this.tableFilterFrom = '';
    this.tableFilterTo = '';
    this.tableFilterScore = '';
    this.tablePage = 0;
    this.loadTablePage();
    this.closeDetail();
  }

  prevTablePage() { if (this.tablePage > 0) { this.tablePage--; this.loadTablePage(); } }
  nextTablePage() { if (this.tablePage < this.tableTotalPages - 1) { this.tablePage++; this.loadTablePage(); } }

  get tablePageStart() { return this.tablePage * this.tableSize + 1; }
  get tablePageEnd() { return Math.min((this.tablePage + 1) * this.tableSize, this.tableTotalElements); }

  // ===== Carte Détail =====
  openDetail(flow: any) {
    this.selectedFlow = flow;
    this.selectedFlowScore = this.getCriticalityScoreDetailed(flow);
    this.detailPanelOpen = true;
  }

  closeDetail() {
    this.detailPanelOpen = false;
    this.selectedFlow = null;
    this.selectedFlowScore = null;
  }

  // ===== IA Scoring =====
  getCriticalityScore(flow: any): { score: number; label: string; level: string } {
    const result = this.getCriticalityScoreDetailed(flow);
    return { score: result.score, label: result.label, level: result.level };
  }

  getCriticalityScoreDetailed(flow: any): { score: number; label: string; level: string; breakdown: any[] } {
    const okStatuses = ['Processed', 'Sent', 'Acked', 'SentAndWaitingAck', 'Initiated', 'Completed', 'Canceled'];

    if (okStatuses.includes(flow.status)) {
      return { score: 0, label: 'OK', level: 'ok', breakdown: [{ rule: 'Statut final', points: 0, applied: false, description: 'Flux terminé correctement' }] };
    }

    const breakdown: any[] = [];
    let score = 0;

    // Règle 1 : Statut critique
    const criticalStatuses = SCORING_RULES[0].statuses;
    const isC = criticalStatuses.includes(flow.status);
    breakdown.push({ rule: SCORING_RULES[0].label, points: SCORING_RULES[0].points, applied: isC, description: SCORING_RULES[0].description });
    if (isC) score += SCORING_RULES[0].points;

    // Règle 2 : Statut à surveiller
    const warningStatuses = SCORING_RULES[1].statuses;
    const isW = !isC && warningStatuses.includes(flow.status);
    breakdown.push({ rule: SCORING_RULES[1].label, points: SCORING_RULES[1].points, applied: isW, description: SCORING_RULES[1].description });
    if (isW) score += SCORING_RULES[1].points;

    // Règle 3 : Ancienneté
    let ageOld = false;
    if (flow.creationDate) {
      const ageH = (Date.now() - new Date(flow.creationDate).getTime()) / 3_600_000;
      ageOld = ageH > 24;
    }
    breakdown.push({ rule: SCORING_RULES[2].label, points: SCORING_RULES[2].points, applied: ageOld, description: SCORING_RULES[2].description });
    if (ageOld) score += SCORING_RULES[2].points;

    // Règle 4 : Type de flux (Sensible)
    const sensitiveFlowTypes = SCORING_RULES[3].flowTypes;
    const isSensitiveType = !!flow.flowTypeName && (sensitiveFlowTypes?.includes(flow.flowTypeName) ?? false);
    
    breakdown.push({ 
      rule: SCORING_RULES[3].label, 
      points: SCORING_RULES[3].points, 
      applied: isSensitiveType, 
      description: SCORING_RULES[3].description 
    });
    if (isSensitiveType) score += SCORING_RULES[3].points;

    const level = score >= 50 ? 'critique' : score >= 20 ? 'vigilance' : 'ok';
    const label = score >= 50 ? 'CRITIQUE' : score >= 20 ? 'VIGILANCE' : 'OK';
    return { score, label, level, breakdown };
  }

  // ===== Helpers =====
  getStatusCss(status: string): string {
    const ok = ['Processed', 'Sent', 'Acked', 'SentAndWaitingAck', 'Initiated', 'Completed'];
    const error = ['InTechnicalError', 'Blocked', 'Rejected', 'InBusinessError', 'InitiationFailed', 'Nacked', 'PutInQueueFailed', 'Canceled', 'SubWorkflowInTechnicalError'];
    const warning = ['WaitAction', 'WaitProcessing', 'InitiationError', 'NoContractFound', 'MarkedForSuspension', 'SubWorkflowInProcess'];
    const proc = ['InProcess', 'WaitToBeSent', 'Init', 'Initial'];
    if (ok.includes(status)) return 'status-success';
    if (error.includes(status)) return 'status-error';
    if (warning.includes(status)) return 'status-warning';
    if (proc.includes(status)) return 'status-processing';
    return 'status-default';
  }

  // Permet de résumer ou raccourcir le nom du type de flux uniquement pour l'affichage dans le tableau
  formatType(type: string): string {
    if (!type) return '—';

    // Demande spécifique : conserver "flow.filein" et "flow.fileout"
    const typeLower = type.toLowerCase();
    if (typeLower.includes('flow.filein')) return 'flow.filein';
    if (typeLower.includes('flow.fileout')) return 'flow.fileout';

    // Si c'est un chemin complet, on garde juste la fin
    if (type.includes('.')) {
      const parts = type.split('.');
      return parts[parts.length - 1];
    }

    // Si le nom est très long, on le coupe
    return type.length > 25 ? type.substring(0, 22) + '...' : type;
  }

  kFormat(v: any): string {
    if (!v) return '0';
    return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v);
  }

  private initChart() {
    this.timelineChart = { type: 'area', stacked: true, height: 260, toolbar: { show: false } };
    this.timelineXAxis = { type: 'datetime', labels: { style: { colors: '#94a3b8' } } };
    this.timelineStroke = { curve: 'smooth', width: 3 };
    this.timelineDataLabels = { enabled: false };
    this.timelineTooltip = { x: { format: 'dd/MM/yyyy HH:mm' } };
    this.timelineAnnotations = { yaxis: [] };
  }

  private toLocalInputValue(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
