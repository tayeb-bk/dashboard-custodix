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
      label: 'Dashboard',
      route: 'overview',
      iconPath: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
      status: 'active'
    },
    {
      id: 'file-in',
      label: 'File In',
      route: 'file-in',
      iconPath: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
      status: 'active'
    },
    {
      id: 'file-out',
      label: 'File Out',
      route: 'file-out',
      iconPath: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
      status: 'disabled',
      badge: 'Bientôt'
    },
    {
      id: 'eai-header',
      label: 'EAI Header',
      route: 'eai-header',
      iconPath: 'M17 1l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3',
      status: 'active',
      badge: 'New'
    },
    {
      id: 'flows',
      label: 'Flow Flow',
      route: 'flows',
      iconPath: 'M22 12h-4l-3 9L9 3l-3 9H2',
      status: 'active',
      badge: 'Live'
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
