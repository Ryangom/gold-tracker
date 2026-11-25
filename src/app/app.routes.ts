import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
    title: 'Dashboard — Gold Tracker',
  },
  {
    path: 'calculator',
    loadComponent: () => import('./features/calculator/calculator').then((m) => m.Calculator),
    title: 'Calculator — Gold Tracker',
  },
  {
    path: 'history',
    loadComponent: () => import('./features/history/history').then((m) => m.History),
    title: 'History — Gold Tracker',
  },
  {
    path: 'alerts',
    loadComponent: () => import('./features/alerts/alerts').then((m) => m.Alerts),
    title: 'Alerts — Gold Tracker',
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage),
    title: 'Settings — Gold Tracker',
  },
  { path: '**', redirectTo: 'dashboard' },
];
