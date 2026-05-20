import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexAxisChartSeries, ApexNonAxisChartSeries, ApexChart, ApexXAxis,
  ApexStroke, ApexDataLabels, ApexTooltip, ApexFill, ApexLegend,
  ApexYAxis, ApexGrid, ApexAnnotations, ApexPlotOptions
} from 'ng-apexcharts';
import { NonPassiveWheelDirective } from '../overview/non-passive-wheel.directive';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-flow-fileout',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, NonPassiveWheelDirective],
  templateUrl: './flow-fileout.component.html',
  styleUrl: './flow-fileout.component.css'
})
export class FlowFileOutComponent implements OnInit {

  private readonly apiUrl = 'http://localhost:8080/api/expedition';

  // ===== Loading state =====
  isLoading = true;

  // ===== Widget 0 — Toggle sources de données =====
  showSources = false;

  /** Prototype sous W1 : masqué tant que les widgets ne sont pas reconstruits */
  showLegacyWidgets = false;


  // ===== Filtres page (W2 pilote, recalcul W1 + funnel) =====
  pageFilters = {
    contrat: '',
    from: '',
    to: '',
    ackOnly: false,
  };
  contratOptions: string[] = [];
  filtersActive = false;

  // ===== Widget 2 — Funnel =====
  funnelLoading = false;
  funnel = {
    recus: 0,
    fichiersLivres: 0,
    livraisons: 0,
    ackConfirmes: 0,
  };
  selectedFunnelStep: 'recus' | 'livres' | 'livraisons' | 'ack' | null = null;
  activeFunnelInfo: string | null = null;

  readonly funnelStepMeta: Record<string, {
    icon: string;
    label: string;
    unit: string;
    hint: string;
    popTitle: string;
    popRows: { key: string; text: string }[];
  }> = {
    recus: {
      icon: '📥',
      label: 'Fichiers reçus',
      unit: 'arrivées partenaires',
      hint: 'Tous les fichiers enregistrés à la réception (étape 1), sur vos filtres.',
      popTitle: 'Fichiers reçus',
      popRows: [
        { key: '📌 Quoi', text: 'Chaque ligne FLOW_FILEIN = un fichier qui entre dans Custodix.' },
        { key: '🧮 Calcul', text: 'COUNT(*) sur FLOW_FILEIN (dates et contrat appliqués).' },
        { key: '💡 Suite', text: 'Tous ne partent pas en livraison : une partie reste en traitement ou est filtrée.' },
      ],
    },
    livres: {
      icon: '📦',
      label: 'Fichiers livrés',
      unit: 'dossiers uniques partis',
      hint: 'Compte chaque fichier reçu une seule fois s’il a eu au moins un envoi.',
      popTitle: 'Fichier livré ≠ livraison',
      popRows: [
        { key: '📦 Fichier livré', text: '1 dossier reçu (FileIn) qui a été expédié au moins une fois. On le compte une seule fois.' },
        { key: '🧮 Calcul', text: 'COUNT(DISTINCT FILEIN_ID_) dans FLOW_FILEOUT — pas le nombre d’envois.' },
        { key: '💡 Exemple', text: '1 fichier reçu envoyé vers 3 destinations = 1 fichier livré, pas 3.' },
      ],
    },
    livraisons: {
      icon: '📤',
      label: 'Livraisons',
      unit: 'envois vers destinations',
      hint: 'Chaque envoi compte : un même fichier peut apparaître plusieurs fois.',
      popTitle: 'Livraison = un envoi',
      popRows: [
        { key: '📤 Livraison', text: '1 ligne FLOW_FILEOUT = 1 envoi physique vers une destination (canal de sortie).' },
        { key: '🧮 Calcul', text: 'COUNT(*) sur FLOW_FILEOUT (toutes les lignes, pas DISTINCT).' },
        { key: '💡 Exemple', text: '1 fichier livré vers 3 destinations = 3 livraisons. D’où un total souvent plus élevé que les fichiers livrés.' },
      ],
    },
    ack: {
      icon: '✅',
      label: 'ACK confirmés',
      unit: 'accusés reçus',
      hint: 'Confirmations enregistrées pour les livraisons filtrées.',
      popTitle: 'Confirmations ACK',
      popRows: [
        { key: '📌 Quoi', text: 'Accusés partenaires enregistrés dans FLOW_INCOMINGACKNOWLEGEMENT.' },
        { key: '🧮 Calcul', text: 'Lignes ACK liées aux FileOut de la sélection (ACKEDFILEOUT_ID_).' },
        { key: '💡 Lien W1', text: 'Voir la carte « Taux de Confirmation » pour les livraisons avec ACK obligatoire.' },
      ],
    },
  };

