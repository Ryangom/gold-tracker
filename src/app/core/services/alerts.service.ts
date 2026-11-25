import { Injectable, signal, computed, inject } from '@angular/core';
import { PriceAlert } from '../models/models';
import { StorageService, CACHE_KEYS } from '../utils/cache.util';

/**
 * In-browser price alerts. Persisted to localStorage. The PriceStore checks
 * each alert on every refresh; matched alerts flip `triggered` and (if granted)
 * raise a browser Notification. Alerts only fire while the tab is open — the UI
 * says so honestly.
 */
@Injectable({ providedIn: 'root' })
export class AlertsService {
  private readonly storage = inject(StorageService);

  private readonly _alerts = signal<PriceAlert[]>(this.load());

  readonly alerts = this._alerts.asReadonly();
  readonly hasActive = computed(() => this._alerts().some((a) => !a.triggered));

  private load(): PriceAlert[] {
    const list = this.storage.read<PriceAlert[]>(CACHE_KEYS.alerts, []);
    return Array.isArray(list) ? list : [];
  }

  private persist(list: PriceAlert[]): void {
    this._alerts.set(list);
    this.storage.write(CACHE_KEYS.alerts, list);
  }

  add(alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>): void {
    const next: PriceAlert = {
      ...alert,
      id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      triggered: false,
    };
    this.persist([this._alerts(), next].flat());
  }

  remove(id: string): void {
    this.persist(this._alerts().filter((a) => a.id !== id));
  }

  clearTriggered(): void {
    this.persist(this._alerts().filter((a) => !a.triggered));
  }

  /**
   * Check alerts against a current price map { karat -> BDT per unit }.
   * Returns the alerts that matched. Marks them triggered and persists.
   * Raises a browser Notification if permission is granted.
   */
  check(
    prices: { karat: PriceAlert['karat']; unit: PriceAlert['unit']; bdt: number }[],
  ): PriceAlert[] {
    const matched: PriceAlert[] = [];
    const list = this._alerts();
    let changed = false;
    const next = list.map((a) => {
      if (a.triggered) {
        return a;
      }
      const p = prices.find((pr) => pr.karat === a.karat && pr.unit === a.unit);
      if (!p) {
        return a;
      }
      const hit = a.direction === 'above' ? p.bdt >= a.target : p.bdt <= a.target;
      if (hit) {
        changed = true;
        matched.push(a);
        this.notify(a, p.bdt);
        return { ...a, triggered: true };
      }
      return a;
    });
    if (changed) {
      this.persist(next);
    }
    return matched;
  }

  private notify(a: PriceAlert, current: number): void {
    try {
      if (typeof Notification === 'undefined') {
        return;
      }
      if (Notification.permission !== 'granted') {
        return;
      }
      const dir = a.direction === 'above' ? 'reached' : 'dropped to';
      new Notification('Gold price alert', {
        body: `${a.karat} (${a.unit}) ${dir} ৳${current.toFixed(2)} — target was ৳${a.target.toFixed(2)}.`,
        // silent text icon; no image required
      });
    } catch {
      /* notifications can fail; ignore */
    }
  }
}
