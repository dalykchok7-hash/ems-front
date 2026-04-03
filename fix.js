const fs = require('fs');
const path = require('path');

const baseDir = path.join('c:', 'Users', 'AROBAZ', 'ems-frontend', 'src', 'app', 'features');

function fixCreneauxTs() {
    const filePath = path.join(baseDir, 'creneaux', 'creneaux.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    let mainPart = content.split('// ══════════════════════════════════════════════════════════════════\r\n// MODIFICATIONS À FAIRE DANS creneaux.component.ts')[0];
    if (mainPart === content) {
        mainPart = content.split('// ══════════════════════════════════════════════════════════════════\n// MODIFICATIONS À FAIRE DANS creneaux.component.ts')[0];
    }
    
    mainPart = mainPart.replace(
        "export interface Seance {", 
        "export type TailleGilet = 'S' | 'M' | 'L';\n\nexport interface Seance {"
    );

    mainPart = mainPart.replace(
        "seance_id: number;\n}", 
        "seance_id: number;\n  taille_gilet: TailleGilet;\n}"
    );
    mainPart = mainPart.replace(
        "seance_id: number;\r\n}", 
        "seance_id: number;\r\n  taille_gilet: TailleGilet;\r\n}"
    );

    mainPart = mainPart.replace(/(client_nom:.*seance_id:\s*\d+)(\s*})/g, "$1, taille_gilet: 'M'$2");

    const props = `  modalSelectedDevice    = signal<'i-motion' | 'i-model' | null>(null);
  modalSelectedTaille    = signal<TailleGilet>('M');

  readonly TAILLES_GILET: TailleGilet[] = ['S', 'M', 'L'];

  getTailleColor(taille: TailleGilet): string {
    const colors: Record<TailleGilet, string> = {
      'S': '#22d3ee',
      'M': '#3b82f6',
      'L': '#c084fc',
    };
    return colors[taille] || '#ffffff';
  }`;
    mainPart = mainPart.replace("  modalSelectedDevice    = signal<'i-motion' | 'i-model' | null>(null);", props);

    mainPart = mainPart.replace("this.modalSelectedDevice.set(null);", "this.modalSelectedDevice.set(null);\n    this.modalSelectedTaille.set('M');");
    mainPart = mainPart.replace("this.modalSelectedDevice.set(null);\r\n", "this.modalSelectedDevice.set(null);\r\n    this.modalSelectedTaille.set('M');\r\n");

    mainPart = mainPart.replace(
        "seance_id: seance.id,\n    };", 
        "seance_id: seance.id,\n      taille_gilet: this.modalSelectedTaille(),\n    };"
    );
    mainPart = mainPart.replace(
        "seance_id: seance.id,\r\n    };", 
        "seance_id: seance.id,\r\n      taille_gilet: this.modalSelectedTaille(),\r\n    };"
    );

    const newContent = mainPart.trim() + "\n}";
    fs.writeFileSync(filePath, newContent, 'utf-8');
}

