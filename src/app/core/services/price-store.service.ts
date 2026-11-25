import { Injectable, computed, signal, effect, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer, Subject, switchMap, catchError, EMPTY, tap, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BajusRates, KaratId, PriceUnitId } from '../models/models';
import { BAJUS_KARATS, BAJUS_PRICE_UNITS, GRAMS_PER_VORI, unitGrams } from '../models/constants';
import { BajusPriceService } from './bajus-price.service';
import { HistoryService } from './history.service';
import { AlertsService } from './alerts.service';
import { SettingsService } from './settings.service';
import {
  StorageService,
  CACHE_KEYS,
  CacheEnvelope,
  isCacheFresh,
  cacheAgeMs,
} from '../utils/cache.util';
import { LiveBajusQuote } from '../utils/bajus-parser.util';
import {
  bajusPerUnit,
  bajusRateForKarat,
  priceChange,
  resalePrice,
} from '../utils/gold-conversion.util';

export type FetchStatus = 'idle' | 'loading' | 'ok' | 'error' | 'stale';

export interface BajusTableRow {
  karat: KaratId;
  perVori: number | null;
  resalePerVori: number | null;
  perGram: number | null;
  perAna: number | null;
  perRoti: number | null;
  selectedMarket: number | null;
  selectedResale: number | null;
}

export interface PriceState {
  liveBajus: LiveBajusQuote | null;
  status: FetchStatus;
  error: string | null;
  lastFetchAt: number | null;
  lastManualRefreshAt: number | null;
  /** Age of the served BAJUS cache in ms. */
  dataAgeMs: number;
}

@Injectable({ providedIn: 'root' })
export class PriceStore {
  private bajusSvc = inject(BajusPriceService);
  private history = inject(HistoryService);
  private alerts = inject(AlertsService);
  private settings = inject(SettingsService);
  private storage = inject(StorageService);

  private readonly _state = signal<PriceState>({
    liveBajus: null,
    status: 'idle',
    error: null,
    lastFetchAt: null,
    lastManualRefreshAt: null,
    dataAgeMs: 0,
  });

  readonly state = this._state.asReadonly();
  readonly status = computed(() => this._state().status);
  readonly liveBajus = computed(() => this._state().liveBajus);
  readonly error = computed(() => this._state().error);

  /** True when serving cached BAJUS data after a live fetch failure. */
  readonly isStale = computed(() => this._state().status === 'stale');

  /** Whether manual BAJUS rates are saved or live bajus.org rates are active. */
  readonly bajusSource = computed<'manual' | 'live' | 'none'>(() => {
    const m = this.settings.bajusRates();
    if (m.k22 > 0 || m.k21 > 0 || m.k18 > 0 || m.traditional > 0) {
      return 'manual';
    }
    return this._state().liveBajus ? 'live' : 'none';
  });

  /** Active BAJUS per-vori rates (manual override if entered, otherwise live bajus.org). */
  readonly bajusRates = computed<BajusRates>(() => {
    const manual = this.settings.bajusRates();
    if (manual.k22 > 0 || manual.k21 > 0 || manual.k18 > 0 || manual.traditional > 0) {
      return manual;
    }
    const live = this._state().liveBajus;
    if (live) {
      return { ...live.perVori, updatedAt: live.fetchedAt };
    }
    return manual;
  });

  /** True when at least one BAJUS retail karat rate is available. */
  readonly hasBajusRates = computed(() => {
    const r = this.bajusRates();
    return r.k22 > 0 || r.k21 > 0 || r.k18 > 0 || r.traditional > 0;
  });

  /** Full BAJUS table rows across 22K, 21K, 18K, Traditional. */
  readonly bajusRows = computed<BajusTableRow[]>(() => {
    const rates = this.bajusRates();
    const deduction = this.settings.resaleDeductionPct();
    const grams = unitGrams(this.settings.priceUnit());

    return BAJUS_KARATS.map(({ id }) => {
      const perVori = bajusRateForKarat(rates, id);
      const selectedMarket = perVori !== null ? bajusPerUnit(perVori, grams) : null;
      return {
        karat: id,
        perVori,
        resalePerVori: perVori !== null ? resalePrice(perVori, deduction) : null,
        perGram: perVori !== null ? bajusPerUnit(perVori, 1) : null,
        perAna: perVori !== null ? bajusPerUnit(perVori, GRAMS_PER_VORI / 16) : null,
        perRoti: perVori !== null ? bajusPerUnit(perVori, GRAMS_PER_VORI / 96) : null,
        selectedMarket,
        selectedResale:
          selectedMarket !== null ? resalePrice(selectedMarket, deduction) : null,
      };
    });
  });

