import {
  Component, OnInit, signal, computed, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

// ══════════════════════════════════════════════════════════════════
// MODELS
// ══════════════════════════════════════════════════════════════════

export type ClientStatut = 'actif' | 'expire' | 'inactif';

export interface Client {
  id              : string
  nom             : string
  prenom          : string
  cin             : string
  telephone_1     : string
  telephone_2    ?: string    // ← avec underscore
  email          ?: string
  date_naissance ?: string
  created_at      : string    // ← backend retourne created_at
  est_actif       : boolean
  essai_fait      : boolean
  abonnement_actif: string
  statut         ?: ClientStatut  // ← calculé côté frontend
  avatar_color   ?: string
  photo          ?: string
}

export interface AbonnementHistorique {
  id: number;
  type: string;   // type_label du backend
  type_key?: string;   // type brut du backend
  date_debut: string;
  date_expiration: string | null;
  seances_total: number;
  seances_restantes: number;
  seances_utilisees?: number;
  statut: 'actif' | 'termine' | 'expire' | 'en_attente';
  mode_paiement?: string;
  est_paye?: boolean;
  prix_paye?: string;
  reduction?: string;
  created_at?: string;
}

export interface SeanceHistorique {
  id: number;
  date: string;
  heure_debut: string;
  heure_fin?: string;
  type_appareil: 'i-motion' | 'i-model';
  statut: 'present' | 'absent';
  taille_gilet?: string;
}

export interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'warning' | 'info';
}

export interface ClientForm {
  nom: string;
  prenom: string;
  cin: string;
  telephone_1: string;
  telephone_2?: string;
  email?: string;
  date_naissance?: string;
  photo?: File | null;
}

// ══════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clients.html',
  styleUrl: './clients.css',
})
export class ClientsComponent implements OnInit {

  private apiService = inject(ApiService);

  // ── State ──────────────────────────────────────────────────────
  searchQuery = signal<string>('');
  activeFilter = signal<'tous' | ClientStatut>('tous');
  selectedClientId = signal<string | null>(null);
  showModal = signal<boolean>(false);
  modalMode = signal<'add' | 'edit'>('add');
  toast = signal<ToastState>({ visible: false, message: '', type: 'success' });
  private toastTimer: any;
  private searchTimer: any;

  // ── Onglet actif dans le panel détail ─────────────────────────
  // 'abonnement' | 'historique_abo' | 'seances'
  activeTab = signal<'abonnement' | 'historique_abo' | 'seances'>('abonnement');
  protected readonly parseFloat = parseFloat;

  // ── Loading states ─────────────────────────────────────────────
  isLoadingAbo = signal<boolean>(false);
  isLoadingHistAbo = signal<boolean>(false);
  isLoadingSeances = signal<boolean>(false);
  currentPage  = signal<number>(1)
  totalCount   = signal<number>(0)
  totalPages   = computed(() => Math.ceil(this.totalCount() / 20))

  // ── Form ───────────────────────────────────────────────────────
  clientForm: ClientForm = {
    nom: '', prenom: '', cin: '', telephone_1: '',
    telephone_2: '', email: '', date_naissance: '', photo: null
  };

  // ── Two-way binding ────────────────────────────────────────────
  get searchValue(): string { return this.searchQuery(); }
  set searchValue(v: string) {
  this.searchQuery.set(v)
  clearTimeout(this.searchTimer)
  this.searchTimer = setTimeout(() => this.loadClients(v, 1), 300)
}
nextPage(): void {
  if (this.currentPage() < this.totalPages()) {
    this.loadClients(this.searchValue, this.currentPage() + 1)
  }
}

previousPage(): void {
  if (this.currentPage() > 1) {
    this.loadClients(this.searchValue, this.currentPage() - 1)
  }
}

  // ══════════════════════════════════════════════════════════════════
  // DATA SIGNALS
  // ══════════════════════════════════════════════════════════════════

  clients = signal<Client[]>([]);
  detailedClient = signal<Client | null>(null);
  apiActiveAbo = signal<AbonnementHistorique | null>(null);

  // ✅ NOUVEAU — historique de TOUS les abonnements
  historiqueAbonnements = signal<AbonnementHistorique[]>([]);

  // ✅ NOUVEAU — historique des séances
  historiqueSeances = signal<SeanceHistorique[]>([]);

