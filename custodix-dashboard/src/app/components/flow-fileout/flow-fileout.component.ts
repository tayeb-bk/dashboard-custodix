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

export interface ContratPerfRow {
  contrat: string;
  fichiersRecus: number;
  fichiersLivres: number;
  livraisons: number;
  couverturePct: number;
  ackAttendu: number;
  ackConfirmes: number;
  ackManquants: number;
  tauxAckPct: number | null;
}

export interface DestinationRow {
  id: string;
  livraisons: number;
  fichiersDistinct: number;
  ackAttendu: number;
  ackManquants: number;
  pct: number;
}

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

  // ===== Widget 7 — Journal d'expédition =====
  journalLoading = false;
  journalError = '';
  journalView: 'livraisons' | 'non_livre' = 'livraisons';
  journalPreset: '' | 'ack_confirme' | 'ack_manquant' = '';
  journalAckFilter: number | null = null;
  journalPage = 0;
  journalSize = 25;
  journalTotal = 0;
  journalTotalPages = 0;
  journalSearch = '';
  activeJournalInfo = false;

  readonly journalPanelPopRows = [
    { key: '📋 Journal', text: 'Liste détaillée : chaque ligne est soit une livraison (FLOW_FILEOUT), soit un fichier reçu jamais expédié.' },
    { key: '📦 vs 📤', text: 'Onglet Livraisons = tous les envois. Onglet Non livrés = FileIn sans aucune ligne FileOut (palier « Fichiers reçus » du funnel).' },
    { key: '🔗 Funnel', text: '« Voir la liste détaillée » sous le pipeline applique le filtre du palier sélectionné + les dates/contrat de la page.' },
    { key: '✅ ACK', text: 'Presets ACK confirmés / manquants : même logique que les KPI et le funnel (ACKEXPECTED_ + FLOW_INCOMINGACKNOWLEGEMENT).' },
    { key: '📄 Pagination', text: '25 à 100 lignes par page côté serveur. La recherche filtre uniquement la page affichée.' },
    { key: '📜 Scroll', text: 'Faites défiler la page (molette ou trackpad) pour voir tout le journal ; la barre de scroll reste discrète.' },
  ];

  journalRows: {
    foId: number | null;
    fileInId: number;
    contrat: string;
    workflow: string;
    dateEnvoi: string;
    priorite: string;
    ackAttendu: number | null;
    destination: number | null;
    statutAck: string;
    typeAck: string | null;
  }[] = [];

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
    if (this.activeKpiCard) {
      this.activeJournalInfo = false;
      this.activeTimelineInfo = false;
    }
  }
  closeKpiCard() { this.activeKpiCard = null; }

  closeAllPopovers(): void {
    this.activeKpiCard = null;
    this.activeFunnelInfo = null;
    this.activeJournalInfo = false;
    this.activeTimelineInfo = false;
    this.activeContratsPerfInfo = false;
    this.activeDestInfo = false;
  }

  toggleTimelineInfo(event: Event): void {
    event.stopPropagation();
    this.activeTimelineInfo = !this.activeTimelineInfo;
    if (this.activeTimelineInfo) {
      this.activeKpiCard = null;
      this.activeFunnelInfo = null;
      this.activeJournalInfo = false;
      this.activeContratsPerfInfo = false;
      this.activeDestInfo = false;
    }
  }

  toggleContratsPerfInfo(event: Event): void {
    event.stopPropagation();
    this.activeContratsPerfInfo = !this.activeContratsPerfInfo;
    if (this.activeContratsPerfInfo) {
      this.activeKpiCard = null;
      this.activeFunnelInfo = null;
      this.activeJournalInfo = false;
      this.activeTimelineInfo = false;
      this.activeDestInfo = false;
    }
  }

  toggleDestInfo(event: Event): void {
    event.stopPropagation();
    this.activeDestInfo = !this.activeDestInfo;
    if (this.activeDestInfo) {
      this.activeKpiCard = null;
      this.activeFunnelInfo = null;
      this.activeJournalInfo = false;
      this.activeTimelineInfo = false;
      this.activeContratsPerfInfo = false;
    }
  }

  toggleFunnelInfo(id: string, event: Event): void {
    event.stopPropagation();
    this.activeFunnelInfo = this.activeFunnelInfo === id ? null : id;
    if (this.activeFunnelInfo) {
      this.activeJournalInfo = false;
      this.activeTimelineInfo = false;
      this.activeContratsPerfInfo = false;
      this.activeDestInfo = false;
    }
  }

  toggleJournalInfo(event: Event): void {
    event.stopPropagation();
    this.activeJournalInfo = !this.activeJournalInfo;
    if (this.activeJournalInfo) {
      this.activeKpiCard = null;
      this.activeFunnelInfo = null;
      this.activeTimelineInfo = false;
      this.activeContratsPerfInfo = false;
      this.activeDestInfo = false;
    }
  }

  // ===== Widget 3 — Timeline (legacy loadTimeline ci-dessous) =====
  timelineLoading = false;
  timelineLoaded = false;
  timelineError = '';
  activeTimelineInfo = false;
  timelinePeak: { label: string; count: number } | null = null;
  /** Filtres propres au widget (contrat / workflow) — dates = filtres page */
  timelineFilters = { contrat: '', workflow: '' };
  timelineContratOptions: string[] = [];
  timelineWorkflowOptions: string[] = [];

  readonly timelinePanelPopRows = [
    { key: '📈 Courbe', text: 'Nombre de livraisons (FLOW_FILEOUT) par jour de date d’envoi (SENDINGDATE_ du fichier reçu).' },
    { key: '👤 Par qui', text: 'Contrat SLA = partenaire / engagement métier (filtre principal). Workflow = type de flux technique (plus fin).' },
    { key: '📤 Livraisons', text: 'Chaque envoi compte : un pic peut refléter plusieurs fichiers ou multi-destinations.' },
    { key: '✅ ACK requis', text: 'Sous-ensemble des livraisons du jour avec ACKEXPECTED_=1 (pas les confirmations reçues).' },
    { key: '🔗 Dates', text: 'Période et « ACK requis » = filtres page (barre funnel). Contrat / workflow = filtres ci-dessous + Actualiser.' },
  ];
  timelineFilterStatus = '';
  timelineFrom = '';
  timelineTo = '';

  timelineSeries: ApexAxisChartSeries = [];
  timelineChart: ApexChart = { type: 'area', height: 280, toolbar: { show: false }, animations: { enabled: true } };
  timelineXAxis: ApexXAxis = { type: 'datetime', labels: { style: { colors: 'var(--text-muted)', fontSize: '11px' } } };
  timelineYAxis: ApexYAxis = {
    labels: { style: { colors: 'var(--text-muted)', fontSize: '11px' } },
    title: { text: 'Livraisons / jour', style: { color: 'var(--text-muted)', fontSize: '11px' } },
  };
  timelineStroke: ApexStroke = { curve: 'smooth', width: [2.5, 2] };
  timelineFill: ApexFill = {
    type: 'gradient',
    gradient: { opacityFrom: 0.45, opacityTo: 0.06 },
  };
  timelineGrid: ApexGrid = { borderColor: 'rgba(148, 163, 184, 0.15)', strokeDashArray: 4 };
  timelineDataLabels: ApexDataLabels = { enabled: false };
  timelineTooltip: ApexTooltip = { x: { format: 'dd/MM/yyyy' } };
  timelineLegend: ApexLegend = { position: 'top', horizontalAlign: 'right', fontSize: '11px' };
  timelineAnnotations: ApexAnnotations = {};
  timelineColors = ['#10b981', '#6366f1'];

  // ===== Widget 4 — Performance par partenaire (contrat SLA) =====
  contratsPerfLoading = false;
  contratsPerfError = '';
  contratsPerfRows: ContratPerfRow[] = [];
  contratsPerfSort: 'volume' | 'couverture' | 'risque' = 'volume';
  activeContratsPerfInfo = false;
  /** Contrat / preset journal imposés par un clic dans W4 — levés par Actualiser / chip */
  contratsPerfDrillContrat: string | null = null;
  contratsPerfDrillJournalPreset: '' | 'ack_confirme' | 'ack_manquant' | null = null;

  // ===== Widget 5 — Destinations =====
  destLoading = false;
  destError = '';
  destRows: DestinationRow[] = [];
  destSort: 'livraisons' | 'fichiers' = 'livraisons';
  activeDestInfo = false;
  destChartReady = false;
  destinationsDrillId: string | null = null;
  journalDestinationFilter: string | null = null;

  destDonutSeries: ApexNonAxisChartSeries = [];
  destDonutLabels: string[] = [];
  destDonutColors = [
    '#10b981', '#6366f1', '#8b5cf6', '#f59e0b', '#ef4444',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b',
  ];
  destDonutChart: ApexChart = {
    type: 'donut',
    height: 280,
    toolbar: { show: false },
    animations: { enabled: true },
    events: {
      dataPointSelection: (_e, _chart, config) => {
        const idx = config?.dataPointIndex;
        if (idx == null || idx < 0) return;
        const row = this.sortedDestRows[idx];
        if (row) this.selectDestination(row);
      },
    },
  };
  destDonutPlotOptions: ApexPlotOptions = {
    pie: { donut: { size: '62%', labels: { show: true, total: { show: true, label: 'Livraisons', fontSize: '11px' } } } },
  };
  destDonutStroke: ApexStroke = { width: 0 };
  destDonutLegend: ApexLegend = { position: 'bottom', fontSize: '11px' };
  destDonutDataLabels: ApexDataLabels = { enabled: false };
  destDonutTooltip: ApexTooltip = { y: { formatter: (v: number) => `${v} livraison(s)` } };

  readonly destPanelPopRows = [
    {
      key: '📌 Objectif',
      text: 'Répondre à « vers où partent les livraisons ? » sur la période filtrée (dates, contrat, ACK requis).',
    },
    {
      key: '🌍 Destination',
      text: 'Identifiant du canal de sortie (champ DESTINATIONINFO_ID_ dans FLOW_FILEOUT). C’est la cible technique d’un envoi : connecteur, répertoire, flux partenaire, etc. Ce n’est pas le contrat SLA (partenaire métier en réception) — c’est le chemin par lequel le fichier sort de Custodix.',
    },
    {
      key: '📦 Fichier distinct',
      text: 'Nombre de dossiers reçus différents (FILEIN) ayant été expédiés au moins une fois vers ce canal. On compte chaque fichier une seule fois par destination, même s’il y a plusieurs envois. Formule : COUNT(DISTINCT FILEIN_ID_) parmi les livraisons de ce canal.',
    },
    {
      key: '📤 Livraisons',
      text: 'Nombre total d’envois (lignes FLOW_FILEOUT) vers ce canal. Chaque poussée = 1 livraison. Peut être supérieur aux fichiers distincts si le même dossier est renvoyé plusieurs fois vers le même canal.',
    },
    {
      key: '💡 Exemple',
      text: '1 fichier reçu envoyé 2 fois vers la destination #12 → 2 livraisons, 1 fichier distinct. Le même fichier aussi envoyé vers la destination #5 → +1 livraison sur #5 et 1 fichier distinct sur #5 (d’où l’écart livraisons > fichiers dans le funnel).',
    },
    {
      key: '🔢 Total graphique',
      text: 'Le centre du donut = même total que le KPI « Volume des livraisons » (toutes destinations). Le détail liste le top 10 ; s’il reste d’autres canaux, une tranche « Autres canaux » complète le graphique.',
    },
    {
      key: '✅ ACK',
      text: 'Par canal : livraisons avec accusé requis (ACKEXPECTED_=1), combien ont une confirmation en base, et combien restent manquantes.',
    },
    {
      key: '🎯 Action',
      text: 'Cliquez un secteur du graphique ou une ligne du détail : le journal n’affiche que les livraisons de ce canal. « Réinitialiser vue » retire ce zoom.',
    },
  ];

  readonly contratsPerfPanelPopRows = [
    { key: '📌 Objectif', text: 'Comparer les partenaires (contrats SLA) sur la même période que le funnel : réception, livraison, couverture et qualité ACK.' },
    { key: '📥 Reçus', text: 'Fichiers FLOW_FILEIN du contrat sur la période (filtres page).' },
    { key: '📦 Livrés', text: 'Dossiers distincts ayant au moins une livraison — aligné palier « Fichiers livrés ».' },
    { key: '📤 Livraisons', text: 'Nombre d’envois (lignes FileOut) — peut dépasser les fichiers livrés (multi-destinations).' },
    { key: '📊 Couverture', text: '% fichiers livrés / fichiers reçus : indique si les arrivées partent bien en expédition.' },
    { key: '✅ ACK', text: 'Sur livraisons avec ACK requis : confirmés, manquants et taux — même logique que KPI et journal.' },
    { key: '🎯 Action', text: 'Cliquez une ligne pour zoomer sur le partenaire (journal). « Réinitialiser vue » annule ce zoom et remet tout le dashboard à l’état des filtres page.' },
  ];

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
    this.loadTimelineFilterOptions();
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
        this.timelineContratOptions = [...this.contratOptions];
      },
    });
  }

  loadTimelineFilterOptions(): void {
    this.http.get<any[]>(`${this.apiUrl}/workflows`).subscribe({
      next: (res) => {
        this.timelineWorkflowOptions = (res || [])
          .map(r => String(r[0] ?? r).trim())
          .filter(w => w.length > 0);
      },
    });
  }

  get timelineFiltersActive(): boolean {
    return !!(this.timelineFilters.contrat?.trim() || this.timelineFilters.workflow?.trim());
  }

  get timelineFilterSummary(): string {
    const parts: string[] = [];
    if (this.timelineFilters.contrat?.trim()) {
      parts.push(`Contrat : ${this.timelineFilters.contrat.trim()}`);
    }
    if (this.timelineFilters.workflow?.trim()) {
      parts.push(`Workflow : ${this.timelineFilters.workflow.trim()}`);
    }
    return parts.length ? parts.join(' · ') : 'Tous partenaires et workflows';
  }

  private buildTimelineParams(): Record<string, string> {
    const params = this.buildFilterParams();
    if (this.timelineFilters.contrat?.trim()) {
      params['contrat'] = this.timelineFilters.contrat.trim();
    }
    if (this.timelineFilters.workflow?.trim()) {
      params['workflow'] = this.timelineFilters.workflow.trim();
    }
    return params;
  }

  resetTimelineFilters(): void {
    this.timelineFilters = { contrat: '', workflow: '' };
    this.loadWidget3Timeline();
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
    this.loadWidget3Timeline();
    this.clearDestinationsDrill(false);
    this.loadWidget4ContratsPerf();
    this.loadWidget5Destinations();
    this.loadWidget7Journal(true);
  }

  resetPageFilters(): void {
    this.pageFilters = { contrat: '', from: '', to: '', ackOnly: false };
    this.selectedFunnelStep = null;
    this.activeFunnelInfo = null;
    this.journalPreset = '';
    this.journalView = 'livraisons';
    this.journalAckFilter = null;
    this.clearContratsPerfDrill(false);
    this.clearDestinationsDrill(false);
    this.applyPageFilters();
  }

  get contratsPerfDrillActive(): boolean {
    return !!this.contratsPerfDrillContrat;
  }

  private setContratsPerfDrill(
    contrat: string,
    journalPreset: '' | 'ack_confirme' | 'ack_manquant' | null = null,
  ): void {
    this.contratsPerfDrillContrat = contrat;
    this.contratsPerfDrillJournalPreset = journalPreset;
    this.pageFilters.contrat = contrat;
  }

  clearContratsPerfDrill(reload = true): void {
    if (!this.contratsPerfDrillContrat) return;
    if (this.pageFilters.contrat === this.contratsPerfDrillContrat) {
      this.pageFilters.contrat = '';
    }
    if (
      this.contratsPerfDrillJournalPreset &&
      this.journalPreset === this.contratsPerfDrillJournalPreset
    ) {
      this.journalPreset = '';
    }
    this.contratsPerfDrillContrat = null;
    this.contratsPerfDrillJournalPreset = null;
    if (reload) {
      this.selectedFunnelStep = null;
      this.applyPageFilters();
    }
  }

  /** Actualiser W4 : si zoom partenaire actif → réinitialise tout le dashboard, sinon recharge la liste */
  refreshContratsPerf(): void {
    if (this.contratsPerfDrillActive) {
      this.clearContratsPerfDrill(true);
      return;
    }
    this.loadWidget4ContratsPerf();
  }

  selectFunnelStep(step: 'recus' | 'livres' | 'livraisons' | 'ack', event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedFunnelStep = step;
  }

  get selectedFunnelStepLabel(): string {
    if (!this.selectedFunnelStep) return '';
    return this.funnelStepMeta[this.selectedFunnelStep]?.label ?? '';
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

  get journalFilteredRows() {
    let rows = this.journalRows;
    const q = this.journalSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      String(r.contrat || '').toLowerCase().includes(q) ||
      String(r.workflow || '').toLowerCase().includes(q) ||
      String(r.fileInId).includes(q) ||
      (r.foId != null && String(r.foId).includes(q)) ||
      String(r.destination ?? '').includes(q)
    );
  }

  get journalContextLabel(): string {
    if (this.journalDestinationFilter) {
      const label = this.formatDestLabel(this.journalDestinationFilter);
      return `Livraisons — ${label}`;
    }
    if (this.journalView === 'non_livre') {
      return 'Fichiers reçus sans livraison';
    }
    if (this.journalPreset === 'ack_confirme') return 'Livraisons avec ACK confirmé';
    if (this.journalPreset === 'ack_manquant') return 'Livraisons — ACK manquant';
    if (this.pageFilters.ackOnly) return 'Livraisons (ACK requis)';
    return 'Toutes les livraisons';
  }

  get funnelInsight(): string {
    if (!this.selectedFunnelStep) {
      return 'Cliquez un palier du pipeline (surligné en vert), puis « Voir la liste détaillée » pour ouvrir le journal.';
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
        this.recalcDestPercentages();
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

  private parseApiDate(raw: unknown): number {
    if (raw == null) return NaN;
    if (Array.isArray(raw)) {
      const y = Number(raw[0]);
      const m = Number(raw[1]) || 1;
      const d = Number(raw[2]) || 1;
      return new Date(y, m - 1, d).getTime();
    }
    const s = String(raw);
    if (s.length >= 10) {
      const d = new Date(s.slice(0, 10) + 'T12:00:00');
      if (!isNaN(d.getTime())) return d.getTime();
    }
    return new Date(s).getTime();
  }

  loadWidget5Destinations(): void {
    this.destLoading = true;
    this.destError = '';
    this.destChartReady = false;
    this.http.get<any[]>(`${this.apiUrl}/top-destinations`, { params: this.buildFilterParams() }).subscribe({
      next: (res) => {
        this.destRows = (res || []).map(r => this.mapDestinationRow(r));
        this.recalcDestPercentages();
        this.destLoading = false;
      },
      error: () => {
        this.destError = 'Impossible de charger la répartition par destination.';
        this.destRows = [];
        this.destChartReady = false;
        this.destLoading = false;
      },
    });
  }

  private mapDestinationRow(r: any): DestinationRow {
    const row = Array.isArray(r) ? r : [];
    const id = String(row[0] ?? 'NON_DEFINI');
    return {
      id,
      livraisons: Number(row[1]) || 0,
      fichiersDistinct: Number(row[2]) || 0,
      ackAttendu: Number(row[3]) || 0,
      ackManquants: Number(row[4]) || 0,
      pct: 0,
    };
  }

  formatDestLabel(id: string): string {
    if (id === 'NON_DEFINI') return 'Non défini';
    return `Destination #${id}`;
  }

  /** % de chaque canal sur le total KPI (pas seulement le top 10) */
  private recalcDestPercentages(): void {
    const total = this.destGrandTotalLivraisons;
    if (!this.destRows.length) return;
    this.destRows = this.destRows.map(x => ({
      ...x,
      pct: total > 0 ? Math.round((x.livraisons / total) * 1000) / 10 : 0,
    }));
    this.rebuildDestChart();
  }

  setDestSort(mode: 'livraisons' | 'fichiers'): void {
    this.destSort = mode;
    this.rebuildDestChart();
  }

  get sortedDestRows(): DestinationRow[] {
    const rows = [...this.destRows];
    if (this.destSort === 'fichiers') {
      return rows.sort((a, b) => b.fichiersDistinct - a.fichiersDistinct);
    }
    return rows.sort((a, b) => b.livraisons - a.livraisons);
  }

  /** Somme des livraisons sur le top 10 canaux (requête SQL limitée) */
  get destTop10Livraisons(): number {
    return this.destRows.reduce((s, r) => s + r.livraisons, 0);
  }

  /** Total aligné KPI / funnel (toutes destinations, mêmes filtres page) */
  get destGrandTotalLivraisons(): number {
    return this.kpi.total > 0 ? this.kpi.total : this.destTop10Livraisons;
  }

  get destAutresLivraisons(): number {
    return Math.max(0, this.destGrandTotalLivraisons - this.destTop10Livraisons);
  }

  get destTop3Pct(): number {
    const sorted = [...this.destRows].sort((a, b) => b.livraisons - a.livraisons);
    const raw = sorted.slice(0, 3).reduce((s, r) => s + r.pct, 0);
    return Math.round(raw * 10) / 10;
  }

  get destSummary(): string {
    const n = this.destRows.length;
    if (!n) return 'Aucune livraison';
    const total = this.destGrandTotalLivraisons.toLocaleString('fr-FR');
    const autres = this.destAutresLivraisons;
    const base = `${n} canaux détaillés · ${total} livraisons (total KPI)`;
    if (autres > 0) {
      return `${base} — hors top 10 : ${autres.toLocaleString('fr-FR')}`;
    }
    return `${base} — top 10 = 100 % du volume`;
  }

  private rebuildDestChart(): void {
    const rows = this.sortedDestRows;
    const labels = rows.map(r => this.formatDestLabel(r.id));
    const series = rows.map(r => r.livraisons);
    const autres = this.destAutresLivraisons;
    if (autres > 0) {
      labels.push('Autres canaux');
      series.push(autres);
    }
    this.destDonutLabels = labels;
    this.destDonutSeries = series;
    this.destChartReady = series.length > 0 && series.some(v => v > 0);
  }

  get destinationsDrillActive(): boolean {
    return !!this.destinationsDrillId;
  }

  clearDestinationsDrill(reloadJournal = true): void {
    if (!this.destinationsDrillId && !this.journalDestinationFilter) return;
    this.destinationsDrillId = null;
    this.journalDestinationFilter = null;
    if (reloadJournal) {
      this.loadWidget7Journal(true);
    }
  }

  refreshDestinations(): void {
    if (this.destinationsDrillActive) {
      this.clearDestinationsDrill(true);
      this.loadWidget5Destinations();
      return;
    }
    this.loadWidget5Destinations();
  }

  isDestSelected(id: string): boolean {
    return this.destinationsDrillId === id;
  }

  selectDestination(row: DestinationRow, event?: Event): void {
    if (event) event.stopPropagation();
    this.destinationsDrillId = row.id;
    this.journalDestinationFilter = row.id;
    this.journalView = 'livraisons';
    this.journalPreset = '';
    this.journalAckFilter = null;
    this.loadWidget7Journal(true);
    setTimeout(() => {
      document.getElementById('fo-journal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  destLivraisonsRatio(row: DestinationRow): string {
    if (row.fichiersDistinct <= 0) return '—';
    return (row.livraisons / row.fichiersDistinct).toLocaleString('fr-FR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  get destMaxLivraisons(): number {
    return Math.max(...this.destRows.map(r => r.livraisons), 1);
  }

  loadWidget4ContratsPerf(): void {
    this.contratsPerfLoading = true;
    this.contratsPerfError = '';
    this.http.get<any[]>(`${this.apiUrl}/top-contrats`, { params: this.buildFilterParams() }).subscribe({
      next: (res) => {
        this.contratsPerfRows = (res || []).map(r => this.mapContratPerfRow(r));
        this.contratsPerfLoading = false;
      },
      error: () => {
        this.contratsPerfError = 'Impossible de charger la performance partenaires.';
        this.contratsPerfRows = [];
        this.contratsPerfLoading = false;
      },
    });
  }

  private mapContratPerfRow(r: any): ContratPerfRow {
    const row = Array.isArray(r) ? r : [];
    return {
      contrat: String(row[0] ?? '—'),
      fichiersRecus: Number(row[1]) || 0,
      fichiersLivres: Number(row[2]) || 0,
      livraisons: Number(row[3]) || 0,
      couverturePct: Number(row[4]) || 0,
      ackAttendu: Number(row[5]) || 0,
      ackConfirmes: Number(row[6]) || 0,
      ackManquants: Number(row[7]) || 0,
      tauxAckPct: row[8] != null ? Number(row[8]) : null,
    };
  }

  setContratsPerfSort(mode: 'volume' | 'couverture' | 'risque'): void {
    this.contratsPerfSort = mode;
  }

  get sortedContratsPerf(): ContratPerfRow[] {
    const rows = [...this.contratsPerfRows];
    switch (this.contratsPerfSort) {
      case 'couverture':
        return rows.sort((a, b) => a.couverturePct - b.couverturePct);
      case 'risque':
        return rows.sort((a, b) => {
          if (b.ackManquants !== a.ackManquants) return b.ackManquants - a.ackManquants;
          return a.couverturePct - b.couverturePct;
        });
      default:
        return rows.sort((a, b) => b.livraisons - a.livraisons);
    }
  }

  get contratsPerfMaxLivraisons(): number {
    return Math.max(...this.contratsPerfRows.map(r => r.livraisons), 1);
  }

  get contratsPerfSummary(): string {
    const n = this.contratsPerfRows.length;
    if (!n) return 'Aucun partenaire sur la sélection.';
    const alertes = this.contratsPerfRows.filter(r => r.ackManquants > 0).length;
    const faible = this.contratsPerfRows.filter(r => r.couverturePct < 70 && r.fichiersRecus >= 5).length;
    const parts: string[] = [`${n} partenaire(s) analysé(s)`];
    if (alertes) parts.push(`${alertes} avec ACK manquant(s)`);
    if (faible) parts.push(`${faible} couverture < 70 %`);
    return parts.join(' · ');
  }

  contratPerfNonLivres(row: ContratPerfRow): number {
    return Math.max(0, row.fichiersRecus - row.fichiersLivres);
  }

  contratPerfLivraisonsRatio(row: ContratPerfRow): string {
    if (row.fichiersLivres <= 0) return '—';
    return (row.livraisons / row.fichiersLivres).toLocaleString('fr-FR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  couvertureBarClass(pct: number): string {
    if (pct >= 85) return 'fo-perf-bar-fill--ok';
    if (pct >= 60) return 'fo-perf-bar-fill--warn';
    return 'fo-perf-bar-fill--risk';
  }

  isContratPerfSelected(contrat: string): boolean {
    const focus = this.contratsPerfDrillContrat || this.pageFilters.contrat?.trim();
    return !!focus && focus === contrat;
  }

  selectContratPerf(row: ContratPerfRow, event?: Event): void {
    if (event) event.stopPropagation();
    this.setContratsPerfDrill(row.contrat);
    this.journalView = 'livraisons';
    this.journalPreset = '';
    this.journalAckFilter = null;
    this.selectedFunnelStep = null;
    this.applyPageFilters();
    setTimeout(() => {
      document.getElementById('fo-journal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  investigateContratAckManquants(row: ContratPerfRow, event: Event): void {
    event.stopPropagation();
    this.setContratsPerfDrill(row.contrat, 'ack_manquant');
    this.journalView = 'livraisons';
    this.journalPreset = 'ack_manquant';
    this.journalAckFilter = null;
    this.selectedFunnelStep = null;
    this.applyPageFilters();
    setTimeout(() => {
      document.getElementById('fo-journal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  loadWidget3Timeline(): void {
    this.timelineLoading = true;
    this.timelineLoaded = false;
    this.timelineError = '';
    this.http.get<any[]>(`${this.apiUrl}/timeline`, { params: this.buildTimelineParams() }).subscribe({
      next: (res) => {
        const livraisons: [number, number][] = [];
        const ackRequis: [number, number][] = [];
        (res || []).forEach((r) => {
          const ts = this.parseApiDate(r[0]);
          if (isNaN(ts)) return;
          livraisons.push([ts, Number(r[1]) || 0]);
          ackRequis.push([ts, Number(r[2]) || 0]);
        });
        livraisons.sort((a, b) => a[0] - b[0]);
        ackRequis.sort((a, b) => a[0] - b[0]);
        this.timelineSeries = [
          { name: 'Livraisons', data: livraisons },
          { name: 'ACK requis', data: ackRequis },
        ];
        this.timelinePeak = this.computeTimelinePeak(livraisons);
        this.timelineLoaded = livraisons.length > 0;
        this.timelineLoading = false;
      },
      error: () => {
        this.timelineError = 'Impossible de charger la timeline. Vérifiez le backend.';
        this.timelineSeries = [];
        this.timelinePeak = null;
        this.timelineLoaded = false;
        this.timelineLoading = false;
      },
    });
  }

  private computeTimelinePeak(points: [number, number][]): { label: string; count: number } | null {
    if (!points.length) return null;
    let max = points[0];
    for (const p of points) {
      if (p[1] > max[1]) max = p;
    }
    return {
      label: new Date(max[0]).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
      count: max[1],
    };
  }

  private buildJournalParams(): Record<string, string | number> {
    const params: Record<string, string | number> = {
      view: this.journalView,
      page: this.journalPage,
      size: this.journalSize,
    };
    const pageParams = this.buildFilterParams();
    if (pageParams['contrat']) params['contrat'] = pageParams['contrat'];
    if (pageParams['from']) params['from'] = pageParams['from'];
    if (pageParams['to']) params['to'] = pageParams['to'];
    if (pageParams['ackOnly']) params['ackOnly'] = 'true';
    if (this.journalPreset) params['preset'] = this.journalPreset;
    if (this.journalAckFilter !== null) params['ackExpected'] = this.journalAckFilter;
    if (this.journalDestinationFilter && this.journalView === 'livraisons') {
      params['destination'] = this.journalDestinationFilter;
    }
    return params;
  }

  loadWidget7Journal(resetPage = false): void {
    if (resetPage) this.journalPage = 0;
    this.journalLoading = true;
    this.journalError = '';
    this.http.get<any>(`${this.apiUrl}/journal`, { params: this.buildJournalParams() }).subscribe({
      next: (res) => {
        this.journalTotal = Number(res?.totalElements) || 0;
        this.journalTotalPages = Number(res?.totalPages) || 0;
        this.journalRows = (res?.content || []).map((r: any) => this.mapJournalRow(r));
        this.journalLoading = false;
      },
      error: () => {
        this.journalError = 'Impossible de charger le journal. Vérifiez que le backend est démarré.';
        this.journalRows = [];
        this.journalTotal = 0;
        this.journalTotalPages = 0;
        this.journalLoading = false;
      },
    });
  }

  private mapJournalRow(r: any) {
    const dateRaw = r.dateEnvoi ?? r.dateenvoi;
    return {
      foId: r.foId != null ? Number(r.foId) : null,
      fileInId: Number(r.fileInId ?? r.fileinId) || 0,
      contrat: String(r.contrat ?? '—'),
      workflow: String(r.workflow ?? '—'),
      dateEnvoi: dateRaw ? String(dateRaw) : '—',
      priorite: String(r.priorite ?? '—'),
      ackAttendu: r.ackAttendu != null ? Number(r.ackAttendu) : null,
      destination: r.destination != null ? Number(r.destination) : null,
      statutAck: String(r.statutAck ?? r.statutack ?? '—'),
      typeAck: r.typeAck != null ? String(r.typeAck) : (r.typeack != null ? String(r.typeack) : null),
    };
  }

  investigateFromFunnel(): void {
    const step = this.selectedFunnelStep ?? 'livraisons';
    this.journalPreset = '';
    this.journalAckFilter = null;
    this.clearDestinationsDrill(false);
    switch (step) {
      case 'recus':
        this.journalView = 'non_livre';
        break;
      case 'livres':
      case 'livraisons':
        this.journalView = 'livraisons';
        break;
      case 'ack':
        this.journalView = 'livraisons';
        this.journalPreset = 'ack_confirme';
        break;
    }
    this.loadWidget7Journal(true);
    setTimeout(() => {
      document.getElementById('fo-journal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  setJournalView(view: 'livraisons' | 'non_livre'): void {
    this.journalView = view;
    if (view === 'non_livre') {
      this.journalPreset = '';
      this.journalAckFilter = null;
      this.clearDestinationsDrill(false);
    }
    this.loadWidget7Journal(true);
  }

  setJournalPreset(preset: '' | 'ack_confirme' | 'ack_manquant'): void {
    this.journalPreset = preset;
    this.journalView = 'livraisons';
    this.clearDestinationsDrill(false);
    this.loadWidget7Journal(true);
  }

  onJournalPageChange(delta: number): void {
    const next = this.journalPage + delta;
    if (next >= 0 && next < this.journalTotalPages) {
      this.journalPage = next;
      this.loadWidget7Journal();
    }
  }

  onJournalSizeChange(): void {
    this.loadWidget7Journal(true);
  }

  formatJournalDate(value: string): string {
    if (!value || value === '—') return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value.slice(0, 19).replace('T', ' ');
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  getAckBadgeClass(statut: string): string {
    if (statut === 'Confirmé') return 'fo-badge-ack-ok';
    if (statut === 'Non livré') return 'fo-badge-neutral';
    return 'fo-badge-ack-pending';
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
