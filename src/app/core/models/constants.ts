import { KaratOption, WeightUnitOption, PriceUnitId, KaratId } from '../models/models';

/**
 * Full karat catalogue (kept for conversion utilities and unit tests).
 */
export const KARATS: readonly KaratOption[] = [
  { id: '24K', bn: '২৪ ক্যারেট', factor: 24 / 24, editable: false },
  { id: '22K', bn: '২২ ক্যারেট', factor: 22 / 24, editable: false },
  { id: '21K', bn: '২১ ক্যারেট', factor: 21 / 24, editable: false },
  { id: '18K', bn: '১৮ ক্যারেট', factor: 18 / 24, editable: false },
  {
    id: 'traditional',
    bn: 'সনাতন',
    factor: 0.8,
    editable: true,
    approximate: true,
  },
] as const;

/** Official BAJUS gold categories published on bajus.org/gold-price. */
export const BAJUS_KARATS: readonly {
  id: KaratId;
  en: string;
  bn: string;
  descKey: string;
}[] = [
  { id: '22K', en: '22K Gold', bn: '২২ ক্যারেট', descKey: 'bajus.hallmarked' },
  { id: '21K', en: '21K Gold', bn: '২১ ক্যারেট', descKey: 'bajus.hallmarked' },
  { id: '18K', en: '18K Gold', bn: '১৮ ক্যারেট', descKey: 'bajus.hallmarked' },
  { id: 'traditional', en: 'Traditional', bn: 'সনাতন', descKey: 'bajus.traditional_desc' },
] as const;

export function karatFactor(id: KaratId, traditionalPurity = 0.8): number {
  const found = KARATS.find((k) => k.id === id);
  if (!found) {
    throw new Error(`Unknown karat: ${id}`);
  }
  return id === 'traditional' ? traditionalPurity : found.factor;
}

export function karatLabel(id: KaratId): string {
  const found = KARATS.find((k) => k.id === id);
  return found ? found.id : id;
}

/**
 * Weight units used in Bangladesh.
 * 1 vori (ভরি) = 11.664 g = 16 ana = 96 roti = 960 point.
 * 1 ana     = 11.664 / 16  = 0.729 g
 * 1 roti    = 11.664 / 96  = 0.1215 g
 * 1 point   = 11.664 / 960 = 0.01215 g
 */
export const GRAMS_PER_VORI = 11.664;
export const GRAMS_PER_TROY_OUNCE = 31.1035;

export const WEIGHT_UNITS: readonly WeightUnitOption[] = [
  { id: 'vori', gramsPerUnit: GRAMS_PER_VORI, bn: 'ভরি' },
  { id: 'ana', gramsPerUnit: GRAMS_PER_VORI / 16, bn: 'আনা' },
  { id: 'roti', gramsPerUnit: GRAMS_PER_VORI / 96, bn: 'রতি' },
  { id: 'point', gramsPerUnit: GRAMS_PER_VORI / 960, bn: 'পয়েন্ট' },
  { id: 'gram', gramsPerUnit: 1, bn: 'গ্রাম' },
] as const;

export const PRICE_UNITS: readonly { id: PriceUnitId; grams: number; bn: string; en: string }[] = [
  { id: 'vori', grams: GRAMS_PER_VORI, bn: 'ভরি', en: 'vori' },
  { id: 'gram', grams: 1, bn: 'গ্রাম', en: 'gram' },
  { id: 'ounce', grams: GRAMS_PER_TROY_OUNCE, bn: 'আউন্স', en: 'ounce' },
] as const;

/** Bangladesh-standard BAJUS price display units. */
export const BAJUS_PRICE_UNITS: readonly { id: PriceUnitId; grams: number; bn: string; en: string }[] = [
  { id: 'vori', grams: GRAMS_PER_VORI, bn: 'ভরি', en: 'Vori' },
  { id: 'gram', grams: 1, bn: 'গ্রাম', en: 'Gram' },
  { id: 'ana', grams: GRAMS_PER_VORI / 16, bn: 'আনা', en: 'Ana' },
  { id: 'roti', grams: GRAMS_PER_VORI / 96, bn: 'রতি', en: 'Roti' },
] as const;

export function unitGrams(id: PriceUnitId): number {
  const found =
    BAJUS_PRICE_UNITS.find((u) => u.id === id) ?? PRICE_UNITS.find((u) => u.id === id);
  return found ? found.grams : GRAMS_PER_VORI;
}
