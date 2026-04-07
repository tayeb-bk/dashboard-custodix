import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.css'
})
export class OverviewComponent {
  today = new Date();
  kpis = [
    { label: 'Total Flux', value: '12 847', icon: '📊', trend: '+8.2%', up: true, color: 'violet' },
    { label: 'Succès', value: '11 203', icon: '✅', trend: '+4.1%', up: true, color: 'green' },
    { label: 'En attente', value: '1 328', icon: '⏳', trend: '-2.3%', up: false, color: 'amber' },
    { label: 'Erreurs', value: '316', icon: '❌', trend: '-12%', up: true, color: 'red' },
  ];

  recentActivity = [
    { action: 'Flux traité avec succès', detail: 'FLOW-8821 · SWIFT → SEPA', time: 'Il y a 2 min', status: 'success' },
    { action: 'Erreur de traitement', detail: 'FLOW-8820 · ISO20022', time: 'Il y a 5 min', status: 'error' },
    { action: 'Flux en attente', detail: 'FLOW-8819 · FIX Protocol', time: 'Il y a 9 min', status: 'pending' },
    { action: 'Flux traité avec succès', detail: 'FLOW-8818 · CFONB → XML', time: 'Il y a 14 min', status: 'success' },
    { action: 'Flux traité avec succès', detail: 'FLOW-8817 · MT103', time: 'Il y a 20 min', status: 'success' },
  ];
}
