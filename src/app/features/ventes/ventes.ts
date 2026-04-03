import {
  Component, OnInit, signal, computed, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

// ══════════════════════════════════════════════════════════════════
// MODELS — alignés avec le backend Django
// ══════════════════════════════════════════════════════════════════

export interface ProduitDisponible {
  id:            string;   // UUID
  nom:           string;
  type:          string;
  type_label:    string;
  prix_unitaire: string;
  stock:         number;
  seuil_alerte:  number;
  stock_faible:  boolean;
  est_actif:     boolean;
}

export interface LigneVente {
  produit_id:    string;
  produit_nom:   string;
  quantite:      number;
  prix_unitaire: number;
  prix_total:    number;
}

// Vente retournée par le backend (VenteSerializer)
export interface VenteAPI {
  id:            string;
  personnel?:    string;
  personnel_nom?:string;
  lignes:        LigneVenteAPI[];
  montant_total: string;
  created_at:    string;
}

export interface LigneVenteAPI {
  id?:           string;
  produit?:      string;
  produit_nom?:  string;
  quantite:      number;
  prix_unitaire: string;
  prix_total:    string;
}

export type ViewMode  = 'caisse' | 'historique';
export type FilterDate = 'today' | 'week' | 'all';

export interface ToastState {
  visible: boolean;
  message: string;
  type:    'success' | 'warning' | 'info';
}

// ══════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════

@Component({
  selector:    'app-ventes',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './ventes.html',
  styleUrl:    './ventes.css',
})
export class VentesComponent implements OnInit {

  private apiService = inject(ApiService);

  // ── View mode ──────────────────────────────────────────────────
  activeView = signal<ViewMode>('caisse');

  // ── State Caisse ───────────────────────────────────────────────
  produits         = signal<ProduitDisponible[]>([]);
  panier           = signal<LigneVente[]>([]);
  isLoadingProduits = signal<boolean>(false);
  isCreatingVente  = signal<boolean>(false);
  searchProduit    = signal<string>('');
  filterType       = signal<string>('tous');

  // ── State Historique ───────────────────────────────────────────
  ventes           = signal<VenteAPI[]>([]);
  isLoadingVentes  = signal<boolean>(false);
  filterDate       = signal<FilterDate>('today');
  selectedVenteId  = signal<string | null>(null);
  datePersonnalisee = signal<string>(this.todayISO());

  // ── Toast ──────────────────────────────────────────────────────
  toast = signal<ToastState>({ visible: false, message: '', type: 'success' });
  private toastTimer: any;

  get searchValue(): string { return this.searchProduit(); }
  set searchValue(v: string) { this.searchProduit.set(v); }

  // ══════════════════════════════════════════════════════════════════
  // COMPUTED
  // ══════════════════════════════════════════════════════════════════

  // Produits filtrés pour la caisse
  produitsFiltres = computed(() => {
    let list = this.produits().filter(p => p.est_actif);
    const q  = this.searchProduit().toLowerCase().trim();
    const ft = this.filterType();

    if (ft !== 'tous') list = list.filter(p => p.type === ft);
    if (q) list = list.filter(p =>
      p.nom.toLowerCase().includes(q) ||
      p.type_label.toLowerCase().includes(q)
    );
    return list;
  });

  // Total du panier
  totalPanier = computed(() =>
    this.panier().reduce((sum, l) => sum + l.prix_total, 0)
  );

  totalArticles = computed(() =>
    this.panier().reduce((sum, l) => sum + l.quantite, 0)
  );

  // KPIs historique
  totalVentes     = computed(() => this.ventes().length);
  totalRevenuJour = computed(() =>
    this.ventes().reduce((sum, v) => sum + parseFloat(v.montant_total || '0'), 0)
  );
  nbArticlesVendus = computed(() =>
    this.ventes().reduce((sum, v) =>
      sum + v.lignes.reduce((s, l) => s + l.quantite, 0), 0
    )
  );

  // Vente sélectionnée pour détail
  selectedVente = computed(() =>
    this.ventes().find(v => v.id === this.selectedVenteId()) ?? null
  );

  // Types distincts pour le filtre
  typesDisponibles = computed(() => {
    const types = new Set(this.produits().map(p => p.type));
    return Array.from(types);
  });

  // ══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.loadProduits();
    this.loadVentes();
  }

  // ══════════════════════════════════════════════════════════════════
  // CHARGEMENT PRODUITS — GET /api/produits/
  // ══════════════════════════════════════════════════════════════════

  loadProduits(): void {
    this.isLoadingProduits.set(true);
    this.apiService.getProduits().subscribe({
      next: (data: any) => {
        const list = Array.isArray(data) ? data : (data.results || []);
        this.produits.set(list.filter((p: any) => p.est_actif));
        this.isLoadingProduits.set(false);
      },
      error: () => {
        this.isLoadingProduits.set(false);
        this.showToast('❌ Erreur chargement produits', 'warning');
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // CHARGEMENT VENTES — GET /api/produits/ventes/?date=...
  // ══════════════════════════════════════════════════════════════════

  loadVentes(date?: string): void {
    this.isLoadingVentes.set(true);
    this.ventes.set([]);

    this.apiService.getVentes(date).subscribe({
      next: (data: any) => {
        const list = Array.isArray(data) ? data : (data.results || []);
        // Tri par date décroissante
        list.sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        this.ventes.set(list);
        this.isLoadingVentes.set(false);
      },
      error: () => {
        this.isLoadingVentes.set(false);
        this.showToast('❌ Erreur chargement des ventes', 'warning');
      }
    });
  }

  // ── Filtre date historique ─────────────────────────────────────
  setFilterDate(f: FilterDate): void {
    this.filterDate.set(f);
    this.selectedVenteId.set(null);
    if (f === 'today') {
      this.loadVentes(this.todayISO());
    } else if (f === 'week') {
      this.loadVentes(); // sans filtre = tout
    } else {
      this.loadVentes();
    }
  }

  onDatePersonnaliseeChange(): void {
    const d = this.datePersonnalisee();
    if (d) this.loadVentes(d);
  }

  // ══════════════════════════════════════════════════════════════════
  // CAISSE — Gestion du panier
  // ══════════════════════════════════════════════════════════════════

  ajouterAuPanier(produit: ProduitDisponible): void {
    const existing = this.panier().find(l => l.produit_id === produit.id);

    if (existing) {
      // Incrémenter quantité si déjà dans le panier
      if (existing.quantite >= produit.stock) {
        this.showToast(`⚠️ Stock insuffisant — max ${produit.stock}`, 'warning');
        return;
      }
      this.panier.update(list =>
        list.map(l => l.produit_id === produit.id
          ? { ...l, quantite: l.quantite + 1, prix_total: (l.quantite + 1) * l.prix_unitaire }
          : l
        )
      );
    } else {
      if (produit.stock === 0) {
        this.showToast(`❌ ${produit.nom} en rupture de stock`, 'warning');
        return;
      }
      const ligne: LigneVente = {
        produit_id:    produit.id,
        produit_nom:   produit.nom,
        quantite:      1,
        prix_unitaire: parseFloat(produit.prix_unitaire),
        prix_total:    parseFloat(produit.prix_unitaire),
      };
      this.panier.update(list => [...list, ligne]);
      this.showToast(`✅ ${produit.nom} ajouté`, 'success');
    }
  }

  incrementerQuantite(produit_id: string): void {
    const produit  = this.produits().find(p => p.id === produit_id);
    const ligne    = this.panier().find(l => l.produit_id === produit_id);
    if (!ligne || !produit) return;

    if (ligne.quantite >= produit.stock) {
      this.showToast(`⚠️ Stock max : ${produit.stock}`, 'warning');
      return;
    }
    this.panier.update(list =>
      list.map(l => l.produit_id === produit_id
        ? { ...l, quantite: l.quantite + 1, prix_total: (l.quantite + 1) * l.prix_unitaire }
        : l
      )
    );
  }

  decrementerQuantite(produit_id: string): void {
    const ligne = this.panier().find(l => l.produit_id === produit_id);
    if (!ligne) return;

    if (ligne.quantite <= 1) {
      this.retirerDuPanier(produit_id);
      return;
    }
    this.panier.update(list =>
      list.map(l => l.produit_id === produit_id
        ? { ...l, quantite: l.quantite - 1, prix_total: (l.quantite - 1) * l.prix_unitaire }
        : l
      )
    );
  }

  retirerDuPanier(produit_id: string): void {
    this.panier.update(list => list.filter(l => l.produit_id !== produit_id));
  }

  viderPanier(): void {
    this.panier.set([]);
  }

  // Vérifie si un produit est dans le panier
  getQuantitePanier(produit_id: string): number {
    return this.panier().find(l => l.produit_id === produit_id)?.quantite ?? 0;
  }

  isInPanier(produit_id: string): boolean {
    return this.panier().some(l => l.produit_id === produit_id);
  }

  // ══════════════════════════════════════════════════════════════════
  // CONFIRMER VENTE — POST /api/produits/ventes/
  // Payload : { lignes: [{ produit_id, quantite }] }
  // ══════════════════════════════════════════════════════════════════

  confirmerVente(): void {
    if (this.panier().length === 0) {
      this.showToast('⚠️ Le panier est vide', 'warning');
      return;
    }
    if (this.isCreatingVente()) return;

    this.isCreatingVente.set(true);

    // Payload aligné avec CreerVenteSerializer
    const payload = {
      lignes: this.panier().map(l => ({
        produit_id: l.produit_id,
        quantite:   l.quantite,
      }))
    };

    this.apiService.creerVente(payload).subscribe({
      next: (res: VenteAPI) => {
        this.isCreatingVente.set(false);
        const total = parseFloat(res.montant_total || '0');
        this.showToast(
          `✅ Vente confirmée — ${total.toLocaleString('fr-FR')} DT`,
          'success'
        );
        // Vider le panier
        this.panier.set([]);
        // Recharger les produits (stocks mis à jour)
        this.loadProduits();
        // Recharger les ventes du jour
        this.loadVentes(this.todayISO());
      },
      error: (err: any) => {
        this.isCreatingVente.set(false);
        const msg = err.error?.error || err.error?.non_field_errors?.[0] || 'Erreur serveur';
        this.showToast(`❌ ${msg}`, 'warning');
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════

  setView(v: ViewMode): void {
    this.activeView.set(v);
    if (v === 'historique') this.loadVentes(this.todayISO());
  }

  setFilterType(t: string): void { this.filterType.set(t); }

  selectVente(id: string): void {
    this.selectedVenteId.set(this.selectedVenteId() === id ? null : id);
  }

  todayISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  formatHeure(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  }

  formatDateFR(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    } catch { return dateStr; }
  }

  formatPrix(prix: string | number): string {
    return parseFloat(String(prix)).toLocaleString('fr-FR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }) + ' DT';
  }

  readonly TYPE_META: Record<string, { icon: string; color: string }> = {
    complement:  { icon: '💊', color: '#22c55e' },
    pre_workout: { icon: '⚡', color: '#f59e0b' },
    dose:        { icon: '🧪', color: '#22d3ee' },
    autre:       { icon: '📦', color: '#9ba3c8' },
  };

  getTypeIcon(type: string): string {
    return this.TYPE_META[type]?.icon ?? '📦';
  }

  getTypeColor(type: string): string {
    return this.TYPE_META[type]?.color ?? '#9ba3c8';
  }

  getStockColor(p: ProduitDisponible): string {
    if (p.stock === 0)      return '#f87171';
    if (p.stock_faible)     return '#fbbf24';
    return '#22c55e';
  }

  // ── Toast ──────────────────────────────────────────────────────
  showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ visible: true, message, type });
    this.toastTimer = setTimeout(
      () => this.toast.update(t => ({ ...t, visible: false })),
      3000
    );
  }
}