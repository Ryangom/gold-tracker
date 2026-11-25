import { GRAMS_PER_TROY_OUNCE, GRAMS_PER_VORI, karatFactor } from '../models/constants';
import { BajusRates, KaratId } from '../models/models';

/**
 * Pure gold-price conversion utilities. All functions are side-effect free and
 * deterministic — this is the single source of truth for the calculation rules
 * described in the spec, and the unit tests target exactly these.
 *
 * Formulas:
 *   BDT per gram (24K) = (XAU_USD / 31.1035) × USD_BDT
 *   BDT per gram (K)   = BDT per gram (24K) × (K/24)
 *   BDT per vori       = BDT per gram × 11.664
 *   BDT per 10 g       = BDT per gram × 10
 *   BDT per ounce      = BDT per gram (24K) × 31.1035  (= XAU_USD × USD_BDT)
 */

export interface SpotInputs {
  /** XAU/USD spot price per troy ounce. */
  xauUsd: number;
  /** USD→BDT exchange rate. */
  usdBdt: number;
}

export interface PriceBreakdown {
  perGram24k: number;
  perOunce: number;
  perVori24k: number;
  per10g24k: number;
  /** Per-gram price for a given karat (after purity factor). */
  perGramForKarat: (karat: KaratId, traditionalPurity?: number) => number;
  /** Per-unit price for a given karat and gram-equivalent unit. */
  perUnit: (karat: KaratId, grams: number, traditionalPurity?: number) => number;
}

/** Apply an optional local-market premium (percent) to a BDT price. */
export function applyPremium(bdt: number, premiumPct: number): number {
  if (!isFinite(bdt) || !isFinite(premiumPct)) {
    return bdt;
  }
  return bdt * (1 + premiumPct / 100);
}

/** Compute the full price breakdown from spot inputs. Pure. */
export function computeBreakdown(inputs: SpotInputs): PriceBreakdown {
  const { xauUsd, usdBdt } = inputs;
  const perGram24k = (xauUsd / GRAMS_PER_TROY_OUNCE) * usdBdt;
  const perOunce = xauUsd * usdBdt;
  const perVori24k = perGram24k * GRAMS_PER_VORI;
  const per10g24k = perGram24k * 10;

  const perGramForKarat = (karat: KaratId, traditionalPurity = 0.8): number => {
    const factor = karatFactor(karat, traditionalPurity);
    return perGram24k * factor;
  };

  const perUnit = (karat: KaratId, grams: number, traditionalPurity = 0.8): number => {
    return perGramForKarat(karat, traditionalPurity) * grams;
  };

  return { perGram24k, perOunce, perVori24k, per10g24k, perGramForKarat, perUnit };
}

/**
 * Difference between a BAJUS override (per vori) and the spot-based per-vori
 * price for 24K. Returns the absolute and percentage gap.
 */
export function bajusDelta(
  bajusPerVori: number,
  spotPerVori24k: number,
): { abs: number; pct: number } {
  if (!spotPerVori24k || !isFinite(spotPerVori24k)) {
    return { abs: 0, pct: 0 };
  }
  const abs = bajusPerVori - spotPerVori24k;
  const pct = (abs / spotPerVori24k) * 100;
  return { abs, pct };
}

/**
 * Old gold resale payout after applying a percentage deduction (default 15%
 * per standard BAJUS practice, i.e. 85% of market price).
 */
export function resalePrice(marketPrice: number, deductionPct = 15): number {
  if (!isFinite(marketPrice) || marketPrice <= 0) {
    return 0;
  }
  const safeDeduction = isFinite(deductionPct) ? deductionPct : 0;
  const clamped = Math.max(0, Math.min(100, safeDeduction));
  return marketPrice * (1 - clamped / 100);
}

/** Look up the locally saved BAJUS per-vori rate for a karat (null if unset or 24K). */
export function bajusRateForKarat(rates: BajusRates, karat: KaratId): number | null {
  let raw: number;
  switch (karat) {
    case '22K':
      raw = rates.k22;
      break;
    case '21K':
      raw = rates.k21;
      break;
    case '18K':
      raw = rates.k18;
      break;
    case 'traditional':
      raw = rates.traditional;
      break;
    case '24K':
      return null;
  }
  return isFinite(raw) && raw > 0 ? raw : null;
}

