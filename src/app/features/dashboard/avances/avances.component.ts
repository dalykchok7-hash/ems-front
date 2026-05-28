import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

interface AvanceClient {
  client_nom: string;
  client_telephone?: string;
  pack_nom: string;
  prix_paye: number;
  avance: number;
  montant_restant: number;
  date_debut: string;
  statut: string;
}

interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'warning' | 'info';
}

@Component({
  selector: 'app-avances',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './avances.component.html',
  styleUrls: ['./avances.component.css'],
})
export class AvancesComponent implements OnInit {
  private apiService = inject(ApiService);

  clientsAvances = signal<AvanceClient[]>([]);
  totalRestantAvances = signal<number>(0);
  isLoadingAvances = signal<boolean>(false);

  toast = signal<ToastState>({ visible: false, message: '', type: 'success' });
  private toastTimer: any = null;

  ngOnInit(): void {
    this.loadAvances();
  }

  loadAvances(): void {
    this.isLoadingAvances.set(true);
    this.apiService.getDashboardAvances().subscribe({
      next: (data: any) => {
        this.isLoadingAvances.set(false);
        this.clientsAvances.set(data.clients_avances || []);
        this.totalRestantAvances.set(data.total_restant || 0);
      },
      error: (err: any) => {
        this.isLoadingAvances.set(false);
        this.showToast(`Erreur avances (${err.status})`, 'warning');
      }
    });
  }

  showToast(message: string, type: 'success' | 'warning' | 'info' = 'info'): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ visible: true, message, type });
    this.toastTimer = setTimeout(() => this.toast.set({ ...this.toast(), visible: false }), 3000);
  }
}
