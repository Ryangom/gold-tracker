import { Component, computed, inject, signal, effect, OnDestroy, Signal } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartDataset, ChartOptions } from 'chart.js';
import { HistoryService } from '../../core/services/history.service';
import { I18nService } from '../../core/services/i18n.service';
import { SettingsService } from '../../core/services/settings.service';
import { ThemeService } from '../../core/services/theme.service';
import { PriceSnapshot } from '../../core/models/models';
import { GRAMS_PER_VORI } from '../../core/models/constants';

type Range = '24h' | '7d' | '30d' | 'all';

@Component({
  selector: 'app-history',
  imports: [BaseChartDirective],
  templateUrl: './history.html',
})
export class History implements OnDestroy {
  private history = inject(HistoryService);
  private i18n = inject(I18nService);
  private settings = inject(SettingsService);
  private theme = inject(ThemeService);

  readonly range = signal<Range>('7d');
  // Re-render trigger: bump when history changes (refresh writes new snapshots).
  private readonly tick = signal(0);

  private intervalId = window.setInterval(() => this.tick.update((n) => n + 1), 60_000);

  constructor() {
    // Also bump when the language changes so labels update.
    effect(() => {
      this.i18n.lang();
      this.tick.update((n) => n + 1);
    });
  }

  ngOnDestroy(): void {
    window.clearInterval(this.intervalId);
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  readonly ranges: { id: Range; labelKey: string }[] = [
    { id: '24h', labelKey: 'chart.range.24h' },
    { id: '7d', labelKey: 'chart.range.7d' },
    { id: '30d', labelKey: 'chart.range.30d' },
    { id: 'all', labelKey: 'chart.range.all' },
  ];

  setRange(r: Range): void {
    this.range.set(r);
  }

  /** Snapshots filtered by the active range. */
  private readonly filtered = computed<PriceSnapshot[]>(() => {
    // read tick + range so we recompute periodically
    this.tick();
    const r = this.range();
    const ms = r === '24h' ? 24 * 3600_000 : r === '7d' ? 7 * 86_400_000 : r === '30d' ? 30 * 86_400_000 : Number.POSITIVE_INFINITY;
    return this.history.within(ms);
  });

  readonly isEmpty = computed(() => this.filtered().length < 2);

  private readonly isDark = computed(() => {
    // depend on theme + system via ThemeService is implicit; we read the class.
    this.tick();
    return document.documentElement.classList.contains('dark');
  });

  readonly data: Signal<ChartData<'line'>> = computed<ChartData<'line'>>(() => {
    this.tick();
    const snaps = this.filtered();
    const labels = snaps.map((s) => this.formatLabel(s.ts));
    const values = snaps.map((s) => {
      const vori =
        s.bdtPerVori22k ??
        (s.bdtPerGram22k ? s.bdtPerGram22k * GRAMS_PER_VORI : s.bdtPerGram24k * GRAMS_PER_VORI);
      return Number(vori.toFixed(2));
    });
    const dark = this.isDark();
    const dataset: ChartDataset<'line'> = {
      label: this.i18n.t('chart.title'),
      data: values,
      borderColor: dark ? '#f59e0b' : '#d97706',
      backgroundColor: dark ? 'rgba(245,158,11,0.12)' : 'rgba(217,119,6,0.1)',
      borderWidth: 2,
      pointRadius: snaps.length > 60 ? 0 : 2.5,
      pointHoverRadius: 4.5,
      tension: 0.2,
      fill: true,
    };
    return { labels, datasets: [dataset] };
  });

  readonly options: Signal<ChartOptions<'line'>> = computed<ChartOptions<'line'>>(() => {
    this.tick();
    const dark = this.isDark();
    const tickColor = dark ? '#a1a1aa' : '#64748b';
    const gridColor = dark ? '#27272a' : '#e2e8f0';
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: dark ? '#18181b' : '#0f172a',
          titleColor: '#fafafa',
          bodyColor: '#f59e0b',
          displayColors: false,
          callbacks: {
            label: (ctx) => `৳ ${(ctx.parsed.y ?? 0).toLocaleString('en-IN')}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
          grid: { color: gridColor },
        },
        y: {
          ticks: { color: tickColor, callback: (v) => `৳${v}` },
          grid: { color: gridColor },
        },
      },
    };
  });

  readonly chartType: 'line' = 'line';

  exportCsv(): void {
    const csv = this.history.toCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gold-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  clearHistory(): void {
    if (confirm(this.i18n.lang() === 'bn' ? 'ইতিহাস মুছবেন?' : 'Clear all history?')) {
      this.history.clear();
      this.tick.update((n) => n + 1);
    }
  }

  private formatLabel(iso: string): string {
    const d = new Date(iso);
    const locale = this.i18n.lang() === 'bn' ? 'bn-BD' : 'en-GB';
    try {
      const r = this.range();
      if (r === '24h') {
        return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
      }
      return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(d);
    } catch {
      return d.toLocaleDateString();
    }
  }
}
