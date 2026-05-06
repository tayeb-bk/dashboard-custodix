import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexDataLabels,
  ApexStroke,
  ApexTooltip,
  ApexFill,
  ApexGrid,
  ApexYAxis
} from 'ng-apexcharts';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  tooltip: ApexTooltip;
  dataLabels: ApexDataLabels;
  fill: ApexFill;
  grid: ApexGrid;
  colors: string[];
};

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, HttpClientModule],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.css'
})
export class OverviewComponent implements OnInit {
  
  public receptionChartOptions!: Partial<ChartOptions> | any;
  public totalFiles: number = 0;
  public topSenders: any[] = [];
  public chartLoaded: boolean = false;

  private baseUrl = 'http://localhost:8080/api/filein';

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit() {
    this.loadRealData();
  }

  loadRealData() {
    // 1. Fetch KPI Summary for Total Volume
    this.http.get<any>(`${this.baseUrl}/kpi/summary`).subscribe(res => {
      this.totalFiles = res?.totalFiles || 0;
    });

    // 2. Fetch Top Senders
    this.http.get<any[]>(`${this.baseUrl}/contracts/top`).subscribe(res => {
      // Take top 3
      if (res && res.length > 0) {
        this.topSenders = res.slice(0, 3).map((item, index) => ({
          rank: index + 1,
          name: item.contrat || 'Inconnu',
          value: item.total || 0
        }));
      }
    });

    // 3. Fetch Timeline Data
    this.http.get<any[]>(`${this.baseUrl}/timeline?bucket=day`).subscribe(res => {
      if (res && res.length > 0) {
        const seriesData = res.map(point => {
          let t = point.bucket;
          let d: Date;
          if (Array.isArray(t)) {
             // Spring Boot might serialize LocalDateTime as [yyyy, MM, dd, HH, mm]
             d = new Date(t[0], t[1] - 1, t[2], t[3] || 0, t[4] || 0);
          } else {
             d = new Date(t);
          }
          return [d.getTime(), point.total || 0];
        });
        
        // Sort data by time ascending just in case
        seriesData.sort((a, b) => a[0] - b[0]);
        this.initReceptionChart(seriesData);
      } else {
        this.initReceptionChart([]);
      }
      this.chartLoaded = true;
    }, error => {
      console.error("Erreur chargement timeline:", error);
      this.initReceptionChart([]);
      this.chartLoaded = true;
    });
  }

  initReceptionChart(seriesData: any[]) {
    this.receptionChartOptions = {
      series: [{
        name: 'Fichiers Entrants',
        data: seriesData
      }],
      chart: {
        type: 'area',
        height: 280,
        toolbar: { 
          show: true,
          tools: {
            download: false,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        },
        background: 'transparent',
        sparkline: { enabled: false },
        animations: { enabled: false }
      },
      colors: ['#3b82f6'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [0, 100]
        }
      },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 2 },
      xaxis: {
        type: 'datetime',
        labels: { 
          style: { colors: '#cbd5e1', fontSize: '12px', fontWeight: 500 },
          datetimeUTC: false,
          format: 'dd MMM yyyy'
        },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: { 
          style: { colors: '#cbd5e1', fontSize: '12px', fontWeight: 500 },
          formatter: (value: number) => { return value ? value.toLocaleString('fr-FR') : '0'; }
        }
      },
      grid: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        strokeDashArray: 4,
        yaxis: { lines: { show: true } },
        xaxis: { lines: { show: false } }
      },
      tooltip: { 
        theme: 'dark',
        x: { format: 'dd MMM yyyy HH:mm' }
      }
    };
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
