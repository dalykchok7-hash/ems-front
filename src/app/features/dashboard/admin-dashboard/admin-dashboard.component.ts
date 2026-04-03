import {
  Component, OnInit, OnDestroy, AfterViewInit,
  signal, computed, ElementRef, ViewChild, inject
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';


// ── Models ──────────────────────────────────────────────────────

export interface RevenueBlock {
  label:       string;
  total:       number;
  abonnements: number;
  ventes:      number;
  icon:        string;
  color:       string;
  bgColor:     string;
  borderColor: string;
}

export interface SeanceRow {
  id:           number;
  heure_debut:  string;
  heure_fin:    string;
  reservations: number;
  places_total: number;
  disponibles:  number;
  i_motion:     number;
  i_model:      number;
}

export interface ExpiringAbo {
  initials:          string;
  nom:               string;
  type:              string;
  seances_restantes: number;
  avatar_color:      string;
  bar_percent:       number;
}

export interface ExpiringProduit {
  nom:          string;
  stock:        number;
  seuil_alerte: number;
  type:         string;
}

export interface ClientStats {
  total:         number;
  actifs:        number;
  inactifs:      number;
  nouveaux_mois: number;
}

export interface ChartMode {
  key:     'week' | 'month' | 'year';
  label:   string;
  periode: string;
}

export interface ToastState {
  visible: boolean;
  message: string;
  type:    'success' | 'warning' | 'info';
}

// ── Component ─────────────────────────────────────────────────────

@Component({
  selector:    'app-admin-dashboard',
  standalone:  true,
  imports:     [CommonModule, DatePipe, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl:    './admin-dashboard.component.css',
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  private router     = inject(Router);
  private apiService = inject(ApiService);

  @ViewChild('revenueCanvas') revenueCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('donutCanvas')   donutCanvasRef!:   ElementRef<HTMLCanvasElement>;

  // ── State ───────────────────────────────────────────────────────
  currentDate     = signal<Date>(new Date());
  activeChartMode = signal<'week' | 'month' | 'year'>('month');
  toast           = signal<ToastState>({ visible: false, message: '', type: 'success' });

  // ── Change Password Modal ─────────────────────────────────────
  showPasswordModal = signal<boolean>(false);
  passwordForm = { old_password: '', new_password: '', confirm_password: '' };
  passwordError = signal<string | null>(null);
  passwordLoading = signal<boolean>(false);

  // Loading granulaire par bloc
  isLoadingRevenus = signal<boolean>(false);
  isLoadingAlertes = signal<boolean>(false);
  isLoadingClients = signal<boolean>(false);

  chartsReady = false;

  private toastTimer:   any = null;
  private revenueChart: any = null;
  private donutChart:   any = null;

  DONUT_COLORS = ['#3b82f6', '#c084fc', '#fbbf24', '#f87171', '#10b981', '#22d3ee'];

  chartModes: ChartMode[] = [
    { key: 'week',  label: '7j',   periode: '7j'   },
    { key: 'month', label: '12m',  periode: '12m'  },
    { key: 'year',  label: 'Tout', periode: 'tout' },
  ];

  // Cache courbe par mode
  CHART_DATA: Record<string, { labels: string[]; data: number[] }> = {
    week:  { labels: [], data: [] },
    month: { labels: [], data: [] },
    year:  { labels: [], data: [] },
  };

  // ── Data signals ────────────────────────────────────────────────
  revenueBlocs       = signal<RevenueBlock[]>([]);
  abonnementsParType = signal<any[]>([]);
  expiringAbos       = signal<ExpiringAbo[]>([]);
  produitsAlerte     = signal<ExpiringProduit[]>([]);
  clientStats        = signal<ClientStats>({ total: 0, actifs: 0, inactifs: 0, nouveaux_mois: 0 });
  seancesJour:         SeanceRow[] = [];

  // ── Computed ────────────────────────────────────────────────────
  formattedDate = computed(() =>
    this.currentDate().toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
  );

  // true si au moins un bloc charge encore
  isLoading = computed(() =>
    this.isLoadingRevenus() || this.isLoadingAlertes() || this.isLoadingClients()
  );

  chartFooterStats = computed(() => {
    const d = this.CHART_DATA[this.activeChartMode()];
    if (!d?.data?.length) return [
      { label: 'Données', value: 'Aucune donnée', color: 'var(--t3)' },
    ];
    const max      = Math.max(...d.data);
    const maxIdx   = d.data.indexOf(max);
    const avg      = Math.round(d.data.reduce((a, b) => a + b, 0) / d.data.length);
    const total    = d.data.reduce((a, b) => a + b, 0);
    const maxLabel = d.labels[maxIdx] || '—';
    const mode     = this.activeChartMode();
    return [
      {
        label: mode === 'week' ? 'Meilleur jour' : mode === 'month' ? 'Meilleur mois' : 'Meilleure période',
        value: `${maxLabel} — ${max.toLocaleString('fr-FR')} DT`,
        color: 'var(--green)',
      },
      {
        label: mode === 'week' ? 'Moyenne/jour' : 'Moyenne mensuelle',
        value: `${avg.toLocaleString('fr-FR')} DT`,
        color: '#fff',
      },
      {
        label: 'Total période',
        value: `${total.toLocaleString('fr-FR')} DT`,
        color: 'var(--blue)',
      },
    ];
  });

  // ── Lifecycle ───────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadRevenus('month');
    this.loadAlertes();
    this.loadClients();
    this.loadSeancesJour();
  }

  ngAfterViewInit(): void {
    this.chartsReady = true;
    const d = this.CHART_DATA['month'];
    if (d?.labels?.length > 0) this.buildRevenueChart('month');
    if (this.abonnementsParType().length > 0) setTimeout(() => this.buildDonutChart(), 0);
  }

  ngOnDestroy(): void {
    this.revenueChart?.destroy();
    this.donutChart?.destroy();
    clearTimeout(this.toastTimer);
  }

  // ══════════════════════════════════════════════════════════════════
  // BLOC 1 — GET /api/users/dashboard/revenus/?periode=...
  // ══════════════════════════════════════════════════════════════════

  loadRevenus(mode: 'week' | 'month' | 'year'): void {
    this.isLoadingRevenus.set(true);
    const periode = this.chartModes.find(m => m.key === mode)?.periode || '12m';

    this.apiService.getDashboardRevenus(periode).subscribe({
      next: (data: any) => {
        this.isLoadingRevenus.set(false);

        // ── Revenue blocs ──────────────────────────────────────────
        const jour  = data.revenu_jour  || { abonnements: 0, ventes: 0, total: 0 };
        const mois  = data.revenu_mois  || { abonnements: 0, ventes: 0, total: 0 };
        const annee = data.revenu_annee || { abonnements: 0, ventes: 0, total: 0 };

        this.revenueBlocs.set([
          {
            label: "Revenue du Jour",
            total:       parseFloat(jour.total),
            abonnements: parseFloat(jour.abonnements),
            ventes:      parseFloat(jour.ventes),
            icon: '💰', color: '#3b82f6',
            bgColor: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.18)',
          },
          {
            label: 'Revenue Mensuel',
            total:       parseFloat(mois.total),
            abonnements: parseFloat(mois.abonnements),
            ventes:      parseFloat(mois.ventes),
            icon: '📅', color: '#10b981',
            bgColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.18)',
          },
          {
            label: 'Revenue Annuel',
            total:       parseFloat(annee.total),
            abonnements: parseFloat(annee.abonnements),
            ventes:      parseFloat(annee.ventes),
            icon: '📊', color: '#c084fc',
            bgColor: 'rgba(192,132,252,0.08)', borderColor: 'rgba(192,132,252,0.18)',
          },
        ]);

        // ── Courbe (chart ligne) ───────────────────────────────────
        const courbe: any[] = data.revenus_courbe || [];
        this.CHART_DATA[mode] = courbe.length
          ? { labels: courbe.map(r => r.label), data: courbe.map(r => r.total) }
          : { labels: [], data: [] };
        if (this.chartsReady) this.buildRevenueChart(mode);

        // ── Revenue par type → donut ───────────────────────────────
        console.log("📊 Données brutes Dashboard Revenus:", data);
        const parTypeSource = data.revenus_par_type || data.revenu_par_type || data.abonnements_par_type || [];
        let mapped: any[] = [];
        if (Array.isArray(parTypeSource) && parTypeSource.length > 0) {
          mapped = parTypeSource.map((p: any) => ({
            label: p.label || p.type || p.pack || p.nom || 'Inconnu',
            pourcentage: p.pourcentage ?? p.count ?? p.total ?? p.valeur ?? p.quantite ?? p.montant ?? 0
          }));
        } else if (parTypeSource && typeof parTypeSource === 'object' && Object.keys(parTypeSource).length > 0) {
          mapped = Object.keys(parTypeSource).map(key => ({
            label: key,
            pourcentage: parTypeSource[key]
          }));
        }
        if (mapped.length > 0) {
          this.abonnementsParType.set(mapped);
          if (this.chartsReady) setTimeout(() => this.buildDonutChart(), 0);
        }
      },
      error: (err: any) => {
        this.isLoadingRevenus.set(false);
        this.showToast(`Erreur revenus (${err.status})`, 'warning');
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // BLOC 2 — GET /api/users/dashboard/alertes/
  // ══════════════════════════════════════════════════════════════════

  loadAlertes(): void {
    this.isLoadingAlertes.set(true);

    this.apiService.getDashboardAlertes().subscribe({
      next: (data: any) => {
        this.isLoadingAlertes.set(false);

        // ── Expirations abonnements ────────────────────────────────
        this.expiringAbos.set(
          (data.expirations_proches || []).map((e: any) => ({
            initials:          this.getInitials(e.client_nom || '—'),
            nom:               e.client_nom || '—',
            type:              e.type       || '-',
            seances_restantes: e.seances_restantes || 0,
            avatar_color:      'linear-gradient(135deg,#f59e0b,#d97706)',
            bar_percent:       Math.min(((e.seances_restantes || 0) / 10) * 100, 100),
          }))
        );

        // ── Stock faible ───────────────────────────────────────────
        this.produitsAlerte.set(
          (data.stock_faible || []).map((p: any) => ({
            nom:          p.nom,
            stock:        p.stock,
            seuil_alerte: p.seuil_alerte,
            type:         p.type,
          }))
        );
      },
      error: (err: any) => {
        this.isLoadingAlertes.set(false);
        this.showToast(`Erreur alertes (${err.status})`, 'warning');
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // BLOC 3 — GET /api/users/dashboard/clients/
  // ══════════════════════════════════════════════════════════════════

  loadClients(): void {
    this.isLoadingClients.set(true);

    this.apiService.getDashboardClients().subscribe({
      next: (data: any) => {
        this.isLoadingClients.set(false);

        // ── Stats clients ──────────────────────────────────────────
        this.clientStats.set({
          total:         data.total_clients    || 0,
          actifs:        data.clients_actifs   || 0,
          inactifs:      data.clients_inactifs || 0,
          nouveaux_mois: data.nouveaux_mois    || 0,
        });

        // ── Abonnements par type → donut (fallback si /revenus/ pas encore chargé) ──
        console.log("👥 Données brutes Dashboard Clients:", data);
        if (this.abonnementsParType().length === 0) {
          const parTypeSource = data.abonnements_par_type || data.revenus_par_type || data.revenu_par_type || [];
          let mapped: any[] = [];
          if (Array.isArray(parTypeSource) && parTypeSource.length > 0) {
            mapped = parTypeSource.map((p: any) => ({
              label: p.label || p.type || p.pack || p.nom || 'Inconnu',
              pourcentage: p.pourcentage ?? p.count ?? p.total ?? p.valeur ?? p.quantite ?? p.montant ?? 0
            }));
          } else if (parTypeSource && typeof parTypeSource === 'object' && Object.keys(parTypeSource).length > 0) {
            mapped = Object.keys(parTypeSource).map(key => ({
              label: key,
              pourcentage: parTypeSource[key]
            }));
          }
          if (mapped.length > 0) {
            this.abonnementsParType.set(mapped);
            if (this.chartsReady) setTimeout(() => this.buildDonutChart(), 0);
          }
        }
      },
      error: (err: any) => {
        this.isLoadingClients.set(false);
        this.showToast(`Erreur clients (${err.status})`, 'warning');
      }
    });
  }

  // ── Chart mode switch ────────────────────────────────────────────
  setChartMode(mode: 'week' | 'month' | 'year'): void {
    if (this.activeChartMode() === mode) return;
    this.activeChartMode.set(mode);
    const cached = this.CHART_DATA[mode];
    if (cached?.labels?.length > 0) { this.buildRevenueChart(mode); return; }
    this.loadRevenus(mode);
  }

  // ── Charts ──────────────────────────────────────────────────────
  private buildRevenueChart(mode: 'week' | 'month' | 'year'): void {
    const Chart = (window as any)['Chart'];
    if (!Chart || !this.revenueCanvasRef) return;
    const d = this.CHART_DATA[mode];
    if (!d?.labels?.length) { this.revenueChart?.destroy(); this.revenueChart = null; return; }

    const ctx  = this.revenueCanvasRef.nativeElement.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, 'rgba(59,130,246,0.28)');
    grad.addColorStop(1, 'rgba(59,130,246,0)');

    this.revenueChart?.destroy();
    this.revenueChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [{
          data: d.data, borderColor: '#3b82f6', backgroundColor: grad,
          borderWidth: 2, fill: true, tension: 0.4,
          pointBackgroundColor: '#3b82f6', pointBorderColor: '#111627',
          pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111627', borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1, titleColor: '#eef0fa', bodyColor: '#9ba3c8', padding: 10,
            callbacks: { label: (c: any) => ' ' + c.parsed.y.toLocaleString('fr-FR') + ' DT' }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#525c78', font: { size: 10, family: 'JetBrains Mono' } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#525c78', font: { size: 10 }, callback: (v: any) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v } }
        }
      }
    });
  }

  private buildDonutChart(): void {
    const Chart = (window as any)['Chart'];
    const data  = this.abonnementsParType();
    if (!Chart || !this.donutCanvasRef || !data.length) return;
    const ctx = this.donutCanvasRef.nativeElement.getContext('2d')!;
    this.donutChart?.destroy();
    this.donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels:   data.map(a => a.label),
        datasets: [{
          data:            data.map(a => a.pourcentage),
          backgroundColor: data.map((_: any, i: number) => this.getDonutColor(i)),
          borderColor:     '#111627', borderWidth: 3, hoverOffset: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111627', borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1, titleColor: '#eef0fa', bodyColor: '#9ba3c8', padding: 8,
            callbacks: { label: (c: any) => ` ${c.parsed}%` }
          }
        }
      }
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────
  getDonutColor(i: number): string { return this.DONUT_COLORS[i % this.DONUT_COLORS.length]; }

  getBlocAboPercent(bloc: RevenueBlock): number {
    return bloc.total ? Math.round((bloc.abonnements / bloc.total) * 100) : 0;
  }
  getBlocVentePercent(bloc: RevenueBlock): number {
    return bloc.total ? Math.round((bloc.ventes / bloc.total) * 100) : 0;
  }

  getExpiryColor(j: number): string {
    return j === 0 ? 'var(--red)' : j === 1 ? 'var(--amber)' : 'var(--green)';
  }

  getProduitStockColor(p: ExpiringProduit): string { return p.stock === 0 ? '#f87171' : '#fbbf24'; }
  getProduitStockLabel(p: ExpiringProduit): string { return p.stock === 0 ? 'Rupture' : 'Stock faible'; }

  getInitials(nom: string): string {
    return nom.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
  formatRevenu(n: number): string {
    return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  }

  // ── Séances helpers ──────────────────────────────────────────────
  naviguerVersCreneaux(seance?: SeanceRow): void { this.router.navigate(['/creneaux']); }
  ajouterReservation(seance: SeanceRow): void {
    this.showToast(`Réservation ajoutée à ${seance.heure_debut}`, 'success');
  }
  getOccupancyPercent(s: SeanceRow): number {
    return s.places_total ? Math.round((s.reservations / s.places_total) * 100) : 0;
  }
  getBarColor(s: SeanceRow): string {
    const p = this.getOccupancyPercent(s);
    return p === 100 ? 'var(--red)' : p >= 60 ? 'var(--amber)' : 'var(--green)';
  }
  getStatutLabel(s: SeanceRow): string {
    if (s.disponibles === 0)  return 'Complet';
    if (s.reservations === 0) return 'Vide';
    return this.getOccupancyPercent(s) >= 60 ? 'Bientôt Plein' : 'Disponible';
  }
  getStatutClass(s: SeanceRow): string {
    if (s.disponibles === 0)  return 'sp-full';
    if (s.reservations === 0) return 'sp-empty';
    return this.getOccupancyPercent(s) >= 60 ? 'sp-mid' : 'sp-ok';
  }
  loadSeancesJour(): void {
  const today = new Date().toISOString().split('T')[0];

  this.apiService.getSeances(today).subscribe({
    next: (res: any) => {
      console.log("RAW:", res);
      const data = res.results || res;

     this.seancesJour = data.map((s: any) => ({
  id: s.id,

  heure_debut: s.heure_debut?.substring(0, 5) || '',
  heure_fin: s.heure_fin?.substring(0, 5) || '',

  reservations: s.reservations 
             ?? s.reservations_count 
             ?? 0,

  places_total: s.places_total 
             ?? s.places 
             ?? 0,

  disponibles: s.places_disponibles 
            ?? s.disponibles 
            ?? 0,

  i_motion: s.i_motion ?? 0,
  i_model: s.i_model ?? 0,
}));

      console.log("SEANCES MAPPED:", this.seancesJour); // debug
    },
    error: (err) => {
      this.showToast(`Erreur séances (${err.status})`, 'warning');
    }
  });
}

  // ── Toast ────────────────────────────────────────────────────────
  showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ visible: true, message, type });
    this.toastTimer = setTimeout(
      () => this.toast.update(t => ({ ...t, visible: false })),
      3000
    );
  }

  naviguerVersAbonnements(): void { this.router.navigate(['/abonnements']); }
  naviguerVersVentes():      void { this.router.navigate(['/ventes']); }
  naviguerVersProduits():    void { this.router.navigate(['/produits']); }
  naviguerVersClients():     void { this.router.navigate(['/clients']); }

  // ── Change Password ───────────────────────────────────────────
  openPasswordModal(): void {
    this.passwordForm = { old_password: '', new_password: '', confirm_password: '' };
    this.passwordError.set(null);
    this.showPasswordModal.set(true);
  }

  closePasswordModal(): void {
    this.showPasswordModal.set(false);
  }

  savePassword(): void {
    const f = this.passwordForm;
    this.passwordError.set(null);

    if (!f.old_password || !f.new_password || !f.confirm_password) {
      this.passwordError.set('Veuillez remplir tous les champs.');
      return;
    }
    if (f.new_password.length < 6) {
      this.passwordError.set('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (f.new_password !== f.confirm_password) {
      this.passwordError.set('Les mots de passe ne correspondent pas.');
      return;
    }

    this.passwordLoading.set(true);
    this.apiService.changePassword({
      old_password: f.old_password,
      new_password: f.new_password,
    }).subscribe({
      next: () => {
        this.passwordLoading.set(false);
        this.closePasswordModal();
        this.showToast('✅ Mot de passe modifié avec succès', 'success');
      },
      error: (err) => {
        this.passwordLoading.set(false);
        const msg = err.error?.error
          || err.error?.old_password?.[0]
          || err.error?.new_password?.[0]
          || err.error?.detail
          || 'Erreur lors du changement de mot de passe';
        this.passwordError.set(msg);
      }
    });
  }
}