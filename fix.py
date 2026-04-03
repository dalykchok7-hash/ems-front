import os
import re

base_dir = r"c:\Users\AROBAZ\ems-frontend\src\app\features"

def fix_creneaux_ts():
    file_path = os.path.join(base_dir, "creneaux", "creneaux.ts")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    main_part = content.split("// ══════════════════════════════════════════════════════════════════\n// MODIFICATIONS À FAIRE DANS creneaux.component.ts")[0]
    
    main_part = main_part.replace(
        "export interface Seance {", 
        "export type TailleGilet = 'S' | 'M' | 'L';\n\nexport interface Seance {"
    )

    main_part = main_part.replace(
        "seance_id: number;\n}", 
        "seance_id: number;\n  taille_gilet: TailleGilet;\n}"
    )

    main_part = re.sub(r"(client_nom:.*seance_id:\s*\d+)(\s*})", r"\1, taille_gilet: 'M'\2", main_part)

    props = """  modalSelectedDevice    = signal<'i-motion' | 'i-model' | null>(null);
  modalSelectedTaille    = signal<TailleGilet>('M');

  readonly TAILLES_GILET: TailleGilet[] = ['S', 'M', 'L'];

  getTailleColor(taille: TailleGilet): string {
    const colors: Record<TailleGilet, string> = {
      'S': '#22d3ee',
      'M': '#3b82f6',
      'L': '#c084fc',
    };
    return colors[taille] || '#ffffff';
  }"""
    main_part = main_part.replace("  modalSelectedDevice    = signal<'i-motion' | 'i-model' | null>(null);", props)

    main_part = main_part.replace("this.modalSelectedDevice.set(null);", "this.modalSelectedDevice.set(null);\n    this.modalSelectedTaille.set('M');")

    main_part = main_part.replace(
        "seance_id: seance.id,\n    };", 
        "seance_id: seance.id,\n      taille_gilet: this.modalSelectedTaille(),\n    };"
    )

    content = main_part.strip() + "\n}"
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

def fix_creneaux_html():
    file_path = os.path.join(base_dir, "creneaux", "creneaux.html")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    main_part = content.split("<!-- ══════════════════════════════════════════════════════════════════\n     MODIFICATIONS À FAIRE DANS creneaux.component.html")[0]
    
    main_part = main_part.replace("<th>Appareil</th>\n                <th>Statut</th>", "<th>Appareil</th>\n                <th>Gilet</th>\n                <th>Statut</th>")

    cell = """                <!-- Gilet -->
                <td>
                  <span class="device-tag"
                        [style.color]="getTailleColor(res.taille_gilet)"
                        [style.background]="getTailleColor(res.taille_gilet) + '18'"
                        [style.border]="'1px solid ' + getTailleColor(res.taille_gilet) + '30'">
                    👕 {{ res.taille_gilet }}
                  </span>
                </td>\n\n                <!-- Statut -->"""
    main_part = main_part.replace("<!-- Statut -->", cell)

    selector = """        <!-- Step 2 — Choix Appareil -->
        <div *ngIf="modalStep() === 2" class="step-content">
          <!-- Client recap -->
          <div class="client-recap">
            <div class="client-recap-avatar">{{ getInitials(modalSelectedClient()?.nom || '') }}</div>
            <div class="flex-1">
              <div class="client-recap-name">{{ modalSelectedClient()?.nom }}</div>
              <div class="client-recap-meta">
                <span>🪪 {{ modalSelectedClient()?.cin }}</span>
                <span>·</span>
                <span class="text-cyan-400">📞 {{ modalSelectedClient()?.telephone }}</span>
              </div>
            </div>
            <button (click)="previousStep()" class="client-recap-change">Modifier</button>
          </div>

          <h4 class="device-selection-title" style="margin-top:0">Choisissez la Taille du Gilet</h4>
          <div class="device-grid" style="margin-bottom: 24px; grid-template-columns: repeat(3, 1fr);">
            <div *ngFor="let taille of TAILLES_GILET"
                 (click)="modalSelectedTaille.set(taille)"
                 class="device-card"
                 [style.borderColor]="modalSelectedTaille() === taille ? getTailleColor(taille) : ''">
              <div class="device-emoji">👕</div>
              <div class="device-name" [style.color]="modalSelectedTaille() === taille ? getTailleColor(taille) : ''">{{ taille }}</div>
            </div>
          </div>

          <h4 class="device-selection-title">Choisissez l'appareil EMS</h4>
          <div class="device-grid">"""
    
    main_part = main_part.replace("""        <!-- Step 2 — Choix Appareil -->
        <div *ngIf="modalStep() === 2" class="step-content">
          <!-- Client recap -->
          <div class="client-recap">
            <div class="client-recap-avatar">{{ getInitials(modalSelectedClient()?.nom || '') }}</div>
            <div class="flex-1">
              <div class="client-recap-name">{{ modalSelectedClient()?.nom }}</div>
              <div class="client-recap-meta">
                <span>🪪 {{ modalSelectedClient()?.cin }}</span>
                <span>·</span>
                <span class="text-cyan-400">📞 {{ modalSelectedClient()?.telephone }}</span>
              </div>
            </div>
            <button (click)="previousStep()" class="client-recap-change">Modifier</button>
          </div>

          <h4 class="device-selection-title">Choisissez l'appareil EMS</h4>
          <div class="device-grid">""", selector)


    confirm_row = """            <div class="confirm-row">
              <span class="confirm-key">Gilet</span>
              <span class="device-tag"
                    [style.color]="getTailleColor(modalSelectedTaille())"
                    [style.background]="getTailleColor(modalSelectedTaille()) + '18'"
                    [style.border]="'1px solid ' + getTailleColor(modalSelectedTaille()) + '30'">
                👕 {{ modalSelectedTaille() }}
              </span>
            </div>
            <div class="confirm-row" style="border-bottom: none">"""
    main_part = main_part.replace("""            <div class="confirm-row" style="border-bottom: none">""", confirm_row)


    content = main_part.strip()
    if not content.endswith("</div>"):
        content += "\n</div>"
        
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