  // ══════════════════════════════════════════════════════════════════
  // COMPUTED
  // ══════════════════════════════════════════════════════════════════

  filteredClients = computed(() => {
    let list = this.clients();
    const f = this.activeFilter();
    if (f !== 'tous') list = list.filter(c => c.statut === f);
    return list;
  });

  selectedClient = computed(() =>
    this.detailedClient() || this.clients().find(c => c.id === this.selectedClientId()) || null
  );

  activeAbo = computed(() => this.apiActiveAbo());

  // Abonnement actif uniquement
  selectedClientAbo = computed(() => {
    const abo = this.apiActiveAbo();
    return abo ? [abo] : [];
  });

  // ── KPIs ───────────────────────────────────────────────────────
  totalClients = computed(() => this.totalCount());
  totalActifs = computed(() => this.clients().filter(c => c.statut === 'actif').length);
  totalExpirants = computed(() => this.clients().filter(c => c.statut === 'expire').length);
  totalInactifs = computed(() => this.clients().filter(c => c.statut === 'inactif').length);

  // Statistiques séances du client sélectionné
  totalSeancesClient = computed(() => this.historiqueSeances().length);
  seancesPresent = computed(() => this.historiqueSeances().filter(s => s.statut === 'present').length);
  seancesAbsent = computed(() => this.historiqueSeances().filter(s => s.statut === 'absent').length);
  tauxPresence = computed(() => {
    const total = this.totalSeancesClient();
    return total === 0 ? 0 : Math.round((this.seancesPresent() / total) * 100);
  });

  // Progression abonnement actif
  aboProgressPercent = computed(() => {
    const a = this.activeAbo();
    if (!a || !a.seances_total) return 0;
    const utilisees = a.seances_utilisees ?? (a.seances_total - (a.seances_restantes ?? 0));
    return Math.round((Math.max(0, utilisees) / a.seances_total) * 100);
  });

  // Statistiques historique abonnements
  totalAbosClient = computed(() => this.historiqueAbonnements().length);
  abosActifs = computed(() => this.historiqueAbonnements().filter(a => a.statut === 'actif').length);
  abosTermines = computed(() => this.historiqueAbonnements().filter(a => a.statut === 'termine').length);

