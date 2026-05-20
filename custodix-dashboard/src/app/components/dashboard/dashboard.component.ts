import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { ThemeService } from '../../services/theme';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

interface NavStep {
  id: string;
  label: string;
  route: string;
  iconPath: string; // SVG path string
  status: 'active' | 'disabled';
  badge?: string;
  isAi?: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterOutlet, RouterLink, CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  currentRoute = signal<string>('');

  steps: NavStep[] = [
    {
      id: 'overview',
      label: 'Tour de Contrôle',
      route: 'overview',
      iconPath: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
      status: 'active'
    },
    {
      id: 'file-in',
      label: 'Étape 1 : Réception',
      route: 'file-in',
      iconPath: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
      status: 'active'
    },
    {
      id: 'flows',
      label: 'Étape 2 : Traitement',
      route: 'flows',
      iconPath: 'M22 12h-4l-3 9L9 3l-3 9H2',
      status: 'active'
    },
    {
      id: 'file-out',
      label: 'Étape 3 : Expédition',
      route: 'file-out',
      iconPath: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
      status: 'active'
    },
    {
      id: 'eai-header',
      label: 'Étape 4 : Alertes',
      route: 'eai-header',
      iconPath: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
      status: 'active',
      badge: 'En cours'
    },
    {
      id: 'perf',
      label: 'Étape 5 : Performance',
      route: 'performance',
      iconPath: 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
      status: 'disabled'
    },
    {
      id: 'trace',
      label: 'Étape 6 : Traçabilité',
      route: 'traceability',
      iconPath: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35',
      status: 'disabled'
    },
    {
      id: 'custodix-ai',
      label: 'Custodix AI',
      route: 'custodix-ai',
      iconPath: 'M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z M12 6v6l4 2 M8.5 15h7',
      status: 'active',
      badge: 'IA',
      isAi: true
    }
  ];

  constructor(public themeService: ThemeService, private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute.set(event.urlAfterRedirects);
    });
  }

  ngOnInit() {
    this.currentRoute.set(this.router.url);
  }

  getStepState(step: NavStep, index: number): string {
    if (step.status === 'disabled') return 'disabled';
    const currentUrl = this.currentRoute();
    const isCurrent = currentUrl.includes('/' + step.route);
    
    const currentIndex = this.steps.findIndex(s => currentUrl.includes('/' + s.route));
    
    if (isCurrent) return 'current';
    if (currentIndex > -1 && index < currentIndex) return 'completed';
    return 'upcoming';
  }
}
