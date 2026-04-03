import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Observable } from 'rxjs'
import { environment } from '../../../environments/environment'

@Injectable({ providedIn: 'root' })
export class ApiService {

  private http    = inject(HttpClient)
  private baseUrl = environment.apiUrl

  // ── AUTH ──────────────────────────────────────────────────────
  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/users/login/`, { username, password })
  }

  logout(refresh: string): Observable<any> {
    return this.http.post<any> (`${this.baseUrl}/users/logout/`, { refresh })
  }

  // ── CLIENTS ───────────────────────────────────────────────────
  getClients(pageOrQuery?: number | string, q = ''): Observable<any> {
  let params = new HttpParams()

  if (typeof pageOrQuery === 'number') {
    params = params.set('page', pageOrQuery.toString())
    if (q) params = params.set('q', q)
  } else if (typeof pageOrQuery === 'string') {
    params = params.set('q', pageOrQuery)
    params = params.set('page', '1')
  }

  return this.http.get<any>(`${this.baseUrl}/clients/`, { params })
}

  getClient(cin: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/clients/${cin}/`)
  }

  createClient(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/clients/`, data)
  }

  modifierClient(cin: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/clients/${cin}/`, data)
  }

  supprimerClient(cin: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/clients/${cin}/`)
  }

  getClientStats(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/clients/stats/`)
  }

  getClientSeances(cin: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/clients/${cin}/seances/`)
  }

  // ── SÉANCES ───────────────────────────────────────────────────
  getSeances(date?: string): Observable<any> {
    let params = new HttpParams()
    if (date) params = params.set('date', date)
    return this.http.get<any>(`${this.baseUrl}/seances/`, { params })
  }

  getReservations(seanceId: string | number, statut?: string, q?: string): Observable<any> {
    let params = new HttpParams()
    if (statut) params = params.set('statut', statut)
    if (q)      params = params.set('q', q)
    console.log("🌐 [HTTP] GET /reservations");
    return this.http.get<any>(`${this.baseUrl}/seances/${seanceId}/reservations/`, { params })
  }

  creerReservation(seanceId: string | number, payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/seances/${seanceId}/reservations/`, payload)
  }

  marquerPresent(id: string | number): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/seances/reservations/${id}/present/`, {});
  }

  marquerAbsent(id: string | number): Observable<any> {
    console.log("🌐 [HTTP] PATCH /reservations/absent/" + id);
    return this.http.patch<any>(`${this.baseUrl}/seances/reservations/${id}/absent/`, {});
  }

  annulerReservation(id: string | number): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/seances/reservations/${id}/annuler/`, {});
  }

  // ── PRODUITS ──────────────────────────────────────────────────
  getProduits(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/produits/`)
  }

  creerProduit(data: any): Observable<any> {
    return this.http.post<any>( `${this.baseUrl}/produits/`, data)
  }

  modifierProduit(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/produits/${id}/`, data)
  }
// ── VENTES ────────────────────────────────────────────────────
  getVentes(date?: string): Observable<any> {
    let params = new HttpParams()
    if (date) params = params.set('date', date)
    return this.http.get<any>(`${this.baseUrl}/produits/ventes/`, { params })
  }

  creerVente(data: any): Observable<any> {
    return this.http.post<any>( `${this.baseUrl}/produits/ventes/`, data)
  }

  // ── DASHBOARD ─────────────────────────────────────────────────
  getDashboardRevenus(periode = '12m'): Observable<any> {
  return this.http.get<any>(
    `${this.baseUrl}/users/dashboard/revenus/?periode=${periode}`
  )
}

getDashboardAlertes(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/users/dashboard/alertes/`)
}

getDashboardClients(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/users/dashboard/clients/`)
}

  // ── HISTORIQUE ────────────────────────────────────────────────
  getHistorique(date?: string): Observable<any> {
    let params = new HttpParams()
    if (date) params = params.set('date', date)
    return this.http.get<any>(`${this.baseUrl}/historique/`, { params })
  }

  // ── PERSONNEL ─────────────────────────────────────────────────
  getPersonnel(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/users/personnel/`)
  }

  creerPersonnel(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/users/`, data)
  }

  modifierPersonnel(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/users/personnel/${id}/`, data)
  }

  desactiverPersonnel(id: string): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/users/personnel/${id}/`, {})
  }

  supprimerPersonnel(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/users/personnel/${id}/`)
  }
  // ── ABONNEMENTS ───────────────────────────────────────────────
 
  // ✅ NOUVEAU — tous les abonnements (liste globale)
 getAllAbonnements(page = 1, statut?: string, q?: string): Observable<any> {
    let url = `${this.baseUrl}/clients/abonnements/?page=${page}`
    if (statut) url += `&statut=${statut}`
    if (q)      url += `&q=${encodeURIComponent(q)}`
    return this.http.get(url)
  }
 
  // Abonnement actif d'un client
  getAbonnementActif(cin: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/clients/${cin}/abonnement/`)
  }
  deleteAbonnement(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/clients/abonnements/${id}/`)
  }

 
  // ✅ NOUVEAU — créer un abonnement pour un client
  // POST /api/clients/{cin}/abonnement/
  // Payload : { type, mode_paiement, est_paye, date_paiement, date_expiration, reduction }
  createAbonnement(cin: string, payload: {
    pack_id:          string
    mode_paiement?:   'cash' | 'tpe' | ''
    est_paye?:        boolean
    date_paiement?:   string | null
    date_expiration?: string | null
    reduction?:       number
  }): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/clients/${cin}/abonnement/`,
      payload
    )
  }
  changePassword(payload: {
    old_password: string
    new_password: string
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/users/change-password/`, payload)
  }
  forgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/users/forgot-password/`, { email })
  }
  resetPassword(payload: {
    token: string
    new_password: string
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/users/reset-password/`, payload)
  }
  getHistoriqueAbonnements(cin: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/clients/${cin}/abonnements/`)
  }
 
  // PUT /api/clients/abonnements/{id}/
  modifierAbonnement(id: string, payload: {
    mode_paiement?:   'cash' | 'tpe'
    est_paye?:        boolean
    date_paiement?:   string | null
    date_expiration?: string | null
    reduction?:       number
  }): Observable<any> {
    return this.http.put(
      `${this.baseUrl}/clients/abonnements/${id}/`,
      payload
    )
  }
  // ── PACKS ──────────────────────────────────────────────────────

  /** GET /clients/packs/ → liste tous les packs actifs */
  getPacks(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/clients/packs/`)
  }

  /** POST /clients/packs/ → créer un pack
   *  Body : { nom, nb_seances, prix, description? }
   */
  createPack(payload: {
    nom: string
    nb_seances: number
    prix: number
    description?: string
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/clients/packs/`, payload)
  }

  /** PUT /clients/packs/<uuid>/ → modifier un pack
   *  Body : { nom?, nb_seances?, prix?, description?, est_actif? }
   */
  updatePack(packId: string, payload: {
    nom?: string
    nb_seances?: number
    prix?: number
    description?: string
    est_actif?: boolean
  }): Observable<any> {
    return this.http.put(`${this.baseUrl}/clients/packs/${packId}/`, payload)
  }

  /** DELETE /clients/packs/<uuid>/ → désactiver un pack (soft delete) */
  deletePack(packId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/clients/packs/${packId}/`)
  }

}
