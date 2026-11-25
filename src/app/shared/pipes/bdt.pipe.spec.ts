import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BdtPipe } from './bdt.pipe';
import { SettingsService } from '../../core/services/settings.service';
import { StorageService } from '../../core/utils/cache.util';

describe('BdtPipe', () => {
  let pipe: BdtPipe;
  let settings: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BdtPipe, SettingsService, StorageService],
    });
    pipe = TestBed.inject(BdtPipe);
    settings = TestBed.inject(SettingsService);
    // Default to western digits, English.
    settings.update({ digits: 'western', lang: 'en' });
  });

  describe('symbol and grouping', () => {
    it('prefixes the ৳ symbol', () => {
      expect(pipe.transform(100)).toBe('৳100.00');
    });

    it('uses South Asian grouping (1,23,456.78), not Western', () => {
      // 123456.78 -> "1,23,456.78" (lakh grouping), NOT "123,456.78"
      expect(pipe.transform(123456.78)).toBe('৳1,23,456.78');
    });

    it('groups 12,34,567.89', () => {
      expect(pipe.transform(1234567.89)).toBe('৳12,34,567.89');
    });

    it('three-digit numbers have no group separator', () => {
      expect(pipe.transform(999)).toBe('৳999.00');
    });

    it('four-digit numbers group as 1,000', () => {
      expect(pipe.transform(1000)).toBe('৳1,000.00');
    });

    it('handles negative amounts', () => {
      expect(pipe.transform(-1234.5)).toBe('-৳1,234.50');
    });
  });

  describe('decimal places', () => {
    it('defaults to 2 decimals', () => {
      expect(pipe.transform(1.234)).toBe('৳1.23');
    });
    it('honours the fractionDigits argument', () => {
      expect(pipe.transform(1.2345, 4)).toBe('৳1.2345');
      expect(pipe.transform(123456, 0)).toBe('৳1,23,456');
    });
  });

  describe('Bengali digits', () => {
    beforeEach(() => {
      settings.update({ digits: 'bengali' });
    });

    it('converts Western digits to Bengali', () => {
      // 1,23,456.78 -> ১,২৩,৪৫৬.৭৮
      expect(pipe.transform(123456.78)).toBe('৳১,২৩,৪৫৬.৭৮');
    });

    it('keeps the ৳ symbol (not digit-converted)', () => {
      expect(pipe.transform(100).startsWith('৳')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('null returns a placeholder', () => {
      expect(pipe.transform(null)).toBe('৳—');
    });
    it('NaN returns a placeholder', () => {
      expect(pipe.transform(NaN)).toBe('৳—');
    });
    it('Infinity returns a placeholder', () => {
      expect(pipe.transform(Infinity)).toBe('৳—');
    });
  });
});
