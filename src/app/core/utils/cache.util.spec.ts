import { describe, it, expect, beforeEach } from 'vitest';
import { isCacheFresh, cacheAgeMs, shouldSnapshot, trimHistory, CacheEnvelope } from './cache.util';
import { PriceSnapshot } from '../models/models';

const T0 = 1_700_000_000_000; // fixed epoch ms

function env<T>(value: T, ageMs: number, ttlMs = 15 * 60_000): CacheEnvelope<T> {
  return { value, fetchedAt: T0 - ageMs, ttlMs };
}

describe('cache expiry logic', () => {
  describe('isCacheFresh', () => {
    it('fresh when age < ttl', () => {
      expect(isCacheFresh(env(42, 60_000, 900_000), T0)).toBe(true);
    });
    it('stale when age >= ttl', () => {
      expect(isCacheFresh(env(42, 900_000, 900_000), T0)).toBe(false);
      expect(isCacheFresh(env(42, 1_000_000, 900_000), T0)).toBe(false);
    });
    it('rejects malformed envelopes', () => {
      expect(isCacheFresh(null, T0)).toBe(false);
      expect(isCacheFresh({} as CacheEnvelope<unknown>, T0)).toBe(false);
      expect(isCacheFresh({ value: 1, fetchedAt: 'x' } as unknown as CacheEnvelope<number>, T0)).toBe(false);
    });
  });

  describe('cacheAgeMs', () => {
    it('returns the age in ms', () => {
      expect(cacheAgeMs(env(42, 120_000), T0)).toBe(120_000);
    });
    it('clamps to >= 0', () => {
      expect(cacheAgeMs(env(42, -5), T0)).toBe(0);
    });
    it('infinity for malformed', () => {
      expect(cacheAgeMs(null, T0)).toBe(Number.POSITIVE_INFINITY);
    });
  });
});

describe('snapshot scheduling', () => {
  const snap = (iso: string): PriceSnapshot => ({
    ts: iso,
    xauUsd: 2000,
    usdBdt: 120,
    bdtPerGram24k: 7716,
  });

  describe('shouldSnapshot', () => {
    it('true when history is empty', () => {
      expect(shouldSnapshot([], 30 * 60_000, T0)).toBe(true);
    });
    it('false when last snapshot is within the interval', () => {
      const history = [snap(new Date(T0 - 10 * 60_000).toISOString())];
      expect(shouldSnapshot(history, 30 * 60_000, T0)).toBe(false);
    });
    it('true when last snapshot is older than the interval', () => {
      const history = [snap(new Date(T0 - 31 * 60_000).toISOString())];
      expect(shouldSnapshot(history, 30 * 60_000, T0)).toBe(true);
    });
    it('true when last snapshot has an unparseable timestamp', () => {
      const history = [snap('not-a-date')];
      expect(shouldSnapshot(history, 30 * 60_000, T0)).toBe(true);
    });
  });

  describe('trimHistory', () => {
    it('drops snapshots older than retention', () => {
      const retentionDays = 90;
      const old = snap(new Date(T0 - 100 * 86_400_000).toISOString());
      const recent = snap(new Date(T0 - 1 * 86_400_000).toISOString());
      const result = trimHistory([old, recent], retentionDays, T0);
      expect(result).toEqual([recent]);
    });
    it('keeps all when within retention', () => {
      const retentionDays = 90;
      const a = snap(new Date(T0 - 10 * 86_400_000).toISOString());
      const b = snap(new Date(T0 - 1 * 86_400_000).toISOString());
      expect(trimHistory([a, b], retentionDays, T0)).toEqual([a, b]);
    });
    it('drops unparseable timestamps', () => {
      const bad = snap('garbage');
      const good = snap(new Date(T0 - 1_000).toISOString());
      expect(trimHistory([bad, good], 90, T0)).toEqual([good]);
    });
  });
});
