import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { PriceStore } from './core/services/price-store.service';
import { I18nService } from './core/services/i18n.service';
import { SettingsService } from './core/services/settings.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private store = inject(PriceStore);
  private i18n = inject(I18nService);
  private settings = inject(SettingsService);
  private themeSvc = inject(ThemeService);

  readonly status = this.store.status;
  readonly headline = this.store.headline;
  readonly isStale = this.store.isStale;
  readonly error = this.store.error;
  readonly lang = this.settings.lang;
  readonly theme = this.settings.theme;

  readonly isDark = computed(() => {
    const pref = this.theme();
    if (pref === 'dark') {
      return true;
    }
    if (pref === 'light') {
      return false;
    }
    return typeof window !== 'undefined'
      ? window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
      : false;
  });

  readonly refreshing = computed(() => this.status() === 'loading');

  ngOnInit(): void {
    void this.themeSvc;
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  toggleLang(): void {
    this.settings.update({ lang: this.lang() === 'en' ? 'bn' : 'en' });
  }

  toggleTheme(): void {
    this.settings.update({ theme: this.isDark() ? 'light' : 'dark' });
  }

  refresh(): void {
    this.store.refreshNow().subscribe();
  }
}
