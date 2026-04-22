import { Component, OnInit } from '@angular/core';
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
  ApexResponsive
} from "ng-apexcharts";
import { FormsModule } from '@angular/forms';
import { NonPassiveWheelDirective } from '../overview/non-passive-wheel.directive';
@Component({
  selector: 'app-flow-flow',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, FormsModule, NonPassiveWheelDirective],
  templateUrl: './flow-flow.component.html',
  styleUrl: './flow-flow.component.css'
})
export class FlowFlowComponent implements OnInit {

  flows: any[] = [];
  statsByStatus: any[] = [];
  statsByType: any[] = [];
  loading = true;

  // Timeline chart
  timelineSeries: ApexAxisChartSeries = [];
  timelineChart!: ApexChart;
  timelineXAxis!: ApexXAxis;
  timelineStroke!: ApexStroke;
  timelineDataLabels!: ApexDataLabels;
  timelineTooltip!: ApexTooltip;

  // Filters
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

  constructor(private flowService: Flow) { }

  ngOnInit(): void {
    this.maxDate = this.toLocalInputValue(new Date());

    // Init chart options BEFORE data
    this.initChart();

    this.flowService.getAllFlows().subscribe(data => {
      this.flows = data;
      this.loading = false;
    });

    this.flowService.getStatsByStatus().subscribe(data => {
      this.statsByStatus = data;
      this.statusList = data.map(d => d[0]);
      this.selectedStatus = this.statusList[0] || 'Processed';
    });

    this.flowService.getStatsByType().subscribe(data => {
      this.statsByType = data;
    });

    // ===== Nouveaux KPIs =====
    this.flowService.getFinancialVolumeByStatus().subscribe(data => this.loadVolumeChart(data));
    this.flowService.getTopRoutes().subscribe(data => this.loadTopRoutesChart(data));
    this.flowService.getLeadTimeTrends().subscribe(data => this.loadLeadTimeChart(data));

    this.loadTimeline();
  }

  loadTimeline() {
    const params: any = {
      status: this.selectedStatus,
      bucket: this.selectedBucket
    };

    if (this.fromDate) params.from = this.fromDate;
    if (this.toDate) params.to = this.toDate;

    this.flowService.getTimeline(params).subscribe(data => {
      this.timelineSeries = [{
        name: 'Flux',
        data: (data || []).map(d => ({
          x: new Date(d.bucket).getTime(),
          y: d.total
        }))
      }];
    });
    this.loadFlowType();
  }////////////////////////////////////////
  // ===== Chart "Flux par type" =====
  flowTypeSeries: ApexAxisChartSeries = [{ name: 'Flux', data: [] }];
  flowTypeChart: ApexChart = { type: 'bar', height: 220, toolbar: { show: false } };
  flowTypePlotOptions: ApexPlotOptions = {
    bar: { borderRadius: 6, columnWidth: '55%', distributed: true }
  };
  flowTypeDataLabels: ApexDataLabels = {
    enabled: true,
    offsetY: -10,
    style: { colors: ['#6b7280'], fontSize: '12px', fontWeight: 600 },
    formatter: (val) => this.kFormat(val)
  };
  flowTypeXAxis: ApexXAxis = {
    categories: [],
    labels: { style: { colors: '#94a3b8', fontSize: '12px' } }
  };
  flowTypeYAxis: ApexYAxis = { show: false };
  flowTypeGrid: ApexGrid = { show: false };
  flowTypeFill: ApexFill = {
    colors: ['#2f6fd3', '#4f83d8', '#6b95df', '#8aa7e6', '#a6bbee', '#c0d0f6']
  };
  flowTypeTooltip: ApexTooltip = { y: { formatter: (val) => this.kFormat(val) } };

  loadFlowType() {
    this.flowService.getStatsByType().subscribe(data => {
      const clean = (data || [])
        .filter(d => d && d[0] != null && d[1] != null);

      const labels = clean.map(d => d[0]);
      const values = clean.map(d => d[1]);

      this.flowTypeSeries = [{ name: 'Flux', data: values }];
      this.flowTypeXAxis = { ...this.flowTypeXAxis, categories: labels };
    });
  }

  kFormat(v: any) {
    if (!v) return '0';
    return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toString();
  }
  //////////////////////////////////////

  // ===== NOUVEAU KPI 1 : Volume Financier par Statut (Donut) =====
  volumeSeries: ApexNonAxisChartSeries = [];
  volumeLabels: string[] = [];
  volumeChart: ApexChart = {
    type: 'donut',
    height: 300,
    events: {
      dataPointSelection: (_event: any, _chartContext: any, config: any) => {
        const statusClicked = config.w.config.labels[config.dataPointIndex];
        if (statusClicked && statusClicked !== this.selectedStatus) {
          this.selectedStatus = statusClicked;
          this.loadTimeline();
        }
      }
    }
  };
  volumeLegend: ApexLegend = {
    position: 'bottom',
    fontSize: '12px',
    labels: { colors: '#64748b' },
    markers: { size: 6, shape: 'circle' as any }
  };
  volumeResponsive: ApexResponsive[] = [
    { breakpoint: 480, options: { chart: { height: 260 }, legend: { position: 'bottom' } } }
  ];
  volumeColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

