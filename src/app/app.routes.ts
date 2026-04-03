import { Routes } from '@angular/router'
import { authGuard, adminGuard, guestGuard } from './core/guards/auth.guard'

export const routes: Routes = [
  {
  path: 'reset-password',
  canActivate: [guestGuard],
  loadComponent: () =>
    import('./features/auth/login/login.component')
      .then(m => m.LoginComponent)
},
  // ── Login (redirige vers dashboard si déjà connecté) ──
  {
    path: '',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component')
        .then(m => m.LoginComponent)
  },

  // ── Routes protégées avec layout ──────────────────────
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/layout')
        .then(m => m.Layout),
    children: [

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard')
            .then(m => m.AdminDashboardComponent)
      },
      {
        path: 'clients',
        loadComponent: () =>
          import('./features/clients/clients')
            .then(m => m.ClientsComponent)
      },

      {
        path: 'abonnements',
        loadComponent: () =>
          import('./features/abonnements/abonnements')
            .then(m => m.AbonnementsComponent)
      },

      {
        path: 'creneaux',
        loadComponent: () =>
          import('./features/creneaux/creneaux')
            .then(m => m.CreneauxComponent)
      },

      {
        path: 'ventes',
        loadComponent: () =>
          import('./features/ventes/ventes')
            .then(m => m.VentesComponent)
      },

      // ── Admin seulement ───────────────────────────────
      {
        path: 'personnel',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/personnel/personnel')
            .then(m => m.PersonnelComponent)
      },

      {
        path: 'historique',

        loadComponent: () =>
          import('./features/historique/historique')
            .then(m => m.HistoriqueComponent)
      },
      {
        path: 'produits',
        canActivate: [adminGuard],
        loadComponent: () =>
        import('./features/produits/produits')
        .then(m => m.ProduitsComponent)
     }, 

    ]
  },

  // ── Fallback ──────────────────────────────────────────
  {
    path: '**',
    redirectTo: ''
  }
]