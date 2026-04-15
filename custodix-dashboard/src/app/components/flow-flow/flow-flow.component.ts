import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Flow } from '../../services/flow';
import { NgApexchartsModule } from "ng-apexcharts";
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexStroke,
  ApexDataLabels,
  ApexTooltip,
  ApexPlotOptions,
  ApexYAxis,
  ApexGrid,
  ApexFill
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
    'Processed','Sent','SubWorkflowInTechnicalError','WaitProcessing','Initial','Init',
    'WaitToBeSent','InTechnicalError','NoContractFound','InitiationError','Rejected',
    'InitiationFailed','InProcess','WaitAction','MarkedForSuspension','SubWorkflowInProcess',
    'InBusinessError','PutInQueueFailed','Blocked','Initiated','Acked','SentAndWaitingAck',
    'Nacked','Canceled'
  ];

  selectedStatus = 'Processed';
  selectedBucket = 'auto';
  fromDate = '';
  toDate = '';
  maxDate = '';

  constructor(private flowService: Flow) {}

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
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
