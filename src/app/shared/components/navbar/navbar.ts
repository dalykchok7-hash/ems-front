import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class NavbarComponent implements OnInit {

  currentDate = new Date();
  user: any = null;
  pageTitle   = 'EMS Management System';
  breadcrumb  = 'Vue générale du studio';

  // Map route → titre + breadcrumb
  private readonly PAGE_MAP: Record<string, { title: string; bread: string }> = {
    '/dashboard':    { title: 'EMS Management System',  bread: 'Vue générale du studio'          },
    '/creneaux':     { title: 'Planning des Créneaux',   bread: 'Accueil / Créneaux'              },
    '/clients':      { title: 'Gestion des Clients',     bread: 'Accueil / Clients'               },
    '/abonnements':  { title: 'Abonnements',             bread: 'Accueil / Abonnements'           },
    '/ventes':       { title: 'Ventes & Paiements',      bread: 'Accueil / Ventes'                },
    '/rapports':     { title: 'Rapports & Statistiques', bread: 'Accueil / Rapports'              },
    '/parametres':   { title: 'Paramètres',              bread: 'Accueil / Paramètres'            },
  };

  constructor(private router: Router,private api: ApiService) {}

  ngOnInit(): void {
    // Appliquer le titre pour la route initiale
    this.updateTitle(this.router.url);
    this.loadUser();

    // Écouter les changements de route
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => this.updateTitle(e.urlAfterRedirects));
  }

  private updateTitle(url: string): void {
    const route = '/' + url.split('/')[1]; // ex: '/creneaux'
    const page  = this.PAGE_MAP[route];
    if (page) {
      this.pageTitle  = page.title;
      this.breadcrumb = page.bread;
    }
  }
  loadUser() {
  const data = localStorage.getItem('user');
  if (data) {
    this.user = JSON.parse(data);
  }
}
getInitials(): string {
  if (!this.user?.nom) return '';

  const parts = this.user.nom.split(' ');
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
logout() {
  const refresh = localStorage.getItem('refresh');

  if (!refresh) {
    this.router.navigate(['/login']);
    return;
  }
this.api.logout(refresh).subscribe({
    next: () => {
      this.clearSession();
    },
    error: () => {
      // même si erreur → on déconnecte quand même côté front
      this.clearSession();
    }
  });
  
}
clearSession() {
  localStorage.removeItem('user');
  localStorage.removeItem('access');
  localStorage.removeItem('refresh');

  this.router.navigate(['']);
}
}