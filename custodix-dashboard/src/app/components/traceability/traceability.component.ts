import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TraceabilityService } from '../../services/traceability.service';
import { FlowFileInService } from '../../services/flow-filein.service';

@Component({
  selector: 'app-traceability',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './traceability.component.html',
  styleUrl: './traceability.component.css'
})
export class TraceabilityComponent implements OnInit {

  // ===== Recherche (Widget 1) =====
  searchTerm: string = '';
  selectedContract: string = '';
  selectedWorkflow: string = '';
  searchResults: any[] = [];
  page: number = 0;
  size: number = 10;
  totalPages: number = 0;
  totalElements: number = 0;
  isSearching: boolean = false;

  // ===== Listes pour les filtres =====
  contracts: string[] = [];
  workflows: string[] = [];

  // ===== Détail Actif (Arbre de Traçabilité - DTO) =====
  selectedTrace: any = null;
  activeId: number | null = null;
  isLoadingDetails: boolean = false;

  // ===== Pinboard de Surveillance (Widget 6) =====
  pinnedItems: any[] = [];

  constructor(
    private traceabilityService: TraceabilityService,
    private fileInService: FlowFileInService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadPinned();
    this.search(true);
  }

  // Charge les contrats et workflows pour alimenter les listes déroulantes de filtres
  loadFilterOptions(): void {
    this.fileInService.getFilterContracts().subscribe(res => {
      this.contracts = res;
      this.cdr.markForCheck();
    });
    this.fileInService.getFilterWorkflows().subscribe(res => {
      this.workflows = res;
      this.cdr.markForCheck();
    });
  }

  // Lance la recherche paginée
  search(resetPage: boolean = true): void {
    if (resetPage) {
      this.page = 0;
    }
    this.isSearching = true;
    this.traceabilityService.searchFiles({
      searchTerm: this.searchTerm,
      contrat: this.selectedContract,
      workflow: this.selectedWorkflow,
      page: this.page,
      size: this.size
    }).subscribe({
      next: (res) => {
        this.searchResults = res.content;
        this.totalPages = res.totalPages;
        this.totalElements = res.totalElements;
        this.isSearching = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isSearching = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Sélectionne un fichier pour charger ses détails complets de traçabilité
  selectTrace(id: number): void {
    this.activeId = id;
    this.isLoadingDetails = true;
    this.selectedTrace = null;
    this.cdr.markForCheck();

    this.traceabilityService.getTraceabilityDetails(id).subscribe({
      next: (res) => {
        this.selectedTrace = res;
        this.isLoadingDetails = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingDetails = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Pagination
  prevPage(): void {
    if (this.page > 0) {
      this.page--;
      this.search(false);
    }
  }

  nextPage(): void {
    if (this.page < this.totalPages - 1) {
      this.page++;
      this.search(false);
    }
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedContract = '';
    this.selectedWorkflow = '';
    this.search(true);
  }

  // ===== Gestion du Pinboard (LocalStorage) =====
  loadPinned(): void {
    try {
      const items = localStorage.getItem('custodix_pinned_traces');
      this.pinnedItems = items ? JSON.parse(items) : [];
    } catch (e) {
      this.pinnedItems = [];
    }
  }

  savePinned(): void {
    localStorage.setItem('custodix_pinned_traces', JSON.stringify(this.pinnedItems));
  }

  isPinned(id: number): boolean {
    return this.pinnedItems.some(item => item.fileInId === id);
  }

  togglePin(item: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (this.isPinned(item.fileInId)) {
      this.pinnedItems = this.pinnedItems.filter(p => p.fileInId !== item.fileInId);
    } else {
      // On sauvegarde juste l'essentiel pour le panneau d'épinglage
      this.pinnedItems.push({
        fileInId: item.fileInId,
        fileName: item.fileName,
        contract: item.contract,
        flowStatus: item.flowStatus || 'En cours'
      });
    }
    this.savePinned();
    this.cdr.markForCheck();
  }

  // ===== Formattage des latences =====
  formatDuration(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return '—';
    if (ms < 1000) return `${ms} ms`;
    const secs = ms / 1000;
    if (secs < 60) return `${secs.toFixed(1)} s`;
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins} min ${remainingSecs} s`;
  }

  // ===== Calcul de l'état de santé global du cycle =====
  computeGlobalHealth(): { level: string; label: string; icon: string } {
    if (!this.selectedTrace) return { level: 'info', label: 'Inconnu', icon: '⚪' };
    
    const flowStatus = this.selectedTrace.flowStatus;
    const expeditions = this.selectedTrace.expeditions || [];
    
    if (['InTechnicalError', 'Blocked', 'Rejected'].includes(flowStatus)) {
      return { level: 'danger', label: 'Erreur Technique', icon: '🔴' };
    }
    
    let hasNack = false;
    let hasMissing = false;
    let hasAck = false;
    
    for (const exp of expeditions) {
      if (exp.ackStatus === 'NACK') hasNack = true;
      if (exp.ackStatus === 'MISSING') hasMissing = true;
      if (exp.ackStatus === 'ACK') hasAck = true;
    }
    
    if (hasNack) {
      return { level: 'danger', label: 'Rejeté (NACK)', icon: '🔴' };
    }
    if (hasMissing) {
      return { level: 'warning', label: 'En attente (MISSING)', icon: '🟡' };
    }
    if (hasAck || flowStatus === 'Processed' || flowStatus === 'Sent' || flowStatus === 'Acked') {
      return { level: 'success', label: 'Opérationnel (ACK)', icon: '🟢' };
    }
    
    return { level: 'info', label: 'En cours', icon: '🔵' };
  }

  // ===== Résolveur de classe CSS pour les statuts =====
  getStatusClass(status: string): string {
    if (!status) return 'status-init';
    const s = status.toUpperCase();
    if (['PROCESSED', 'SENT', 'ACKED', 'ACK', 'OK', 'DELIVERED'].includes(s)) return 'status-ok';
    if (['INTECHNICALERROR', 'BLOCKED', 'REJECTED', 'NACK', 'ERROR', 'FAILED'].includes(s)) return 'status-error';
    if (['MISSING', 'WAITING', 'PENDING'].includes(s)) return 'status-warning';
    return 'status-info';
  }

  // ===== Résolveur de classe SLA pour les durées =====
  getSlaClass(ackDurationMs: number | null | undefined): string {
    if (ackDurationMs === null || ackDurationMs === undefined) return 'sla-none';
    if (ackDurationMs > 3600000) return 'sla-critical'; // > 1 heure
    if (ackDurationMs > 1800000) return 'sla-warning';  // > 30 minutes
    return 'sla-ok';
  }

  // ===== Comptage des états d'acquittement =====
  countAck(status: string): number {
    if (!this.selectedTrace || !this.selectedTrace.expeditions) return 0;
    return this.selectedTrace.expeditions.filter((e: any) => {
      const s = e.ackStatus ? e.ackStatus.toUpperCase() : '';
      return s === status.toUpperCase();
    }).length;
  }
}