function fixCreneauxHtml() {
    const filePath = path.join(baseDir, 'creneaux', 'creneaux.html');
    const content = fs.readFileSync(filePath, 'utf-8');

    let mainPart = content.split('<!-- ══════════════════════════════════════════════════════════════════\r\n     MODIFICATIONS À FAIRE DANS creneaux.component.html')[0];
    if (mainPart === content) {
        mainPart = content.split('<!-- ══════════════════════════════════════════════════════════════════\n     MODIFICATIONS À FAIRE DANS creneaux.component.html')[0];
    }
    
    mainPart = mainPart.replace("<th>Appareil</th>\n                <th>Statut</th>", "<th>Appareil</th>\n                <th>Gilet</th>\n                <th>Statut</th>");
    mainPart = mainPart.replace("<th>Appareil</th>\r\n                <th>Statut</th>", "<th>Appareil</th>\r\n                <th>Gilet</th>\r\n                <th>Statut</th>");

    const cell = `                <!-- Gilet -->
                <td>
                  <span class="device-tag"
                        [style.color]="getTailleColor(res.taille_gilet)"
                        [style.background]="getTailleColor(res.taille_gilet) + '18'"
                        [style.border]="'1px solid ' + getTailleColor(res.taille_gilet) + '30'">
                    👕 {{ res.taille_gilet }}
                  </span>
                </td>\n\n                <!-- Statut -->`;
    mainPart = mainPart.replace("<!-- Statut -->", cell);

    const selector = `        <!-- Step 2 — Choix Appareil -->
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
          <div class="device-grid">`;
    
    mainPart = mainPart.replace(`        <!-- Step 2 — Choix Appareil -->\n        <div *ngIf="modalStep() === 2" class="step-content">\n          <!-- Client recap -->\n          <div class="client-recap">\n            <div class="client-recap-avatar">{{ getInitials(modalSelectedClient()?.nom || '') }}</div>\n            <div class="flex-1">\n              <div class="client-recap-name">{{ modalSelectedClient()?.nom }}</div>\n              <div class="client-recap-meta">\n                <span>🪪 {{ modalSelectedClient()?.cin }}</span>\n                <span>·</span>\n                <span class="text-cyan-400">📞 {{ modalSelectedClient()?.telephone }}</span>\n              </div>\n            </div>\n            <button (click)="previousStep()" class="client-recap-change">Modifier</button>\n          </div>\n\n          <h4 class="device-selection-title">Choisissez l'appareil EMS</h4>\n          <div class="device-grid">`, selector);

    mainPart = mainPart.replace(`        <!-- Step 2 — Choix Appareil -->\r\n        <div *ngIf="modalStep() === 2" class="step-content">\r\n          <!-- Client recap -->\r\n          <div class="client-recap">\r\n            <div class="client-recap-avatar">{{ getInitials(modalSelectedClient()?.nom || '') }}</div>\r\n            <div class="flex-1">\r\n              <div class="client-recap-name">{{ modalSelectedClient()?.nom }}</div>\r\n              <div class="client-recap-meta">\r\n                <span>🪪 {{ modalSelectedClient()?.cin }}</span>\r\n                <span>·</span>\r\n                <span class="text-cyan-400">📞 {{ modalSelectedClient()?.telephone }}</span>\r\n              </div>\r\n            </div>\r\n            <button (click)="previousStep()" class="client-recap-change">Modifier</button>\r\n          </div>\r\n\r\n          <h4 class="device-selection-title">Choisissez l'appareil EMS</h4>\r\n          <div class="device-grid">`, selector);

    const confirmRow = `            <div class="confirm-row">
              <span class="confirm-key">Gilet</span>
              <span class="device-tag"
                    [style.color]="getTailleColor(modalSelectedTaille())"
                    [style.background]="getTailleColor(modalSelectedTaille()) + '18'"
                    [style.border]="'1px solid ' + getTailleColor(modalSelectedTaille()) + '30'">
                👕 {{ modalSelectedTaille() }}
              </span>
            </div>
            <div class="confirm-row" style="border-bottom: none">`;
    mainPart = mainPart.replace(`            <div class="confirm-row" style="border-bottom: none">`, confirmRow);

    let newContent = mainPart.trim();
    if (!newContent.endsWith("</div>")) {
        newContent += "\n</div>";
    }
        
    fs.writeFileSync(filePath, newContent, 'utf-8');
}

function fixClientsTs() {
    const filePath = path.join(baseDir, 'clients', 'clients.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    let mainPart = content.split('// ══════════════════════════════════════════════════════════════════\r\n// MODIFICATIONS À FAIRE DANS clients.component.ts')[0];
    if (mainPart === content) {
        mainPart = content.split('// ══════════════════════════════════════════════════════════════════\n// MODIFICATIONS À FAIRE DANS clients.component.ts')[0];
    }

    mainPart = mainPart.replace("export type AboType      = 'Mensuel' | 'Trimestriel' | 'Annuel' | '—';", "export type AboType      = 'Mensuel' | 'Trimestriel' | 'Annuel' | '—';\nexport type TailleGilet  = 'S' | 'M' | 'L';");

    mainPart = mainPart.replace("  avatar_color:     string;\n}", "  avatar_color:     string;\n  taille_gilet:     TailleGilet;\n}");
    mainPart = mainPart.replace("  avatar_color:     string;\r\n}", "  avatar_color:     string;\r\n  taille_gilet:     TailleGilet;\r\n}");

    mainPart = mainPart.replace("  abonnement:     AboType;\n}", "  abonnement:     AboType;\n  taille_gilet:   TailleGilet;\n}");
    mainPart = mainPart.replace("  abonnement:     AboType;\r\n}", "  abonnement:     AboType;\r\n  taille_gilet:   TailleGilet;\r\n}");
    
    mainPart = mainPart.replace("email: '', date_naissance: '', abonnement: 'Mensuel',", "email: '', date_naissance: '', abonnement: 'Mensuel', taille_gilet: 'M',");

    mainPart = mainPart.replace(/(avatar_color:'.*?')(\s*})/g, "$1, taille_gilet: 'M'$2");

    mainPart = mainPart.replace("abonnement:     this.activeAbo()?.type ?? 'Mensuel',", "abonnement:     this.activeAbo()?.type ?? 'Mensuel',\n      taille_gilet:   c.taille_gilet ?? 'M',");

    mainPart = mainPart.replace("avatar_color:     '#3b82f6',", "avatar_color:     '#3b82f6',\n        taille_gilet:     this.clientForm.taille_gilet,");
    
    mainPart = mainPart.replace("email: this.clientForm.email }", "email: this.clientForm.email, taille_gilet: this.clientForm.taille_gilet }");

    const toastMethodStart = "showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {";
    const replaceWith = `readonly TAILLES_GILET: TailleGilet[] = ['S', 'M', 'L'];

  getTailleColor(taille: TailleGilet): string {
    const colors: Record<TailleGilet, string> = {
      'S': '#22d3ee',
      'M': '#3b82f6',
      'L': '#c084fc',
    };
    return colors[taille] || '#ffffff';
  }

  showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {`;
    
    mainPart = mainPart.replace(toastMethodStart, replaceWith);

    const newContent = mainPart.trim() + "\n}";
    fs.writeFileSync(filePath, newContent, 'utf-8');
}

