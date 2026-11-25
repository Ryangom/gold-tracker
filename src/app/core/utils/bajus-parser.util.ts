import { GRAMS_PER_VORI } from '../models/constants';

export interface LiveBajusQuote {
  perGram: {
    k22: number;
    k21: number;
    k18: number;
    traditional: number;
  };
  perVori: {
    k22: number;
    k21: number;
    k18: number;
    traditional: number;
  };
  fetchedAt: string;
  noticePdfUrl: string | null;
}

const GOLD_ROWS: { key: keyof LiveBajusQuote['perGram']; label: string }[] = [
  { key: 'k22', label: '22 KARAT Gold' },
  { key: 'k21', label: '21 KARAT Gold' },
  { key: 'k18', label: '18 KARAT Gold' },
  { key: 'traditional', label: 'TRADITIONAL Gold' },
];

/**
 * Parse official BAJUS gold prices (BDT/GRAM) from https://www.bajus.org/gold-price HTML
 * and convert to per-vori using GRAMS_PER_VORI (11.664g).
 */
export function parseBajusGoldHtml(
  html: string,
  fetchedAt: string = new Date().toISOString(),
): LiveBajusQuote {
  if (!html || typeof html !== 'string') {
    throw new Error('BAJUS returned empty HTML');
  }

  // Narrow to the gold-table block when present so silver prices can't match.
  const goldStart = html.indexOf('gold-table');
  const silverStart = html.indexOf('silver-table');
  const section =
    goldStart >= 0
      ? html.slice(goldStart, silverStart > goldStart ? silverStart : undefined)
      : html;

  const perGram = { k22: 0, k21: 0, k18: 0, traditional: 0 };

  for (const row of GOLD_ROWS) {
    const escaped = row.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `${escaped}[\\s\\S]*?<span[^>]*class=["'][^"']*price[^"']*["'][^>]*>([\\d,]+(?:\\.\\d+)?)\\s*BDT\\/GRAM`,
      'i',
    );
    const m = section.match(re);
    const val = m ? Number(m[1].replace(/,/g, '')) : NaN;
    if (!Number.isFinite(val) || val <= 0) {
      throw new Error(`Could not parse BAJUS ${row.label} price`);
    }
    perGram[row.key] = val;
  }

  const pdfMatch = html.match(/href=["'](https:\/\/www\.bajus\.org\/storage\/[^"']+\.pdf)["']/i);

  return {
    perGram,
    perVori: {
      k22: perGram.k22 * GRAMS_PER_VORI,
      k21: perGram.k21 * GRAMS_PER_VORI,
      k18: perGram.k18 * GRAMS_PER_VORI,
      traditional: perGram.traditional * GRAMS_PER_VORI,
    },
    fetchedAt,
    noticePdfUrl: pdfMatch ? pdfMatch[1] : null,
  };
}
