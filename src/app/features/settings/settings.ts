import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../core/services/settings.service';
import { I18nService } from '../../core/services/i18n.service';
import { HistoryService } from '../../core/services/history.service';
import { environment } from '../../../environments/environment';
import { DigitPref, LangPref, ThemePref, Settings as SettingsModel } from '../../core/models/models';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.html',
})
export class SettingsPage {
  private settings = inject(SettingsService);
  private i18n = inject(I18nService);
  private history = inject(HistoryService);

  readonly s = this.settings.settings;
  readonly intervals: (15 | 30 | 60)[] = [15, 30, 60];

  t(key: string): string {
    return this.i18n.t(key);
  }

  setLang(v: LangPref): void {
    this.settings.update({ lang: v });
  }
  setDigits(v: DigitPref): void {
    this.settings.update({ digits: v });
  }
  setTheme(v: ThemePref): void {
    this.settings.update({ theme: v });
  }
  setKarat(v: SettingsModel['karat']): void {
    this.settings.update({ karat: v });
  }
  setPriceUnit(v: SettingsModel['priceUnit']): void {
    this.settings.update({ priceUnit: v });
  }
  setResaleDeduction(v: number | string): void {
    const n = typeof v === 'string' ? parseFloat(v) || 0 : v;
    this.settings.update({ resaleDeductionPct: Math.max(0, Math.min(50, n)) });
  }
  setInterval(v: 15 | 30 | 60): void {
    this.settings.update({ refreshIntervalMin: v });
  }

  exportCsv(): void {
    const csv = this.history.toCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bajus-gold-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  clearHistory(): void {
    if (confirm(this.i18n.lang() === 'bn' ? 'ইতিহাস মুছবেন?' : 'Clear all history?')) {
      this.history.clear();
    }
  }

  get cacheTtlMin(): number {
    return Math.round(environment.cacheTtlMs / 60000);
  }
}
