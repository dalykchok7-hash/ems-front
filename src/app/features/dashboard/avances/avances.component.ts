import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

interface AvanceClient {
  abonnement_id: string;
  client_nom: string;
  client_cin: string;
  client_telephone?: string;
  pack_nom: string;
  pack_prix: number;
  prix_paye: number;
  avance: number;
  montant_restant: number;
  date_debut: string;
  statut: string;
  mode_paiement?: 'cash' | 'tpe';
  reduction: number;
  est_paye: boolean;
  date_paiement: string;
  date_expiration: string;
}

interface EditAbonnementForm {
  abonnement_id: string;
  client_nom: string;
  pack_nom: string;
  pack_prix: number;
  prix_paye: number;
  montant_restant: number;
  statut: string;
  mode_paiement: 'cash' | 'tpe';
  est_paye: boolean;
  avance: number;
  reduction: number;
  date_paiement: string;
  date_expiration: string;
}

interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'warning' | 'info';
}

@Component({
  selector: 'app-avances',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink],
  templateUrl: './avances.component.html',
  styleUrls: ['./avances.component.css'],
})
export class AvancesComponent implements OnInit {
  private apiService = inject(ApiService);

  clientsAvances = signal<AvanceClient[]>([]);
  totalRestantAvances = signal<number>(0);
  isLoadingAvances = signal<boolean>(false);

  showEditModal = signal<boolean>(false);
  editAboForm = signal<EditAbonnementForm | null>(null);
  isSavingEdit = signal<boolean>(false);
  editFormError = signal<string | null>(null);

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

  openEditAbonnement(abo: AvanceClient): void {
    this.editFormError.set(null);
    this.editAboForm.set({
      abonnement_id:   abo.abonnement_id,
      client_nom:      abo.client_nom,
      pack_nom:        abo.pack_nom,
      pack_prix:       abo.pack_prix || 0,
      prix_paye:       abo.prix_paye,
      montant_restant: abo.montant_restant,
      statut:          abo.statut,
      mode_paiement:   abo.mode_paiement || 'cash',
      est_paye:        abo.est_paye,
      avance:          abo.avance,
      reduction:       abo.reduction,
      date_paiement:   abo.date_paiement,
      date_expiration: abo.date_expiration,
    });
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editAboForm.set(null);
    this.editFormError.set(null);
  }

  onEstPayeChange(value: boolean): void {
    const form = this.editAboForm();
    if (!form) return;
    this.editAboForm.set({
      ...form,
      est_paye: value,
      date_paiement: value ? (form.date_paiement || new Date().toISOString().split('T')[0]) : '',
    });
  }

  setModePaiement(value: 'cash' | 'tpe'): void {
    const form = this.editAboForm();
    if (!form) return;
    this.editAboForm.set({ ...form, mode_paiement: value });
  }

  getAvatarColor(name: string): string {
    const colors = ['#1d4ed8', '#2563eb', '#4338ca', '#0f172a', '#2563eb'];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  }

  getAvatarInitials(name: string): string {
    if (!name) {
      return 'AB';
    }
    const parts = name.trim().split(/\s+/);
    const initials = parts.map(part => part[0].toUpperCase()).join('');
    return initials.substring(0, 2);
  }

  updateEditField(field: keyof Omit<EditAbonnementForm, 'abonnement_id' | 'client_nom' | 'pack_nom' | 'prix_paye' | 'montant_restant' | 'statut'>, value: string | number | boolean): void {
    const form = this.editAboForm();
    if (!form) return;
    this.editAboForm.set({ ...form, [field]: value });
  }

  getDynamicPrixPaye(): number {
    const form = this.editAboForm();
    if (!form) return 0;
    const packPrix = form.pack_prix || 0;
    const reduction = form.reduction || 0;
    return Math.round(packPrix * (1 - reduction / 100));
  }

  getDynamicMontantRestant(): number {
    const form = this.editAboForm();
    if (!form) return 0;
    if (form.est_paye) return 0;
    const prixPaye = this.getDynamicPrixPaye();
    return Math.max(0, prixPaye - (form.avance || 0));
  }

  extractErrorMessage(err: any): string {
    if (!err?.error) return 'Erreur inconnue';
    if (err.error.error) return err.error.error;
    if (err.error.non_field_errors?.length) return err.error.non_field_errors[0];
    const firstKey = Object.keys(err.error)[0];
    if (firstKey && err.error[firstKey]?.length) return err.error[firstKey][0];
    return 'Erreur serveur';
  }

  saveEditAbonnement(): void {
    const form = this.editAboForm();
    if (!form) return;

    this.editFormError.set(null);
    this.isSavingEdit.set(true);

    const payload = {
      mode_paiement:  form.mode_paiement,
      est_paye:       form.est_paye,
      avance:         form.avance,
      date_paiement:  form.date_paiement || null,
      date_expiration: form.date_expiration || null,
      reduction:      form.reduction,
    };

    this.apiService.modifierAbonnement(form.abonnement_id, payload).subscribe({
      next: () => {
        this.isSavingEdit.set(false);
        this.showToast('✅ Abonnement mis à jour', 'success');
        this.closeEditModal();
        this.loadAvances();
      },
      error: (err: any) => {
        this.isSavingEdit.set(false);
        const msg = this.extractErrorMessage(err);
        this.editFormError.set(msg);
        this.showToast(msg, 'warning');
      }
    });
  }
}
