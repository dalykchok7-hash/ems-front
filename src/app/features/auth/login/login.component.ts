import { Component, inject, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { AuthService } from '../../../core/services/auth.service'
import { ApiService }  from '../../../core/services/api.service'
import { ActivatedRoute } from '@angular/router';

// Injection




type LoginView = 'login' | 'forgot' | 'reset'

@Component({
  selector   : 'app-login',
  standalone : true,
  imports    : [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl   : './login.component.css'
})
export class LoginComponent {

  // ── Injection ────────────────────────────────────────────────────
  private authService = inject(AuthService)
  private apiService  = inject(ApiService)   // ← manquait

  // ── Login ────────────────────────────────────────────────────────
  username  = ''
  password  = ''

  // ── Forgot / Reset ───────────────────────────────────────────────
  view    = signal<LoginView>('login')
  loading = signal<boolean>(false)
  erreur  = signal<string>('')
  succes  = signal<string>('')

  forgotEmail  = ''
  resetToken   = ''
  resetNew     = ''
  resetConfirm = ''

  // ── Navigation entre vues ────────────────────────────────────────
  goTo(v: LoginView): void {
    this.view.set(v)
    this.erreur.set('')
    this.succes.set('')
  }
  private route = inject(ActivatedRoute);
  ngOnInit() {
  // on capte le "?token=..." de l'email
  const tokenUrl = this.route.snapshot.queryParamMap.get('token');
  if (tokenUrl) {
    this.resetToken = tokenUrl;
    this.goTo('reset'); // on emmène le user directement sur le panel 
  }
}

  // ── Login ────────────────────────────────────────────────────────
  login(): void {
    if (!this.username.trim() || !this.password.trim()) {
      this.erreur.set('Veuillez remplir tous les champs')
      return
    }

    this.loading.set(true)
    this.erreur.set('')

    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        this.loading.set(false)
        this.authService.redirectAfterLogin()
      },
      error: (err: any) => {
        this.loading.set(false)
        this.erreur.set(err?.error?.detail || 'Identifiants incorrects')
      }
    })
  }

  // ── Mot de passe oublié ──────────────────────────────────────────
  sendForgot(): void {
    if (!this.forgotEmail.trim()) {
      this.erreur.set('Veuillez saisir votre adresse email.')
      return
    }
    this.erreur.set('')
    this.succes.set('')
    this.loading.set(true)

    // ✅ Fix — passe la string directement (pas un objet)
    this.apiService.forgotPassword(this.forgotEmail.trim()).subscribe({
      next: (res: any) => {
        this.loading.set(false)
        this.succes.set(res?.message || 'Token envoyé ! Vérifiez votre email.')
        setTimeout(() => this.goTo('reset'), 2000)
      },
      error: (err) => {
        this.loading.set(false)
        this.erreur.set(this.extractError(err,
          "Fonctionnalité non disponible — contactez l'administrateur."))
      }
    })
  }

  // ── Réinitialiser mot de passe ───────────────────────────────────
  resetPassword(): void {
    this.erreur.set('')

    if (!this.resetToken.trim()) {
      this.erreur.set('Veuillez saisir le token reçu par email.')
      return
    }
    if (!this.resetNew || this.resetNew.length < 6) {
      this.erreur.set('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (this.resetNew !== this.resetConfirm) {
      this.erreur.set('Les mots de passe ne correspondent pas.')
      return
    }

    this.loading.set(true)

    this.apiService.resetPassword({
      token        : this.resetToken.trim(),
      new_password : this.resetNew
    }).subscribe({
      next: (res: any) => {
        this.loading.set(false)
        this.succes.set(res?.message || 'Mot de passe réinitialisé avec succès !')
        setTimeout(() => this.goTo('login'), 2000)
      },
      error: (err) => {
        this.loading.set(false)
        this.erreur.set(this.extractError(err, 'Token invalide ou expiré.'))
      }
    })
  }

  // ── Extraction sécurisée du message d'erreur ─────────────────────
  private extractError(err: any, fallback: string): string {
    try {
      if (!err) return fallback
      if (typeof err.error === 'object' && err.error !== null) {
        return err.error.error
            || err.error.detail
            || err.error.message
            || err.error.email?.[0]
            || err.error.non_field_errors?.[0]
            || fallback
      }
      if (err.status === 0)   return 'Impossible de joindre le serveur.'
      if (err.status === 404) return "Fonctionnalité non disponible — contactez l'administrateur."
      if (err.status === 500) return 'Erreur serveur — réessayez plus tard.'
      return fallback
    } catch {
      return fallback
    }
  }

  // ── Force du mot de passe ────────────────────────────────────────
  get pwdStrength(): number {
    const p = this.resetNew
    if (!p)          return 0
    if (p.length >= 12) return 3
    if (p.length >= 8)  return 2
    return 1
  }

  get pwdStrengthLabel(): string {
    return ['', 'Faible', 'Moyen', 'Fort'][this.pwdStrength]
  }

  get pwdStrengthColor(): string {
    return ['', '#ff6b6b', '#fbbf24', '#22d47c'][this.pwdStrength]
  }
}