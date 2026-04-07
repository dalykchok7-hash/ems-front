import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class ProfileComponent implements OnInit {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);

  // ── Signals ──────────────────────────────────────
  loading     = signal<boolean>(true);
  userProfile = signal<any>(null);
  error       = signal<string>('');
  success     = signal<string>('');

  private alreadyFetched = false;

  emailForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email])
  });

  passwordForm = new FormGroup({
    old_password: new FormControl('', [Validators.required]),
    new_password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    confirm_password: new FormControl('', [Validators.required])
  });

  ngOnInit(): void {
    console.log('DEBUG: ProfileComponent initialized');
    if (!this.alreadyFetched) {
      this.fetchProfile();
      this.alreadyFetched = true;
    }
  }

  private handleBackendErrors(err: any, fallback: string): void {
    console.error('DEBUG: Erreur backend détaillée:', err)
    let msg = fallback
    if (err.error && typeof err.error === 'object') {
      const firstKey = Object.keys(err.error)[0]
      const firstVal = err.error[firstKey]
      msg = Array.isArray(firstVal) ? firstVal[0] : (err.error.error || err.error.detail || JSON.stringify(err.error))
    }
    this.error.set(msg)
    this.cdr.detectChanges()
  }

  fetchProfile(): void {
    this.loading.set(true);
    this.error.set('');
    console.log('DEBUG: Fetching profile data...');
    
    this.api.getProfile().subscribe({
      next: (res) => {
        console.log('DEBUG: Profile data received:', res);
        this.userProfile.set(res);
        this.emailForm.patchValue({ email: res.email });
        this.loading.set(false);
        
        // Forcer la détection
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('DEBUG: Profile fetch error:', err);
        this.error.set('Impossible de charger les données du profil.');
        this.loading.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  updateEmail(): void {
    if (this.emailForm.invalid) return;
    this.error.set('');
    this.success.set('');

    const email = this.emailForm.value.email!;
    this.api.updateAdminEmail(email).subscribe({
      next: () => {
        this.success.set('Email mis à jour avec succès');
        const current = this.userProfile();
        if (current) this.userProfile.set({ ...current, email });
        this.cdr.detectChanges();
      },
      error: (err) => this.handleBackendErrors(err, 'Erreur lors de la mise à jour')
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) return;
    this.error.set('');
    this.success.set('');

    const { old_password, new_password, confirm_password } = this.passwordForm.value;

    if (new_password !== confirm_password) {
      this.error.set('Les nouveaux mots de passe ne correspondent pas');
      return;
    }

    this.api.changePassword({ old_password: old_password!, new_password: new_password! }).subscribe({
      next: () => {
        this.success.set('Mot de passe modifié avec succès');
        this.passwordForm.reset();
        this.cdr.detectChanges();
      },
      error: (err) => this.handleBackendErrors(err, 'Mot de passe actuel incorrect')
    });
  }

  clearMessages(): void {
    this.error.set('');
    this.success.set('');
    this.cdr.detectChanges();
  }
}
