import { Component, OnInit, inject, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { NgApexchartsModule } from 'ng-apexcharts';
import { AiChatService } from '../../services/ai-chat.service';
import { ThemeService } from '../../services/theme';
import { finalize } from 'rxjs';
 
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexStroke,
  ApexTooltip,
  ApexFill,
  ApexGrid,
  ApexDataLabels,
  ApexLegend,
  ApexMarkers
} from 'ng-apexcharts';
 
export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  tooltip: ApexTooltip;
  fill: ApexFill;
  grid: ApexGrid;
  dataLabels: ApexDataLabels;
  colors: string[];
  legend: ApexLegend;
  markers: ApexMarkers;
};
 
export interface PerformanceLatency {
  fileInId: number;
  contract: string;
  workflow: string;
  priority: number;
  sendingDate: string;
  creationDateFlow: string;
  updateDateFlow: string;
  sendingDateAck: string;
  ackExpected: number;
  status: string;
  
  // Champs calculés côté client
  t1: number;
  t2: number;
  t3: number;
  isBreached: boolean;
}
 
@Component({
  selector: 'app-performance',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, NgApexchartsModule],
  templateUrl: './performance.component.html',
  styleUrls: ['./performance.component.css']
})
export class PerformanceComponent implements OnInit {
  private http = inject(HttpClient);
  private aiService = inject(AiChatService);
  public themeService = inject(ThemeService);
 
  constructor() {
    effect(() => {
      // Détecter les changements de theme
      const dark = this.themeService.isDark();
      if (this.rawLatencies.length > 0) {
        this.renderCharts();
      }
    });
  }

  // Mode d'affichage: 'business' | 'noc'
  public viewMode: 'business' | 'noc' = 'noc';
  
  // Niveau d'audit actif
  public activePreset: string = 'silver';

  // Seuils d'évaluation (selon le niveau choisi)
  public t1SlaSec: number = 5;   // Intégration (5 s par défaut)
  public t2SlaSec: number = 120; // Traitement (2 min par défaut)
  public t3SlaMin: number = 15;  // Attente partenaire (15 min par défaut)

  // Filtres
  public selectedContract: string = '';
  public selectedWorkflow: string = '';
  public searchQuery: string = '';
  public startDate: string = '';
  public endDate: string = '';

  // Listes de filtres distincts
  public contracts: string[] = [];
  public workflows: string[] = [];

  // Données
  public rawLatencies: any[] = [];
  public processedLatencies: PerformanceLatency[] = [];
  public filteredLatencies: PerformanceLatency[] = [];
  public displayedLatencies: PerformanceLatency[] = [];

  // Pagination journal
  public currentPage: number = 1;
  public pageSize: number = 10;
  public totalPages: number = 1;

  // KPIs
  public totalCount: number = 0;
  public breachedCount: number = 0;
  public complianceRate: number = 100;

  public avgT1: number = 0;
  public avgT2: number = 0;
  public avgT3: number = 0;

  // Pipeline : Analyse des goulots d'étranglement
  // pipelineLatencies = filteredLatencies + filtre pipelineSearchId (vue propre au widget)
  public pipelineLatencies: PerformanceLatency[] = [];
  public pipelineSearchId: string = '';
  public stepFilter: 't1' | 't2' | 't3' | null = null;
  public stepFilterLabel: string = '';
  public breachedT1Count: number = 0;
  public breachedT2Count: number = 0;
  public breachedT3Count: number = 0;
  public top5T1: PerformanceLatency[] = [];
  public top5T2: PerformanceLatency[] = [];
  public top5T3: PerformanceLatency[] = [];

  // Nombre de fichiers dans la vue pipeline (≠ totalCount qui est la vue globale)
  public get pipelineCount(): number {
    return this.pipelineLatencies.length;
  }

  // Info popovers (cartes "i")
  public activeWidget: string | null = null;
  public popoverPos: { top: number; left: number } | null = null;

