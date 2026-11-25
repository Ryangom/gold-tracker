import { describe, it, expect } from 'vitest';
import { parseBajusGoldHtml } from './bajus-parser.util';

const SAMPLE_HTML = `
<section class="report-page gold-rate-page my-5">
  <div class="report-page-title mb-4">
    Gold And Silver Rate
    <a href="https://www.bajus.org/storage/files/shares/Gold Price/25-Nov-2026.pdf" target="_blank">View In PDF</a>
  </div>
  <table class="table table-bordered table-striped gold-table">
    <tbody>
      <tr>
        <th><h6>22 KARAT Gold</h6></th>
        <td><p>CADMIUM (HALLMARKED GOLD)</p></td>
        <td><span class="price">16,875 BDT/GRAM</span></td>
      </tr>
      <tr>
        <th><h6>21 KARAT Gold</h6></th>
        <td><p>CADMIUM (HALLMARKED GOLD)</p></td>
        <td><span class="price">16,120 BDT/GRAM</span></td>
      </tr>
      <tr>
        <th><h6>18 KARAT Gold</h6></th>
        <td><p>CADMIUM (HALLMARKED GOLD)</p></td>
        <td><span class="price">13,845 BDT/GRAM</span></td>
      </tr>
      <tr>
        <th><h6>TRADITIONAL Gold</h6></th>
        <td><p></p></td>
        <td><span class="price">11,285 BDT/GRAM</span></td>
      </tr>
    </tbody>
  </table>
  <table class="table silver-table">
    <tbody>
      <tr><th><h6>22 KARAT Silver</h6></th><td><span class="price">260 BDT/GRAM</span></td></tr>
    </tbody>
  </table>
</section>`;

describe('parseBajusGoldHtml', () => {
  it('parses all four BAJUS gold rates and converts to exact per-vori values', () => {
    const q = parseBajusGoldHtml(SAMPLE_HTML, '2026-11-25T09:00:00.000Z');
    expect(q.perGram).toEqual({
      k22: 16875,
      k21: 16120,
      k18: 13845,
      traditional: 11285,
    });
    expect(q.perVori.k22).toBeCloseTo(196830, 2);
    expect(q.perVori.k21).toBeCloseTo(188023.68, 2);
    expect(q.perVori.k18).toBeCloseTo(161488.08, 2);
    expect(q.perVori.traditional).toBeCloseTo(131628.24, 2);
    expect(q.fetchedAt).toBe('2026-11-25T09:00:00.000Z');
    expect(q.noticePdfUrl).toBe(
      'https://www.bajus.org/storage/files/shares/Gold Price/25-Nov-2026.pdf',
    );
  });

  it('throws when HTML is empty or missing a karat rate', () => {
    expect(() => parseBajusGoldHtml('')).toThrow();
    expect(() => parseBajusGoldHtml('<div>22 KARAT Gold 16,875</div>')).toThrow();
  });
});