/** Convert a per-vori BAJUS rate into a different weight unit (e.g. 1g). */
export function bajusPerUnit(perVoriBdt: number, unitGrams: number): number {
  if (!isFinite(perVoriBdt) || perVoriBdt <= 0 || !isFinite(unitGrams) || unitGrams <= 0) {
    return 0;
  }
  return (perVoriBdt / GRAMS_PER_VORI) * unitGrams;
}

/**
 * Change between two snapshots. Returns amount, percent, and a direction tag.
 * If `previous` is missing or zero, returns 'collecting' so the UI can show
 * "Collecting history".
 */
export function priceChange(
  current: number,
  previous: number | null | undefined,
): { abs: number; pct: number; dir: 'up' | 'down' | 'flat' | 'collecting' } {
  if (previous == null || !isFinite(previous) || previous === 0) {
    return { abs: 0, pct: 0, dir: 'collecting' };
  }
  const abs = current - previous;
  const pct = (abs / previous) * 100;
  const dir = abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat';
  return { abs, pct, dir };
}

/**
 * Convert a weight given in a traditional unit (vori/ana/roti/point) into grams.
 * Pure; mirrors WEIGHT_UNITS but accepts any numeric amount.
 */
export function weightToGrams(amount: number, unitGramsPerUnit: number): number {
  return amount * unitGramsPerUnit;
}

/** Convert grams back into a traditional unit. */
export function gramsToWeight(grams: number, unitGramsPerUnit: number): number {
  if (unitGramsPerUnit === 0) {
    return 0;
  }
  return grams / unitGramsPerUnit;
}

/**
 * Calculator: total value of a piece of gold.
 *   value = weightGrams × perGram(karat) × (1 + vatPct/100) + makingCharge
 * where making charge is either a percent of metal value or a fixed ৳/gram.
 */
export interface CalculatorInputs {
  weightGrams: number;
  karat: KaratId;
  traditionalPurity?: number;
  perGram24k: number;
  makingPct: number; // percent of metal value
  makingPerGram: number; // ৳ per gram (added after, not scaled by vat)
  vatPct: number;
}

export interface CalculatorResult {
  metalValue: number;
  makingCharge: number;
  subtotal: number;
  vat: number;
  total: number;
}

export function calculateValue(inputs: CalculatorInputs): CalculatorResult {
  const { weightGrams, karat, traditionalPurity = 0.8, perGram24k, makingPct, makingPerGram, vatPct } =
    inputs;
  const perGramKarat = perGram24k * karatFactor(karat, traditionalPurity);
  const metalValue = perGramKarat * weightGrams;
  const makingFromPct = metalValue * (makingPct / 100);
  const makingFromPerGram = makingPerGram * weightGrams;
  const makingCharge = makingFromPct + makingFromPerGram;
  const subtotal = metalValue + makingCharge;
  const vat = subtotal * (vatPct / 100);
  const total = subtotal + vat;
  return { metalValue, makingCharge, subtotal, vat, total };
}

/** Reverse calculator: how much gold (in grams) a BDT budget can buy. */
export function budgetToGold(
  budgetBdt: number,
  perGram24k: number,
  karat: KaratId,
  traditionalPurity = 0.8,
  makingPct = 0,
  makingPerGram = 0,
  vatPct = 0,
): { grams: number; vori: number } {
  const factor = karatFactor(karat, traditionalPurity);
  const perGramKarat = perGram24k * factor;
  if (perGramKarat <= 0) {
    return { grams: 0, vori: 0 };
  }
  // per gram of finished jewellery = metal + making-per-gram, grossed up by vat
  const makingPerGramTotal = makingPerGram + perGramKarat * (makingPct / 100);
  const perGramFinished = (perGramKarat + makingPerGramTotal) * (1 + vatPct / 100);
  if (perGramFinished <= 0) {
    return { grams: 0, vori: 0 };
  }
  const grams = budgetBdt / perGramFinished;
  return { grams, vori: grams / GRAMS_PER_VORI };
}
