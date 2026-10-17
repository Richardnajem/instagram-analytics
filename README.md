# SWA - Small World Analytics

A comprehensive Instagram analytics dashboard for tracking key performance metrics.

## Run it on a new machine

Nothing is installed system-wide and nothing is uploaded anywhere. On a fresh
Windows, macOS or Linux machine with Node 18 or newer:

| Step | Command | Why |
|---|---|---|
| 1. Check Node | `node --version` | Electron 28 needs Node 18+. |
| 2. Install | `npm ci` | Installs exactly the versions in `package-lock.json`, so a second machine gets the same app. |
| 3. Run | `npm start` | Opens the app in its own local window. |
| 4. Prove it booted | `npm run test:boot` | Loads the real `index.html` in Electron and fails loudly if any module did not load. |
| 5. Prove the numbers | `npm test` | Pagination, scan orchestration, saved scans, project inventory, advice, error logging, determinism, unfollow honesty. |

Optional — the Python scan path only: install Python 3 (the app offers to
`pip install instaloader` on first use). Without Python the app still scans
through its other sources and reports what it could not reach.

### Packaging a build to hand to someone else

| Command | Result |
|---|---|
| `npm run pack` | An unpacked build in `dist/win-unpacked/` (fast, best for testing) |
| `npm run dist` | The single portable `.exe` in `dist/`, version bumped |

`Launch App.bat` starts whatever build is in `dist/` and says what to run if
there is none. Packaged builds are deliberately **not** committed: the portable
installer is far larger than GitHub's 100 MB per-file limit.

## Online preview — a link to hand to testers

`npm run build:web` turns the **same** `index.html`, stylesheets and modules into
a plain static site in `web/`, which anyone can open in a browser — no install, no
server runtime, no account. Upload the **contents** of `web/` to any static host
(or drag the folder onto one) and send the URL.

| Command | What it does |
|---|---|
| `npm run build:web` | Assembles `web/` (add `--no-header` to skip the header lookup below) |
| `npm run serve:web` | Serves `web/` on <http://127.0.0.1:4173> so you can check it first |
| `npm run test:web` | Loads `web/` in the Chrome/Edge on this machine and asserts it really works |
| `npm run deploy:web` | Builds, publishes `web/` to Vercel, then **verifies the live URL** and prints it |

`npm run test:web` is the web equivalent of `npm run test:boot`: it boots the
page in a real browser and checks that it comes up with an empty error log, shows
the real coverage, renders every post, draws the charts, refuses scanning
honestly, and can import a tester's own scan file. With no Chrome/Edge installed
it skips with a message instead of reporting a pass it did not earn.

### Put it on a public URL

```bash
npm run build:web    # 1. build web/ and check it locally with `npm run serve:web`
npm run test:web     # 2. prove the built copy works in a real browser
npm run deploy:web   # 3. build, publish, verify the live URL, print it
node test_web_smoke.js --url https://swa-preview-one.vercel.app   # re-check any deployed copy
```

`deploy:web` (`deploy-web.js`) runs the Vercel CLI through `npx` (nothing to install
globally) and
publishes the folder to the `swa-preview` project, so the URL is stable across
deploys: **<https://swa-preview-one.vercel.app>** (the Vercel project also owns
<https://swa-preview-insta-5bc1.vercel.app>; the team-scoped one is not worth
sharing). It logs in on first use — the CLI prints a device URL, you approve it in
the browser once. `web/` stays git-ignored and is uploaded as-is: **no build runs
on the host**, so the deployed bytes are the exact bytes `test:web` just checked.

As its last step `deploy:web` runs `test_web_smoke.js --url <the live URL>`, which
fetches everything the deployment is serving, compares it byte for byte with the
build that was just uploaded, and then runs the full browser suite. A deployment
that went stale, half-uploaded or kept an old file fails **there** rather than in
front of the person you sent the link to (`--no-verify` skips the check).
The `-one` suffix is not a typo: `swa-preview.vercel.app` is already taken by
another Vercel account, and it serves a **different app**, so share the `-one`
link.

Deployment protection has to stay **off** for the link to be shareable:

```bash
npx vercel project protection disable swa-preview --sso
```

Prefer a different host? The build output is plain static files with relative
paths, so the **contents** of `web/` also drop straight onto Netlify, Cloudflare
Pages, GitHub Pages or any static server.

### What works online, and what does not

Online: the whole dashboard, post grid, per-post *Comprehensive Analysis*, all
metrics and charts, the Projects tab and its exports, theme switching, the error
log, and importing a scan file.

**Not** online: live scanning. Instagram refuses anonymous cross-origin requests
(401/CORS), so a browser page cannot walk a profile — a fake result would be worse
than none. So in the preview:

