import { Pipe, PipeTransform, inject, Injectable } from '@angular/core';
import { SettingsService } from '../../core/services/settings.service';

/**
 * Format a number as Bangladeshi Taka.
 *
 *   - Symbol: ৳ (always, in both languages)
 *   - Grouping: South Asian (1,23,456.78) — the Indian/Bengali lakh system,
 *     not the Western (123,456.78). This is what people expect for BDT.
 *   - Digits: Western (0-9) or Bengali (০-৯) per settings.
 *   - Decimals: 2 for prices by default; the `fractionDigits` arg overrides.
 *   - tabular-nums is applied by the consumer via the `.tnum` utility.
 *
 * Pure over the value + current settings (the pipe reads the settings signal,
 * so it re-evaluates when the digit preference changes).
 *
 * Also marked `@Injectable({ providedIn: 'root' })` so components can `inject()`
 * it for imperative formatting (e.g. the change pill strips the ৳ prefix).
 */
@Injectable({ providedIn: 'root' })
@Pipe({ name: 'bdt', standalone: true })
export class BdtPipe implements PipeTransform {
  private settings = inject(SettingsService);

  transform(value: number | null | undefined, fractionDigits = 2): string {
    if (value == null || !isFinite(value)) {
      return '৳—';
    }
    const neg = value < 0;
    const grouped = this.groupSouthAsian(Math.abs(value), fractionDigits);
    const digits = this.settings.digits();
    const out = digits === 'bengali' ? this.toBengaliDigits(grouped) : grouped;
    return neg ? `-৳${out}` : `৳${out}`;
  }

  /**
   * South-Asian digit grouping. The first group after the decimal point is 3
   * digits, then groups of 2 going leftward: 12,34,567.89. Negatives handled.
   * Pure string math — no locale dependency.
   */
  groupSouthAsian(n: number, fractionDigits: number): string {
    const neg = n < 0;
    const abs = Math.abs(n);
    const fixed = abs.toFixed(fractionDigits);
    const [intPart, fracPart] = fixed.split('.');
    let grouped: string;
    if (intPart.length <= 3) {
      grouped = intPart;
    } else {
      const head = intPart.slice(0, intPart.length - 3);
      const tail = intPart.slice(intPart.length - 3);
      // head grouped in pairs from the right
      const headGrouped = head.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      grouped = `${headGrouped},${tail}`;
    }
    const out = fracPart != null && fractionDigits > 0 ? `${grouped}.${fracPart}` : grouped;
    return neg ? `-${out}` : out;
  }

  toBengaliDigits(s: string): string {
    const map: Record<string, string> = {
      '0': '০',
      '1': '১',
      '2': '২',
      '3': '৩',
      '4': '৪',
      '5': '৫',
      '6': '৬',
      '7': '৭',
      '8': '৮',
      '9': '৯',
    };
    return s.replace(/[0-9]/g, (d) => map[d] ?? d);
  }
}