  readonly widgetInfo: Record<string, { icon: string; title: string; what: string; how: string; action: string }> = {
    conformite: {
      icon: '✅',
      title: 'Taux de conformité',
      what: 'Pourcentage de fichiers traités dans les seuils définis (Intégration, Traitement Custodix, Attente partenaire).',
      how: '(Total fichiers − Hors délais) × 100 ÷ Total fichiers. Un fichier est "hors délais" si l\'une de ses 3 étapes dépasse le seuil correspondant.',
      action: 'Si le taux baisse, identifier l\'étape responsable via le tableau des hors délais.'
    },
    volume: {
      icon: '📦',
      title: 'Volume analysé',
      what: 'Nombre total de fichiers pris en compte dans l\'audit en cours.',
      how: 'Somme des fichiers retournés par la base de données après application des filtres (Contrat, Workflow, Dates).',
      action: 'Un volume faible peut indiquer un filtre trop restrictif ou un manque de données sur la période sélectionnée.'
    },
    tempsMoyen: {
      icon: '⏱️',
      title: 'Temps de cycle total',
      what: 'Durée moyenne cumulée des 3 étapes du cycle de vie d\'un fichier.',
      how: 'Moyenne de (Intégration + Traitement + Attente partenaire) calculée sur tous les fichiers de l\'échantillon.',
      action: 'Comparer chaque étape avec son seuil pour identifier le goulot d\'étranglement.'
    },
    seuils: {
      icon: '📊',
      title: 'Seuils d\'évaluation',
      what: 'Règles appliquées pour qualifier un fichier "conforme" ou "hors délais".',
      how: '3 niveaux prédéfinis : Exigence haute (strict), Standard (moyen), Souple (tolérant). Chaque niveau fixe un temps maximum pour l\'Intégration, le Traitement Custodix et l\'Attente partenaire.',
      action: 'Changer de niveau pour observer l\'impact sur le taux de conformité et le nombre de fichiers hors délais.'
    },
    goulots: {
      icon: '🔍',
      title: 'Analyse des Goulots',
      what: 'Identifie à quelle étape du cycle de vie (Intégration, Traitement EAI, Attente partenaire) les fichiers sont les plus lents et dépasse leur SLA.',
      how: 'Pour chaque étape, on compte les fichiers dont le temps mesuré (T1, T2 ou T3) dépasse le seuil défini. La barre bicolore montre la proportion conforme (vert) vs hors délais (rouge). Le Top5 liste les 5 fichiers les plus lents sur l\'étape sélectionnée.',
      action: 'Cliquer sur une étape pour filtrer le journal en bas. Utiliser la recherche par ID pour isoler un flux précis dans les statistiques.'
    }
  };

  toggleWidget(key: string, event: Event): void {
    event.stopPropagation();
    if (this.activeWidget === key) {
      this.closeWidget();
      return;
    }
    this.activeWidget = key;
    const wrap = event.currentTarget as HTMLElement;
    if (wrap) {
      const rect = wrap.getBoundingClientRect();
      let left = rect.left;
      if (left + 290 > window.innerWidth - 16) {
        left = window.innerWidth - 290 - 16;
      }
      this.popoverPos = { top: rect.bottom + 4, left };
    }
  }

  closeWidget(): void {
    this.activeWidget = null;
    this.popoverPos = null;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeWidget();
  }

  // Ligne dépliée (Recherche 1-à-N)
  public expandedFileId: number | null = null;
  public subDeliveries: any[] = [];

  // IA Copilot
  public isAnalyzing: boolean = false;
  public aiDiagnostic: string = '';
  public userAiQuery: string = '';

  // Options graphiques ApexCharts
  public scatterChartOptions!: Partial<ChartOptions> | any;
  public barChartOptions!: Partial<ChartOptions> | any;
  public chartsLoaded: boolean = false;

  ngOnInit(): void {
    this.fetchData();
  }

  public toggleViewMode(): void {
    this.viewMode = this.viewMode === 'noc' ? 'business' : 'noc';
    setTimeout(() => this.renderCharts(), 50);
  }

  // toggleNocLiveMode supprimé (inutile sur copie locale)

  public selectScenario(type: string): void {
    this.activePreset = type;
    if (type === 'gold') {
      this.t1SlaSec = 2;
      this.t2SlaSec = 30;
      this.t3SlaMin = 5;
    } else if (type === 'silver') {
      this.t1SlaSec = 5;
      this.t2SlaSec = 120;
      this.t3SlaMin = 15;
    } else if (type === 'bronze') {
      this.t1SlaSec = 10;
      this.t2SlaSec = 600;
      this.t3SlaMin = 60;
    }
    this.applyFiltersAndAudit();
  }

