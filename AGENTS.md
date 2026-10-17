# AGENTS.md — Instagram Analytics (SWA · Small World Analytics)

> **AI/human orientation.** This file says what the app is and **exactly which
> file to edit for a given change**. For features, usage and API setup, read
> [`README.md`](./README.md).

## What this is

A local-only desktop (Electron) + browser analytics app for Instagram accounts.
It scans a profile's **entire post history**, computes engagement/growth/audience
metrics from the real values the source APIs expose, and gives advice that quotes
the measurement it came from. No accounts, no server, no telemetry — data lives in
`localStorage` and the app's user-data folder.

**Stack:** vanilla JS (no framework, no build step for the renderer), Electron,
Chart.js + GSAP from `node_modules/`. The renderer is plain `<script>` tags in
`index.html` in a fixed order — there is no bundler, so **load order matters**.

## How it loads (read this before editing)

`index.html` includes, in order: `boot-diagnostics.js` → `app.js` → `post-analysis.js`
→ `utils.js` → `scraping.js` → `metrics.js` → `charts.js` → `ui.js` →
`project-inventory.js` → `instagram-auth.js` → `storage.js` → `error-handling.js` →
`animations.js` → `context-menu.js`. Each module does `const P = InstagramAnalytics.prototype;` and
attaches methods. `app.js` defines the class and a `_verifyMethods()` guard that
warns (and logs) if any expected method is missing — if you add a method other
modules call, it does not need to be in that list, but a missing one is surfaced.

## Where to edit

| I want to change… | Edit |
|---|---|
| App class, boot, toasts, profile fetch flow | `app.js` |
| Boot-time error capture + module-load verification | `boot-diagnostics.js` |
| Runtime error handling / `logError` / known-error hints | `error-handling.js` |
| Scraping profiles & posts, all source strategies, IPC scan driver | `scraping.js` |
| Full-history pagination core (cursors, retries, dedupe, coverage) | `history-scan.js` |
| Metrics, analysis, **fake-follower estimate**, marketing advice | `metrics.js` |
| Charts (Chart.js) | `charts.js` |
| DOM rendering: pages, post grid, dashboard, profile header, **data-freshness strip** | `ui.js` |
| Per-post analysis (the "Comprehensive Analysis" panel) | `post-analysis.js` |
| Projects tab: field guide, inventory, analytics, data double-check, exports | `project-inventory.js` |
| localStorage persistence, history, build log, unfollow history, **scan snapshots** | `storage.js` |
| Instagram login / session / unfollow | `instagram-auth.js` |
| Intro overlay, entrance/scroll animations, particles | `animations.js` |
| Right-click context menus and metric tooltips | `context-menu.js` |
| Electron main process, window, IPC (`scrape-instagram-profile`) | `main.js` |
| Markup / DOM ids / script order | `index.html` |
| **Online (browser) preview** — notice, saved-scan bootstrap, honest scan refusal, scan-file import | `web-preview.js` |
| Building the shareable static site / which real scan it bundles | `build-web.js` |
| Serving the built preview locally | `serve-web.js` |
| Publishing the preview to a public URL (and proving it) | `deploy-web.js` (`npm run deploy:web`), documented in README §Online preview |
| Chrome/Edge discovery for the build + web test | `web-tools.js` |
| Checking a DEPLOYED copy against this build (`test_web_smoke.js --url <base>`) | `test_web_smoke.js` |

## Data-honesty rules (do not break these)

1. **Never fabricate a number.** If a value is unknown, show an explicit
   placeholder (`—`) and, where possible, state which field/API would provide it.
   Tests assert this (`test_real_data_suggestions.js`, `test_metrics_determinism.js`).
2. **Estimates are labelled.** Modelled signals (e.g. the fake-follower detector,
   per-post "est" metrics) must be tagged as estimates and never mixed with
   measured values. See the `src` / `📊 Est.` tagging in `metrics.js`.
3. **Coverage is always stated.** A scan reports *how much of the account it saw*
   (`coverage` in `history-scan.js`) and a partial/capped walk is labelled, never
   passed off as full history. `scanFullHistory()` + `coverageLabel()` + `renderDataQualityBanner()`.
4. **No simulated actions.** Unfollow requires real account IDs and a connected
   session; it must never move the estimated counts or invent IDs
   (`instagram-auth.js`, guarded by `test_no_fake_unfollow.js`).
5. **Determinism.** Metric computation contains no `Math.random` — the same input
   must produce the same output every run.
6. **The newest scan is always kept, and always dated.** Every scan writes its
   results to a per-account snapshot (`saveScanSnapshot()` in `storage.js`, plus
   a disk checkpoint from `main.js`), which MERGES rather than replaces, so a
   throttled 24-post peek cannot wipe a 600-post walk. The screen states whether
   it is showing live or saved data and **the age shown is the age of the data**, 
   not of the file write (`_scanFreshness()` / `renderScanFreshness()` in `ui.js`,
   guarded by `test_scan_snapshot.js`).

## Error logging

`boot-diagnostics.js` captures failures during module load (before the app's own
handlers exist) and records a boot report — duration, failed steps, missing
modules — shown on the **Error Log** page as *Boot status*. `error-handling.js`
handles runtime errors: severity-classified, de-duplicated with a repeat counter,
stack traces kept, library noise suppressed **with a visible count** so a quiet log
can't hide a problem. Missing fonts/images are tracked separately as asset failures.

## The online preview (`web/`)

`npm run build:web` copies this renderer into a static site in `web/` so a link can
be sent to testers; `web-preview.js` (loaded from `index.html` right before
`app.js`) is what makes that safe:

- it **returns immediately inside Electron** — the desktop app is untouched;
- it switches auto-fetch off *before* boot reads settings (it registers its
  `DOMContentLoaded` hook before `app.js` does), so a browser page never tries a
  scan it cannot do;
- it loads the bundled **real** scan and patches the scan methods to explain,
  rather than fail, that scanning needs the desktop app;
- it widens `importData` to every scan shape the app can produce.

Rules that must not break: the preview never fabricates a value (a partial walk
stays labelled partial, unknowns stay `—`, and the notice names where the profile
counts came from), and `web/` is generated output (git-ignored) — edit the sources,
not the copy.

## Tests

```bash
npm test          # pagination, scan orchestration, saved-scan snapshots, project inventory, real-data advice, error logging, determinism, unfollow honesty
npm run test:boot # launches the real index.html in Electron and asserts a clean boot
npm run test:web  # builds web/ and loads it in a real browser (Chrome/Edge) to prove the shared preview works
npm run gen:inventory # rewrites SmallWorld-Project-Inventory.xlsx from project-inventory.js
```

## Known hazard

`dist_new/` is a **stale extracted build (v1.1.6)** whose `extracted_app/app.js`
still contains the old `Math.random`-based metric code. It is not loaded by the
app and is untracked, but running it would show fabricated values. Do not use it;
delete it when convenient.