- auto-fetch is switched off, and the Scan buttons answer with where scanning
  *does* work instead of failing with a network error;
- a notice at the top of every page states what the screen is showing, and the
  freshness strip still says **saved scan** (with the age of the data).

### What data does it show?

The preview ships a **real saved scan** as `preview-scan.json`. `build-web.js`
picks, in order: the committed `preview-scan.json` → the newest scan the desktop
app checkpointed to its user-data folder → the shipped `smallworld_scan_results.json`
and keeps the committed snapshot in step, so the build is reproducible on another
machine.

Nothing is fabricated. A partial walk stays labelled partial with its reason, a
value that was never captured stays `—`, and if the scan carried no profile header
(followers / following / post totals) the build reads it once off the live profile
page in the local browser and says so in the notice. `--no-header` skips even that.

### Testers can bring their own account

Drop a scan `.json` anywhere on the page, or use Settings → **📥 Import JSON**.
`web-preview.js` widens the importer beyond the `{profile, posts}` file the desktop
Settings page accepts, so every shape the app itself can produce loads:

| File | Where it comes from |
|---|---|
| `{profile, posts[]}` | the shipped scan file / an exported scan |
| `{username, posts[], complete, …}` | the desktop app's `scan-cache/<user>.json` |
| `{accounts: {…}}` | the saved-scan library |

Everything a tester does stays in **their own browser's** storage; the page
uploads nothing.

> The preview is read-only by design. To scan a *new* profile with real numbers,
> use the desktop app (`npm start` or the `.exe`) — it reads the profile in a real
> browser window and walks the feed to the account's first post.

## Features

### Metrics Tracked

**Engagement Metrics:**
- Engagement Rate by Reach
- Shares-to-Reach Ratio  
- Reels Retention Rate
- Skip Rate

**Growth Metrics:**
- Follower Growth Velocity (followers per day)
- Follower Growth Rate (%)

**Performance Metrics:**
- Views
- Reach
- Average Watch Time
- Rewatch Rate
- Profile Visits
- Link Clicks
- Website Clicks

**Audience Insights:**
- Audience Active Hours
- Audience Demographics (age/gender breakdown)
- Negative Feedback Rate

### Key Features

✅ **Dark/Light Mode Toggle** - Switch between themes instantly
✅ **Progress History** - All edits and data saves are logged for recovery after timeout/context limits
✅ **API Configuration** - Configure Instagram Graph API settings in Settings tab
✅ **Data Export/Import** - Download all data as JSON or restore from backups
✅ **Real-time Charts** - Interactive visualizations using Chart.js
✅ **Responsive Design** - Works on desktop and mobile

## Full-History Scanning

The analytics are only as good as the slice of the account they were computed
from, so scanning walks the account back to its **very first post** instead of
stopping after the newest few hundred.

### How it works

| Piece | Responsibility |
|---|---|
| `history-scan.js` | Pagination core: follows feed cursors until the source says there is nothing left, retries throttling, de-duplicates overlapping pages, merges with richer values, reports honest coverage. Unit tested in `test_full_history.js`. |
| `main.js` (IPC `scrape-instagram-profile`) | Drives the walk in the main process: no page cap (a 1000-page safety ceiling = 24,000 posts), streams `scrape-progress` to the UI, checkpoints resumable state to `scan-cache/<username>.json` under the app's user-data folder. |
| `instaloader_helper.py` | Python path: unlimited `feed/user/{id}` pagination with backoff, plus `--max-pages` (explicit cap) and `--start-max-id` (resume). Returns `complete` / `lastMaxId`. |
| `scraping.js` → `scanFullHistory()` | Renderer action behind the **📚 Scan Full History** button on the Posts page: runs with a 2-minute *idle* watchdog (not a hard timeout), merges results so repeated runs accumulate, reports coverage. |

### What you get

- Every post since the account began, with the real per-post analytics the API
  exposes: likes, comments, video plays, date, format, carousel size, video
  duration, caption hashtags/mentions, location, tagged-user count.
- **Coverage is always stated**, never implied: *3,912 posts · 100% of the
  account · back to 14 Mar 2019*. A partial or capped walk is labelled as such,
  with the reason, and can be resumed from where it stopped.
- Long walks show live progress (*posts collected, page N*) instead of freezing.

## Saved scans (the most recent results are always kept)

A scan can be throttled, cut short or fail outright. When it does, the newest
results must not disappear with it — and a screen with no data reads as “this
account has nothing”, which is a different and false claim. So every scan is
written down:

