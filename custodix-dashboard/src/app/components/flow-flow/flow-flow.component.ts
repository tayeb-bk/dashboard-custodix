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
  ApexTooltip
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
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
