import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { GRAMS_PER_VORI } from '../models/constants';
import { PriceSnapshot } from '../models/models';
import { StorageService, CACHE_KEYS, shouldSnapshot, trimHistory } from '../utils/cache.util';

/**
 * Persists BAJUS price snapshots to localStorage: at most one per 30 minutes,
 * keeping the last 90 days. Powers the history chart and 24h price change.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  constructor(private storage: StorageService) {}

  /** All snapshots, oldest first. */
  all(): PriceSnapshot[] {
    const list = this.storage.read<PriceSnapshot[]>(CACHE_KEYS.history, []);
    return Array.isArray(list) ? list : [];
  }

  /**
   * Maybe add a snapshot. Returns true if one was added.
   * Honours the 30-minute minimum interval and the 90-day retention.
   */
  record(snap: Omit<PriceSnapshot, 'ts'>): boolean {
    const current = this.all();
    if (!shouldSnapshot(current, environment.snapshotMinIntervalMs)) {
      return false;
    }
    const next: PriceSnapshot[] = trimHistory(
      [...current, { ...snap, ts: new Date().toISOString() }],
      environment.snapshotRetentionDays,
    );
    this.storage.write(CACHE_KEYS.history, next);
    return true;
  }

  clear(): void {
    this.storage.remove(CACHE_KEYS.history);
  }

  /** Snapshots within the given ms window, oldest first. */
  within(ms: number, now: number = Date.now()): PriceSnapshot[] {
    const cutoff = now - ms;
    return this.all().filter((s) => {
      const t = Date.parse(s.ts);
      return isFinite(t) && t >= cutoff;
    });
  }

  /** The most recent snapshot before `cutoffMs`, or null. */
  latestBefore(cutoffMs: number): PriceSnapshot | null {
    const all = this.all();
    let found: PriceSnapshot | null = null;
    let foundT = -Infinity;
    for (const s of all) {
      const t = Date.parse(s.ts);
      if (isFinite(t) && t <= cutoffMs && t > foundT) {
        found = s;
        foundT = t;
      }
    }
    return found;
  }

  /** Export the full BAJUS history as a CSV string. */
  toCsv(): string {
    const rows = this.all();
    const header = 'timestamp,bajus_22k_per_gram_bdt,bajus_22k_per_vori_bdt';
    const lines = rows.map((r) => {
      const gram22 = r.bdtPerGram22k ?? r.bdtPerGram24k;
      const vori22 = r.bdtPerVori22k ?? gram22 * GRAMS_PER_VORI;
      return `${r.ts},${gram22.toFixed(2)},${vori22.toFixed(2)}`;
    });
    return [header, ...lines].join('\n');
  }
}
