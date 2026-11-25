import { Injectable } from '@angular/core';
import { PriceSnapshot } from '../models/models';

/**
 * Thin, defensive wrapper around localStorage. Every call is wrapped in
 * try/catch so private-mode browsers, quota errors, or corrupt JSON never crash
 * the app — callers just get null / false / empty arrays.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private available(): boolean {
    try {
      const k = '__gt_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  read<T>(key: string, fallback: T): T {
    if (!this.available()) {
      return fallback;
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) {
        return fallback;
      }
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  write(key: string, value: unknown): boolean {
    if (!this.available()) {
      return false;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    if (!this.available()) {
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  }
}

/** Cache envelope with an absolute expiry timestamp. */
export interface CacheEnvelope<T> {
  value: T;
  fetchedAt: number; // epoch ms
  ttlMs: number;
}

export const CACHE_KEYS = {
  bajus: 'gt:cache:bajus',
  settings: 'gt:settings',
  history: 'gt:history:v1',
  alerts: 'gt:alerts',
} as const;

/** Pure cache-expiry check used by services and tested directly. Accepts null. */
export function isCacheFresh(envelope: CacheEnvelope<unknown> | null, now: number = Date.now()): boolean {
  if (!envelope || typeof envelope.fetchedAt !== 'number' || typeof envelope.ttlMs !== 'number') {
    return false;
  }
  return now - envelope.fetchedAt < envelope.ttlMs;
}

/** Age of a cached value in ms (clamped at >= 0). Returns Infinity for null. */
export function cacheAgeMs(envelope: CacheEnvelope<unknown> | null, now: number = Date.now()): number {
  if (!envelope || typeof envelope.fetchedAt !== 'number') {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, now - envelope.fetchedAt);
}

/**
 * Decide whether a new snapshot should be persisted, given the last snapshot's
 * timestamp and the 30-minute minimum interval. Pure and tested.
 */
export function shouldSnapshot(
  history: PriceSnapshot[],
  minIntervalMs: number,
  now: number = Date.now(),
): boolean {
  if (history.length === 0) {
    return true;
  }
  const last = history[history.length - 1];
  const lastTs = Date.parse(last.ts);
  if (!isFinite(lastTs)) {
    return true;
  }
  return now - lastTs >= minIntervalMs;
}

/** Drop snapshots older than the retention window. Pure. */
export function trimHistory(history: PriceSnapshot[], retentionDays: number, now: number = Date.now()): PriceSnapshot[] {
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  return history.filter((s) => {
    const t = Date.parse(s.ts);
    return isFinite(t) && t >= cutoff;
  });
}
