import { Injectable, inject } from '@angular/core'
import { Router } from '@angular/router'
import { ApiService } from './api.service'
import { tap } from 'rxjs/operators'
import { Observable } from 'rxjs'

export interface AuthUser {
  id    : string
  role  : 'admin' | 'personnel'
  username: string
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private router     = inject(Router)
  private apiService = inject(ApiService)

  // ── Getters ──────────────────────────────────────

  getToken(): string | null {
    return localStorage.getItem('access')
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh')
  }

  getUser(): AuthUser | null {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    try   { return JSON.parse(raw) as AuthUser }
    catch { return null }
  }

  getRole(): string {
    return this.getUser()?.role || ''
  }

  isLoggedIn(): boolean {
    return !!this.getToken()
  }

  isAdmin(): boolean {
    return this.getRole() === 'admin'
  }

  isPersonnel(): boolean {
    return this.getRole() === 'personnel'
  }

  // ── Login ──────────────────────────────────────

  login(username: string, password: string): Observable<any> {
    return this.apiService.login(username, password).pipe(
      tap((res: any) => {
        localStorage.setItem('access',  res.access)
        localStorage.setItem('refresh', res.refresh)
        localStorage.setItem('user',    JSON.stringify(res.user))
      })
    )
  }

  // ── Logout ──────────────────────────────────────

  logout(): void {
    const refresh = this.getRefreshToken()
    if (refresh) {
      this.apiService.logout(refresh).subscribe({ error: () => {} })
    }
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    localStorage.removeItem('user')
    this.router.navigate(['/'])
  }

  // ── Redirection après login selon rôle ──────────

  redirectAfterLogin(): void {
    const role = this.getRole()
    if (role === 'admin' || role === 'personnel') {
      this.router.navigate(['/dashboard'])
    } else {
      this.router.navigate(['/'])
    }
  }
}