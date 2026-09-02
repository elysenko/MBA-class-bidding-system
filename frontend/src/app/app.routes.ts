import { Routes } from '@angular/router';
import { requireAuth } from './core/auth.guard';
import { LayoutComponent } from './layout/layout.component';

/**
 * Every screen is deep-linkable. Dialogs that carry content live at a query
 * param (?modal=…) on their host route so a reviewer can link straight to them.
 */
export const routes: Routes = [
  // --- public ---
  {
    path: 'login/token',
    loadComponent: () =>
      import('./auth/login-token.component').then((m) => m.LoginTokenComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login-student.component').then((m) => m.LoginStudentComponent),
  },
  {
    path: 'signup',
    loadComponent: () => import('./auth/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./auth/login-admin.component').then((m) => m.LoginAdminComponent),
  },

  // --- role landing ---
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./core/root-redirect.component').then((m) => m.RootRedirectComponent),
  },

  // --- administration ---
  {
    path: 'admin',
    component: LayoutComponent,
    canActivate: [requireAuth('admin')],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'classes',
        loadComponent: () =>
          import('./admin/admin-classes.component').then((m) => m.AdminClassesComponent),
      },
      {
        path: 'classes/:id/edit',
        loadComponent: () =>
          import('./admin/admin-class-edit.component').then((m) => m.AdminClassEditComponent),
      },
      {
        path: 'classes/:id/results',
        loadComponent: () =>
          import('./admin/admin-class-results.component').then(
            (m) => m.AdminClassResultsComponent,
          ),
      },
      {
        path: 'accounts',
        loadComponent: () =>
          import('./admin/admin-accounts.component').then((m) => m.AdminAccountsComponent),
      },
      {
        path: 'window',
        loadComponent: () =>
          import('./admin/admin-window.component').then((m) => m.AdminWindowComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./admin/admin-settings.component').then((m) => m.AdminSettingsComponent),
      },
    ],
  },

  // --- student ---
  {
    path: '',
    component: LayoutComponent,
    canActivate: [requireAuth('student')],
    children: [
      {
        path: 'classes',
        loadComponent: () =>
          import('./student/class-list.component').then((m) => m.ClassListComponent),
      },
      {
        path: 'classes/:id',
        loadComponent: () =>
          import('./student/class-detail.component').then((m) => m.ClassDetailComponent),
      },
      {
        path: 'my-bids',
        loadComponent: () => import('./student/my-bids.component').then((m) => m.MyBidsComponent),
      },
      {
        path: 'results',
        loadComponent: () =>
          import('./student/my-results.component').then((m) => m.MyResultsComponent),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
