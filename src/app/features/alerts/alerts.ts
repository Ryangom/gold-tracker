import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertsService } from '../../core/services/alerts.service';
import { PriceStore } from '../../core/services/price-store.service';
import { I18nService } from '../../core/services/i18n.service';
import { BdtPipe } from '../../shared/pipes/bdt.pipe';
import { BAJUS_KARATS, BAJUS_PRICE_UNITS } from '../../core/models/constants';
import { KaratId, PriceUnitId } from '../../core/models/models';

@Component({
  selector: 'app-alerts',
  imports: [FormsModule, BdtPipe],
  templateUrl: './alerts.html',
})
export class Alerts implements OnInit {
  private alertsSvc = inject(AlertsService);
  private store = inject(PriceStore);
  private i18n = inject(I18nService);

  readonly karats = BAJUS_KARATS;
  readonly units = BAJUS_PRICE_UNITS;

  readonly alerts = this.alertsSvc.alerts;

  readonly newKarat = signal<KaratId>('22K');
  readonly newDirection = signal<'above' | 'below'>('above');
  readonly newTarget = signal<number>(0);
  readonly newUnit = signal<PriceUnitId>('vori');

  readonly notifPermission = signal<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );

  ngOnInit(): void {}

  t(key: string): string {
    return this.i18n.t(key);
  }

  karatLabel(id: KaratId): string {
    if (id === 'traditional') {
      return this.i18n.lang() === 'bn' ? 'সনাতন' : 'Traditional';
    }
    return id;
  }

  unitLabel(id: PriceUnitId): string {
    const found = BAJUS_PRICE_UNITS.find((u) => u.id === id);
    return found ? (this.i18n.lang() === 'bn' ? found.bn : found.en) : id;
  }

  /** Live BAJUS price for the chosen karat/unit. */
  currentPrice(karat: KaratId, unit: PriceUnitId): number {
    return this.store.priceFor(karat, unit);
  }

  addAlert(): void {
    const target = this.newTarget();
    if (!isFinite(target) || target <= 0) {
      return;
    }
    this.alertsSvc.add({
      karat: this.newKarat(),
      direction: this.newDirection(),
      target,
      unit: this.newUnit(),
    });
    this.newTarget.set(0);
  }

  removeAlert(id: string): void {
    this.alertsSvc.remove(id);
  }

  async requestNotifPermission(): Promise<void> {
    if (typeof Notification === 'undefined') {
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      this.notifPermission.set(perm);
    } catch {
      /* noop */
    }
  }

  permLabel(): string {
    const p = this.notifPermission();
    if (p === 'granted') {
      return this.t('alert.granted');
    }
    if (p === 'denied') {
      return this.t('alert.denied');
    }
    return this.t('alert.request_perm');
  }
}