| Piece | Responsibility |
|---|---|
| `saveScanSnapshot()` (`storage.js`) | One snapshot per account in `localStorage` (`swaScanLibrary`): the posts, the profile header, the scan report, the method list and the time. A later scan **merges** into it (by shortcode, keeping the richest real value), so a 24-post anonymous peek can never wipe a 600-post walk. Bounded to 6 accounts × 600 posts, and a trimmed snapshot says so. |
| `main.js` (`scan-cache/<username>.json` + IPC `get-saved-scan`) | The walk checkpoints posts to disk as it goes and writes the finished result (posts + header + report) at the end, so the last scan survives a crash, a cleared profile or a reinstall. The renderer can ask for it at any time. |
| `_acceptPartialScan()` (`scraping.js`) | A scan that fails *after* collecting posts still shows and saves what it collected, labelled as a partial walk. |
| `renderScanFreshness()` (`ui.js`) | The strip on every page: says whether the screen is **live** or **saved**, states the age **of the data** (not of the file write), keeps the saved numbers visible while a fresh scan runs, and offers a one-click “Use saved scan” that makes no network request. |

`test_scan_snapshot.js` covers all of it, including the rule that a saved scan
is never presented as fresh.

## The Projects tab

Five sub-tabs, so the working part is never buried in the reference part:

- **Overview & analytics** — the identification picture (the account's own
  profile photo, falling back to the app logo), KPI tiles, charts of projects per
  year / per country / by status / by support type, how the 16 fields are
  covered, and what the inventory deliberately does *not* total.
- **Inventory** — every project as a compact table. Key fields by default, all
  16 on demand; any column heading sorts; filters for status, country, year and
  gaps; 25/50/100/all rows per page; click a row to open every field with the
  guide text beside it.
- **Add a project** — a grouped form with a picture preview. A duplicate Project
  ID is refused and the ID pattern is checked, so a hand-added row cannot corrupt
  the inventory.
- **Live Instagram data** — the most recent saved scan first (with its age,
  coverage and whether the walk reached the first post), the live profile and
  post cards, and the researched list of ways to get accurate data.
- **Field guide & sources** — the 16-field guide, the sources and what each one
  could not give, and how the inventory was built.

### Double-check

The Overview tab runs a second pass over the rows and reports what a spreadsheet
hides: the same description under two different years (a likely double count), a
year that is really a span, a country cell that is a region or a pair, an
abbreviated country name, an institution type with no organisation, an amount
mentioned in the text but missing from the amount column, and the coverage facts
(how many rows record no amount, no date, no beneficiary count). Every finding
names its rows and can be opened in the inventory. Nothing is corrected
automatically — the sources decide what is right.

### Exports

Excel (all rows, or exactly the filtered/sorted view), CSV, and JSON with the
double-check findings. The workbook is written by the same builder the table
uses, so the file and the screen cannot drift apart.

### Advice based on real data

Recommendations quote the measurement they came from (e.g. *“this post got 41
likes — 0.3× your typical 138”*) and are compared against the account's own
median and percentiles. There is no generic tip pool: when a post has no
measurable data, the app says so and names the missing fields. Signals in the
Advanced Metrics page that are modelled rather than measured are tagged **est**,
with a count of how many are measured vs modelled, and the Marketing Analysis
page states how many posts the findings are based on.

## Error Logging & Boot Health