function fixClientsHtml() {
    const filePath = path.join(baseDir, 'clients', 'clients.html');
    const content = fs.readFileSync(filePath, 'utf-8');

    let mainPart = content.split('<!-- ══════════════════════════════════════════════════════════════════\r\n     MODIFICATIONS À FAIRE DANS clients.component.html')[0];
    if (mainPart === content) {
        mainPart = content.split('<!-- ══════════════════════════════════════════════════════════════════\n     MODIFICATIONS À FAIRE DANS clients.component.html')[0];
    }

    const pdItem = `            <div class="pd-item">
              <div class="pd-label">Abonnement actuel</div>
              <div class="pd-value" style="color:#3b82f6;font-weight:700">
                {{ activeAbo()?.type ?? '—' }}
              </div>
            </div>
            <div class="pd-item">
              <div class="pd-label">Taille Gilet</div>
              <div class="pd-value">
                <span class="taille-chip"
                      [style.color]="getTailleColor(selectedClient()!.taille_gilet)"
                      [style.background]="getTailleColor(selectedClient()!.taille_gilet) + '18'"
                      [style.border]="'1px solid ' + getTailleColor(selectedClient()!.taille_gilet) + '30'"
                      style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;">
                  👕 {{ selectedClient()!.taille_gilet }}
                </span>
              </div>
            </div>`;
    
    mainPart = mainPart.replace(`            <div class="pd-item">\n              <div class="pd-label">Abonnement actuel</div>\n              <div class="pd-value" style="color:#3b82f6;font-weight:700">\n                {{ activeAbo()?.type ?? '—' }}\n              </div>\n            </div>`, pdItem);
    mainPart = mainPart.replace(`            <div class="pd-item">\r\n              <div class="pd-label">Abonnement actuel</div>\r\n              <div class="pd-value" style="color:#3b82f6;font-weight:700">\r\n                {{ activeAbo()?.type ?? '—' }}\r\n              </div>\r\n            </div>`, pdItem);

    const selector = `        <div class="form-group form-group--full">
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
          <select class="form-input form-select" [(ngModel)]="clientForm.abonnement">`;
    
    mainPart = mainPart.replace(`        <div class="form-group">\n          <label class="form-label">Abonnement initial</label>\n          <select class="form-input form-select" [(ngModel)]="clientForm.abonnement">`, selector);
    mainPart = mainPart.replace(`        <div class="form-group">\r\n          <label class="form-label">Abonnement initial</label>\r\n          <select class="form-input form-select" [(ngModel)]="clientForm.abonnement">`, selector);

    let newContent = mainPart.trim();
    if (!newContent.endsWith("</div>")) {
        newContent += "\n</div>";
    }
        
    fs.writeFileSync(filePath, newContent, 'utf-8');
}

try { fixCreneauxTs(); console.log("Fixed creneaux.ts"); } catch (e) { console.error("Error creneaux.ts:", e); }
try { fixCreneauxHtml(); console.log("Fixed creneaux.html"); } catch (e) { console.error("Error creneaux.html:", e); }
try { fixClientsTs(); console.log("Fixed clients.ts"); } catch (e) { console.error("Error clients.ts:", e); }
try { fixClientsHtml(); console.log("Fixed clients.html"); } catch (e) { console.error("Error clients.html:", e); }
