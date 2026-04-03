import {
  Component, OnInit, signal, computed, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

// ══════════════════════════════════════════════════════════════════
// MODELS — alignés avec le backend Django
// ══════════════════════════════════════════════════════════════════

export type ProduitType = 'complement' | 'pre_workout' | 'dose' | 'autre';

export interface Produit {
  id:            string;   // UUID
  nom:           string;
  type:          ProduitType;
  type_label:    string;
  prix_unitaire: string;   // DecimalField → string
  stock:         number;
  seuil_alerte:  number;
  stock_faible:  boolean;
  est_actif:     boolean;
  created_at:    string;
}

export interface ProduitForm {
  nom:           string;
  type:          ProduitType;
  prix_unitaire: number | null;
  stock:         number;
  seuil_alerte:  number;
}

export interface ToastState {
  visible: boolean;
  message: string;
  type:    'success' | 'warning' | 'info';
}

export type FilterMode = 'tous' | 'actif' | 'inactif' | 'stock_faible';
export type ModalMode  = 'add' | 'edit';

@Component({
  selector:    'app-produits',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './produits.html',
  styleUrl:    './produits.css',
})
export class ProduitsComponent implements OnInit {
  Math = Math;

  private apiService = inject(ApiService);

  // ── State ──────────────────────────────────────────────────────
  produits     = signal<Produit[]>([]);
  isLoading    = signal<boolean>(false);
  searchQuery  = signal<string>('');
  activeFilter = signal<FilterMode>('tous');
  showModal    = signal<boolean>(false);
  modalMode    = signal<ModalMode>('add');
  editId       = signal<string | null>(null);
  toast        = signal<ToastState>({ visible: false, message: '', type: 'success' });
  private toastTimer: any;

  // ── Form ───────────────────────────────────────────────────────
  produitForm: ProduitForm = this.emptyForm();

  get searchValue(): string { return this.searchQuery(); }
  set searchValue(v: string) { this.searchQuery.set(v); }

  // ── Types de produits (du backend) ────────────────────────────
  readonly TYPES: { key: ProduitType; label: string; icon: string; color: string }[] = [
    { key: 'complement',  label: 'Complément alimentaire', icon: '💊', color: '#22c55e'  },
    { key: 'pre_workout', label: 'Pre-Workout',            icon: '⚡', color: '#f59e0b'  },
    { key: 'dose',        label: 'Dose',                   icon: '🧪', color: '#22d3ee'  },
    { key: 'autre',       label: 'Autre',                  icon: '📦', color: '#9ba3c8'  },
  ];

  // ══════════════════════════════════════════════════════════════════
  // COMPUTED
  // ══════════════════════════════════════════════════════════════════

  filteredProduits = computed(() => {
    let list = this.produits();
    const f  = this.activeFilter();
    const q  = this.searchQuery().toLowerCase().trim();

    if (f === 'actif')       list = list.filter(p => p.est_actif);
    if (f === 'inactif')     list = list.filter(p => !p.est_actif);
    if (f === 'stock_faible') list = list.filter(p => p.stock_faible);

    if (q) list = list.filter(p =>
      p.nom.toLowerCase().includes(q) ||
      p.type_label.toLowerCase().includes(q)
    );
    return list;
  });

  // KPIs
  totalProduits   = computed(() => this.produits().length);
  totalActifs     = computed(() => this.produits().filter(p => p.est_actif).length);
  stockFaibleCount = computed(() => this.produits().filter(p => p.stock_faible).length);
  valeurTotaleStock = computed(() =>
    this.produits()
      .filter(p => p.est_actif)
      .reduce((sum, p) => sum + (parseFloat(p.prix_unitaire) * p.stock), 0)
  );

  editTarget = computed(() =>
    this.produits().find(p => p.id === this.editId()) ?? null
  );

  // ══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.loadProduits();
  }

  // ══════════════════════════════════════════════════════════════════
  // CHARGEMENT — GET /api/produits/
  // ══════════════════════════════════════════════════════════════════

  loadProduits(): void {
    this.isLoading.set(true);
    this.apiService.getProduits().subscribe({
      next: (data: any) => {
        const list = Array.isArray(data) ? data : (data.results || []);
        this.produits.set(list);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.isLoading.set(false);
        this.showToast('❌ Erreur chargement des produits', 'warning');
        console.error(err);
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // MODAL — AJOUTER
  // ══════════════════════════════════════════════════════════════════

  openAddModal(): void {
    this.modalMode.set('add');
    this.editId.set(null);
    this.produitForm = this.emptyForm();
    this.showModal.set(true);
  }

  // ══════════════════════════════════════════════════════════════════
  // MODAL — MODIFIER
  // ══════════════════════════════════════════════════════════════════

  openEditModal(id: string): void {
    const p = this.produits().find(x => x.id === id);
    if (!p) return;
    this.modalMode.set('edit');
    this.editId.set(id);
    this.produitForm = {
      nom:           p.nom,
      type:          p.type,
      prix_unitaire: parseFloat(p.prix_unitaire),
      stock:         p.stock,
      seuil_alerte:  p.seuil_alerte,
    };
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); }

  // ══════════════════════════════════════════════════════════════════
  // SAVE — POST /api/produits/ ou PUT /api/produits/{id}/
  // ══════════════════════════════════════════════════════════════════

  saveProduit(): void {
    if (!this.produitForm.nom || !this.produitForm.prix_unitaire) {
      this.showToast('⚠️ Nom et prix sont obligatoires', 'warning');
      return;
    }

    // Payload aligné avec CreerProduitSerializer / ModifierProduitSerializer
    const payload = {
      nom:           this.produitForm.nom,
      type:          this.produitForm.type,
      prix_unitaire: this.produitForm.prix_unitaire,
      stock:         this.produitForm.stock,
      seuil_alerte:  this.produitForm.seuil_alerte,
    };

    if (this.modalMode() === 'add') {
      this.apiService.creerProduit(payload).subscribe({
        next: (res: Produit) => {
          this.produits.update(list => [res, ...list]);
          this.showToast(`✅ ${res.nom} ajouté au stock`, 'success');
          this.closeModal();
        },
        error: (err: any) => {
          const msg = err.error ? JSON.stringify(err.error) : 'Erreur serveur';
          this.showToast(`❌ ${msg}`, 'warning');
        }
      });
    } else {
      const id = this.editId();
      if (!id) return;

      // PUT — ModifierProduitSerializer (tous les champs optionnels)
      this.apiService.modifierProduit(id, payload).subscribe({
        next: (res: Produit) => {
          this.produits.update(list =>
            list.map(p => p.id === id ? res : p)
          );
          this.showToast(`✅ ${res.nom} modifié`, 'success');
          this.closeModal();
        },
        error: (err: any) => {
          const msg = err.error?.error || JSON.stringify(err.error) || 'Erreur serveur';
          this.showToast(`❌ ${msg}`, 'warning');
        }
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // TOGGLE ACTIF/INACTIF — PUT /api/produits/{id}/ avec est_actif
  // ══════════════════════════════════════════════════════════════════

  toggleActif(id: string): void {
    const p = this.produits().find(x => x.id === id);
    if (!p) return;

    const newActif = !p.est_actif;

    // Mise à jour locale immédiate
    this.produits.update(list =>
      list.map(x => x.id === id ? { ...x, est_actif: newActif } : x)
    );

    this.apiService.modifierProduit(id, { est_actif: newActif }).subscribe({
      next: (res: Produit) => {
        this.produits.update(list => list.map(x => x.id === id ? res : x));
        this.showToast(
          newActif ? `✅ ${p.nom} activé` : `⛔ ${p.nom} désactivé`,
          newActif ? 'success' : 'warning'
        );
      },
      error: () => {
        // Annuler le changement local
        this.produits.update(list =>
          list.map(x => x.id === id ? { ...x, est_actif: !newActif } : x)
        );
        this.showToast('❌ Erreur serveur', 'warning');
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // AJUSTER STOCK rapide — PUT /api/produits/{id}/
  // ══════════════════════════════════════════════════════════════════

  ajusterStock(id: string, delta: number): void {
    const p = this.produits().find(x => x.id === id);
    if (!p) return;

    const newStock = Math.max(0, p.stock + delta);

    // Mise à jour locale immédiate
    this.produits.update(list =>
      list.map(x => x.id === id
        ? { ...x, stock: newStock, stock_faible: newStock <= x.seuil_alerte }
        : x
      )
    );

    this.apiService.modifierProduit(id, { stock: newStock }).subscribe({
      next: (res: Produit) => {
        this.produits.update(list => list.map(x => x.id === id ? res : x));
      },
      error: () => {
        // Annuler
        this.produits.update(list =>
          list.map(x => x.id === id ? { ...x, stock: p.stock, stock_faible: p.stock_faible } : x)
        );
        this.showToast('❌ Erreur mise à jour stock', 'warning');
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════

  setFilter(f: FilterMode): void { this.activeFilter.set(f); }

  getTypeMeta(type: ProduitType) {
    return this.TYPES.find(t => t.key === type) ?? this.TYPES[3];
  }

  getStockColor(p: Produit): string {
    if (p.stock === 0)       return '#f87171';
    if (p.stock_faible)      return '#fbbf24';
    return '#22c55e';
  }

  getStockLabel(p: Produit): string {
    if (p.stock === 0)  return 'Rupture';
    if (p.stock_faible) return 'Stock faible';
    return 'En stock';
  }

  getStockClass(p: Produit): string {
    if (p.stock === 0)  return 'stock-rupture';
    if (p.stock_faible) return 'stock-faible';
    return 'stock-ok';
  }

  formatPrix(prix: string): string {
    return parseFloat(prix).toLocaleString('fr-FR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }) + ' DT';
  }

  private emptyForm(): ProduitForm {
    return {
      nom:           '',
      type:          'complement',
      prix_unitaire: null,
      stock:         0,
      seuil_alerte:  2,
    };
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