  readonly funnelPanelPopRows = [
    { key: '📦 Fichier livré', text: 'On compte les dossiers : combien de fichiers reçus sont partis au moins une fois.' },
    { key: '📤 Livraison', text: 'On compte les envois : chaque poussée vers une destination est une ligne de plus.' },
    { key: '🔗 Lien', text: 'Plusieurs livraisons pour un même fichier → le total livraisons dépasse souvent les fichiers livrés. Ce n’est pas une erreur.' },
  ];

  // ===== Widget 1 — 4 KPI =====
  kpi = {
    total: 0,                    // livraisons COUNT(FileOut)
    fileInTotal: 0,              // fichiers reçus COUNT(FileIn)
    fileInDistinctLivres: 0,     // fichiers avec ≥1 livraison DISTINCT FILEIN_ID_
    couverture: 0,               // % fileInDistinctLivres / fileInTotal
    ackAttendu: 0,
    ackRecus: 0,
    ackManquants: 0,             // depuis /ack/manquants (NOT EXISTS)
    tauxAck: 0,
    destinations: 0,
  };

  // ===== Donut Chart (Répartition des statuts) =====
  donutSeries: number[] = [];
  donutLabels: string[] = [];
  donutColors: string[] = [];
  donutChart: ApexChart = { type: 'donut', height: 280 };
  donutPlotOptions: ApexPlotOptions = { pie: { donut: { size: '65%' } } };
  donutStroke: ApexStroke = { width: 0 };
  donutLegend: ApexLegend = { position: 'bottom' };

  // ===== ACK Tracker =====
  ackTracker: { status: string; total: number; avgWaitSec: number }[] = [];

  // ===== KPI Popovers =====
  activeKpiCard: string | null = null;
  toggleKpiCard(card: string, event: Event) {
    event.stopPropagation();
    this.activeKpiCard = this.activeKpiCard === card ? null : card;
  }
  closeKpiCard() { this.activeKpiCard = null; }

  closeAllPopovers(): void {
    this.activeKpiCard = null;
    this.activeFunnelInfo = null;
  }

  toggleFunnelInfo(id: string, event: Event): void {
    event.stopPropagation();
    this.activeFunnelInfo = this.activeFunnelInfo === id ? null : id;
  }

  // ===== Timeline Chart =====
  timelineLoaded = false;
  timelineFilterStatus = '';
  timelineFrom = '';
  timelineTo = '';

  timelineSeries: ApexAxisChartSeries = [];
  timelineChart: ApexChart = { type: 'area', height: 260, toolbar: { show: false }, animations: { enabled: true } };
  timelineXAxis: ApexXAxis = { type: 'datetime', labels: { style: { colors: 'var(--text-muted)', fontSize: '11px' } } };
  timelineYAxis: ApexYAxis = { labels: { style: { colors: 'var(--text-muted)', fontSize: '11px' } } };
  timelineStroke: ApexStroke = { curve: 'smooth', width: 2 };
  timelineFill: ApexFill = { type: 'gradient', gradient: { opacityFrom: 0.5, opacityTo: 0.05 } };
  timelineGrid: ApexGrid = { borderColor: 'var(--border)' };
  timelineDataLabels: ApexDataLabels = { enabled: false };
  timelineTooltip: ApexTooltip = { x: { format: 'dd/MM/yyyy' } };
  timelineAnnotations: ApexAnnotations = {};
  timelineColors = ['#10b981', '#f59e0b', '#f43f5e', '#6366f1', '#94a3b8'];

