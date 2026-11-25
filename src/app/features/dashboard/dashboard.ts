import { Component, computed, inject, signal, effect, ElementRef, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PriceStore } from '../../core/services/price-store.service';
import { SettingsService } from '../../core/services/settings.service';
import { I18nService } from '../../core/services/i18n.service';
import { BdtPipe } from '../../shared/pipes/bdt.pipe';
import { BAJUS_KARATS, BAJUS_PRICE_UNITS } from '../../core/models/constants';
import { KaratId, PriceUnitId } from '../../core/models/models';

@Component({
  selector: 'app-dashboard',
  imports: [BdtPipe, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private store = inject(PriceStore);
  private settings = inject(SettingsService);
  private i18n = inject(I18nService);
  private bdtPipe = inject(BdtPipe);

  readonly karats = BAJUS_KARATS;
  readonly units = BAJUS_PRICE_UNITS;

  readonly status = this.store.status;
  readonly error = this.store.error;
  readonly liveBajus = this.store.liveBajus;
  readonly bajusSource = this.store.bajusSource;
  readonly bajusRates = this.store.bajusRates;
  readonly hasBajusRates = this.store.hasBajusRates;
  readonly bajusRows = this.store.bajusRows;
  readonly headline = this.store.headline;
  readonly change24h = this.store.change24h;

  readonly karat = this.settings.karat;
  readonly unit = this.settings.priceUnit;
  readonly resaleDeductionPct = this.settings.resaleDeductionPct;
  readonly payoutPct = computed(() => Math.max(0, 100 - this.resaleDeductionPct()));

  // Inline manual override editor state
  readonly bajusEditorOpen = signal(false);
  readonly draftK22 = signal('');
  readonly draftK21 = signal('');
  readonly draftK18 = signal('');
  readonly draftTraditional = signal('');
  readonly draftDeduction = signal('15');

  // Subtle flash animation when headline value changes
  private readonly prevHeadline = signal<number | null>(null);
  readonly flashDir = computed<'up' | 'down' | null>(() => {
    const cur = this.headline()?.bdt ?? null;
    const prev = this.prevHeadline();
    if (cur == null || prev == null || cur === prev) {
      return null;
    }
    return cur > prev ? 'up' : 'down';
  });
  private flashEl = viewChild<ElementRef<HTMLElement>>('priceFlash');

  constructor() {
    effect(() => {
      const cur = this.headline()?.bdt ?? null;
      if (cur != null) {
        this.prevHeadline.set(cur);
        const el = this.flashEl()?.nativeElement;
        if (el) {
          el.classList.remove('flash-up', 'flash-down');
          void el.offsetWidth;
          const dir = this.flashDir();
          
          if (dir === 'up') {
            el.classList.add('flash-up');
          } else if (dir === 'down') {
            el.classList.add('flash-down');
          }
        }
      }
    });
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  todayLabel(): string {
    const locale = this.i18n.lang() === 'bn' ? 'bn-BD' : 'en-GB';
    try {
      return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return new Date().toDateString();
    }
  }

  unitLabel(id: PriceUnitId): string {
    const found = BAJUS_PRICE_UNITS.find((u) => u.id === id);
    if (!found) {
      return id;
    }
    return this.i18n.lang() === 'bn' ? found.bn : found.en;
  }

  karatLabel(id: KaratId): string {
    const found = BAJUS_KARATS.find((k) => k.id === id);
    if (!found) {
      return id;
    }
    return this.i18n.lang() === 'bn' ? found.bn : found.en;
  }

  karatShort(id: KaratId): string {
    if (id === 'traditional') {
      return this.i18n.lang() === 'bn' ? 'সনাতন' : 'Traditional';
    }
    return id;
  }

  karatDesc(id: KaratId): string {
    const found = BAJUS_KARATS.find((k) => k.id === id);
    return found ? this.t(found.descKey) : '';
  }

  /** Other weight units for the currently selected karat (non-repetitive breakdown). */
  readonly otherUnits = computed(() => {
    const k = this.karat();
    const active = this.unit();
    return BAJUS_PRICE_UNITS.filter((u) => u.id !== active).map((u) => ({
      id: u.id,
      label: this.i18n.lang() === 'bn' ? u.bn : u.en,
      price: this.store.priceFor(k, u.id),
    }));
  });

  absBdt(n: number): string {
    const abs = Math.abs(n);
    const formatted = this.bdtPipe.transform(abs, 2);
    return formatted.replace(/^৳/, '');
  }

  absNum(n: number): string {
    return Math.abs(n).toFixed(2);
  }

  formatTime(d: Date): string {
    const locale = this.i18n.lang() === 'bn' ? 'bn-BD' : 'en-GB';
    try {
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short',
      }).format(d);
    } catch {
      return d.toLocaleString();
    }
  }

  selectKarat(id: KaratId): void {
    this.settings.update({ karat: id });
  }

  selectUnit(id: PriceUnitId): void {
    this.settings.update({ priceUnit: id });
  }

  retryFetch(): void {
    this.store.refreshNow().subscribe();
  }

  openBajusEditor(): void {
    const r = this.bajusRates();
    this.draftK22.set(r.k22 > 0 ? String(Math.round(r.k22 * 100) / 100) : '');
    this.draftK21.set(r.k21 > 0 ? String(Math.round(r.k21 * 100) / 100) : '');
    this.draftK18.set(r.k18 > 0 ? String(Math.round(r.k18 * 100) / 100) : '');
    this.draftTraditional.set(
      r.traditional > 0 ? String(Math.round(r.traditional * 100) / 100) : '',
    );
    this.draftDeduction.set(String(this.resaleDeductionPct()));
    this.bajusEditorOpen.set(true);
  }

  closeBajusEditor(): void {
    this.bajusEditorOpen.set(false);
  }

  saveBajusRates(): void {
    const num = (v: string) => Math.max(0, parseFloat(v) || 0);
    const deduction = Math.max(0, Math.min(50, parseFloat(this.draftDeduction()) || 0));
    this.settings.update({ resaleDeductionPct: deduction });
    this.settings.updateBajusRates({
      k22: num(this.draftK22()),
      k21: num(this.draftK21()),
      k18: num(this.draftK18()),
      traditional: num(this.draftTraditional()),
    });
    this.bajusEditorOpen.set(false);
  }

  clearBajusRates(): void {
    this.settings.clearBajusRates();
    this.draftK22.set('');
    this.draftK21.set('');
    this.draftK18.set('');
    this.draftTraditional.set('');
    this.bajusEditorOpen.set(false);
  }

  bajusUpdatedAt(): Date | null {
    const iso = this.bajusRates().updatedAt;
    if (!iso) {
      return null;
    }
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
}
