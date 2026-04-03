import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

export interface HistoriqueEntry {
  id          : string;
  personnel   : string;   // UUID
  personnelNom: string;   // "Karim Aziz"
  action      : string;   // "creer_client"
  actionLabel : string;   // "Créer client"
  details     : any;      // objet JSON libre
  createdAt   : string;   // ISO date
  // Champs calculés pour l'affichage
  client      : string;
  description : string;
  badgeClass  : string;
  dotColor    : string;
}

@Component({
  selector   : 'app-historique',
  standalone : true,
  imports    : [CommonModule, FormsModule],
  templateUrl: './historique.html',
  styleUrl   : './historique.css'
})
export class HistoriqueComponent implements OnInit {

  private apiService = inject(ApiService);

  allEntries   = signal<HistoriqueEntry[]>([]);
  isLoading    = signal(true);
  hasError     = signal(false);
  searchQuery  = signal('');
  activeFilter = signal<string>('all');
  currentPage  = signal(1);
  readonly pageSize = 15;
  selectedDate = signal<string>('');                          // '' = 7 derniers jours
  today        = new Date().toISOString().split('T')[0];     // max du datepicker

  // Filtres alignés sur les valeurs d'action du backend
  filters = [
    { key: 'all',               label: 'Tout',         icon: '📋' },
    { key: 'creer_reservation', label: 'Réservations', icon: '📅' },
    { key: 'marquer_present',   label: 'Présences',    icon: '✅' },
    { key: 'creer_abonnement',  label: 'Abonnements',  icon: '🎟️' },
    { key: 'creer_client',      label: 'Clients',      icon: '👤' },
    { key: 'creer_vente',       label: 'Ventes',       icon: '💰' },
    { key: 'connexion',         label: 'Connexions',   icon: '🔑' },
  ];

  // ── Computed ──────────────────────────────────────────────────────────────
  filteredEntries = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const f = this.activeFilter();

    return this.allEntries().filter(e => {
      // Filtre par action (exact match sauf 'all')
      const matchFilter = f === 'all' || e.action === f;

      // Recherche sur nom personnel, client, description
      const matchSearch = !q
        || e.personnelNom.toLowerCase().includes(q)
        || e.client.toLowerCase().includes(q)
        || e.description.toLowerCase().includes(q)
        || e.actionLabel.toLowerCase().includes(q);

      return matchFilter && matchSearch;
    });
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredEntries().length / this.pageSize))
  );

  pagedEntries = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredEntries().slice(start, start + this.pageSize);
  });

  pageNumbers = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1)
  );

  totalCount = computed(() => this.filteredEntries().length);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadHistorique();
  }

  loadHistorique(): void {
  this.isLoading.set(true);
  this.hasError.set(false);

  const date = this.selectedDate();
  this.apiService.getHistorique(date || undefined).subscribe({
    next: (data) => {
      let items: any[] = Array.isArray(data) ? data : (data?.results ?? []);
      
      // Filtrer l'historique si le role n'est pas "admin"
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user && user.role !== 'admin') {
            items = items.filter(h => 
              String(h.personnel) === String(user.id) || 
              h.personnel === user.username || 
              h.personnel_nom === user.nom
            );
          }
        } catch(e) {}
      }

      this.allEntries.set(items.map((h: any) => this.mapEntry(h)));
      this.isLoading.set(false);
    },
    error: (err) => {
      console.log('=== ERREUR ===', err)  // ← ajouter
      this.isLoading.set(false);
      this.hasError.set(true);
    }
  });
}

  // ── Mapping backend → frontend ────────────────────────────────────────────
  private mapEntry(h: any): HistoriqueEntry {
    const action  = h.action || '';
    const details = h.details || {};

    return {
      id          : h.id,
      personnel   : h.personnel,
      personnelNom: h.personnel_nom || '—',
      action      : action,
      actionLabel : h.action_label || action,
      details     : details,
      createdAt   : h.created_at || '',
      // Champs calculés
      client      : this.extractClient(action, details),
      description : this.buildDescription(action, details),
      badgeClass  : this.getBadgeClass(action),
      dotColor    : this.getDotColor(action),
    };
  }

  // Extrait le nom du client depuis details selon l'action
  private extractClient(action: string, details: any): string {
    // La plupart des actions ont client_nom dans details
    if (details.client_nom) return details.client_nom;
    // Connexion/déconnexion → nom du personnel
    if (details.username)   return details.username;
    return '—';
  }

  // Construit une description lisible depuis details
  private buildDescription(action: string, details: any): string {
    switch (action) {
      case 'connexion':
        return 'Connexion au système';
      case 'deconnexion':
        return 'Déconnexion du système';
      case 'creer_client':
        return `CIN : ${details.client_cin || '—'}`;
      case 'creer_abonnement':
        return  ` Pack ${details.type || '—'} — ${details.prix_paye || '—'} DT `;
      case 'creer_reservation':
        return `Séance ${details.seance_date || '—'} ${details.seance_heure || '—'} — ${details.type_appareil || '—'}`.trim();
      case 'marquer_present':
        return `Séance ${details.seance_date || '—'} ${details.seance_heure || '—'}`.trim();
      case 'creer_vente':
        return `Total : ${details.prix_total || '—'} DT (${details.lignes?.length || 0} article(s))`;
      default:
        return action;
    }
  }

  getDotColor(action: string): string {
    const colors: Record<string, string> = {
      connexion         : '#9ba3c8',
      deconnexion       : '#9ba3c8',
      creer_client      : '#c084fc',
      creer_abonnement  : '#fbbf24',
      creer_reservation : '#3b82f6',
      marquer_present   : '#22c55e',
      creer_vente       : '#22d3ee',
    };
    return colors[action] || '#9ba3c8';
  }

  getBadgeClass(action: string): string {
    const classes: Record<string, string> = {
      connexion         : 'badge--neutral',
      deconnexion       : 'badge--neutral',
      creer_client      : 'badge--purple',
      creer_abonnement  : 'badge--amber',
      creer_reservation : 'badge--blue',
      marquer_present   : 'badge--green',
      creer_vente       : 'badge--blue',
    };
    return classes[action] || 'badge--neutral';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateStr; }
  }

  formatRelative(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
      if (diffMin < 1)  return 'À l\'instant';
      if (diffMin < 60) return `Il y a ${diffMin} min`  ;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24)   return `Il y a ${diffH}h`;
      const diffD = Math.floor(diffH / 24);
      if (diffD < 7)    return `Il y a ${diffD}j` ;
      return this.formatDate(dateStr);
    } catch { return dateStr; }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  onDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.selectedDate.set(val);
    this.currentPage.set(1);
    this.loadHistorique();
  }

  resetDate(): void {
    this.selectedDate.set('');
    this.currentPage.set(1);
    this.loadHistorique();
  }

  setFilter(key: string): void {
    this.activeFilter.set(key);
    this.currentPage.set(1);
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }
}