/** A persisted history snapshot, saved at most once per 30 minutes. */
export interface PriceSnapshot {
  /** ISO timestamp string. */
  ts: string;
  /** Legacy fields kept optional for backwards-compatible snapshots/tests. */
  xauUsd?: number;
  usdBdt?: number;
  bdtPerGram24k: number;
  /** BAJUS 22K per-gram and per-vori rates in BDT at snapshot time. */
  bdtPerGram22k?: number;
  bdtPerVori22k?: number;
}

/** Karat options offered in the UI. */
export type KaratId = '24K' | '22K' | '21K' | '18K' | 'traditional';

export interface KaratOption {
  id: KaratId;
  /** Bengali label. */
  bn: string;
  /** Purity as a fraction of 24 (e.g. 22/24). For "traditional" this is a default. */
  factor: number;
  /** Whether the purity is user-editable. */
  editable: boolean;
  approximate?: boolean;
}

/** Unit options for the calculator weight input. */
export type WeightUnitId = 'vori' | 'ana' | 'roti' | 'point' | 'gram';

export interface WeightUnitOption {
  id: WeightUnitId;
  /** How many grams one unit equals. */
  gramsPerUnit: number;
  bn: string;
}

/** Unit options for the price display. */
export type PriceUnitId = 'vori' | 'gram' | 'ana' | 'roti' | 'ounce';

/** An in-browser price alert. */
export interface PriceAlert {
  id: string;
  karat: KaratId;
  /** 'above' fires when current price >= target; 'below' when <= target. */
  direction: 'above' | 'below';
  target: number;
  unit: PriceUnitId;
  createdAt: string;
  /** Whether the alert has already fired (so we don't spam). */
  triggered: boolean;
}

export type ThemePref = 'light' | 'dark' | 'system';
export type LangPref = 'en' | 'bn';
export type DigitPref = 'western' | 'bengali';

/** Locally saved BAJUS retail rates (৳ per vori). 0 means unset. */
export interface BajusRates {
  k22: number;
  k21: number;
  k18: number;
  traditional: number;
  updatedAt: string | null;
}

/** User settings, persisted to localStorage. */
export interface Settings {
  lang: LangPref;
  digits: DigitPref;
  theme: ThemePref;
  karat: KaratId;
  priceUnit: PriceUnitId;
  /** Locally saved BAJUS retail rates per vori (22K/21K/18K/Traditional). */
  bajusRates: BajusRates;
  /** Deduction % applied for old gold resale (পুরাতন বিক্রয় মূল্য). Default 15% (85% payout). */
  resaleDeductionPct: number;
  /** Auto-refresh interval in minutes. */
  refreshIntervalMin: 15 | 30 | 60;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en',
  digits: 'western',
  theme: 'system',
  karat: '22K',
  priceUnit: 'vori',
  bajusRates: {
    k22: 0,
    k21: 0,
    k18: 0,
    traditional: 0,
    updatedAt: null,
  },
  resaleDeductionPct: 15,
  refreshIntervalMin: 15,
};