def fix_clients_ts():
    file_path = os.path.join(base_dir, "clients", "clients.ts")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    main_part = content.split("// ══════════════════════════════════════════════════════════════════\n// MODIFICATIONS À FAIRE DANS clients.component.ts")[0]

    main_part = main_part.replace("export type AboType      = 'Mensuel' | 'Trimestriel' | 'Annuel' | '—';", "export type AboType      = 'Mensuel' | 'Trimestriel' | 'Annuel' | '—';\nexport type TailleGilet  = 'S' | 'M' | 'L';")

    main_part = main_part.replace("  avatar_color:     string;\n}", "  avatar_color:     string;\n  taille_gilet:     TailleGilet;\n}")

    main_part = main_part.replace("  abonnement:     AboType;\n}", "  abonnement:     AboType;\n  taille_gilet:   TailleGilet;\n}")
    
    main_part = main_part.replace("email: '', date_naissance: '', abonnement: 'Mensuel',", "email: '', date_naissance: '', abonnement: 'Mensuel', taille_gilet: 'M',")

    main_part = re.sub(r"(avatar_color:'.*?')(\s*})", r"\1, taille_gilet: 'M'\2", main_part)

    main_part = main_part.replace("abonnement:     this.activeAbo()?.type ?? 'Mensuel',", "abonnement:     this.activeAbo()?.type ?? 'Mensuel',\n      taille_gilet:   c.taille_gilet ?? 'M',")

    main_part = main_part.replace("avatar_color:     '#3b82f6',", "avatar_color:     '#3b82f6',\n        taille_gilet:     this.clientForm.taille_gilet,")
    
    main_part = main_part.replace("email: this.clientForm.email }", "email: this.clientForm.email, taille_gilet: this.clientForm.taille_gilet }")

    main_part = main_part.replace("showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {", """readonly TAILLES_GILET: TailleGilet[] = ['S', 'M', 'L'];

  getTailleColor(taille: TailleGilet): string {
    const colors: Record<TailleGilet, string> = {
      'S': '#22d3ee',
      'M': '#3b82f6',
      'L': '#c084fc',
    };
    return colors[taille] || '#ffffff';
  }

  showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {""")

    content = main_part.strip() + "\n}"
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

def fix_clients_html():
    file_path = os.path.join(base_dir, "clients", "clients.html")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    main_part = content.split("<!-- ══════════════════════════════════════════════════════════════════\n     MODIFICATIONS À FAIRE DANS clients.component.html")[0]

    pd_item = """            <div class="pd-item">
              <div class="pd-label">Abonnement actuel</div>
              <div class="pd-value" style="color:#3b82f6;font-weight:700">
                {{ activeAbo()?.type ?? '—' }}
              </div>
            </div>
            <div class="pd-item">
              <div class="pd-label">Taille Gilet</div>
              <div class="pd-value">
                <span style="padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;"
                      [style.color]="getTailleColor(selectedClient()!.taille_gilet)"
                      [style.background]="getTailleColor(selectedClient()!.taille_gilet) + '18'"
                      [style.border]="'1px solid ' + getTailleColor(selectedClient()!.taille_gilet) + '30'">
                  👕 {{ selectedClient()!.taille_gilet }}
                </span>
              </div>
            </div>"""
    main_part = main_part.replace("""            <div class="pd-item">
              <div class="pd-label">Abonnement actuel</div>
              <div class="pd-value" style="color:#3b82f6;font-weight:700">
                {{ activeAbo()?.type ?? '—' }}
              </div>
            </div>""", pd_item)

    selector = """        <div class="form-group">
          <label class="form-label">Taille du Gilet</label>
          <div style="display:flex; gap: 8px;">
            <div *ngFor="let taille of TAILLES_GILET"
                 style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid var(--border); text-align: center; cursor: pointer; transition: all 0.2s;"
                 [style.borderColor]="clientForm.taille_gilet === taille ? getTailleColor(taille) : 'var(--border)'"
                 [style.backgroundColor]="clientForm.taille_gilet === taille ? getTailleColor(taille) + '18' : 'transparent'"
                 (click)="clientForm.taille_gilet = taille">
              <span style="font-size: 16px; margin-right: 4px;">👕</span>
              <span [style.color]="clientForm.taille_gilet === taille ? getTailleColor(taille) : 'var(--t1)'" style="font-weight: 600;">{{ taille }}</span>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Abonnement initial</label>
          <select class="form-input form-select" [(ngModel)]="clientForm.abonnement">"""
    
    main_part = main_part.replace("""        <div class="form-group">
          <label class="form-label">Abonnement initial</label>
          <select class="form-input form-select" [(ngModel)]="clientForm.abonnement">""", selector)

    content = main_part.strip()
    if not content.endswith("</div>"):
        content += "\n</div>"
        
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    try:
        fix_creneaux_ts()
        print("Fixed creneaux.ts")
    except Exception as e:
        print(f"Error fix_creneaux_ts: {e}")
        
    try:
        fix_creneaux_html()
        print("Fixed creneaux.html")
    except Exception as e:
        print(f"Error fix_creneaux_html: {e}")

    try:
        fix_clients_ts()
        print("Fixed clients.ts")
    except Exception as e:
        print(f"Error fix_clients_ts: {e}")
        
    try:
        fix_clients_html()
        print("Fixed clients.html")
    except Exception as e:
        print(f"Error fix_clients_html: {e}")
