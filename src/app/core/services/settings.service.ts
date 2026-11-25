import { Injectable, signal, computed, inject } from '@angular/core';
import { BajusRates, DEFAULT_SETTINGS, Settings } from '../models/models';
import { StorageService, CACHE_KEYS } from '../utils/cache.util';

/**
 * Owns user settings, persisted to localStorage. Exposes signals so any
 * component can react to changes. Every read falls back to defaults if storage
 * is unavailable or corrupt.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storage = inject(StorageService);

  private readonly _settings = signal<Settings>(this.load());

  readonly settings = this._settings.asReadonly();

  /** Convenience computed slices consumed by the store and UI. */
  readonly lang = computed(() => this._settings().lang);
  readonly digits = computed(() => this._settings().digits);
  readonly theme = computed(() => this._settings().theme);
  readonly karat = computed(() => this._settings().karat);
  readonly priceUnit = computed(() => this._settings().priceUnit);
  readonly bajusRates = computed(() => this._settings().bajusRates);
  readonly resaleDeductionPct = computed(() => this._settings().resaleDeductionPct);
  readonly refreshIntervalMin = computed(() => this._settings().refreshIntervalMin);

  private load(): Settings {
    const stored = this.storage.read<Partial<Settings>>(CACHE_KEYS.settings, {});
    const mergedRates: BajusRates = {
      ...DEFAULT_SETTINGS.bajusRates,
      ...(stored.bajusRates ?? {}),
    };
    const deduction =
      typeof stored.resaleDeductionPct === 'number' && Number.isFinite(stored.resaleDeductionPct)
        ? Math.max(0, Math.min(50, stored.resaleDeductionPct))
        : DEFAULT_SETTINGS.resaleDeductionPct;
    const karat =
      stored.karat === '22K' ||
      stored.karat === '21K' ||
      stored.karat === '18K' ||
      stored.karat === 'traditional'
        ? stored.karat
        : DEFAULT_SETTINGS.karat;
    const priceUnit =
      stored.priceUnit === 'vori' ||
      stored.priceUnit === 'gram' ||
      stored.priceUnit === 'ana' ||
      stored.priceUnit === 'roti'
        ? stored.priceUnit
        : DEFAULT_SETTINGS.priceUnit;
    const refreshIntervalMin =
      stored.refreshIntervalMin === 15 ||
      stored.refreshIntervalMin === 30 ||
      stored.refreshIntervalMin === 60
        ? stored.refreshIntervalMin
        : DEFAULT_SETTINGS.refreshIntervalMin;

    return {
      lang: stored.lang === 'bn' ? 'bn' : 'en',
      digits: stored.digits === 'bengali' ? 'bengali' : 'western',
      theme: stored.theme === 'light' || stored.theme === 'dark' ? stored.theme : 'system',
      karat,
      priceUnit,
      bajusRates: mergedRates,
      resaleDeductionPct: deduction,
      refreshIntervalMin,
    };
  }

  /** Patch one or more settings; persists immediately. */
  update(patch: Partial<Settings>): void {
    const next: Settings = { ...this._settings(), ...patch };
    this._settings.set(next);
    this.storage.write(CACHE_KEYS.settings, next);
  }

  /** Save locally entered BAJUS retail rates (৳ per vori) with timestamp. */
  updateBajusRates(rates: Omit<BajusRates, 'updatedAt'>): void {
    const clean = (v: number) => Math.max(0, Number.isFinite(v) ? v : 0);
    const k22 = clean(rates.k22);
    const k21 = clean(rates.k21);
    const k18 = clean(rates.k18);
    const traditional = clean(rates.traditional);
    const hasAny = k22 > 0 || k21 > 0 || k18 > 0 || traditional > 0;
    this.update({
      bajusRates: {
        k22,
        k21,
        k18,
        traditional,
        updatedAt: hasAny ? new Date().toISOString() : null,
      },
    });
  }

  /** Clear saved manual BAJUS rates back to live bajus.org feed. */
  clearBajusRates(): void {
    this.update({
      bajusRates: { k22: 0, k21: 0, k18: 0, traditional: 0, updatedAt: null },
    });
  }
}