  loadVolumeChart(data: any[]) {
    // backend retourne [status, SUM(amount1), COUNT(f)]
    // Si amount1 est null en DB, on utilise COUNT (d[2]) comme métrique
    const clean = (data || []).filter(d => d && d[0] != null);
    this.volumeLabels = clean.map(d => String(d[0]));
    this.volumeSeries = clean.map(d => {
      const amount = d[1] != null ? Number(d[1]) : null;
      const count  = d[2] != null ? Number(d[2]) : 0;
      return amount !== null && amount > 0 ? amount : count;
    });
  }

  // ===== NOUVEAU KPI 2 : Top 5 Routes (Barre Horizontale) =====
  topRoutesSeries: ApexAxisChartSeries = [{ name: 'Volume', data: [] }];
  topRoutesChart: ApexChart = { type: 'bar', height: 300, toolbar: { show: false } };
  topRoutesXAxis: ApexXAxis = {
    categories: [],
    labels: { style: { colors: '#64748b', fontSize: '11px' } }
  };
  topRoutesPlotOptions: ApexPlotOptions = {
    bar: { horizontal: true, borderRadius: 6, distributed: true, barHeight: '60%' }
  };
  topRoutesDataLabels: ApexDataLabels = {
    enabled: true,
    style: { colors: ['#fff'], fontSize: '11px', fontWeight: 700 },
    formatter: (val: any) => this.kFormat(val)
  };
  topRoutesFill: ApexFill = {
    colors: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']
  };
  topRoutesTooltip: ApexTooltip = {
    y: { formatter: (val: any) => val.toLocaleString('fr-FR') + ' €' }
  };

  loadTopRoutesChart(data: any[]) {
    // backend: [senderIdentifier, receiverIdentifier, routeId, SUM(amount1), COUNT(f)]
    // d[0] et d[1] peuvent être null → on utilise d[2] (routeId) comme label
    // d[3] = null (amount1 vide en DB) → on utilise d[4] (COUNT) comme valeur
    const clean = (data || [])
      .filter(d => d && (d[2] != null || d[0] != null)) // au moins un identifiant
      .map(d => ({
        label: d[2] || `${d[0] || '?'} → ${d[1] || '?'}`,
        value: d[4] != null ? Number(d[4]) : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    this.topRoutesXAxis = { ...this.topRoutesXAxis, categories: clean.map(d => d.label) };
    this.topRoutesSeries = [{ name: 'Nombre de flux', data: clean.map(d => d.value) }];
  }

  // ===== NOUVEAU KPI 3 : Lead Time Trends (Area) =====
  leadTimeSeries: ApexAxisChartSeries = [{ name: 'Lead Time Moyen (min)', data: [] }];
  leadTimeChart: ApexChart = {
    type: 'area',
    height: 260,
    toolbar: {
      show: true,
      tools: { download: false, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }
    },
    zoom: { enabled: true, type: 'x' },
    selection: { enabled: true, type: 'x' }
  };
  leadTimeXAxis: ApexXAxis = { type: 'datetime', labels: { style: { colors: '#94a3b8', fontSize: '11px' } } };
  leadTimeStroke: ApexStroke = { curve: 'smooth', width: 3 };
  leadTimeDataLabels: ApexDataLabels = { enabled: false };
  leadTimeYAxis: ApexYAxis = {
    labels: {
      formatter: (val: number) => val != null ? val.toFixed(1) + ' min' : ''
    }
  };
  leadTimeFill: ApexFill = {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.05, stops: [0, 100] }
  };
  leadTimeTooltip: ApexTooltip = {
    x: { format: 'dd/MM/yyyy' },
    y: { formatter: (val: any) => val.toFixed(1) + ' min' }
  };

  loadLeadTimeChart(data: any[]) {
    const seriesData = (data || []).filter(d => d && d[0] && d[1] != null).map(d => ({
      x: new Date(d[0]).getTime(),
      y: parseFloat(Number(d[1]).toFixed(2))
    }));
    // Nouveau référentiel d'objet pour forcer la détection de changement Angular
    this.leadTimeSeries = [{ name: 'Lead Time Moyen (min)', data: [...seriesData] }];
  }

  reloadLeadTime() {
    this.flowService.getLeadTimeTrends().subscribe(data => this.loadLeadTimeChart(data));
  }

  private initChart() {
    this.timelineChart = {
      type: 'area',
      height: 260,
      toolbar: { show: false }
    };

    this.timelineXAxis = { type: 'datetime' };
    this.timelineStroke = { curve: 'smooth', width: 3 };
    this.timelineDataLabels = { enabled: false };
    this.timelineTooltip = { x: { format: 'dd/MM/yyyy' } };
  }

  private toLocalInputValue(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
