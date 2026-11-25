# Gold Tracker — Bangladesh (BDT, ৳)

A frontend-only gold price tracker for Bangladesh. Shows the international
**spot** price of gold (XAU/USD) converted to Bangladeshi Taka, per vori, gram
and ounce, for 24K / 22K / 21K / 18K and an editable "Traditional" purity.

> **This is the spot price, not the BAJUS retail rate.** The BAJUS rate includes
> duty, VAT and making charges. Use the *Local market premium* and *BAJUS
> override* in Settings to compare. Not financial advice.

Built with **Angular 22** (standalone components, signals, new `@if/@for`
control flow), **Tailwind CSS v4**, and **Chart.js** via ng2-charts. Strict
TypeScript. No backend — all data comes from free public APIs called directly
from the browser.

---

## Setup

```bash
npm install
npm start          # ng serve, http://localhost:4200
```

### Build & test

```bash
npm run build      # ng build --configuration production  →  dist/gold-tracker
npm test           # Vitest, headless, watch=false
```

Requires Node 20+ (developed on Node 24).

---

## Data sources (all free, no backend)

| Purpose | Endpoint | Key | CORS |
| --- | --- | --- | --- |
| Gold spot XAU/USD (primary) | `https://api.gold-api.com/price/XAU` | none | `*` |
| Gold spot XAU/USD (fallback) | `https://www.goldapi.io/api/XAU/USD` | `x-access-token` header | `*` |
| Exchange rate USD→BDT | `https://open.er-api.com/v6/latest/USD` | none | `*` |

The two keyless endpoints are verified to allow browser calls (`access-control-allow-origin: *`).
The fallback provider is **skipped silently** when no key is set.

### Adding a GoldAPI.io key (optional)

The fallback gold provider needs a key. You can add one in two ways:

1. **In the app** — Settings → *GoldAPI.io key (optional)*. Stored in
   `localStorage` only, never sent anywhere except goldapi.io. **Reload the
   app** after changing it — the key is read from `environment.ts` at startup.
2. **At build time** — edit `src/environments/environment.ts` and set
   `goldApiIoKey: 'your-key'`. This bakes the key into the bundle (use only for
   personal deployments; do not commit a real key to a public repo).

Get a free key at <https://www.goldapi.io/> (free tier: ~500 requests/month).

---

## How the calculation works

All conversion logic lives in `src/app/core/utils/gold-conversion.util.ts` and
is unit-tested.

```
1 troy ounce = 31.1035 g          1 vori (ভরি) = 11.664 g
1 vori = 16 ana = 96 roti = 960 point

BDT per gram (24K) = (XAU_USD ÷ 31.1035) × USD_BDT
BDT per gram (K)   = BDT per gram (24K) × (K ÷ 24)
BDT per vori       = BDT per gram × 11.664
BDT per 10 g       = BDT per gram × 10
BDT per ounce      = XAU_USD × USD_BDT          (= per-gram-24K × 31.1035)
```

Karat factors: 24K = 24/24, 22K = 22/24, 21K = 21/24, 18K = 18/24.
"Traditional (সনাতন)" defaults to 0.8 of 24K and is **editable** in Settings
(marked approximate).

### Local market premium & BAJUS override

- **Local market premium %** (Settings) — added to every BDT price uniformly,
  to approximate local retail over spot.
- **BAJUS rate override (৳ per vori)** (Settings) — when set, the dashboard
  shows the override next to the spot-based 24K per-vori price with the
  absolute and percentage difference, plus the disclaimer.

### Caching & history (no backend)

- The last successful gold price and FX rate are cached in `localStorage` with
  timestamps and reused for 15 minutes.
- If all providers fail, cached values are shown with an "Offline / stale data"
  badge and the data age.
- A price snapshot (timestamp, XAU_USD, USD_BDT, BDT/g 24K) is saved at most
  once per 30 minutes, keeping the last 90 days. It powers the history chart and
  the 24h / 7d / 30d change. If there isn't enough history yet, the UI shows
  "Collecting history" instead of fake data.
- Export history as CSV, or clear it, from the History page or Settings.

### Refresh policy

- Auto-refresh runs on an RxJS timer at the chosen interval (15 / 30 / 60 min),
  but **only while the tab is visible** (Page Visibility API pauses it when
  hidden). Returning to a stale tab triggers a refresh.
- Manual refresh enforces a 60-second minimum between presses.

---

## Architecture

