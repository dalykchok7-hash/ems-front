import { Component, computed, OnInit, signal, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule }  from '@angular/forms'
import { ApiService }   from '../../core/services/api.service'

export type Role = 'admin' | 'personnel'

export interface StaffMember {
  id           : string
  prenom       : string
  nom          : string
  email        : string
  username     : string
  cin          : string
  telephone    : string
  role         : Role
  shift        : 'jour' | 'soir'
  date_embauche: string
  is_active    : boolean
  avatar_color ?: string
}

export interface StaffForm {
  prenom       : string
  nom          : string
  email        : string
  username     : string
  cin          : string
  telephone    : string
  role         : Role
  shift        : 'jour' | 'soir'
  date_embauche: string
  password     : string
  password2    : string
}

export interface ToastState {
  visible: boolean
  message: string
  type   : 'success' | 'warning' | 'info'
}

const PROTECTED_USER_ID = '1'

@Component({
  selector   : 'app-personnel',
  standalone : true,
  imports    : [CommonModule, FormsModule],
  templateUrl: './personnel.component.html',
  styleUrl   : './personnel.component.css'
})
export class PersonnelComponent implements OnInit {

  private apiService = inject(ApiService)

  staff        = signal<StaffMember[]>([])
  isLoading    = signal<boolean>(false)
  searchQuery  = signal<string>('')
  activeFilter = signal<string>('tous')
  showModal    = signal<boolean>(false)
  modalMode    = signal<'add' | 'edit'>('add')
  editId       = signal<string | null>(null)
  toast        = signal<ToastState>({ visible: false, message: '', type: 'info' })
  toastTimer   : any

  form: StaffForm = this.getEmptyForm()

  filteredStaff = computed(() => {
    let list = this.staff()
    const q  = this.searchQuery().toLowerCase().trim()
    if (q) {
      list = list.filter(m =>
        m.prenom.toLowerCase().includes(q)   ||
        m.nom.toLowerCase().includes(q)      ||
        m.username.toLowerCase().includes(q) ||
        m.cin.toLowerCase().includes(q)      ||
        m.email.toLowerCase().includes(q)
      )
    }
    const f = this.activeFilter()
    if (f === 'actifs')   list = list.filter(m =>  m.is_active)
    if (f === 'inactifs') list = list.filter(m => !m.is_active)
    if (f === 'jour')     list = list.filter(m => m.shift === 'jour')
    if (f === 'soir')     list = list.filter(m => m.shift === 'soir')
    return list
  })

  totalActifs   = computed(() => this.staff().filter(m =>  m.is_active).length)
  totalInactifs = computed(() => this.staff().filter(m => !m.is_active).length)

  totalRoles = computed(() => {
    const roles = new Set(this.staff().map(m => m.role))
    return roles.size
  })

  editTarget = computed<StaffMember | null>(() =>
    this.staff().find(m => m.id === this.editId()) ?? null
  )

  isProtectedUser = computed(() => this.editId() === PROTECTED_USER_ID)

  ngOnInit(): void {
    this.loadPersonnel()
  }

  loadPersonnel(): void {
    this.isLoading.set(true)
    this.apiService.getPersonnel().subscribe({
      next: (data: any) => {
        const list: any[] = Array.isArray(data) ? data : (data.results ?? [])
        const mapped: StaffMember[] = list.map((m: any) => ({
          id           : String(m.id),
          prenom       : m.first_name  || '',
          nom          : m.last_name   || '',
          email        : m.email       || '',
          username     : m.username    || '',
          cin          : m.cin         || '',
          telephone    : m.telephone   || '',
          role         : (m.role as Role) || 'personnel',
          shift        : m.shift        || 'jour',
          date_embauche: m.date_embauche || '',
          is_active    : !!m.is_active,
          avatar_color : this.getAvatarColor(m.first_name || 'X'),
        }))
        this.staff.set(mapped)
        this.isLoading.set(false)
      },
      error: () => {
        this.isLoading.set(false)
        this.showToast('Erreur lors du chargement du personnel', 'warning')
      }
    })
  }

  private readonly AVATAR_COLORS = [
    '#3b82f6','#10b981','#7c3aed','#f59e0b',
    '#ef4444','#ec4899','#06b6d4'
  ]

  getAvatarColor(nom: string): string {
    return this.AVATAR_COLORS[(nom.charCodeAt(0) || 0) % this.AVATAR_COLORS.length]
  }

  getInitials(member: StaffMember): string {
    return ((member.prenom?.[0] || '') + (member.nom?.[0] || '')).toUpperCase()
  }

  getRoleMeta(role: Role): { label: string; icon: string; class: string } {
    return role === 'admin'
      ? { label: 'Admin',     icon: '👑', class: 'role-admin'     }
      : { label: 'Personnel', icon: '📋', class: 'role-personnel' }
  }

  getShiftLabel(shift: string): string {
    return shift === 'jour' ? '☀️ Jour' : '🌙 Soir'
  }

  selectRole(role: Role): void {
    this.form.role = role
  }

  setFilter(f: string): void {
    this.activeFilter.set(f)
  }

  getEmptyForm(): StaffForm {
    return {
      prenom: '', nom: '', email: '', username: '',
      cin: '', telephone: '', role: 'personnel',
      shift: 'jour', date_embauche: '',
      password: '', password2: ''
    }
  }

  generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!$'
    return Array.from({ length: 12 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
  }

  generateAndFillPassword(): void {
    const pwd = this.generatePassword()
    this.form.password  = pwd
    this.form.password2 = pwd
    this.showToast(`Mot de passe généré : ${pwd}`, 'info')
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal()
    }
  }

  openAddModal(): void {
    this.modalMode.set('add')
    this.editId.set(null)
    this.form = this.getEmptyForm()
    this.showModal.set(true)
  }

