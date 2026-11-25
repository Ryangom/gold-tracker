import { Injectable, effect } from '@angular/core';
import { SettingsService } from './settings.service';

/**
 * Applies the chosen theme to <html> by toggling the `.dark` class. Handles
 * 'system' by listening to `prefers-color-scheme`, and updates the browser
 * chrome colour via the theme-color meta. Re-runs whenever settings change.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private media?: MediaQueryList;
  private mediaListener?: (e: MediaQueryListEvent) => void;

  constructor(private settings: SettingsService) {
    // Re-apply whenever the theme preference changes.
    effect(() => {
      this.apply(this.settings.theme());
    });
  }

  private apply(pref: 'light' | 'dark' | 'system'): void {
    const root = document.documentElement;
    const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const isDark = pref === 'dark' || (pref === 'system' && systemDark);
    root.classList.toggle('dark', isDark);

    // Keep the media query listener in sync with the preference.
    if (this.media && this.mediaListener) {
      this.media.removeEventListener('change', this.mediaListener);
      this.media = undefined;
      this.mediaListener = undefined;
    }
    if (pref === 'system' && window.matchMedia) {
      this.media = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaListener = () => this.apply('system');
      this.media.addEventListener('change', this.mediaListener);
    }

    // Update theme-color metas for mobile browser chrome.
    const color = isDark ? '#09090b' : '#f8fafc';
    document.querySelectorAll('meta[name="theme-color"]').forEach((el) => {
      el.setAttribute('content', color);
    });
  }
}
