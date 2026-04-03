import {
  Component, OnInit, signal, computed, inject
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../core/services/api.service'

// ── Types ──────────────────────────────────────────────────────
export type ModePaiement   = 'cash' | 'tpe'
export type AboStatut      = 'actif' | 'expiré' | 'terminé' | 'en_attente'
export type FilterMode     = 'tous' | 'actif' | 'expiré' | 'terminé' | 'essai'
export type ModalMode      = 'add' | 'edit'
export type UserRole       = 'admin' | 'personnel'

// ── Interfaces API ─────────────────────────────────────────────
export interface PackAPI {
  id:          string
  nom:         string
  nb_seances:  number
  prix:        string       // DecimalField → string dans DRF
  description: string
  est_actif:   boolean
  created_at:  string
}

export interface AbonnementAPI {
  id:                   string
  client:               string
  client_nom:           string
  pack:                 string        // UUID du pack (FK)
  pack_detail:          PackAPI | null
  reduction:            string        // DecimalField → string
  prix_paye:            string
  mode_paiement:        ModePaiement
  est_paye:             boolean
  date_paiement:        string | null
  seances_total:        number
  seances_restantes:    number
  date_debut:           string
  date_derniere_seance: string | null
  date_expiration:      string | null
  statut:               AboStatut
  created_at:           string
}

// ── Payload création → pack_id attendu par CreerAbonnementSerializer
export interface AboCreatePayload {
  pack_id:        string
  mode_paiement:  ModePaiement | ''
  est_paye:       boolean
  date_paiement:  string | null
  date_expiration: string | null
  reduction:      number
}

// ── Payload modification → ModifierAbonnementSerializer
export interface AboEditPayload {
  mode_paiement?:  ModePaiement
  est_paye?:       boolean
  date_paiement?:  string | null
  date_expiration?: string | null
  reduction?:      number
}

// ── Formulaire local ───────────────────────────────────────────
export interface AboFormLocal {
  client_cin:      string
  pack_id:         string        // UUID du pack sélectionné
  mode_paiement:   ModePaiement
  est_paye:        boolean
  date_paiement:   string
  date_expiration: string
  reduction:       number
}

// ── PackMeta : ce qu'utilise le template ──────────────────────
export interface PackMeta {
  id:        string        // UUID
  label:     string
  icon:      string        // emoji généré côté front (absent du back)
  seances:   number
  prix:      number
  desc:      string
  color:     string
  bgClass:   string
  tagClass:  string
}

// ── Pack form (modal ajout/édition pack) ─────────────────────
export interface PackFormLocal {
  id:        string        // UUID si édition, vide si création
  label:     string
  seances:   number | null
  prix:      number | null
  desc:      string
}

// ── Remises rapides ───────────────────────────────────────────
export const QUICK_DISCOUNTS = [10, 20, 30, 50] as const
export type QuickDiscount = typeof QUICK_DISCOUNTS[number]

@Component({
  selector:    'app-abonnements',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './abonnements.html',
  styleUrl:    './abonnements.css',
})
export class AbonnementsComponent implements OnInit {

  private apiService = inject(ApiService)

  // ── Rôle ──────────────────────────────────────────────────────
  userRole    = signal<UserRole>('admin')
  isAdmin     = computed(() => this.userRole() === 'admin')
  canManageAbo = computed(() =>
    this.userRole() === 'admin' || this.userRole() === 'personnel'
  )

  // ── State ──────────────────────────────────────────────────────
  abonnements      = signal<AbonnementAPI[]>([])
  packs            = signal<PackMeta[]>([])
  isLoading        = signal<boolean>(false)
  isLoadingPacks   = signal<boolean>(false)
  searchQuery      = signal<string>('')
  activeFilter     = signal<FilterMode>('tous')
  showModal        = signal<boolean>(false)
  modalMode        = signal<ModalMode>('add')
  editId           = signal<string | null>(null)
  clientsOptions   = signal<ClientOption[]>([])
  isLoadingClients = signal<boolean>(false)

  showPackModal  = signal<boolean>(false)
  packModalMode  = signal<'add' | 'edit'>('add')
  packForm: PackFormLocal = this.emptyPackForm()

  formError = signal<string | null>(null)

  toast = signal<{ visible: boolean; message: string; type: 'success' | 'warning' | 'info' }>({
    visible: false, message: '', type: 'success'
  })
  private toastTimer: any

  aboForm: AboFormLocal = this.emptyAboForm()

  readonly QUICK_DISCOUNTS = QUICK_DISCOUNTS

  // Palette de couleurs cyclique pour les packs dynamiques
  readonly PACK_COLORS = [
    '#9ba3c8', '#22d3ee', '#f59e0b',
    '#c084fc', '#3b82f6', '#22c55e',
    '#ec4899', '#f87171', '#a78bfa',
  ]

  readonly PACK_ICONS = ['🆓', '⚡', '🌟', '🔷', '💎', '💪', '🏆', '🎯', '🚀']

  get searchValue(): string { return this.searchQuery() }
  set searchValue(v: string) { this.searchQuery.set(v) }

  readonly MODES_PAIEMENT = [
    { key: 'cash' as ModePaiement, label: 'Espèces',        icon: '💵' },
    { key: 'tpe'  as ModePaiement, label: 'Carte bancaire', icon: '💳' },
  ]

  // ── Computed ───────────────────────────────────────────────────
  filteredAbonnements = computed(() => {
    let list = this.abonnements()
    const f  = this.activeFilter()
    const q  = this.searchQuery().toLowerCase().trim()

    if (f === 'actif')   list = list.filter(a => a.statut === 'actif')
    if (f === 'expiré')  list = list.filter(a => a.statut === 'expiré')
    if (f === 'terminé') list = list.filter(a => a.statut === 'terminé')
    // "essai" : on détecte les packs à 1 séance (plus de slug hardcodé)
    if (f === 'essai')   list = list.filter(a =>
      a.pack_detail?.nb_seances === 1
    )

    if (q) list = list.filter(a =>
      a.client_nom.toLowerCase().includes(q)
    )
    return list
  })

  totalAbonnements = computed(() => this.abonnements().length)

  totalActifs = computed(() =>
    this.abonnements().filter(a =>
      a.statut === 'actif' && (a.pack_detail?.nb_seances ?? 0) > 1
    ).length
  )

  totalExpirants = computed(() =>
    this.abonnements().filter(a => a.statut === 'expiré').length
  )

  totalEssais = computed(() =>
    this.abonnements().filter(a => a.pack_detail?.nb_seances === 1).length
  )

  revenueTotal = computed(() =>
    this.abonnements()
      .filter(a => a.statut !== 'terminé')
      .reduce((sum, a) => sum + parseFloat(a.prix_paye || '0'), 0)
  )

  // Nombre d'abonnements actifs par pack (par UUID)
  packCounts = computed(() => {
    const list   = this.abonnements().filter(a => a.statut === 'actif')
    const counts: Record<string, number> = {}
    list.forEach(a => {
      if (a.pack) counts[a.pack] = (counts[a.pack] ?? 0) + 1
    })
    return counts
  })

  parseFloat = parseFloat

  // Prix final affiché dans le formulaire
  prixAffiche(): number {
    const pack = this.packs().find(p => p.id === this.aboForm.pack_id)
    if (!pack) return 0
    if (this.aboForm.reduction > 0) {
      return Math.round(pack.prix * (1 - this.aboForm.reduction / 100))
    }
    return pack.prix
  }

  // ── Init ───────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadRoleFromStorage()
    this.loadPacks()
    this.loadAbonnements()
  }

  loadRoleFromStorage(): void {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (user.role === 'admin' || user.role === 'personnel') {
        this.userRole.set(user.role)
      }
    } catch { }
  }

  // ── Charger packs depuis l'API ─────────────────────────────────
  loadPacks(): void {
    this.isLoadingPacks.set(true)
    this.apiService.getPacks().subscribe({
      next: (data: PackAPI[]) => {
        const mapped: PackMeta[] = data.map((p, i) => ({
          id:       p.id,
          label:    p.nom,
          icon:     this.PACK_ICONS[i % this.PACK_ICONS.length],
          seances:  p.nb_seances,
          prix:     parseFloat(p.prix),
          desc:     p.description || `${p.nb_seances} séance(s)`,
          color:    this.PACK_COLORS[i % this.PACK_COLORS.length],
          bgClass:  `pack-custom pack-idx-${i % 6}`,
          tagClass: `tag-custom tag-idx-${i % 6}`,
        }))
        this.packs.set(mapped)
        this.isLoadingPacks.set(false)
        // Initialiser pack_id si le formulaire est ouvert
        if (!this.aboForm.pack_id && mapped.length > 0) {
          this.aboForm.pack_id = mapped[0].id
        }
      },
      error: () => {
        this.isLoadingPacks.set(false)
        this.showToast('❌ Erreur chargement packs', 'warning')
      }
    })
  }

  // ── Charger abonnements ────────────────────────────────────────
  loadAbonnements(): void {
    this.isLoading.set(true)
    let allData: AbonnementAPI[] = []
    let page = 1

    const fetchPage = () => {
      this.apiService.getAllAbonnements(page).subscribe({
        next: (data: any) => {
          const results = data.results || []
          allData = [...allData, ...results]
          if (data.next) {
            page++
            fetchPage()
          } else {
            this.abonnements.set(allData)
            this.isLoading.set(false)
          }
        },
        error: () => {
          this.isLoading.set(false)
          this.showToast('❌ Erreur de chargement', 'warning')
        }
      })
    }

    fetchPage()
  }

  // ── Charger clients ────────────────────────────────────────────
  loadClients(q = ''): void {
    this.isLoadingClients.set(true)
    this.apiService.getClients(q).subscribe({
      next: (data: any) => {
        const list = Array.isArray(data) ? data : (data.results || [])
        this.clientsOptions.set(list)
        this.isLoadingClients.set(false)
      },
      error: () => this.isLoadingClients.set(false)
    })
  }

  editTarget = computed(() =>
    this.abonnements().find(a => a.id === this.editId()) ?? null
  )

  // ── Helpers ────────────────────────────────────────────────────
  readonly AVATAR_COLORS = [
    '#3b82f6', '#7c3aed', '#ec4899',
    '#10b981', '#f59e0b', '#06b6d4', '#ef4444', '#8b5cf6',
  ]

  getInitials(nom: string): string {
    return nom.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  }

  getAvatarColor(nom: string): string {
    return this.AVATAR_COLORS[nom.charCodeAt(0) % this.AVATAR_COLORS.length]
  }

  /** Retourne le PackMeta depuis son UUID */
  getPackMeta(packId: string): PackMeta {
    return this.packs().find(p => p.id === packId) ?? {
      id: '', label: '—', icon: '📦',
      seances: 0, prix: 0, desc: '',
      color: '#666', bgClass: '', tagClass: '',
    }
  }

  /** Retourne le PackMeta depuis pack_detail (quand l'UUID seul ne suffit pas) */
  getPackMetaFromDetail(abo: AbonnementAPI): PackMeta {
    // Priorité : pack_detail du serializer (toujours frais)
    if (abo.pack_detail) {
      const cached = this.packs().find(p => p.id === abo.pack)
      return {
        id:      abo.pack_detail.id,
        label:   abo.pack_detail.nom,
        icon:    cached?.icon  ?? '📦',
        seances: abo.pack_detail.nb_seances,
        prix:    parseFloat(abo.pack_detail.prix),
        desc:    abo.pack_detail.description,
        color:   cached?.color   ?? '#a78bfa',
        bgClass: cached?.bgClass ?? 'pack-custom',
        tagClass:cached?.tagClass ?? 'tag-custom',
      }
    }
    return this.getPackMeta(abo.pack)
  }

  getProgressPercent(a: AbonnementAPI): number {
    if (a.seances_total === 0) return 0
    return Math.round(
      ((a.seances_total - a.seances_restantes) / a.seances_total) * 100
    )
  }

  getProgressColor(pct: number): string {
    if (pct >= 90) return '#f87171'
    if (pct >= 70) return '#fbbf24'
    return '#3b82f6'
  }

  getStatutLabel(s: AboStatut): string {
    const map: Record<AboStatut, string> = {
      actif:       'Actif',
      expiré:      'Expiré',
      terminé:     'Terminé',
      en_attente:  'En attente',
    }
    return map[s] ?? s
  }

  getStatutClass(s: AboStatut): string {
    const map: Record<AboStatut, string> = {
      actif:       'sp-actif',
      expiré:      'sp-expire',
      terminé:     'sp-termine',
      en_attente:  'sp-attente',
    }
    return map[s] ?? 'sp-termine'
  }

  getSeancesUtilisees(a: AbonnementAPI): number {
    return a.seances_total - a.seances_restantes
  }

  formatPrice(prix: number | null): string {
    return prix === null ? 'Gratuit' : prix.toLocaleString('fr-FR') + ' DT'
  }

  formatPrixPaye(prix: string): string {
    return parseFloat(prix || '0').toLocaleString('fr-FR') + ' DT'
  }

  getModeLabel(mode: ModePaiement): string {
    return mode === 'cash' ? '💵 Espèces' : '💳 Carte bancaire'
  }

  getReductionDT(a: AbonnementAPI): number {
    const meta = this.getPackMetaFromDetail(a)
    const pct  = parseFloat(a.reduction || '0')
    return Math.round(meta.prix * pct / 100)
  }

  // ── Forms vides ────────────────────────────────────────────────
  private emptyAboForm(): AboFormLocal {
    return {
      client_cin:      '',
      pack_id:         this.packs()[0]?.id ?? '',
      mode_paiement:   'cash',
      est_paye:        false,
      date_paiement:   '',
      date_expiration: '',
      reduction:       0,
    }
  }

  private emptyPackForm(): PackFormLocal {
    return { id: '', label: '', seances: null, prix: null, desc: '' }
  }

  // ── Remise / Pack ──────────────────────────────────────────────
  onPackChange(packId: string): void {
    this.aboForm.pack_id   = packId
    this.aboForm.reduction = 0
  }

  selectQuickDiscount(pct: QuickDiscount): void {
    this.aboForm.reduction = this.aboForm.reduction === pct ? 0 : pct
  }

  // ── Filtres ────────────────────────────────────────────────────
  setFilter(f: FilterMode): void { this.activeFilter.set(f) }

  // ── Modal Abonnement ───────────────────────────────────────────
  openAddModal(packId: string = ''): void {
    if (!this.canManageAbo()) {
      this.showToast('Action non autorisée', 'warning')
      return
    }
    this.formError.set(null)
    this.modalMode.set('add')
    this.editId.set(null)
    const defaultPack = packId || (this.packs()[0]?.id ?? '')
    this.aboForm = { ...this.emptyAboForm(), pack_id: defaultPack }
    this.loadClients()
    this.clientSearchQuery  = ''
    this.selectedClient     = null
    this.showClientDropdown = false
    this.showModal.set(true)
  }

  openEditModal(id: string): void {
    if (!this.canManageAbo()) {
      this.showToast('Action non autorisée', 'warning')
      return
    }
    const abo = this.abonnements().find(a => a.id === id)
    if (!abo) return

    this.formError.set(null)
    this.modalMode.set('edit')
    this.editId.set(id)
    this.aboForm = {
      client_cin:      '',
      pack_id:         abo.pack,
      mode_paiement:   abo.mode_paiement || 'cash',
      est_paye:        abo.est_paye,
      date_paiement:   abo.date_paiement   || '',
      date_expiration: abo.date_expiration || '',
      reduction:       parseFloat(abo.reduction || '0'),
    }
    this.showModal.set(true)
  }

  renouvelerAbonnement(id: string): void {
    if (!this.canManageAbo()) {
      this.showToast('Action non autorisée', 'warning')
      return
    }
    const abo = this.abonnements().find(a => a.id === id)
    if (!abo) return

    this.formError.set(null)
    this.modalMode.set('add')
    this.editId.set(null)
    this.aboForm = {
      ...this.emptyAboForm(),
      pack_id:       abo.pack,
      mode_paiement: abo.mode_paiement || 'cash',
    }
    this.loadClients()
    this.showModal.set(true)
    this.showToast(`Renouvellement pour ${abo.client_nom}`, 'info')
  }

  closeModal(): void { this.showModal.set(false) }

  // ── Modal Pack ─────────────────────────────────────────────────
  openAddPackModal(): void {
    if (!this.isAdmin()) {
      this.showToast('Action réservée à l\'administrateur', 'warning')
      return
    }
    this.formError.set(null)
    this.packModalMode.set('add')
    this.packForm = this.emptyPackForm()
    this.showPackModal.set(true)
  }

  openEditPackModal(pack: PackMeta): void {
    if (!this.isAdmin()) {
      this.showToast('Action réservée à l\'administrateur', 'warning')
      return
    }
    this.formError.set(null)
    this.packModalMode.set('edit')
    this.packForm = {
      id:      pack.id,
      label:   pack.label,
      seances: pack.seances,
      prix:    pack.prix,
      desc:    pack.desc,
    }
    this.showPackModal.set(true)
  }

  closePackModal(): void { this.showPackModal.set(false) }

  savePackForm(): void {
    this.formError.set(null)
    const f = this.packForm

    if (!f.label.trim()) {
      this.formError.set('Veuillez saisir un nom de pack')
      return
    }
    if (!f.seances || f.seances <= 0) {
      this.formError.set('Veuillez saisir un nombre de séances valide')
      return
    }
    if (!f.prix || f.prix <= 0) {
      this.formError.set('Veuillez saisir un prix valide')
      return
    }

    // Champs attendus par CreerPackSerializer / ModifierPackSerializer
    const payload: any = {
      nom:         f.label.trim(),
      nb_seances:  f.seances,
      prix:        f.prix,
    }
    
    if (f.desc && f.desc.trim()) {
      payload.description = f.desc.trim()
    }

    if (this.packModalMode() === 'edit' && f.id) {
      this.apiService.updatePack(f.id, payload).subscribe({
        next: () => {
          this.loadPacks()
          this.showToast(`✅ Pack "${f.label}" modifié`, 'success')
          this.closePackModal()
        },
        error: (err) => this.formError.set(this.extractErrorMessage(err))
      })
    } else {
      this.apiService.createPack(payload).subscribe({
        next: () => {
          this.loadPacks()
          this.showToast(`✅ Pack "${f.label}" créé`, 'success')
          this.closePackModal()
        },
        error: (err) => this.formError.set(this.extractErrorMessage(err))
      })
    }
  }

  // ── Save Abonnement ────────────────────────────────────────────
  saveAbonnement(): void {
    if (this.modalMode() === 'add') {
      this.creerAbonnement()
    } else {
      this.modifierAbonnement()
    }
  }

  private creerAbonnement(): void {
    this.formError.set(null)

    if (!this.aboForm.client_cin) {
      this.formError.set('Veuillez sélectionner un client')
      return
    }
    if (!this.aboForm.pack_id) {
      this.formError.set('Veuillez sélectionner un pack')
      return
    }

    // CreerAbonnementSerializer attend pack_id (UUID)
    const payload: AboCreatePayload = {
      pack_id:         this.aboForm.pack_id,
      mode_paiement:   this.aboForm.mode_paiement,
      est_paye:        this.aboForm.est_paye,
      date_paiement:   this.aboForm.date_paiement   || null,
      date_expiration: this.aboForm.date_expiration || null,
      reduction:       this.aboForm.reduction,
    }

    this.apiService.createAbonnement(this.aboForm.client_cin, payload).subscribe({
      next: (abo: AbonnementAPI) => {
        this.loadAbonnements()
        const packLabel = abo.pack_detail?.nom
          ?? this.getPackMeta(abo.pack).label
        this.showToast(`✅ Abonnement ${packLabel} créé`, 'success')
        this.closeModal()
      },
      error: (err) => this.formError.set(this.extractErrorMessage(err))
    })
  }

  private modifierAbonnement(): void {
    this.formError.set(null)
    const id = this.editId()
    if (!id) return

    // ModifierAbonnementSerializer — on ne peut PAS changer le pack
    const payload: AboEditPayload = {
      mode_paiement:   this.aboForm.mode_paiement,
      est_paye:        this.aboForm.est_paye,
      date_paiement:   this.aboForm.date_paiement   || null,
      date_expiration: this.aboForm.date_expiration || null,
      reduction:       this.aboForm.reduction,
    }

    this.apiService.modifierAbonnement(id, payload).subscribe({
      next: () => {
        this.loadAbonnements()
        this.showToast('✅ Abonnement modifié avec succès', 'success')
        this.closeModal()
      },
      error: (err) => this.formError.set(this.extractErrorMessage(err))
    })
  }

  // ── Delete ─────────────────────────────────────────────────────
  deleteAbonnement(id: string, clientNom: string): void {
    if (!this.canManageAbo()) {
      this.showToast('Action non autorisée', 'warning')
      return
    }
    if (!confirm(`Supprimer l'abonnement de ${clientNom} ? Cette action est irréversible.`))
      return

    this.apiService.deleteAbonnement(id).subscribe({
      next: () => {
        this.abonnements.update(list => list.filter(a => a.id !== id))
        this.showToast(`✅ Abonnement de ${clientNom} supprimé`, 'success')
      },
      error: (err) => {
        const msg = err.error?.error || 'Erreur lors de la suppression'
        this.showToast(`❌ ${msg}`, 'warning')
      }
    })
  }

  // ── Extraction erreur API ──────────────────────────────────────
  private extractErrorMessage(err: any): string {
    if (!err?.error) return 'Erreur inconnue'
    if (err.error.error) return err.error.error
    if (err.error.non_field_errors?.length) return err.error.non_field_errors[0]
    const firstKey = Object.keys(err.error)[0]
    if (firstKey && err.error[firstKey]?.length) return err.error[firstKey][0]
    return 'Erreur serveur'
  }

  // ── Toast ──────────────────────────────────────────────────────
  showToast(
    message: string,
    type: 'success' | 'warning' | 'info' = 'success'
  ): void {
    clearTimeout(this.toastTimer)
    this.toast.set({ visible: true, message, type })
    this.toastTimer = setTimeout(
      () => this.toast.update(t => ({ ...t, visible: false })),
      3000
    )
  }

  // ── Client search ──────────────────────────────────────────────
  clientSearchQuery   = ''
  showClientDropdown  = false
  selectedClient: ClientOption | null = null

  filteredClients = computed(() => {
    const q = this.clientSearchQuery.toLowerCase().trim()
    if (!q) return this.clientsOptions()
    return this.clientsOptions().filter(c =>
      c.nom.toLowerCase().includes(q)     ||
      c.prenom.toLowerCase().includes(q)  ||
      c.cin.toLowerCase().includes(q)     ||
      (c.telephone_1 || '').includes(q)
    )
  })

  onClientSearch(q: string): void {
    this.clientSearchQuery  = q
    this.showClientDropdown = true
    this.selectedClient     = null
    this.aboForm.client_cin = ''
    if (q.length >= 2) this.loadClients(q)
  }

  selectClient(c: ClientOption): void {
    this.selectedClient     = c
    this.aboForm.client_cin = c.cin
    this.clientSearchQuery  = c.prenom + ' ' + c.nom
    this.showClientDropdown = false
  }

  clearClientSearch(): void {
    this.clientSearchQuery  = ''
    this.selectedClient     = null
    this.aboForm.client_cin = ''
    this.showClientDropdown = false
  }
}

// ── ClientOption (inchangé) ────────────────────────────────────
export interface ClientOption {
  id:          string
  nom:         string
  prenom:      string
  cin:         string
  telephone_1: string
}