  /** Headline BAJUS price and companion metrics for the selected karat & unit. */
  readonly headline = computed<{
    bdt: number;
    resale: number;
    perGram: number;
    perVori: number;
    perAna: number;
    karat: KaratId;
    unit: PriceUnitId;
  } | null>(() => {
    const karat = this.settings.karat();
    const unit = this.settings.priceUnit();
    const rates = this.bajusRates();
    const perVori =
      bajusRateForKarat(rates, karat) ?? bajusRateForKarat(rates, '22K');
    if (perVori === null) {
      return null;
    }
    const grams = unitGrams(unit);
    const bdt = bajusPerUnit(perVori, grams);
    const deduction = this.settings.resaleDeductionPct();
    return {
      bdt,
      resale: resalePrice(bdt, deduction),
      perGram: bajusPerUnit(perVori, 1),
      perVori,
      perAna: bajusPerUnit(perVori, GRAMS_PER_VORI / 16),
      karat,
      unit,
    };
  });

  /** 24h change for BAJUS 22K per selected unit vs previous recorded BAJUS snapshot. */
  readonly change24h = computed(() => {
    const rates = this.bajusRates();
    const k22PerVori = bajusRateForKarat(rates, '22K');
    if (k22PerVori === null) {
      return { abs: 0, pct: 0, dir: 'collecting' as const };
    }
    const start = this.history.latestBefore(Date.now() - 20 * 60 * 60 * 1000);
    if (!start) {
      return { abs: 0, pct: 0, dir: 'collecting' as const };
    }
    const prevPerVori =
      start.bdtPerVori22k ??
      (start.bdtPerGram22k ? start.bdtPerGram22k * GRAMS_PER_VORI : null);
    if (!prevPerVori) {
      return { abs: 0, pct: 0, dir: 'collecting' as const };
    }
    const grams = unitGrams(this.settings.priceUnit());
    const current = bajusPerUnit(k22PerVori, grams);
    const prev = bajusPerUnit(prevPerVori, grams);
    return priceChange(current, prev);
  });

  /** Per-unit BAJUS price for any karat & unit (used by Calculator and Alerts). */
  priceFor(karat: KaratId, unit: PriceUnitId): number {
    const perVori = bajusRateForKarat(this.bajusRates(), karat);
    if (perVori === null) {
      return 0;
    }
    return bajusPerUnit(perVori, unitGrams(unit));
  }

  /** Per-gram BAJUS price for a karat. */
  perGramForKarat(karat: KaratId): number {
    return this.priceFor(karat, 'gram');
  }