  openEditModal(id: string): void {
    const m = this.staff().find(x => x.id === id)
    if (!m) return
    this.modalMode.set('edit')
    this.editId.set(id)
    this.form = {
      prenom       : m.prenom,
      nom          : m.nom,
      email        : m.email,
      username     : m.username,
      cin          : m.cin,
      telephone    : m.telephone,
      role         : m.role,
      shift        : m.shift,
      date_embauche: m.date_embauche,
      password     : '',
      password2    : ''
    }
    this.showModal.set(true)
  }

  closeModal(): void {
    this.showModal.set(false)
    this.editId.set(null)
  }

  resetPassword(id: string): void {
    if (!id) return
    this.showToast('Réinitialisation du mot de passe non encore implémentée', 'info')
  }

  // ── Gestion erreurs backend centralisée ──
  private handleBackendErrors(err: any, defaultMsg: string): void {
  console.log('ERREUR BACKEND:', JSON.stringify(err.error))

  // ── Email ──
  if (err?.error?.email) {
    this.showToast(err.error.email[0], 'warning')
    return
  }

  // ── CIN ──
  if (err?.error?.cin) {
    this.showToast(err.error.cin[0], 'warning')
    return
  }

  // ── Username ──
  if (err?.error?.username) {
    this.showToast(err.error.username[0], 'warning')
    return
  }

  // ── Password ──
  if (err?.error?.password) {
    this.showToast(err.error.password[0], 'warning')
    return
  }

  // ── Erreur générique ──
  const msg = err?.error?.detail
    || err?.error?.non_field_errors?.[0]
    || err?.error?.error
    || defaultMsg
  this.showToast(msg, 'warning')
}

  saveStaff(): void {
    // ── Validation commune add + edit ──
    if (!this.form.prenom.trim() || !this.form.nom.trim()) {
      this.showToast('Le prénom et le nom sont obligatoires', 'warning')
      return
    }

    if (this.modalMode() === 'add') {
      // ── Validation spécifique ajout ──
      if (!this.form.cin.trim()) {
        this.showToast('Le CIN est obligatoire', 'warning')
        return
      }
      if (!this.form.email.trim()) {
        this.showToast("L'email est obligatoire", 'warning')
        return
      }
      if (!this.form.username.trim()) {
        this.showToast("Le nom d'utilisateur est obligatoire", 'warning')
        return
      }
      if (!this.form.password) {
        this.showToast('Le mot de passe est obligatoire', 'warning')
        return
      }
      if (this.form.password !== this.form.password2) {
        this.showToast('Les mots de passe ne correspondent pas', 'warning')
        return
      }

      const payload = {
        username     : this.form.username || `${this.form.prenom}.${this.form.nom}`.toLowerCase(),
        password     : this.form.password,
        first_name   : this.form.prenom,
        last_name    : this.form.nom,
        email        : this.form.email,
        cin          : this.form.cin,
        telephone    : this.form.telephone,
        role         : this.form.role,
        shift        : this.form.shift,
        date_embauche: this.form.date_embauche,
      }

      this.isLoading.set(true)
      this.apiService.creerPersonnel(payload).subscribe({
        next: () => {
          this.showToast('Compte créé avec succès', 'success')
          this.loadPersonnel()
          this.closeModal()
        },
        error: (err: any) => {
          this.isLoading.set(false)
          this.handleBackendErrors(err, 'Erreur lors de la création du compte')
        }
      })

    } else {
      // ── Mode édition ──
      const id = this.editId()
      if (!id) return

      const payload = {
        first_name   : this.form.prenom.trim(),
        last_name    : this.form.nom.trim(),
        email        : this.form.email.trim(),
        cin          : this.form.cin.trim(),
        username     : this.form.username.trim(),
        telephone    : this.form.telephone.trim(),
        role         : this.form.role,
        shift        : this.form.shift,
        date_embauche: this.form.date_embauche,
      }

      this.isLoading.set(true)
      this.apiService.modifierPersonnel(id, payload).subscribe({
        next: () => {
          this.showToast('Compte modifié avec succès', 'success')
          this.loadPersonnel()
          this.closeModal()
        },
        error: (err: any) => {
          this.isLoading.set(false)
          this.handleBackendErrors(err, 'Erreur lors de la modification')
        }
      })
    }
  }

  deleteStaff(id: string): void {
    if (id === PROTECTED_USER_ID) {
      this.showToast('Cet utilisateur ne peut pas être supprimé', 'warning')
      return
    }
    if (!confirm('Confirmer la suppression de ce membre ?')) return

    this.apiService.supprimerPersonnel(id).subscribe({
      next: (res: any) => {
        const msg = res?.message || 'Membre supprimé avec succès'
        this.closeModal()
        this.loadPersonnel()
        this.showToast(msg, 'success')
      },
      error: (err: any) => {
        const msg = err?.error?.error || 'Erreur lors de la suppression'
        this.showToast(msg, 'warning')
      }
    })
  }

  toggleActif(id: string): void {
    if (id === PROTECTED_USER_ID) {
      this.showToast("Impossible de désactiver l'administrateur principal", 'warning')
      return
    }
    this.apiService.desactiverPersonnel(id).subscribe({
      next: () => {
        this.loadPersonnel()
      },
      error: (err: any) => {
        const msg = err?.error?.error || 'Erreur lors du changement de statut'
        this.showToast(msg, 'warning')
      }
    })
  }

  showToast(message: string, type: 'success' | 'warning' | 'info'): void {
    clearTimeout(this.toastTimer)
    this.toast.set({ visible: true, message, type })
    this.toastTimer = setTimeout(() => {
      this.toast.update(t => ({ ...t, visible: false }))
    }, 3000)
  }
}