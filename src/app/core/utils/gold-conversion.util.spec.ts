import { describe, it, expect } from 'vitest';
import {
  computeBreakdown,
  applyPremium,
  bajusDelta,
  resalePrice,
  bajusRateForKarat,
  bajusPerUnit,
  priceChange,
  weightToGrams,
  gramsToWeight,
  calculateValue,
  budgetToGold,
} from './gold-conversion.util';
import { karatFactor, WEIGHT_UNITS, GRAMS_PER_VORI, GRAMS_PER_TROY_OUNCE } from '../models/constants';

describe('gold conversion utility', () => {
  // Verified reference: XAU=2000 USD/oz, USD_BDT=120
  // per gram 24K = (2000/31.1035)*120 = 7716.13...
  const spot = { xauUsd: 2000, usdBdt: 120 };

  describe('computeBreakdown', () => {
    it('computes per-gram 24K from spot', () => {
      const b = computeBreakdown(spot);
      const expected = (2000 / 31.1035) * 120;
      expect(b.perGram24k).toBeCloseTo(expected, 4);
    });

    it('computes per ounce = XAU_USD × USD_BDT', () => {
      const b = computeBreakdown(spot);
      expect(b.perOunce).toBeCloseTo(2000 * 120, 2);
    });

    it('computes per vori 24K = per gram × 11.664', () => {
      const b = computeBreakdown(spot);
      expect(b.perVori24k).toBeCloseTo(b.perGram24k * GRAMS_PER_VORI, 4);
    });

    it('computes per 10 g = per gram × 10', () => {
      const b = computeBreakdown(spot);
      expect(b.per10g24k).toBeCloseTo(b.perGram24k * 10, 4);
    });
  });

  describe('karat factors', () => {
    it('24K factor = 1', () => {
      expect(karatFactor('24K')).toBe(1);
    });
    it('22K factor = 22/24', () => {
      expect(karatFactor('22K')).toBeCloseTo(22 / 24, 10);
    });
    it('21K factor = 21/24', () => {
      expect(karatFactor('21K')).toBeCloseTo(21 / 24, 10);
    });
    it('18K factor = 18/24', () => {
      expect(karatFactor('18K')).toBeCloseTo(18 / 24, 10);
    });
    it('traditional factor uses the provided purity (default 0.8)', () => {
      expect(karatFactor('traditional')).toBeCloseTo(0.8, 10);
      expect(karatFactor('traditional', 0.75)).toBeCloseTo(0.75, 10);
    });

    it('perGramForKarat scales 24K by the karat factor', () => {
      const b = computeBreakdown(spot);
      expect(b.perGramForKarat('22K')).toBeCloseTo(b.perGram24k * (22 / 24), 6);
      expect(b.perGramForKarat('18K')).toBeCloseTo(b.perGram24k * (18 / 24), 6);
    });

    it('perUnit scales by grams for the chosen unit', () => {
      const b = computeBreakdown(spot);
      expect(b.perUnit('24K', GRAMS_PER_VORI)).toBeCloseTo(b.perVori24k, 4);
      expect(b.perUnit('24K', GRAMS_PER_TROY_OUNCE)).toBeCloseTo(b.perOunce, 4);
      expect(b.perUnit('24K', 1)).toBeCloseTo(b.perGram24k, 4);
    });
  });

  describe('ana / roti / point conversions', () => {
    it('1 vori = 11.664 g', () => {
      expect(GRAMS_PER_VORI).toBeCloseTo(11.664, 6);
    });
    it('1 ana = 11.664/16 g', () => {
      const ana = WEIGHT_UNITS.find((u) => u.id === 'ana')!;
      expect(ana.gramsPerUnit).toBeCloseTo(11.664 / 16, 6);
    });
    it('1 roti = 11.664/96 g', () => {
      const roti = WEIGHT_UNITS.find((u) => u.id === 'roti')!;
      expect(roti.gramsPerUnit).toBeCloseTo(11.664 / 96, 6);
    });
    it('1 point = 11.664/960 g', () => {
      const point = WEIGHT_UNITS.find((u) => u.id === 'point')!;
      expect(point.gramsPerUnit).toBeCloseTo(11.664 / 960, 6);
    });
    it('16 ana = 1 vori in grams', () => {
      const ana = WEIGHT_UNITS.find((u) => u.id === 'ana')!;
      expect(weightToGrams(16, ana.gramsPerUnit)).toBeCloseTo(GRAMS_PER_VORI, 6);
    });
    it('96 roti = 1 vori in grams', () => {
      const roti = WEIGHT_UNITS.find((u) => u.id === 'roti')!;
      expect(weightToGrams(96, roti.gramsPerUnit)).toBeCloseTo(GRAMS_PER_VORI, 6);
    });
    it('960 point = 1 vori in grams', () => {
      const point = WEIGHT_UNITS.find((u) => u.id === 'point')!;
      expect(weightToGrams(960, point.gramsPerUnit)).toBeCloseTo(GRAMS_PER_VORI, 6);
    });
    it('gramsToWeight is the inverse of weightToGrams', () => {
      const roti = WEIGHT_UNITS.find((u) => u.id === 'roti')!;
      const g = weightToGrams(5, roti.gramsPerUnit);
      expect(gramsToWeight(g, roti.gramsPerUnit)).toBeCloseTo(5, 6);
    });
    it('gramsToWeight(0, x) handles zero denominator', () => {
      expect(gramsToWeight(10, 0)).toBe(0);
    });
  });

  describe('applyPremium', () => {
    it('adds a percent premium', () => {
      expect(applyPremium(100, 5)).toBeCloseTo(105, 6);
    });
    it('0% premium is a no-op', () => {
      expect(applyPremium(100, 0)).toBe(100);
    });
    it('NaN inputs pass through unchanged', () => {
      expect(applyPremium(NaN, 5)).toBeNaN();
    });
  });

  describe('bajusDelta', () => {
    it('returns absolute and percentage difference', () => {
      const d = bajusDelta(100000, 90000);
      expect(d.abs).toBeCloseTo(10000, 2);
      expect(d.pct).toBeCloseTo((10000 / 90000) * 100, 4);
    });
    it('zero spot returns zero delta', () => {
      expect(bajusDelta(100, 0)).toEqual({ abs: 0, pct: 0 });
    });
  });

  describe('resalePrice', () => {
    it('applies default 15% deduction (85% payout)', () => {
      expect(resalePrice(196830)).toBeCloseTo(167305.5, 2);
    });
    it('supports custom deduction percentage', () => {
      expect(resalePrice(100000, 10)).toBeCloseTo(90000, 2);
      expect(resalePrice(100000, 0)).toBeCloseTo(100000, 2);
    });
    it('clamps deduction to [0, 100] and handles non-positive prices', () => {
      expect(resalePrice(100000, 150)).toBe(0);
      expect(resalePrice(100000, -5)).toBe(100000);
      expect(resalePrice(0, 15)).toBe(0);
      expect(resalePrice(-100, 15)).toBe(0);
    });
  });

  describe('bajusRateForKarat & bajusPerUnit', () => {
    const rates = { k22: 196830, k21: 188024, k18: 161488, traditional: 0, updatedAt: null };

    it('returns configured rate for each BAJUS karat and null for unset or 24K', () => {
      expect(bajusRateForKarat(rates, '22K')).toBe(196830);
      expect(bajusRateForKarat(rates, '21K')).toBe(188024);
      expect(bajusRateForKarat(rates, '18K')).toBe(161488);
      expect(bajusRateForKarat(rates, 'traditional')).toBeNull();
      expect(bajusRateForKarat(rates, '24K')).toBeNull();
    });

    it('converts per-vori BAJUS rate to per-gram', () => {
      expect(bajusPerUnit(196830, 1)).toBeCloseTo(196830 / GRAMS_PER_VORI, 4);
      expect(bajusPerUnit(0, 1)).toBe(0);
    });
  });

  describe('priceChange', () => {
    it('up direction', () => {
      const c = priceChange(110, 100);
      expect(c.dir).toBe('up');
      expect(c.abs).toBeCloseTo(10, 6);
      expect(c.pct).toBeCloseTo(10, 6);
    });
    it('down direction', () => {
      const c = priceChange(90, 100);
      expect(c.dir).toBe('down');
      expect(c.abs).toBeCloseTo(-10, 6);
    });
    it('flat', () => {
      expect(priceChange(100, 100).dir).toBe('flat');
    });
    it('collecting when previous is missing', () => {
      expect(priceChange(100, null).dir).toBe('collecting');
      expect(priceChange(100, 0).dir).toBe('collecting');
    });
  });

  describe('calculateValue', () => {
    it('metal value = weight × perGram(karat)', () => {
      const r = calculateValue({
        weightGrams: 11.664,
        karat: '22K',
        perGram24k: 7716.13,
        makingPct: 0,
        makingPerGram: 0,
        vatPct: 0,
      });
      expect(r.metalValue).toBeCloseTo(7716.13 * (22 / 24) * 11.664, 2);
      expect(r.total).toBeCloseTo(r.metalValue, 2);
    });
    it('making charge percent and per-gram both apply', () => {
      const r = calculateValue({
        weightGrams: 10,
        karat: '24K',
        perGram24k: 1000,
        makingPct: 5,
        makingPerGram: 20,
        vatPct: 0,
      });
      const metal = 1000 * 10;
      const making = metal * 0.05 + 20 * 10;
      expect(r.makingCharge).toBeCloseTo(making, 2);
      expect(r.subtotal).toBeCloseTo(metal + making, 2);
    });
    it('VAT applies to subtotal (metal + making)', () => {
      const r = calculateValue({
        weightGrams: 10,
        karat: '24K',
        perGram24k: 1000,
        makingPct: 0,
        makingPerGram: 0,
        vatPct: 10,
      });
      expect(r.vat).toBeCloseTo(10000 * 0.1, 2);
      expect(r.total).toBeCloseTo(11000, 2);
    });
  });

  describe('budgetToGold (reverse)', () => {
    it('buys grams = budget / perGramFinished', () => {
      const r = budgetToGold(10000, 1000, '24K', 0.8, 0, 0, 0);
      expect(r.grams).toBeCloseTo(10, 6);
    });
    it('vori = grams / 11.664', () => {
      const r = budgetToGold(116640, 10000, '24K', 0.8, 0, 0, 0);
      // 116640 / 10000 = 11.664 g = 1 vori
      expect(r.grams).toBeCloseTo(11.664, 4);
      expect(r.vori).toBeCloseTo(1, 4);
    });
    it('returns zero when per-gram is zero', () => {
      const r = budgetToGold(1000, 0, '24K');
      expect(r.grams).toBe(0);
      expect(r.vori).toBe(0);
    });
  });
});
