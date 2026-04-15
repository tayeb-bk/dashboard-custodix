import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { FlowFlowComponent } from './components/flow-flow/flow-flow.component';
import { OverviewComponent } from './components/overview/overview.component';
import { EaiHeaderComponent } from './components/eai-header/eai-header.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    component: DashboardComponent,
    children: [
      { path: '',           redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview',   component: OverviewComponent },
      { path: 'flows',      component: FlowFlowComponent },
      { path: 'eai-header', component: EaiHeaderComponent },
    ]
  }
];
