import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexStroke, ApexDataLabels, ApexTooltip, ApexFill,
  ApexPlotOptions, ApexGrid, ApexLegend, ApexNonAxisChartSeries
} from 'ng-apexcharts';
import { EaiHeaderService } from '../../services/eai-header';

@Component({
  selector: 'app-eai-header',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './eai-header.component.html',
  styleUrl: './eai-header.component.css'
})
export class EaiHeaderComponent implements OnInit {

  // ===== KPI Cards =====
  kpis: any = { total: 0, last24h: 0, distinctMessages: 0, distinctCreators: 0 };
  kpiLoading = true;

  // ===== Timeline =====
  timelineSeries: ApexAxisChartSeries = [{ name: 'Headers', data: [] }];
  timelineChart: ApexChart = { type: 'area', height: 280, toolbar: { show: false }, animations: { enabled: true } };
  timelineXAxis: ApexXAxis = { type: 'datetime', labels: { style: { colors: 'var(--text-muted)', fontSize: '11px' } } };
  timelineYAxis: ApexYAxis = { labels: { style: { colors: 'var(--text-muted)', fontSize: '11px' } } };
  timelineStroke: ApexStroke = { curve: 'smooth', width: 2 };
  timelineDataLabels: ApexDataLabels = { enabled: false };
  timelineFill: ApexFill = { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.02, stops: [0, 100] } };
  timelineTooltip: ApexTooltip = { x: { format: 'dd/MM/yyyy HH:mm' }, theme: 'dark' };
  timelineGrid: ApexGrid = { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 4 };
  timelineLoading = true;

  // Filtres timeline
  selectedBucket = 'auto';
  fromDate = '';
  toDate   = '';
  filterHeaderName = '';
  filterType = '';

  // ===== Donut — TYPE_ =====
  donutSeries: ApexNonAxisChartSeries = [];
  donutChart: ApexChart = { type: 'donut', height: 260 };
  donutLabels: string[] = [];
  donutLegend: ApexLegend = { position: 'bottom', fontSize: '12px', labels: { colors: 'var(--text-secondary)' } };
  donutTooltip: ApexTooltip = { theme: 'dark' };
  donutLoading = true;

  // ===== Horizontal Bar — Top HEADERNAME_ =====
  headerNameSeries: ApexAxisChartSeries = [{ name: 'Count', data: [] }];
  headerNameChart: ApexChart = { type: 'bar', height: 260, toolbar: { show: false } };
  headerNameXAxis: ApexXAxis = { labels: { style: { colors: 'var(--text-muted)', fontSize: '11px' } } };
  headerNameYAxis: ApexYAxis = { labels: { style: { colors: 'var(--text-muted)', fontSize: '11px' } } };
  headerNamePlot: ApexPlotOptions = { bar: { horizontal: true, borderRadius: 5, barHeight: '65%' } };
  headerNameDataLabels: ApexDataLabels = { enabled: false };
  headerNameGrid: ApexGrid = { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 4 };
  headerNameTooltip: ApexTooltip = { theme: 'dark' };
  headerNameLoading = true;

  // ===== Bar — HEADERTYPE_ =====
  headerTypeSeries: ApexAxisChartSeries = [{ name: 'Count', data: [] }];
  headerTypeChart: ApexChart = { type: 'bar', height: 220, toolbar: { show: false } };
  headerTypeXAxis: ApexXAxis = { labels: { style: { colors: 'var(--text-muted)', fontSize: '11px' }, rotate: -30 } };
  headerTypePlot: ApexPlotOptions = { bar: { borderRadius: 6, columnWidth: '55%', distributed: true } };
  headerTypeDataLabels: ApexDataLabels = { enabled: false };
  headerTypeGrid: ApexGrid = { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 4 };
  headerTypeTooltip: ApexTooltip = { theme: 'dark' };
  headerTypeLoading = true;

  // ===== Top Creators =====
  creators: { name: string; count: number; pct: number }[] = [];
  creatorsLoading = true;

  // ===== Paginated Table =====
  rows: any[] = [];
  totalElements = 0;
  totalPages = 0;
  currentPage = 0;
  pageSize = 20;
  tableLoading = true;
  
  // Table filters
  tableFromDate = '';
  tableToDate = '';
  tableHeaderName = '';
  tableType = '';

  constructor(private svc: EaiHeaderService) {}

  ngOnInit(): void {
    this.loadKpis();
    this.loadTimeline();
    this.loadDonut();
    this.loadHeaderName();
    this.loadHeaderType();
    this.loadCreators();
    this.loadTable(0);
  }

  // ===== Loaders =====

  loadKpis() {
    this.kpiLoading = true;
    this.svc.getKpis().subscribe({
      next: d => { this.kpis = d; this.kpiLoading = false; },
      error: () => { this.kpiLoading = false; }
    });
  }

  loadTimeline() {
    this.timelineLoading = true;
    const params: any = { bucket: this.selectedBucket };
    if (this.fromDate)        params.from = this.fromDate;
    if (this.toDate)          params.to   = this.toDate;
    if (this.filterHeaderName) params.headerName = this.filterHeaderName;
    if (this.filterType)       params.type = this.filterType;

    this.svc.getTimeline(params).subscribe({
      next: d => {
        this.timelineSeries = [{
          name: 'Headers',
          data: (d || []).map(p => ({ x: new Date(p.bucket).getTime(), y: p.total }))
        }];
        this.timelineLoading = false;
      },
      error: () => { this.timelineLoading = false; }
    });
  }

  loadDonut() {
    this.donutLoading = true;
    this.svc.getStatsByType().subscribe({
      next: d => {
        const clean = (d || []).filter(r => r[0] != null);
        this.donutLabels  = clean.map(r => this.cleanType(r[0]));
        this.donutSeries  = clean.map(r => Number(r[1]));
        this.donutLoading = false;
      },
      error: () => { this.donutLoading = false; }
    });
  }

  loadHeaderName() {
    this.headerNameLoading = true;
    this.svc.getStatsByHeaderName().subscribe({
      next: d => {
        const top10 = (d || []).filter(r => r[0] != null).slice(0, 10);
        const cats  = top10.map(r => String(r[0]));
        const vals  = top10.map(r => Number(r[1]));
        this.headerNameSeries = [{ name: 'Count', data: vals }];
        // For ApexCharts horizontal bar: categories go in xaxis
        this.headerNameXAxis  = {
          categories: cats,
          labels: { style: { colors: 'var(--text-muted)', fontSize: '11px' } }
        };
        this.headerNameLoading = false;
      },
      error: () => { this.headerNameLoading = false; }
    });
  }

  loadHeaderType() {
    this.headerTypeLoading = true;
    this.svc.getStatsByHeaderType().subscribe({
      next: d => {
        const clean = (d || []).filter(r => r[0] != null);
        const cats  = clean.map(r => this.cleanType(r[0]));
        const vals  = clean.map(r => Number(r[1]));
        this.headerTypeSeries = [{ name: 'Count', data: vals }];
        this.headerTypeXAxis  = { ...this.headerTypeXAxis, categories: cats };
        this.headerTypeLoading = false;
      },
      error: () => { this.headerTypeLoading = false; }
    });
  }

  loadCreators() {
    this.creatorsLoading = true;
    this.svc.getStatsByCreator().subscribe({
      next: d => {
        const clean = (d || []).filter(r => r[0] != null).slice(0, 8);
        const max   = clean.length ? Number(clean[0][1]) : 1;
        this.creators = clean.map(r => ({
          name:  r[0],
          count: Number(r[1]),
          pct:   Math.round((Number(r[1]) / max) * 100)
        }));
        this.creatorsLoading = false;
      },
      error: () => { this.creatorsLoading = false; }
    });
  }

  loadTable(page: number) {
    this.tableLoading = true;
    const filters: any = {};
    if (this.tableFromDate) filters.from = this.tableFromDate;
    if (this.tableToDate) filters.to = this.tableToDate;
    if (this.tableHeaderName) filters.headerName = this.tableHeaderName;
    if (this.tableType) filters.type = this.tableType;

    this.svc.getPaginated(page, this.pageSize, filters).subscribe({
      next: d => {
        this.rows          = d.content || [];
        this.totalElements = d.totalElements;
        this.totalPages    = d.totalPages;
        this.currentPage   = d.currentPage;
        this.tableLoading  = false;
      },
      error: () => { this.tableLoading = false; }
    });
  }

  // ===== Pagination & Filters =====
  applyTableFilters() {
    this.loadTable(0);
  }

  resetTableFilters() {
    this.tableFromDate = '';
    this.tableToDate = '';
    this.tableHeaderName = '';
    this.tableType = '';
    this.loadTable(0);
  }

  prevPage() { if (this.currentPage > 0) this.loadTable(this.currentPage - 1); }
  nextPage()  { if (this.currentPage < this.totalPages - 1) this.loadTable(this.currentPage + 1); }
  goPage(p: number) { this.loadTable(p); }
  get pages(): number[] {
    const total = Math.min(this.totalPages, 7);
    const start = Math.max(0, Math.min(this.currentPage - 3, this.totalPages - total));
    return Array.from({ length: total }, (_, i) => start + i);
  }

  // ===== Helpers =====
  kFormat(v: number): string {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000)     return (v / 1_000).toFixed(1) + 'k';
    return v.toString();
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  cleanType(val: any): string {
    if (!val) return '';
    const str = String(val).replace(/^class\s+/, '').trim();
    const parts = str.split('.');
    return parts[parts.length - 1] || str;
  }

  statusClass(status: string): string {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s.includes('error') || s.includes('failed') || s.includes('rejected')) return 'badge-error';
    if (s.includes('process') || s.includes('sent'))  return 'badge-success';
    if (s.includes('wait') || s.includes('pending') || s.includes('init'))     return 'badge-warning';
    return 'badge-default';
  }
}