```
src/app/
  core/
    models/        models.ts (typed API responses, settings, alerts),
                   constants.ts (karats, weight units, price units)
    providers/     GoldApiComProvider, GoldApiIoProvider, ErApiFxProvider
    services/      GoldPriceService, FxService (provider fallback),
                   PriceStore (fetch + cache + history + refresh, signals),
                   HistoryService, AlertsService, SettingsService,
                   ThemeService, I18nService
    utils/         gold-conversion.util.ts (pure, tested),
                   cache.util.ts (pure, tested),
                   provider-fallback.util.ts (pure, tested)
    interceptors/  timeout.interceptor.ts (8s timeout, 1 retry on 5xx)
  features/        dashboard, calculator, history, alerts, settings
  shared/pipes/    bdt.pipe.ts (৳, South Asian grouping, Bengali digits)
  app.config.ts    provideHttpClient(withFetch, withInterceptors([timeout])),
                   provideRouter with input binding + scrolling
  app.routes.ts    lazy-loaded feature routes
src/environments/  environment.ts (API URLs + optional key + policy constants)
```

State is held in a single `PriceStore` service using Angular **signals**;
derived prices are `computed()`. The `bdt` pipe formats ৳ with South Asian
grouping (`1,23,456.78`) and optional Bengali digits (`১,২৩,৪৫৬.৭৮`).

### Unit tests (Vitest)

```
gold-conversion.util.spec.ts   35 tests  (conversion, karat factors, ana/roti/point, calculator, reverse)
cache.util.spec.ts             13 tests  (cache expiry, snapshot scheduling, retention trim)
provider-fallback.util.spec.ts  6 tests  (first-success, error fallback, skip-disabled, all-fail)
bdt.pipe.spec.ts               13 tests  (grouping, Bengali digits, decimals, edge cases)
                               67 total
```

Run with `npm test`.

---

## Deploy as a static site

`npm run build` produces a fully static bundle in `dist/gold-tracker/browser/`.
Deploy that directory.

### GitHub Pages

GitHub Pages serves from a project subpath (`/your-repo/`), so set `baseHref`:

```bash
ng build --configuration production --base-href "/your-repo-name/"
# then copy dist/gold-tracker/browser/ to the gh-pages branch root
```

Or use `angular-cli-ghpages`:
```bash
ng deploy --base-href="/your-repo-name/"
```

### Netlify

- Build command: `npm run build`
- Publish directory: `dist/gold-tracker/browser`
- Add `public/_redirects` (already handled by Angular SPA fallback if missing):
  ```
  /*    /index.html   200
  ```

### Vercel

- Framework preset: Angular
- Build command: `npm run build`
- Output directory: `dist/gold-tracker/browser`
- Vercel auto-detects Angular and adds SPA rewrites. If not, add
  `vercel.json`:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```

For a custom domain (no subpath), build without `--base-href` (the default `/`
is correct).

---

## Known limits

- **Spot vs BAJUS.** This app shows the international spot price converted to
  BDT. The BAJUS (Bangladesh Jewellers Association) retail rate is higher
  because it adds duty, VAT and making charges. The premium/override fields are
  approximations, not the official BAJUS rate.
- **Free API limits.** `open.er-api.com` and `api.gold-api.com` are free and
  keyless but rate-limited and best-effort. `goldapi.io` allows ~500
  requests/month on the free tier. The app caches for 15 minutes and refreshes
  at most every 15 minutes to stay well within limits.
- **Alerts are in-browser only.** They fire while the tab is open; there is no
  background service worker. The UI says so.
- **History is local.** Snapshots live in this browser's `localStorage` and are
  not synced across devices. Clearing browser data clears history.
- **No financial advice.** This is a price-convenience tool.

---

## Tech notes

- Angular 22, standalone components, signals, `@if/@for` control flow, strict TS.
- Tailwind CSS v4 via `@tailwindcss/postcss` (`.postcssrc.json`); dark mode via
  the `class` strategy (`@custom-variant dark`).
- Chart.js via ng2-charts for the history line chart; chart colours recompute
  on theme change.
- Fonts: Fraunces (display), Inter (body), Noto Sans Bengali (Bengali glyphs),
  all loaded with `font-display: swap`. `tabular-nums` on every price.
- Accessibility: visible keyboard focus, semantic HTML, ARIA labels on the chart
  and icon buttons, AA-contrast colours, arrows + `+/−` signs (never colour
  alone) for up/down, `prefers-reduced-motion` respected.
- `ng build --configuration production` passes with no errors or warnings.
  67 unit tests pass. Zero console errors at runtime (verified with a headless
  browser across all routes, light/dark/Bengali).