- `boot-diagnostics.js` loads **before** `app.js`, captures errors thrown while
  modules load or the app constructs (which the app's own handlers could not see),
  and verifies that every module file defined its methods.
- Every launch writes a boot record — duration, failed boot steps, missing
  modules, pre-log errors — shown on the Error Log page as **Boot status**.
- Errors are severity-classified (critical / error / warning / test), de-duped
  with a repeat counter, and stored with a stack trace. Real failures (failed
  requests, timeouts, 404s, rate limits) are kept; only genuine library noise is
  suppressed — and the suppressed count is displayed so a quiet log cannot hide a
  problem.
- Missing fonts/images are tracked separately as asset failures, not code errors.

## Tests

```bash
npm test          # pagination, scan orchestration, saved-scan snapshots, project inventory, real-data advice, error logging, metric determinism
npm run test:boot # launches the real index.html in Electron and asserts a clean boot
npm run test:web  # builds web/ and loads it in a real browser, asserting the shared preview works
```

## Installation

1. Clone or download this folder to your desired location
2. Open `index.html` in any modern web browser — or `npm run build:web` and share
   the `web/` folder as a link (see *Online preview* above)
3. No server required - runs entirely client-side!

## Usage

### Initial Setup

1. Click on the **Settings** tab
2. Configure your Instagram Graph API:
   - Enter your API endpoint (e.g., `https://graph.instagram.com/`)
   - Add your access token
   - Set timeout preferences
3. Save settings

### Tracking Metrics

1. Go to the **Dashboard** tab for an overview of key metrics
2. Use the **Metrics** tab for detailed analytics:
   - View all 15+ tracked metrics in organized sections
   - See engagement, growth, and audience insights
   - Monitor negative feedback rates
3. Track progress over time with built-in charts

### Data Management

- All edits are automatically saved to **Progress History** (Settings → History tab)
- Export your data: Click "Export All Data to JSON" in Settings
- Import previous data: Use "Import Data from JSON" button
- Clear history if needed

### Theme Switching

Click the theme toggle button in the header to switch between dark and light modes.

## API Configuration

To use real Instagram data, you'll need:

1. **Instagram Business Account** - Convert your personal account to a business/creator account
2. **Facebook Developer Account** - Create an app at developers.facebook.com
3. **Access Token** - Generate an access token with appropriate permissions:
   - `instagram_basic`
   - `pages_read_engagement`
   - `insights_read`

### Required API Endpoints

The app expects Instagram Graph API endpoints for:
- `/me/insights` - Account-level insights
- `/media/insights` - Post/video insights
- Custom metrics as needed

Add your specific API URL and access token in the Settings tab.

## File Structure

The renderer is plain `<script>` tags in a fixed order — there is no bundler,
so load order matters (`boot-diagnostics.js` must come before `app.js`).

```
├── index.html                 # Markup; loads the modules below in order
├── main.js                    # Electron main process, window, IPC scan driver
├── app.js                     # App class, boot, toasts, profile fetch flow
├── post-analysis.js           # Per-post "Comprehensive Analysis" panel
├── utils.js                   # Shared helpers
├── scraping.js                # Profile/post scraping and every source strategy
├── history-scan.js            # Full-history pagination (cursors, retries, coverage)
├── metrics.js                 # Metrics, analysis, fake-follower estimate, advice
├── charts.js                  # Chart.js visualisations
├── ui.js                      # Pages, post grid, dashboard, freshness strip
├── project-inventory.js       # Projects tab: guide, inventory, double-check, exports
├── instagram-auth.js          # Instagram login, session, unfollow
├── storage.js                 # localStorage persistence, history, scan snapshots
├── error-handling.js          # Runtime error handling and known-error hints
├── boot-diagnostics.js        # Boot-time capture and module-load verification
├── animations.js              # Intro overlay, entrance and scroll animations
├── context-menu.js            # Right-click menus and metric tooltips
├── web-preview.js             # Browser shim: no-op in Electron, makes index.html work as a web page
├── build-web.js               # Assembles the shareable static site into web/
├── serve-web.js               # Zero-dependency static server for checking web/ locally
├── deploy-web.js              # Build → publish to Vercel → verify the live URL
├── web-tools.js               # Chrome/Edge discovery, shared by the build and the web test
├── test_web_smoke.js          # Loads web/ in a real browser and asserts it works
├── styles.css                 # Styling, including post-analysis.css for the panel
├── instaloader_helper.py      # Optional Python full-history path
└── test_*.js                  # Test suites for `npm test` and `npm run test:boot`
```

## Data Storage

All data is stored locally in your browser using:
- **localStorage** - Settings, metrics history (up to 100 entries)
- **sessionStorage** - Session tracking
- **File export** - Download full backups as JSON

### Local Storage Keys
- `instagramAnalyticsSettings` - API settings and theme preference
- `instagramAnalyticsHistory` - All metric snapshots with timestamps
- `swaLastSearch` - The most recent result the app loaded
- `swaScanLibrary` - One saved scan per account (posts + header + coverage + date); merges instead of replacing
- `swaProjectInventoryUser` - Projects you added in the Projects tab

## Troubleshooting

### Can't load real Instagram data?
1. Verify your access token is valid and not expired
2. Check that your Facebook app has the required permissions
3. Ensure your account is a Business/Creator account
4. Review browser console for API errors (F12 → Console)

### Data not saving?
1. Check if localStorage is enabled in your browser
2. Try using an incognito/private window temporarily
3. Export data regularly to avoid loss

### Charts not displaying?
- Chart.js and GSAP are served from `node_modules/`, not a CDN, so run
  `npm ci` if that folder is missing — the charts then work with no internet
- Check the console for loading errors, and the Error Log page, which lists
  failed assets separately from failed code

## Privacy & Security

- All data stays in your browser - nothing is sent to external servers except API calls you configure
- No accounts required
- Open source and transparent

## Browser Compatibility

Works on all modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Future Enhancements

- [ ] Real-time data refresh
- [ ] Custom date range filters
- [ ] More visualization types (pie, radar charts)
- [ ] Automated reporting (PDF export)
- [ ] Multi-account support
- [ ] Predictive analytics

## License

MIT License - Feel free to use and modify for your needs.

## Support

For issues or questions:
1. Check browser console for errors
2. Review API documentation at developers.facebook.com/docs/instagram-api
3. Export data for backup before major changes

---

**Built with ❤️ using vanilla JavaScript, HTML5, and Chart.js**