  // ===== Table paginée =====
  tableRecords: {
    foId: number; fileId: number; fileInId: number;
    ackExpected: number; status: string; execSec: number; creationDate: string;
    sender: string; receiver: string; flowTypeName: string;
  }[] = [];
  tableFilterStatus = '';
  tableFilterAck: number | null = null;
  tableFilterSender = '';
  tableFilterFlowType = '';
  tableFilterFrom = '';
  tableFilterTo = '';

  // Pagination
  tablePage = 0;
  tableSize = 50;
  totalElements = 0;
  totalPages = 0;

  // ===== Pic d'anomalie =====
  peakDay: string | null = null;
  peakBlocked: number = 0;

  // Retiré: logic SVG RING

  formatLeadTime(seconds: number): string {
    if (!seconds || seconds <= 0) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    return `${Math.round(seconds / 3600)}h`;
  }

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadContratOptions();
    this.applyPageFilters();
    if (this.showLegacyWidgets) {
      this.loadLegacyWidgets();
    }
  }

  private buildFilterParams(): Record<string, string> {
    const params: Record<string, string> = {};
    if (this.pageFilters.contrat?.trim()) {
      params['contrat'] = this.pageFilters.contrat.trim();
    }
    if (this.pageFilters.from) {
      params['from'] = `${this.pageFilters.from}T00:00:00`;
    }
    if (this.pageFilters.to) {
      params['to'] = `${this.pageFilters.to}T23:59:59`;
    }
    if (this.pageFilters.ackOnly) {
      params['ackOnly'] = 'true';
    }
    return params;
  }

  loadContratOptions(): void {
    this.http.get<any[]>(`${this.apiUrl}/contrats`).subscribe({
      next: (res) => {
        this.contratOptions = (res || [])
          .map(r => String(r[0] ?? r).trim())
          .filter(c => c.length > 0);
      },
    });
  }

  applyPageFilters(): void {
    this.filtersActive = !!(
      this.pageFilters.contrat?.trim() ||
      this.pageFilters.from ||
      this.pageFilters.to ||
      this.pageFilters.ackOnly
    );
    this.loadWidget1Kpi();
    this.loadWidget2Funnel();
  }

  resetPageFilters(): void {
    this.pageFilters = { contrat: '', from: '', to: '', ackOnly: false };
    this.selectedFunnelStep = null;
    this.activeFunnelInfo = null;
    this.applyPageFilters();
  }

  selectFunnelStep(step: 'recus' | 'livres' | 'livraisons' | 'ack', event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedFunnelStep = this.selectedFunnelStep === step ? null : step;
  }

  get funnelPctLivres(): number {
    return this.funnel.recus > 0
      ? Math.round((this.funnel.fichiersLivres / this.funnel.recus) * 100)
      : 0;
  }

  /** Moyenne livraisons par fichier livré (explique l’écart livraisons > fichiers livrés) */
  get funnelLivraisonsParFichier(): string {
    if (this.funnel.fichiersLivres <= 0) return '—';
    return (this.funnel.livraisons / this.funnel.fichiersLivres).toLocaleString('fr-FR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  get funnelNonLivres(): number {
    return Math.max(0, this.funnel.recus - this.funnel.fichiersLivres);
  }

  get funnelInsight(): string {
    if (!this.selectedFunnelStep) {
      return 'Cliquez sur un palier pour voir le détail et préparer une investigation (journal W7 à venir).';
    }
    const fmt = (n: number) => n.toLocaleString('fr-FR');
    switch (this.selectedFunnelStep) {
      case 'recus':
        return `${fmt(this.funnel.recus)} fichiers reçus sur la sélection. ${fmt(this.funnelNonLivres)} n'ont encore aucune livraison.`;
      case 'livres':
        return `${fmt(this.funnel.fichiersLivres)} fichiers ont au moins une livraison (${this.funnelPctLivres}% des reçus).`;
      case 'livraisons': {
        const ratio = this.funnel.fichiersLivres > 0
          ? (this.funnel.livraisons / this.funnel.fichiersLivres).toFixed(1)
          : '0';
        return `${fmt(this.funnel.livraisons)} livraisons — environ ${ratio} livraison(s) par fichier livré.`;
      }
      case 'ack':
        return `${fmt(this.funnel.ackConfirmes)} accusés confirmés sur la sélection. Carte « Taux de Confirmation » pour le détail ACK requis.`;
      default:
        return '';
    }
  }

  /** Widget 0 (hero stats) + Widget 1 (4 KPI) — respecte les filtres page */
  loadWidget1Kpi(): void {
    this.isLoading = true;
    const params = this.buildFilterParams();
    forkJoin({
      hero: this.http.get<any[]>(`${this.apiUrl}/kpi/hero`, { params }),
      ackManquants: this.http.get<any[]>(`${this.apiUrl}/ack/manquants`, { params }),
    }).subscribe({
      next: ({ hero, ackManquants }) => {
        if (hero?.[0]) {
          const r = hero[0];
          this.kpi.total = Number(r[0]) || 0;
          this.kpi.ackAttendu = Number(r[1]) || 0;
          this.kpi.ackRecus = Number(r[2]) || 0;
          this.kpi.fileInTotal = Number(r[3]) || 0;
          this.kpi.destinations = Number(r[4]) || 0;
          this.kpi.fileInDistinctLivres = Number(r[5]) || 0;
          this.kpi.couverture = this.kpi.fileInTotal > 0
            ? Math.round((this.kpi.fileInDistinctLivres / this.kpi.fileInTotal) * 100)
            : 0;
          this.kpi.tauxAck = this.kpi.ackAttendu > 0
            ? Math.round((this.kpi.ackRecus / this.kpi.ackAttendu) * 100)
            : 0;
        }
        if (ackManquants?.[0]) {
          this.kpi.ackManquants = Number(ackManquants[0][0]) || 0;
        }
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; },
    });
  }

  loadWidget2Funnel(): void {
    this.funnelLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/funnel`, { params: this.buildFilterParams() }).subscribe({
      next: (res) => {
        if (res?.[0]) {
          const r = res[0];
          this.funnel.recus = Number(r[0]) || 0;
          this.funnel.fichiersLivres = Number(r[1]) || 0;
          this.funnel.livraisons = Number(r[2]) || 0;
          this.funnel.ackConfirmes = Number(r[3]) || 0;
        }
        this.funnelLoading = false;
      },
      error: () => { this.funnelLoading = false; },
    });
  }

  /** Ancien écran (timeline, donut, table) — hors périmètre actuel */
  loadLegacyWidgets(): void {
    this.loadPipeline();
    this.loadAckTracker();
    this.loadTimeline();
    this.loadTable();
    this.loadPeak();
  }

  // ===== Donut Chart =====
  loadPipeline(): void {
    this.http.get<any[]>(`${this.apiUrl}/stats/pipeline`).subscribe({
      next: (res) => {
        const top = res.slice(0, 6);
        this.donutLabels = top.map(r => String(r[0] || 'Inconnu'));
        this.donutSeries = top.map(r => Number(r[1]) || 0);

        const colorsMap: Record<string, string> = {
          'Processed': '#10b981',
          'Blocked': '#f59e0b',
          'In Error': '#ef4444',
          'Processing': '#6366f1',
          'SentAndWaitingAck': '#f97316',
          'Started': '#94a3b8',
          'Acked': '#34d399',
          'Processing on hold': '#fbbf24',
          'Nacked': '#dc2626',
          'Canceled': '#64748b',
          'Rejected': '#991b1b',
          'Inconnu': '#475569',
        };
        this.donutColors = this.donutLabels.map(lbl => colorsMap[lbl] || '#475569');
      }
    });
  }

  // ===== ACK Tracker =====
  loadAckTracker(): void {
    this.http.get<any[]>(`${this.apiUrl}/stats/ack-tracker`).subscribe({
      next: (res) => {
        this.ackTracker = res.map(r => ({
          status: String(r[0] || 'Inconnu'),
          total: Number(r[1]) || 0,
          avgWaitSec: Number(r[2]) || 0
        }));
      }
    });
  }

  // ===== Timeline =====
  loadTimeline(): void {
    this.timelineLoaded = false;
    const params: Record<string, string> = {};
    if (this.timelineFilterStatus) params['status'] = this.timelineFilterStatus;
    if (this.timelineFrom) params['from'] = this.timelineFrom + 'T00:00:00';
    if (this.timelineTo) params['to'] = this.timelineTo + 'T23:59:59';

    this.http.get<any[]>(`${this.apiUrl}/stats/timeline`, { params }).subscribe({
      next: (res) => {
        // Regrouper par statut pour créer une série par statut
        const seriesMap: Record<string, [number, number][]> = {};
        res.forEach(r => {
          const dateRaw = r[0];
          const status = String(r[1] || 'Inconnu');
          const total = Number(r[2]) || 0;
          let ts: number;
          if (Array.isArray(dateRaw)) {
            ts = new Date(dateRaw[0], (dateRaw[1] || 1) - 1, dateRaw[2] || 1).getTime();
          } else {
            ts = new Date(dateRaw).getTime();
          }
          if (!seriesMap[status]) seriesMap[status] = [];
          seriesMap[status].push([ts, total]);
        });

        const ORDER = ['Processed', 'Blocked', 'In Error', 'SentAndWaitingAck', 'Processing'];
        const sorted = ORDER.filter(s => seriesMap[s])
          .concat(Object.keys(seriesMap).filter(s => !ORDER.includes(s)));

        this.timelineSeries = sorted.map(status => ({
          name: status,
          data: seriesMap[status].sort((a, b) => a[0] - b[0])
        }));

        this.timelineLoaded = true;
      }
    });
  }

  resetTimeline(): void {
    this.timelineFilterStatus = '';
    this.timelineFrom = '';
    this.timelineTo = '';
    this.loadTimeline();
  }

  // ===== Table paginée =====
  loadTable(): void {
    const params: Record<string, string | number> = { page: this.tablePage, size: this.tableSize };
    if (this.tableFilterStatus) params['status'] = this.tableFilterStatus;
    if (this.tableFilterAck !== null) params['ackExpected'] = this.tableFilterAck;
    if (this.tableFilterSender) params['sender'] = this.tableFilterSender;
    if (this.tableFilterFlowType) params['flowType'] = this.tableFilterFlowType;
    if (this.tableFilterFrom) params['fromDate'] = this.tableFilterFrom;
    if (this.tableFilterTo) params['toDate'] = this.tableFilterTo;

    this.http.get<any>(`${this.apiUrl}/records`, { params }).subscribe({
      next: (res) => {
        this.totalElements = res.totalElements || 0;
        this.totalPages = res.totalPages || 0;
        this.tableRecords = (res.content || []).map((r: any) => ({
          foId: Number(r.foId),
          fileId: r.fileId,
          fileInId: r.fileinId,
          ackExpected: r.ackExpected,
          status: r.status || 'En cours',
          execSec: r.execSec || 0,
          creationDate: r.creationDate ? String(r.creationDate) : '—',
          sender: r.sender || '—',
          receiver: r.receiver || '—',
          flowTypeName: r.typeName || '—'
        }));
      }
    });
  }

  onPageChange(newPage: number): void {
    if (newPage >= 0 && newPage < this.totalPages) {
      this.tablePage = newPage;
      this.loadTable();
    }
  }

  // ===== Pic d'anomalie =====
  loadPeak(): void {
    this.http.get<any[]>(`${this.apiUrl}/stats/peak`).subscribe({
      next: (res) => {
        if (res && res[0]) {
          this.peakDay = String(res[0][0] || '');
          this.peakBlocked = Number(res[0][1]) || 0;
        }
      }
    });
  }

  // ===== Helpers UI =====
  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      'Processed': 'success',
      'Acked': 'success',
      'Blocked': 'warning',
      'Processing on hold': 'warning',
      'In Error': 'error',
      'Nacked': 'error',
      'Rejected': 'error',
      'Canceled': 'error',
      'SentAndWaitingAck': 'warning',
      'Processing': 'warning',
      'Started': 'neutral',
    };
    return map[status] || 'badge-neutral';
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      'Processed': '✅',
      'Acked': '✅',
      'Blocked': '⚠️',
      'In Error': '❌',
      'Nacked': '🚫',
      'Rejected': '🚫',
      'Canceled': '⊗',
      'SentAndWaitingAck': '⟳',
      'Processing': '⚙️',
      'Started': '▶️',
    };
    return map[status] || '?';
  }
}