  public fetchData(): void {
    let url = 'http://localhost:8080/api/performance/latencies';
    
    // Ajout des filtres de date pour l'API si spécifiés
    const params: string[] = [];
    if (this.startDate) params.push(`from=${this.startDate}T00:00:00`);
    if (this.endDate) params.push(`to=${this.endDate}T23:59:59`);
    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.rawLatencies = data;
        this.extractFilterLists();
        this.processLatencies();
        this.applyFiltersAndAudit();
      },
      error: (err) => console.error('Erreur de chargement des latences:', err)
    });
  }

  private extractFilterLists(): void {
    const contractsSet = new Set<string>();
    const workflowsSet = new Set<string>();

    this.rawLatencies.forEach(item => {
      if (item.contract) contractsSet.add(item.contract);
      if (item.workflow) workflowsSet.add(item.workflow);
    });

    this.contracts = Array.from(contractsSet).sort();
    this.workflows = Array.from(workflowsSet).sort();
  }

  private processLatencies(): void {
    const sysDate = new Date().getTime();

    this.processedLatencies = this.rawLatencies.map(item => {
      const dReception = item.sendingDate ? new Date(item.sendingDate).getTime() : null;
      const dCreationFlow = item.creationDateFlow ? new Date(item.creationDateFlow).getTime() : null;
      const dUpdateFlow = item.updateDateFlow ? new Date(item.updateDateFlow).getTime() : null;
      const dAck = item.sendingDateAck ? new Date(item.sendingDateAck).getTime() : null;

      // T1 : Temps d'intégration physique
      let t1 = 0;
      if (dCreationFlow && dReception) {
        t1 = Math.max(0, (dCreationFlow - dReception) / 1000);
      }

      // T2 : Temps de traitement logique
      let t2 = 0;
      if (dUpdateFlow && dCreationFlow) {
        t2 = Math.max(0, (dUpdateFlow - dCreationFlow) / 1000);
      }

      // T3 : Temps d'acquittement externe
      let t3 = 0;
      if (item.ackExpected === 1) {
        if (dAck && dUpdateFlow) {
          t3 = Math.max(0, (dAck - dUpdateFlow) / 1000);
        } else if (dUpdateFlow) {
          // Dérive dynamique par rapport à SYSDATE
          t3 = Math.max(0, (sysDate - dUpdateFlow) / 1000);
        }
      }

      return {
        ...item,
        t1,
        t2,
        t3,
        isBreached: false
      };
    });
  }

  // Se déclenche à chaque modification des sliders/filtres
  public applyFiltersAndAudit(): void {
    // 1. Filtrer les latences globales (contrat, workflow, searchQuery, dates)
    // NOTE: pipelineSearchId N'EST PAS inclus ici — il a sa propre vue (pipelineLatencies)
    this.filteredLatencies = this.processedLatencies.filter(item => {
      if (this.selectedContract && item.contract !== this.selectedContract) return false;
      if (this.selectedWorkflow && item.workflow !== this.selectedWorkflow) return false;
      if (this.searchQuery) {
        const query = this.searchQuery.trim().toLowerCase();
        if (item.fileInId.toString().indexOf(query) === -1) return false;
      }
      return true;
    });

    // 2. Détection des fichiers hors délais
    this.breachedCount = 0;
    let sumT1 = 0, sumT2 = 0, sumT3 = 0, countT3 = 0;

    this.filteredLatencies.forEach(item => {
      const isT1Breached = item.t1 > this.t1SlaSec;
      const isT2Breached = item.t2 > this.t2SlaSec;
      const isT3Breached = item.ackExpected === 1 && item.t3 > (this.t3SlaMin * 60);
      item.isBreached = isT1Breached || isT2Breached || isT3Breached;

      if (item.isBreached) this.breachedCount++;

      sumT1 += item.t1;
      sumT2 += item.t2;
      if (item.ackExpected === 1) {
        sumT3 += item.t3;
        countT3++;
      }
    });

    this.totalCount = this.filteredLatencies.length;
    this.complianceRate = this.totalCount > 0 
      ? parseFloat(((this.totalCount - this.breachedCount) * 100 / this.totalCount).toFixed(1)) 
      : 100;

    this.avgT1 = this.totalCount > 0 ? sumT1 / this.totalCount : 0;
    this.avgT2 = this.totalCount > 0 ? sumT2 / this.totalCount : 0;
    this.avgT3 = countT3 > 0 ? sumT3 / countT3 : 0;

    // 3. Paginer le journal
    this.currentPage = 1;
    this.paginateJournal();

    // 4. Vue pipeline : applique pipelineSearchId par-dessus filteredLatencies
    // puis recalcule les barres et le Top5 (sans toucher aux KPIs globaux)
    this.computePipelineView();

    // 5. Rendu des graphiques
    this.renderCharts();
  }

  // ─── PIPELINE VIEW ────────────────────────────────────────────────────────
  // Calcule la vue propre au widget pipeline :
  //   - pipelineLatencies = filteredLatencies PLUS filtre pipelineSearchId
  //   - Met à jour les barres (breachedT1/2/3Count) et les Top5
  //   - N'affecte PAS les KPIs globaux ni le journal
  public computePipelineView(): void {
    const pid = this.pipelineSearchId.trim().toLowerCase();
    this.pipelineLatencies = pid
      ? this.filteredLatencies.filter(item =>
          item.fileInId.toString().indexOf(pid) !== -1
        )
      : this.filteredLatencies;

    this.computePipelineStats();
  }

  // Calcule les compteurs de violations et les Top5 à partir de pipelineLatencies
  public computePipelineStats(): void {
    this.breachedT1Count = 0;
    this.breachedT2Count = 0;
    this.breachedT3Count = 0;

    const t1List: PerformanceLatency[] = [];
    const t2List: PerformanceLatency[] = [];
    const t3List: PerformanceLatency[] = [];

    // On travaille sur pipelineLatencies (vue isolée du widget)
    this.pipelineLatencies.forEach(item => {
      if (item.t1 > this.t1SlaSec) {
        this.breachedT1Count++;
        t1List.push(item);
      }
      if (item.t2 > this.t2SlaSec) {
        this.breachedT2Count++;
        t2List.push(item);
      }
      if (item.ackExpected === 1 && item.t3 > (this.t3SlaMin * 60)) {
        this.breachedT3Count++;
        t3List.push(item);
      }
    });

    t1List.sort((a, b) => b.t1 - a.t1);
    t2List.sort((a, b) => b.t2 - a.t2);
    t3List.sort((a, b) => b.t3 - a.t3);

    this.top5T1 = t1List.slice(0, 5);
    this.top5T2 = t2List.slice(0, 5);
    this.top5T3 = t3List.slice(0, 5);
  }

  public setPipelineStepFilter(step: 't1' | 't2' | 't3'): void {
    if (this.stepFilter === step) {
      this.clearPipelineStepFilter();
      return;
    }
    this.stepFilter = step;
    const labels: Record<string, string> = { t1: 'Intégration', t2: 'Traitement', t3: 'Attente partenaire' };
    this.stepFilterLabel = 'Filtré par : ' + labels[step];
    this.currentPage = 1;
    this.paginateJournal();
  }

  public clearPipelineStepFilter(): void {
    this.stepFilter = null;
    this.stepFilterLabel = '';
    this.currentPage = 1;
    this.paginateJournal();
  }

  // Recherche ID dans le pipeline : recompute SEULEMENT la vue pipeline
  // Les KPIs globaux, le journal et les graphiques ne sont PAS recalculés
  public onPipelineSearchChange(): void {
    this.computePipelineView();
  }

  public clearPipelineSearch(): void {
    this.pipelineSearchId = '';
    this.computePipelineView();
  }

  // Retourne les fichiers correspondant à la recherche ID pipeline
  // (pipelineLatencies est déjà filtré par computePipelineView)
  public get searchedFiles(): PerformanceLatency[] {
    if (!this.pipelineSearchId.trim()) return [];
    return this.pipelineLatencies;
  }

  public get top5ForStep(): PerformanceLatency[] {
    if (this.stepFilter === 't1') return this.top5T1;
    if (this.stepFilter === 't2') return this.top5T2;
    if (this.stepFilter === 't3') return this.top5T3;
    return [];

  }

  public get latencyForStep(): string {
    if (this.stepFilter === 't1') return 't1';
    if (this.stepFilter === 't2') return 't2';
    if (this.stepFilter === 't3') return 't3';
    return '';
  }

  public get thresholdForStep(): number {
    if (this.stepFilter === 't1') return this.t1SlaSec;
    if (this.stepFilter === 't2') return this.t2SlaSec;
    if (this.stepFilter === 't3') return this.t3SlaMin * 60;
    return 0;
  }

  public getStepLatency(item: PerformanceLatency): number {
    if (this.stepFilter === 't1') return item.t1;
    if (this.stepFilter === 't2') return item.t2;
    if (this.stepFilter === 't3') return item.t3;
    return 0;
  }

  public paginateJournal(): void {
    const source = this.getJournalSource();
    this.totalPages = Math.ceil(source.length / this.pageSize) || 1;
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.displayedLatencies = source.slice(startIndex, startIndex + this.pageSize);
  }

  private getJournalSource(): PerformanceLatency[] {
    if (this.stepFilter === 't1') {
      return this.filteredLatencies.filter(item => item.t1 > this.t1SlaSec);
    }
    if (this.stepFilter === 't2') {
      return this.filteredLatencies.filter(item => item.t2 > this.t2SlaSec);
    }
    if (this.stepFilter === 't3') {
      return this.filteredLatencies.filter(item => item.ackExpected === 1 && item.t3 > (this.t3SlaMin * 60));
    }
    return this.filteredLatencies;
  }

  public prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.paginateJournal();
    }
  }

  public nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.paginateJournal();
    }
  }

  // Recherche 1-à-N : Déplier les flux de livraisons réseau rattachés
  public toggleExpandRow(fileInId: number): void {
    if (this.expandedFileId === fileInId) {
      this.expandedFileId = null;
      this.subDeliveries = [];
    } else {
      this.expandedFileId = fileInId;
      this.subDeliveries = [];
      const item = this.processedLatencies.find(x => x.fileInId === fileInId);
      if (item && item.ackExpected === 1) {
        this.subDeliveries.push({
          deliveryId: fileInId * 3 + 1,
          destId: 'FTP_DEST_' + item.contract,
          t3: item.t3,
          status: item.sendingDateAck ? 'CONFIRMÉ' : 'DÉRIVE / ATTENTE',
          ackType: item.sendingDateAck ? 'ACK' : '—',
          dateAck: item.sendingDateAck || 'Non reçu'
        });
      } else if (item) {
        this.subDeliveries.push({
          deliveryId: fileInId * 3 + 1,
          destId: 'SFTP_PARTNER_DIRECT',
          t3: 0,
          status: 'LIVRÉ SANS ACK ATTENDU',
          ackType: 'N/A',
          dateAck: 'Non attendu'
        });
      }
    }
  }

  // Génération du rapport de audit par défaut
  public generateAiDiagnostic(): void {
    this.isAnalyzing = true;
    this.aiDiagnostic = '';

    const contractBreachesMap = new Map<string, number>();
    this.filteredLatencies.forEach(x => {
      if (x.isBreached) {
        contractBreachesMap.set(x.contract, (contractBreachesMap.get(x.contract) || 0) + 1);
      }
    });

    let worstContract = 'Aucun';
    let maxBreaches = 0;
    contractBreachesMap.forEach((v, k) => {
      if (v > maxBreaches) {
        maxBreaches = v;
        worstContract = k;
      }
    });

    const prompt = `Générer un rapport d'audit et de recommandations de performance pour Custodix.
    Les statistiques actuelles sous les seuils SLA (Traitement max: ${this.t2SlaSec}s, ACK max: ${this.t3SlaMin}min) sont :
    - Taux de conformité global: ${this.complianceRate}%
    - Nombre de violations: ${this.breachedCount} sur ${this.totalCount} fichiers.
    - Fichiers en infraction: ${this.breachedCount}.
    - Latences moyennes: T1 (Intégration) = ${this.avgT1.toFixed(1)}s, T2 (Traitement) = ${this.avgT2.toFixed(1)}s, T3 (Acquittement) = ${this.avgT3.toFixed(1)}s.
    - Contrat le plus pénalisant: ${worstContract} avec ${maxBreaches} violations.`;

    this.aiService.askQuestion({ question: prompt })
      .pipe(finalize(() => this.isAnalyzing = false))
      .subscribe({
        next: (res) => {
          let html = `<div class="ai-query-bubble"><strong>Audit Global :</strong> Configuration de SLA Actuelle</div>`;
          html += `<div class="ai-answer-bubble"><p>${res.answer || this.getFallbackDiagnostic(worstContract, maxBreaches)}</p></div>`;
          this.aiDiagnostic = html;
        },
        error: () => {
          this.aiDiagnostic = `<div class="ai-query-bubble"><strong>Audit Global :</strong> Configuration de SLA Actuelle (Fallback)</div>` +
            `<div class="ai-answer-bubble">${this.getFallbackDiagnostic(worstContract, maxBreaches)}</div>`;
        }
      });
  }

  public askPreset(preset: string): void {
    this.userAiQuery = preset;
    this.askAi();
  }

  public askAi(): void {
    if (!this.userAiQuery.trim()) return;
    this.isAnalyzing = true;
    this.aiDiagnostic = '';

    const queryText = this.userAiQuery;
    this.userAiQuery = '';

    // N'ajouter la note SLA que si la question concerne explicitement les SLAs, retards ou violations
    const lower = queryText.toLowerCase();
    const needsSla = lower.includes('sla') || lower.includes('retard') || lower.includes('violation') || 
                      lower.includes('depass') || lower.includes('breach') || lower.includes('seuil') || 
                      lower.includes('conforme') || lower.includes('penalite');

    const contextualizedQuestion = needsSla
      ? `${queryText} (Note: Seuil cible T2 = ${this.t2SlaSec}s, Seuil cible T3 = ${this.t3SlaMin * 60}s).`
      : queryText;

    this.aiService.askQuestion({ question: contextualizedQuestion })
      .pipe(finalize(() => this.isAnalyzing = false))
      .subscribe({
        next: (res) => {
          let html = `<div class="ai-query-bubble"><strong>Question :</strong> ${queryText}</div>`;
          html += `<div class="ai-answer-bubble"><p>${res.answer || "Aucune réponse rédigée n'a pu être générée."}</p></div>`;
          this.aiDiagnostic = html;
        },
        error: (err) => {
          this.aiDiagnostic = `<p class="text-danger">Erreur lors de l'appel de l'agent IA. Assurez-vous que le serveur Python tourne sur le port 8000. Détail : ${err.message || 'Inconnu'}</p>`;
        }
      });
  }

  private getFallbackDiagnostic(worstContract: string, maxBreaches: number): string {
    const causeT3 = this.avgT3 > (this.t3SlaMin * 60);
    const causeT2 = this.avgT2 > this.t2SlaSec;

    return `### 📊 Rapport d'Audit Performance & SLA
    
**1. Synthèse Executive :**
Le système affiche un taux de conformité de **${this.complianceRate}%** sur **${this.totalCount} fichiers analysés**, dont **${this.breachedCount} hors délais**.

**2. Analyse des Goulots d'Étranglement :**
* ${causeT3 ? `🔴 **Attente partenaire** : La latence d'acquittement externe moyenne de **${(this.avgT3/60).toFixed(1)} min** dépasse votre seuil de **${this.t3SlaMin} min**.` : `💚 **Attente partenaire** : La latence d'acquittement externe reste sous contrôle.`}
* ${causeT2 ? `🔴 **Traitement interne** : Le moteur EAI sature avec une latence moyenne de **${this.avgT2.toFixed(1)}s**, supérieure à votre cible de **${this.t2SlaSec}s**.` : `💚 **Traitement interne** : Les performances du moteur logique EAI sont stables.`}

**3. Client Critique Identifié :**
Le contrat **"${worstContract}"** est la source la plus importante de dérives avec **${maxBreaches} violations** de contrats de service.

**4. Actions Correctives Recommandées :**
1. **Renégociation** : Proposer d'augmenter le SLA d'acquittement à 30 minutes pour le contrat **"${worstContract}"**.
2. **Optimisation** : Inspecter le serveur FTP du client **"${worstContract}"** qui engorge la file d'attente.`;
  }

  // Rendu des graphiques avec ApexCharts
  private renderCharts(): void {
    if (this.filteredLatencies.length === 0) {
      this.chartsLoaded = false;
      return;
    }

    const isDark = this.themeService.isDark();
    const labelColor = isDark ? '#8892b0' : '#475569';
    const gridColor = isDark ? '#1e293b' : '#e2e8f0';
    const tooltipTheme = isDark ? 'dark' : 'light';
    const scatterColor = isDark ? '#00f2fe' : '#0891b2';

    // 1. SCATTER PLOT
    // Extraction des points (T2 et T3)
    const scatterData: { x: number; y: number }[] = [];
    // Limiter aux 200 dernières transactions pour de meilleures performances graphiques
    const recentLatencies = this.filteredLatencies.slice(-200);
    recentLatencies.forEach((item, index) => {
      scatterData.push({
        x: index + 1,
        y: parseFloat((item.t2 + (item.ackExpected === 1 ? item.t3 : 0)).toFixed(1))
      });
    });

    this.scatterChartOptions = {
      series: [{
        name: 'Latence Totale (sec)',
        data: scatterData
      }],
      chart: {
        height: 250,
        type: 'scatter',
        zoom: { enabled: true, type: 'xy' },
        background: 'transparent',
        toolbar: { show: false }
      },
      colors: [scatterColor],
      xaxis: {
        tickAmount: 10,
        title: { text: 'Transactions (Chronologique)', style: { color: labelColor } },
        labels: { style: { colors: labelColor } }
      },
      yaxis: {
        title: { text: 'Temps (secondes)', style: { color: labelColor } },
        labels: { style: { colors: labelColor } }
      },
      grid: {
        borderColor: gridColor,
        strokeDashArray: 4
      },
      markers: {
        size: 6,
        strokeColors: isDark ? '#0f172a' : '#ffffff',
        hover: { size: 8 }
      },
      tooltip: {
        theme: tooltipTheme,
        x: { formatter: (val: number) => `Transaction #${val}` }
      }
    };

    // 2. STACKED BAR CHART
    // Agréger la latence moyenne par contrat (Top 7 contrats pour rester lisible)
    const contractStatsMap = new Map<string, { t1: number, t2: number, t3: number, count: number }>();
    this.filteredLatencies.forEach(item => {
      const contractKey = item.contract || 'Sans contrat';
      const stats = contractStatsMap.get(contractKey) || { t1: 0, t2: 0, t3: 0, count: 0 };
      stats.t1 += item.t1;
      stats.t2 += item.t2;
      stats.t3 += item.t3;
      stats.count++;
      contractStatsMap.set(contractKey, stats);
    });

    const contractsLabels: string[] = [];
    const avgT1Series: number[] = [];
    const avgT2Series: number[] = [];
    const avgT3Series: number[] = [];

    // Trier par count et limiter à 7 contrats
    Array.from(contractStatsMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 7)
      .forEach(([key, val]) => {
        contractsLabels.push(key);
        avgT1Series.push(parseFloat((val.t1 / val.count).toFixed(1)));
        avgT2Series.push(parseFloat((val.t2 / val.count).toFixed(1)));
        avgT3Series.push(parseFloat((val.t3 / val.count).toFixed(1)));
      });

    this.barChartOptions = {
      series: [
        { name: 'Intégration (sec)', data: avgT1Series },
        { name: 'Traitement (sec)', data: avgT2Series },
        { name: 'Attente partenaire (sec)', data: avgT3Series }
      ],
      chart: {
        type: 'bar',
        height: 250,
        stacked: true,
        background: 'transparent',
        toolbar: { show: false }
      },
      colors: isDark ? ['#3b82f6', '#10b981', '#f59e0b'] : ['#2563eb', '#0d9488', '#d97706'],
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '60%'
        }
      },
      xaxis: {
        categories: contractsLabels,
        labels: { style: { colors: labelColor } }
      },
      yaxis: {
        labels: { style: { colors: labelColor } }
      },
      legend: {
        position: 'bottom',
        labels: { colors: labelColor }
      },
      grid: {
        borderColor: gridColor
      },
      tooltip: {
        theme: tooltipTheme
      }
    };

    this.chartsLoaded = true;
  }

  public trackByFileId(index: number, item: PerformanceLatency): number {
    return item.fileInId;
  }
}
