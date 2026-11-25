import { Component, computed, inject, signal } from '@angular/core';
import { PriceStore } from '../../core/services/price-store.service';
import { SettingsService } from '../../core/services/settings.service';
import { I18nService } from '../../core/services/i18n.service';
import { BdtPipe } from '../../shared/pipes/bdt.pipe';
import { BAJUS_KARATS, GRAMS_PER_VORI, WEIGHT_UNITS } from '../../core/models/constants';
import { KaratId, WeightUnitId } from '../../core/models/models';
import { resalePrice, weightToGrams } from '../../core/utils/gold-conversion.util';

@Component({
  selector: 'app-calculator',
  imports: [BdtPipe],
  templateUrl: './calculator.html',
})
export class Calculator {
  private store = inject(PriceStore);
  private settings = inject(SettingsService);
  private i18n = inject(I18nService);

  readonly karats = BAJUS_KARATS;
  readonly weightUnits = WEIGHT_UNITS;

  // Forward calculator inputs
  readonly weight = signal<number>(1);
  readonly weightUnit = signal<WeightUnitId>('vori');
  readonly karat = signal<KaratId>(this.settings.karat());
  readonly makingPct = signal<number>(0);
  readonly makingPerGram = signal<number>(0);
  readonly vatPct = signal<number>(5);

  // Reverse calculator inputs
  readonly budget = signal<number>(100000);
  readonly budgetKarat = signal<KaratId>(this.settings.karat());

  readonly hasBajusRates = this.store.hasBajusRates;
  readonly resaleDeductionPct = this.settings.resaleDeductionPct;

  /** Active BAJUS per-gram and per-vori rate for the selected karat. */
  readonly activeRate = computed(() => {
    const k = this.karat();
    const perGram = this.store.perGramForKarat(k);
    const perVori = this.store.priceFor(k, 'vori');
    return { karat: k, perGram, perVori };
  });

  /** Weight converted to grams for the current unit. */
  readonly weightGrams = computed(() => {
    const u = WEIGHT_UNITS.find((w) => w.id === this.weightUnit());
    return u ? weightToGrams(this.weight(), u.gramsPerUnit) : 0;
  });

  readonly forward = computed(() => {
    const perGram = this.store.perGramForKarat(this.karat());
    if (perGram <= 0) {
      return null;
    }
    const grams = this.weightGrams();
    const metalValue = perGram * grams;
    const makingCharge = metalValue * (this.makingPct() / 100) + this.makingPerGram() * grams;
    const subtotal = metalValue + makingCharge;
    const vat = subtotal * (this.vatPct() / 100);
    const total = subtotal + vat;
    const resale = resalePrice(metalValue, this.resaleDeductionPct());
    return { metalValue, makingCharge, subtotal, vat, total, resale };
  });

  readonly reverse = computed(() => {
    const perGram = this.store.perGramForKarat(this.budgetKarat());
    if (perGram <= 0) {
      return null;
    }
    const makingPerGramTotal = this.makingPerGram() + perGram * (this.makingPct() / 100);
    const perGramFinished = (perGram + makingPerGramTotal) * (1 + this.vatPct() / 100);
    if (perGramFinished <= 0) {
      return { grams: 0, vori: 0 };
    }
    const grams = this.budget() / perGramFinished;
    return { grams, vori: grams / GRAMS_PER_VORI };
  });

  t(key: string): string {
    return this.i18n.t(key);
  }

  unitBn(id: WeightUnitId): string {
    const found = WEIGHT_UNITS.find((w) => w.id === id);
    return found ? (this.i18n.lang() === 'bn' ? found.bn : found.id) : id;
  }

  karatLabel(id: KaratId): string {
    if (id === 'traditional') {
      return this.i18n.lang() === 'bn' ? 'সনাতন' : 'Traditional';
    }
    return id;
  }

  setWeight(v: number | string): void {
    this.weight.set(typeof v === 'string' ? parseFloat(v) || 0 : v);
  }
  setWeightUnit(v: WeightUnitId): void {
    this.weightUnit.set(v);
  }
  setKarat(v: KaratId): void {
    this.karat.set(v);
  }
  setMakingPct(v: number | string): void {
    this.makingPct.set(typeof v === 'string' ? parseFloat(v) || 0 : v);
  }
  setMakingPerGram(v: number | string): void {
    this.makingPerGram.set(typeof v === 'string' ? parseFloat(v) || 0 : v);
  }
  setVatPct(v: number | string): void {
    this.vatPct.set(typeof v === 'string' ? parseFloat(v) || 0 : v);
  }
  setBudget(v: number | string): void {
    this.budget.set(typeof v === 'string' ? parseFloat(v) || 0 : v);
  }
  setBudgetKarat(v: KaratId): void {
    this.budgetKarat.set(v);
  }

  gramsDisplay(): string {
    return this.weightGrams().toFixed(4);
  }

  voriDisplay(): string {
    const r = this.reverse();
    return r ? r.vori.toFixed(4) : '—';
  }

  gramsDisplayReverse(): string {
    const r = this.reverse();
    return r ? r.grams.toFixed(4) : '—';
  }
}
