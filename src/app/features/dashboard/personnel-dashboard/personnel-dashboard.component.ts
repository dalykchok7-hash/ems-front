import {
  Component, OnInit, OnDestroy, AfterViewInit, AfterViewChecked,
  signal, computed, ElementRef, ViewChild, inject
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import Chart from 'chart.js/auto';

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

export interface ToastState {
  visible: boolean;
  message: string;
  type:    'success' | 'warning' | 'info';
}

@Component({
  selector:    'app-personnel-dashboard',
  standalone:  true,
  imports:     [CommonModule, DatePipe],
  templateUrl: './personnel-dashboard.component.html',
  styleUrl:    './personnel-dashboard.components.css',
})
export class PersonnelDashboardComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {

  private router     = inject(Router);
  private apiService = inject(ApiService);

  @ViewChild('donutCanvas') donutCanvasRef!: ElementRef<HTMLCanvasElement>;

  // ── State ───────────────────────────────────────────────────────
  currentDate        = signal<Date>(new Date());
  toast              = signal<ToastState>({ visible: false, message: '', type: 'success' });
  currentWeekOffset  = signal<number>(0);

  isLoadingRevenus = signal<boolean>(false);
  isLoadingAlertes = signal<boolean>(false);
  isLoadingWeekly  = signal<boolean>(false);

  chartsReady     = false;
  private donutChart: any = null;
  private toastTimer: any = null;

  DONUT_COLORS = ['#3b82f6', '#c084fc', '#fbbf24', '#f87171', '#10b981', '#22d3ee'];

  // ── Data signals ────────────────────────────────────────────────
  revenuJour         = signal<{ abonnements: number; ventes: number; total: number }>({ abonnements: 0, ventes: 0, total: 0 });
  abonnementsParType = signal<any[]>([]);
  expiringAbos       = signal<ExpiringAbo[]>([]);
  weeklyReservations = signal<any[]>([]);
  weekTotalClients   = signal<number>(0);
  weekDateDebut      = signal<string>('');
  weekDateFin        = signal<string>('');
  weeklyDays         = signal<any[]>([]);

  // ── Computed ────────────────────────────────────────────────────
  isLoading = computed(() =>
    this.isLoadingRevenus() || this.isLoadingAlertes() || this.isLoadingWeekly()
  );

  aboPercent = computed(() => {
    const r = this.revenuJour();
    return r.total ? Math.round((r.abonnements / r.total) * 100) : 0;
  });

  ventePercent = computed(() => {
    const r = this.revenuJour();
    return r.total ? Math.round((r.ventes / r.total) * 100) : 0;
  });

  isCurrentWeek = computed(() => this.currentWeekOffset() === 0);

  // ── Lifecycle ───────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadRevenus();
    this.loadAlertes();
    this.loadWeeklyReservations();
  }

  ngAfterViewInit(): void {
    this.chartsReady = true;
  }

  ngAfterViewChecked(): void {
    if (
      this.chartsReady &&
      this.abonnementsParType().length > 0 &&
      this.donutCanvasRef &&
      !this.donutChart
    ) {
      this.buildDonutChart();
    }
  }

  ngOnDestroy(): void {
    this.donutChart?.destroy();
    clearTimeout(this.toastTimer);
  }

  // ── Navigation semaine ──────────────────────────────────────────
  semainePrecedente(): void {
    this.currentWeekOffset.update(v => v - 1);
    this.loadWeeklyReservations();
  }

  semaineSuivante(): void {
    this.currentWeekOffset.update(v => v + 1);
    this.loadWeeklyReservations();
  }

  semaineAujourdhui(): void {
    if (this.isCurrentWeek()) return;
    this.currentWeekOffset.set(0);
    this.loadWeeklyReservations();
  }

  // ── API calls ───────────────────────────────────────────────────
  loadRevenus(): void {
    this.isLoadingRevenus.set(true);
    this.apiService.getDashboardRevenus('12m').subscribe({
      next: (data: any) => {
        this.isLoadingRevenus.set(false);
        const jour = data.revenu_jour || { abonnements: 0, ventes: 0, total: 0 };
        this.revenuJour.set({
          abonnements: parseFloat(jour.abonnements || '0'),
          ventes:      parseFloat(jour.ventes      || '0'),
          total:       parseFloat(jour.total        || '0'),
        });
        const parType: any[] = data.revenus_par_type || [];
        if (parType.length > 0) {
          this.abonnementsParType.set(parType);
          setTimeout(() => this.buildDonutChart());
        }
      },
      error: (err: any) => {
        this.isLoadingRevenus.set(false);
        this.showToast(`Erreur revenus (${err.status})`, 'warning');
      }
    });
  }

  loadAlertes(): void {
    this.isLoadingAlertes.set(true);
    this.apiService.getDashboardAlertes().subscribe({
      next: (data: any) => {
        this.isLoadingAlertes.set(false);
        this.expiringAbos.set(
          (data.expirations_proches || []).map((e: any) => ({
            initials:          this.getInitials(e.client_nom || '—'),
            nom:               e.client_nom        || '—',
            type:              e.type              || '-',
            seances_restantes: e.seances_restantes || 0,
            avatar_color:      'linear-gradient(135deg,#f59e0b,#d97706)',
            bar_percent:       Math.min(((e.seances_restantes || 0) / 10) * 100, 100),
          }))
        );
      },
      error: (err: any) => {
        this.isLoadingAlertes.set(false);
        this.showToast(`Erreur alertes (${err.status})`, 'warning');
      }
    });
  }

  loadWeeklyReservations(): void {
    this.isLoadingWeekly.set(true);
    const offset = this.currentWeekOffset();
    this.apiService.getWeeklyReservations(offset).subscribe({
      next: (data: any) => {
        this.isLoadingWeekly.set(false);
        const reservations = data.reservations || [];
        this.weeklyReservations.set(reservations);
        this.weekTotalClients.set(data.total_clients || 0);
        this.weekDateDebut.set(data.date_debut       || '');
        this.weekDateFin.set(data.date_fin           || '');
        this.buildWeeklyDays(data.date_debut, reservations);
      },
      error: (err: any) => {
        this.isLoadingWeekly.set(false);
        this.showToast(`Erreur réservations semaine (${err.status})`, 'warning');
      }
    });
  }

  buildWeeklyDays(dateDebutStr: string, reservations: any[]): void {
    if (!dateDebutStr) return;
    const baseDate = new Date(dateDebutStr.replace(/-/g, '/'));
    const daysData: any[] = [];
    const DAY_NAMES  = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
    const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

    for (let i = 0; i < 7; i++) {
      const current = new Date(baseDate);
      current.setDate(baseDate.getDate() + i);

      const yyyy    = current.getFullYear();
      const mm      = String(current.getMonth() + 1).padStart(2, '0');
      const dd      = String(current.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const dayReservations = reservations.filter((r: any) => {
        let rDate = r.seance_date || '';
        if (rDate.length > 10) rDate = rDate.substring(0, 10);
        if (!rDate && r.seance_info) rDate = r.seance_info.split(' ')[0];
        return rDate === dateStr;
      });

      dayReservations.sort((a: any, b: any) => {
        const timeA = (a.seance_heure_debut || '00:00').substring(0, 5);
        const timeB = (b.seance_heure_debut || '00:00').substring(0, 5);
        return timeA.localeCompare(timeB);
      });

      const timeGroupsMap = new Map<string, any[]>();
      dayReservations.forEach((r: any) => {
        const hDebut = (r.seance_heure_debut || '??:??').substring(0, 5);
        const hFin   = (r.seance_heure_fin   || '??:??').substring(0, 5);
        const key    = `${hDebut} – ${hFin}`;
        if (!timeGroupsMap.has(key)) timeGroupsMap.set(key, []);
        timeGroupsMap.get(key)!.push(r);
      });

      const timeGroups = Array.from(timeGroupsMap.entries()).map(([time, clients]) => ({
        time,
        heure_debut: clients[0]?.seance_heure_debut || '',
        heure_fin:   clients[0]?.seance_heure_fin   || '',
        clients:     clients.map((c: any, idx: number) => ({ ...c, num: idx + 1 })),
      }));

      daysData.push({
        name:         DAY_NAMES[i],
        label:        DAY_LABELS[i],
        dayNum:       String(current.getDate()),
        dateStr,
        reservations: dayReservations,
        timeGroups,
      });
    }

    this.weeklyDays.set(daysData);
  }

  private buildDonutChart(): void {
    const canvas = this.donutCanvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = this.abonnementsParType();
    if (!data.length) return;

    if (this.donutChart) {
      this.donutChart.data.labels              = data.map(a => a.label);
      this.donutChart.data.datasets[0].data    = data.map(a => a.pourcentage);
      this.donutChart.update();
      return;
    }

    this.donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels:   data.map(a => a.label),
        datasets: [{
          data:            data.map(a => a.pourcentage),
          backgroundColor: data.map((_: any, i: number) => this.getDonutColor(i)),
          borderColor:     '#111627',
          borderWidth:     3,
        }]
      },
      options: {
        responsive:           true,
        maintainAspectRatio:  false,
        cutout:               '72%',
        plugins: { legend: { display: false } }
      }
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────
  getDonutColor(i: number): string { return this.DONUT_COLORS[i % this.DONUT_COLORS.length]; }

  getInitials(nom: string): string {
    return nom.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  formatRevenu(n: number): string {
    return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  }

  getExpiryColor(j: number): string {
    return j === 0 ? 'var(--red)' : j <= 2 ? 'var(--amber)' : 'var(--green)';
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

  naviguerVersCreneaux():    void { this.router.navigate(['/creneaux']);    }
  naviguerVersAbonnements(): void { this.router.navigate(['/abonnements']); }

  ajouterReservation(s: SeanceRow): void {
    this.showToast(`Réservation ajoutée à ${s.heure_debut}`, 'success');
  }

  showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ visible: true, message, type });
    this.toastTimer = setTimeout(
      () => this.toast.update(t => ({ ...t, visible: false })),
      3000
    );
  }
}