  private readonly autoTimer$ = new Subject<void>();
  private visibilityHandler?: () => void;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Auto-refresh while the tab is visible; pause when hidden.
    this.autoTimer$
      .pipe(
        switchMap(() => {
          const min = this.settings.refreshIntervalMin();
          const intervalMs = Math.max(5, min) * 60 * 1000;
          return timer(0, intervalMs);
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => {
        if (document.visibilityState === 'visible') {
          this.refresh({ manual: false }).subscribe();
        }
      });

    effect(() => {
      this.settings.refreshIntervalMin();
      this.autoTimer$.next();
    });

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        const s = this._state();
        if (s.lastFetchAt && Date.now() - s.lastFetchAt > environment.cacheTtlMs) {
          this.refresh({ manual: false }).subscribe();
        }
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.refresh({ manual: false }).subscribe();
  }

  /**
   * Refresh official BAJUS rates.
   * - Auto-refresh reuses localStorage cache if < 15 minutes old.
   * - Manual refresh honours a 60s cooldown and fetches live from bajus.org.
   */
  refresh(opts: { manual: boolean }): Observable<unknown> {
    const now = Date.now();
    const s = this._state();

    if (opts.manual) {
      if (
        s.lastManualRefreshAt &&
        now - s.lastManualRefreshAt < environment.manualRefreshMinIntervalMs
      ) {
        this._state.update((st) => ({
          ...st,
          error: 'Please wait a minute before refreshing again.',
        }));
        return EMPTY;
      }
    }

    const cachedBajus = this.readCache<LiveBajusQuote>(CACHE_KEYS.bajus);
    if (!opts.manual && cachedBajus && isCacheFresh(cachedBajus)) {
      this._state.update((st) => ({
        ...st,
        liveBajus: cachedBajus.value,
        status: 'ok',
        error: null,
        dataAgeMs: cacheAgeMs(cachedBajus),
        lastFetchAt: now,
      }));
      this.maybeSnapshot(cachedBajus.value);
      this.checkAlerts();
      return EMPTY;
    }

    if (cachedBajus?.value) {
      this._state.update((st) => ({
        ...st,
        liveBajus: cachedBajus.value,
        status: 'stale',
        dataAgeMs: cacheAgeMs(cachedBajus),
      }));
    }

    this._state.update((st) => ({ ...st, status: 'loading', error: null }));

    return this.bajusSvc.fetchOfficialRates().pipe(
      tap((liveBajus) => {
        this.writeCache(CACHE_KEYS.bajus, liveBajus);
        this._state.update((st) => ({
          ...st,
          liveBajus,
          status: 'ok',
          error: null,
          lastFetchAt: now,
          lastManualRefreshAt: opts.manual ? now : st.lastManualRefreshAt,
          dataAgeMs: 0,
        }));
        this.maybeSnapshot(liveBajus);
        this.checkAlerts();
      }),
      catchError((err) => {
        const stillCached = this.readCache<LiveBajusQuote>(CACHE_KEYS.bajus);
        const hasManual = this.bajusSource() === 'manual';
        this._state.update((st) => ({
          ...st,
          status: stillCached ? 'stale' : hasManual ? 'ok' : 'error',
          error:
            stillCached || hasManual
              ? null
              : this.fmtError(err) ?? 'Could not fetch live BAJUS rates.',
          liveBajus: stillCached?.value ?? st.liveBajus,
          dataAgeMs: stillCached ? cacheAgeMs(stillCached) : st.dataAgeMs,
        }));
        return EMPTY;
      }),
    );
  }

  refreshNow(): Observable<unknown> {
    return this.refresh({ manual: true });
  }

  private maybeSnapshot(quote: LiveBajusQuote): void {
    const g22 = quote.perGram.k22;
    const v22 = quote.perVori.k22;
    this.history.record({
      bdtPerGram24k: g22 / (22 / 24),
      bdtPerGram22k: g22,
      bdtPerVori22k: v22,
    });
  }

  private checkAlerts(): void {
    const prices: { karat: KaratId; unit: PriceUnitId; bdt: number }[] = [];
    for (const k of BAJUS_KARATS) {
      for (const u of BAJUS_PRICE_UNITS) {
        const bdt = this.priceFor(k.id, u.id);
        if (bdt > 0) {
          prices.push({ karat: k.id, unit: u.id, bdt });
        }
      }
    }
    if (prices.length > 0) {
      this.alerts.check(prices);
    }
  }

  private readCache<T>(key: string): CacheEnvelope<T> | null {
    const env = this.storage.read<CacheEnvelope<T> | null>(key, null);
    if (!env || typeof env.fetchedAt !== 'number' || typeof env.ttlMs !== 'number') {
      return null;
    }
    return env;
  }

  private writeCache<T>(key: string, value: T): void {
    const env: CacheEnvelope<T> = { value, fetchedAt: Date.now(), ttlMs: environment.cacheTtlMs };
    this.storage.write(key, env);
  }

  private fmtError(err: unknown): string | null {
    if (!err) {
      return null;
    }
    const e = err as { message?: string; status?: number; statusText?: string };
    if (e.status && e.statusText) {
      return `Network error ${e.status} ${e.statusText}`;
    }
    return e.message ?? String(err);
  }
}