  // ══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.loadClients('');
  }

  // ══════════════════════════════════════════════════════════════════
  // CHARGEMENT CLIENTS
  // ══════════════════════════════════════════════════════════════════

 loadClients(query = '', page = 1): void {
  this.apiService.getClients(page, query).subscribe({
    next: (data: any) => {
      const list = (Array.isArray(data) ? data : (data.results || []))
        .map((c: any) => this.mapClient(c))
      this.clients.set(list)
      this.totalCount.set(data.count || list.length)
      this.currentPage.set(page)
      if (!this.selectedClientId() && list.length > 0) {
        this.selectClient(list[0].id)
      }
    },
    error: () => this.showToast('Erreur chargement des clients', 'warning')
  })
}

  private mapClient(c: any): Client {
    return {
      ...c,
      // Calculer statut depuis abonnement_actif
      statut: c.abonnement_actif && c.abonnement_actif !== 'inactif'
              ? 'actif' : 'inactif',
      // Normaliser telephone
      telephone_2: c.telephone_2 || '',
      // date_inscription (alias pour created_at si encore utilisé)
      date_inscription: c.created_at,
      avatar_color: c.avatar_color || this.getAvatarColor(c.nom || 'X')
    };
  }

  loadClientDetails(cin: string): void {
    this.apiService.getClient(cin).subscribe({
      next: (data: any) => {
        this.detailedClient.set(this.mapClient(data));
      },
      error: err => console.error('Erreur détail client', err)
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // CHARGEMENT ABONNEMENT ACTIF
  // ══════════════════════════════════════════════════════════════════

  loadActiveSubscription(cin: string): void {
    this.isLoadingAbo.set(true);
    this.apiService.getAbonnementActif(cin).subscribe({
      next: (data: any) => {
        this.isLoadingAbo.set(false);
        if (!data || !data.id) {
          this.apiActiveAbo.set(null);
          return;
        }
        const abo: AbonnementHistorique = {
          id: data.id,
          type: data.nom_pack || data.type_label || data.type || '—',
          type_key: data.type,
          date_debut: data.date_debut,
          date_expiration: data.date_fin || data.date_expiration || null,
          seances_total: data.seances_total || 0,
          seances_utilisees: data.seances_utilisees ?? ((data.seances_total || 0) - (data.seances_restantes || 0)),
          seances_restantes: data.seances_restantes ?? 0,
          statut: data.statut,
          mode_paiement: data.mode_paiement?? '--',
          est_paye: data.est_paye,
          prix_paye: data.prix_paye?? null,
          reduction: data.reduction,
        };
        this.apiActiveAbo.set(abo);
      },
      error: () => {
        this.isLoadingAbo.set(false);
        this.apiActiveAbo.set(null);
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // ✅ NOUVEAU — HISTORIQUE ABONNEMENTS
  // GET /api/clients/{cin}/abonnements/
  // ══════════════════════════════════════════════════════════════════

  loadHistoriqueAbonnements(cin: string): void {
    this.isLoadingHistAbo.set(true);
    this.historiqueAbonnements.set([]);

    this.apiService.getHistoriqueAbonnements(cin).subscribe({
      next: (data: any) => {
        this.isLoadingHistAbo.set(false);
        const list = Array.isArray(data) ? data : (data.results || []);

        const mapped: AbonnementHistorique[] = list.map((a: any) => ({
          id: a.id,
          type: a.type_label || a.nom_pack || a.type || '—',
          type_key: a.type,
          date_debut: a.date_debut,
          date_expiration: a.date_expiration || a.date_fin || null,
          seances_total: a.seances_total || 0,
          seances_restantes: a.seances_restantes ?? 0,
          seances_utilisees: a.seances_utilisees ?? (a.seances_total - (a.seances_restantes ?? 0)),
          statut: a.statut,
          mode_paiement: a.mode_paiement,
          est_paye: a.est_paye,
          prix_paye: a.prix_paye,
          reduction: a.reduction,
          created_at: a.created_at,
        }));

        this.historiqueAbonnements.set(mapped);
      },
      error: (err) => {
        this.isLoadingHistAbo.set(false);
        console.error('Erreur historique abonnements', err);
        this.showToast('Erreur chargement historique abonnements', 'warning');
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // ✅ NOUVEAU — HISTORIQUE SÉANCES
  // GET /api/clients/{cin}/seances/
  // ══════════════════════════════════════════════════════════════════

 loadHistoriqueSeances(cin: string): void {
  this.isLoadingSeances.set(true);
  this.historiqueSeances.set([]);

  this.apiService.getClientSeances(cin).subscribe({
    next: (data: any) => {
      this.isLoadingSeances.set(false);

      const list = Array.isArray(data)
        ? data
        : (data.reservations || data.results || []);

      const mapped: SeanceHistorique[] = list.map((s: any) => ({
        id: s.id,
        date: s.date,
        heure_debut: s.heure?.substring(0, 5) || '',
        heure_fin: '',
        type_appareil: s.type_appareil,
        statut: s.statut,
        taille_gilet: null,
      }));

      mapped.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      this.historiqueSeances.set(mapped);
    },
    error: (err) => {
      this.isLoadingSeances.set(false);
      console.error('Erreur historique séances', err);
      this.showToast('Erreur chargement historique séances', 'warning');
    },
  });
}

  // ══════════════════════════════════════════════════════════════════
  // SÉLECTION CLIENT
  // ══════════════════════════════════════════════════════════════════

  selectClient(id: string | number): void {
  const strId = String(id);
  this.selectedClientId.set(strId);
  const c = this.clients().find(x => String(x.id) === strId);
  if (!c?.cin) return;
  

    // Reset état
    this.detailedClient.set(null);
    this.apiActiveAbo.set(null);
    this.historiqueAbonnements.set([]);
    this.historiqueSeances.set([]);
    this.activeTab.set('abonnement'); // revenir au 1er onglet

    // Charger les données
    this.loadClientDetails(c.cin);
    this.loadActiveSubscription(c.cin);
    // On charge aussi les historiques en avance (lazy optionnel)
    this.loadHistoriqueAbonnements(c.cin);
    this.loadHistoriqueSeances(c.cin);
  }

  // ══════════════════════════════════════════════════════════════════
  // ONGLETS
  // ══════════════════════════════════════════════════════════════════

  setTab(tab: 'abonnement' | 'historique_abo' | 'seances'): void {
    this.activeTab.set(tab);
    const c = this.selectedClient();
    if (!c?.cin) return;

    // Recharger si vide (lazy loading optionnel)
    if (tab === 'historique_abo' && this.historiqueAbonnements().length === 0) {
      this.loadHistoriqueAbonnements(c.cin);
    }
    if (tab === 'seances' && this.historiqueSeances().length === 0) {
      this.loadHistoriqueSeances(c.cin);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════

  setFilter(f: 'tous' | ClientStatut): void { this.activeFilter.set(f); }

  private readonly AVATAR_COLORS = ['#3b82f6', '#7c3aed', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#ef4444', '#8b5cf6'];
  getAvatarColor(nom: string): string {
    return this.AVATAR_COLORS[(nom.charCodeAt(0) || 0) % this.AVATAR_COLORS.length];
  }

  getInitials(client: Client): string {
  if (!client?.prenom && !client?.nom) return '??'
  const p = client.prenom?.[0] || ''
  const n = client.nom?.[0] || ''
  return (p + n).toUpperCase()
}

  getFullName(client: Client): string {
    return `${client.prenom || ''} ${client.nom || ''}`.trim();
  }

  getStatutLabel(statut: ClientStatut | undefined): string {
    if (statut === 'actif') return 'Actif';
    if (statut === 'expire') return 'Expiration proche';
    return 'Inactif';
  }

  getAboProgressColor(pct: number): string {
    if (pct >= 90) return '#f87171';
    if (pct >= 70) return '#fbbf24';
    return '#3b82f6';
  }

  getStatutAboClass(statut: string): string {
    if (statut === 'actif') return 'statut-actif';
    if (statut === 'expire') return 'statut-expire';
    if (statut === 'en_attente') return 'statut-attente';
    return 'statut-termine';
  }

  getStatutAboLabel(statut: string): string {
    const map: Record<string, string> = {
      actif: 'Actif',
      expire: 'Expiré',
      termine: 'Terminé',
      en_attente: 'En attente',
    };
    return map[statut] ?? statut;
  }

  getStatutSeanceClass(statut: string): string {
    return statut === 'present' ? 'seance-present' : 'seance-absent';
  }

  getModeLabel(mode: string | null | undefined): string {
  if (!mode) return '—';
  if (mode === 'cash') return '💵 Espèces';
  if (mode === 'tpe') return '💳 Carte';
  return mode;
}

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR');
    } catch { return dateStr; }
  }

  getClientSessions(clientId: string): number {
    return this.historiqueSeances().length;
  }

  // ══════════════════════════════════════════════════════════════════
  // MODAL CLIENT
  // ══════════════════════════════════════════════════════════════════

  openAddModal(): void {
    this.modalMode.set('add');
    this.clientForm = {
      nom: '', prenom: '', cin: '', telephone_1: '',
      telephone_2: '', email: '', date_naissance: '', photo: null
    };
    this.showModal.set(true);
  }

  openEditModal(): void {
    const c = this.selectedClient();
    if (!c) return;
    this.modalMode.set('edit');
    this.clientForm = {
      nom: c.nom,
      prenom: c.prenom,
      cin: c.cin,
      telephone_1: c.telephone_1,
      telephone_2: c.telephone_2 || '',
      email: c.email || '',
      date_naissance: c.date_naissance || '',
      photo: null
    };
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); }

  onFileSelected(event: any): void {
    this.clientForm.photo = event.target.files?.[0] ?? null;
  }

  formErrors: any = {};

saveClient(): void {
  // 🔄 Reset erreurs
  this.formErrors = {};

  // ── VALIDATION FRONTEND ─────────────────────

  if (!this.clientForm.nom?.trim()) {
    this.formErrors.nom = "Nom obligatoire";
  }

  if (!this.clientForm.prenom?.trim()) {
    this.formErrors.prenom = "Prénom obligatoire";
  }

  if (!this.clientForm.cin?.trim()) {
    this.formErrors.cin = "CIN obligatoire";
  } else if (!/^\d{8}$/.test(this.clientForm.cin)) {
    this.formErrors.cin = "CIN invalide (8 chiffres)";
  }

  if (!this.clientForm.telephone_1?.trim()) {
    this.formErrors.telephone_1 = "Téléphone obligatoire";
  } else if (!/^\d{8}$/.test(this.clientForm.telephone_1)) {
    this.formErrors.telephone_1 = "Numéro invalide";
  }

  if (this.clientForm.email && !/^\S+@\S+\.\S+$/.test(this.clientForm.email)) {
    this.formErrors.email = "Email invalide";
  }

  // 🚫 Stop si erreurs
  if (Object.keys(this.formErrors).length > 0) {
    return;
  }

  // ── FORM DATA ───────────────────────────────

  const formData = new FormData();
  formData.append('nom', this.clientForm.nom);
  formData.append('prenom', this.clientForm.prenom);
  formData.append('cin', this.clientForm.cin);
  formData.append('telephone_1', this.clientForm.telephone_1);

  if (this.clientForm.telephone_2) {
    formData.append('telephone_2', this.clientForm.telephone_2||'');
  }

  if (this.clientForm.email) {
    formData.append('email', this.clientForm.email);
  }

  if (this.clientForm.date_naissance) {
    formData.append('date_naissance', this.clientForm.date_naissance);
  }

  if (this.clientForm.photo) {
    formData.append('photo', this.clientForm.photo);
  }

  // ── CREATE ──────────────────────────────────

  if (this.modalMode() === 'add') {
    this.apiService.createClient(formData).subscribe({
      next: () => {
        this.showToast(`✅ Client ${this.clientForm.prenom} ajouté`, 'success');
        this.loadClients(this.searchValue);
        this.closeModal();
      },
      error: (err: any) => {
        this.handleBackendErrors(err);
      }
    });

  // ── UPDATE ──────────────────────────────────

  } else {
    const c = this.selectedClient();
    if (!c) return;

    this.apiService.modifierClient(c.cin, formData).subscribe({
      next: () => {
        this.showToast('✅ Client modifié', 'success');
        this.loadClients(this.searchValue);
        this.loadClientDetails(c.cin);
        this.closeModal();
      },
      error: (err: any) => {
        this.handleBackendErrors(err);
      }
    });
  }
}
handleBackendErrors(err: any): void {
  if (err.error && typeof err.error === 'object') {
    // 🧠 DRF renvoie souvent { field: ["message"] }
    const errors: any = {};

    for (const key in err.error) {
      const value = err.error[key];
      errors[key] = Array.isArray(value) ? value[0] : value;
    }

    this.formErrors = errors;
  } else {
    this.showToast('❌ Erreur serveur', 'warning');
  }
}

  deleteClient(): void {
    const c = this.selectedClient();
    if (!c) return;
    if (!confirm(`Supprimer ${c.prenom} ${c.nom} ?`)) return;

    this.apiService.supprimerClient(c.cin).subscribe({
      next: () => {
        this.showToast('🗑 Client supprimé', 'success');
        this.selectedClientId.set(null);
        this.detailedClient.set(null);
        this.apiActiveAbo.set(null);
        this.historiqueAbonnements.set([]);
        this.historiqueSeances.set([]);
        this.loadClients();
      },
      error: () => this.showToast('❌ Erreur lors de la suppression', 'warning')
    });
  }

  renouvelerAbo(): void {
    const c = this.selectedClient();
    if (!c?.cin) return;
    const typeAbo = this.activeAbo()?.type_key || 'pack10';

    this.apiService.createAbonnement(c.cin, { pack_id: typeAbo }).subscribe({
      next: () => {
        this.showToast('✅ Renouvellement effectué', 'success');
        this.loadActiveSubscription(c.cin);
        this.loadHistoriqueAbonnements(c.cin);
      },
      error: (err: any) => {
        const msg = err.error?.error || 'Erreur renouvellement';
        this.showToast(`❌ ${msg}`, 'warning');
      }
    });
  }
  isSelected(id: string | number | null): boolean {
    const current = this.selectedClientId();
    if (current === null || id === null) return false;
    return String(current) === String(id);
  }

  formatPrix(prix: string | null | undefined): string {
  if (!prix) return '—';
  const value = Math.abs(parseFloat(prix));
  return isNaN(value) ? '—' : value.toString();
}

  // ══════════════════════════════════════════════════════════════════
  // TOAST
  // ══════════════════════════════════════════════════════════════════

  showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ visible: true, message, type });
    this.toastTimer = setTimeout(
      () => this.toast.update(t => ({ ...t, visible: false })),
      3000
    );
  }
}