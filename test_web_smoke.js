/* test_web_smoke.js — does the ONLINE preview actually work?

   `npm run test:boot` proves the desktop app boots inside Electron. This is the
   equivalent for the shareable web build: it builds `web/` (unless it is already
   there), serves it over real HTTP, loads it in the Chrome/Edge already on the
   machine, and asserts what a visitor would experience:

     • the app boots with no failed step and an empty error log
     • the preview notice is on screen and states this scan's real coverage
     • the real saved scan renders — post cards, thumbnails, headline metrics,
       the format mix, and dashboard charts Chart.js actually drew
     • a Scan click explains that scanning is desktop-only instead of throwing
     • importing a scan file in a DIFFERENT real shape (the checkpoint the desktop
       app writes: {username, posts[]}, no profile header) renders as well

   Usage:
     npm run test:web                       # builds web/ first if it is missing
     node test_web_smoke.js --rebuild       # force a fresh build, then check
     node test_web_smoke.js --keep          # leave web/_check.html behind
     node test_web_smoke.js --url <base>    # ALSO prove a deployed copy is this build

   `--url` fetches what the deployed site is serving and compares it byte for byte
   with the build this run just loaded in the browser. The browser checks then run
   against those proven-identical bytes, so a green run describes the page a
   visitor actually gets — not just the folder on this disk. A deployed copy that
   drifted, went stale or lost a file fails here instead of in front of a tester.

   Needs Chrome, Edge or Chromium. With none installed the test SKIPS loudly
   rather than reporting a pass it did not earn.
*/
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { findBrowser } = require('./web-tools.js');

const ROOT = __dirname;
const WEB = path.join(ROOT, 'web');
const PORT = 4179;
const URL_CHECK = 'http://127.0.0.1:' + PORT + '/_check.html';
const HARNESS = path.join(WEB, '_check.html');

const rebuild = process.argv.includes('--rebuild');
const keep = process.argv.includes('--keep');
const urlAt = process.argv.indexOf('--url');
const DEPLOYED = urlAt !== -1 && process.argv[urlAt + 1] && !process.argv[urlAt + 1].startsWith('--')
    ? process.argv[urlAt + 1].replace(/\/+$/, '')
    : null;

/* ═══ the harness page ═══════════════════════════════════════════════════════
   Written inside web/ so it is same-origin with index.html: it can then inspect
   everything the app actually rendered and exercise the paths a visitor clicks.
   It deletes itself (unless --keep) when the run ends. */
const HARNESS_HTML = `<!doctype html>
<html><body style="font-family:monospace">
<pre id="report">loading…</pre>
<iframe id="f" src="index.html" style="width:1400px;height:900px;border:1px solid #333"></iframe>
<script>
const f = document.getElementById('f');
const out = document.getElementById('report');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async function () {
  for (let i = 0; i < 240; i++) { await wait(250); try { if (f.contentWindow.__swaBooted) break; } catch (e) { } }
  await wait(7000);
  let report;
  try {
    const w = f.contentWindow, d = f.contentDocument, app = w.app || {};
    const q = id => { const el = d.getElementById(id); return el ? el.textContent.trim() : null; };
    const imgs = Array.prototype.slice.call(d.querySelectorAll('img'));
    const toasts = () => Array.prototype.map.call(d.querySelectorAll('#toastContainer .toast'), t => t.innerText.trim());

    /* Capture the state a VISITOR first sees — before the tests below mutate it. */
    const pageState = {
      booted: w.__swaBooted === true,
      previewMode: w.__SWA_WEB_PREVIEW__ === true,
      webPreviewFlags: w.__swaWebPreview || null,
      bootReport: app.bootReport || null,
      resourceErrors: ((w.__swaBoot && w.__swaBoot.resourceErrors) || []).slice(0, 6).map(function (e) {
        if (e == null) return 'null';
        if (typeof e === 'string') return e;
        return String(e.url || e.src || e.href || e.file || JSON.stringify(e)).slice(0, 140);
      }),
      previewBar: !!d.getElementById('swaPreviewBar'),
      previewBarText: (d.getElementById('swaPreviewBar') || {}).innerText || '',
      failureSplash: !!d.getElementById('swaRetryBtn'),
      errorLogCount: (app.errorLog || []).length,
      errorLog: (app.errorLog || []).slice(0, 10).map(e => ({ sev: e.severity, msg: String(e.message || '').slice(0, 160) })),
      version: q('appVersion'),
      images: {
        total: imgs.length,
        loadedInBrowser: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
        failed: imgs.filter(i => !(i.complete && i.naturalWidth > 0)).slice(0, 3).map(i => (i.getAttribute('src') || '(no src)').slice(0, 80)),
      },
      stats: { engRate: q('statsEngRate'), ffRatio: q('ffRatioDisplay'), recentLikes: q('recentLikesDisplay'), health: q('dashHealthStatus') },
      posts: {
        cardsInGrid: d.querySelectorAll('#postsGrid > *').length,
        totalLikes: q('postsTotalLikes'),
        photos: q('postsPhotoCount'), videos: q('postsVideoCount'), carousels: q('postsCarouselCount'),
      },
      chartCanvasesDrawn: Array.prototype.filter.call(d.querySelectorAll('canvas'), c => c.width > 0 && c.height > 0).length,
      freshness: (d.getElementById('scanFreshness') || {}).innerText || null,
    };

    // 1) A scan click must explain itself, not fail.
    const errorsBefore = (app.errorLog || []).length;
    let scanResult;
    try { scanResult = await app.fetchProfile('nasa'); }
    catch (e) { scanResult = 'THREW: ' + (e && e.message); }
    await wait(1200);
    const scanTest = {
      returned: scanResult === null ? 'null (handled)' : String(scanResult).slice(0, 100),
      errorsAdded: (app.errorLog || []).length - errorsBefore,
      toasts: toasts(),
    };

    // 2) Importing a scan in ANOTHER real shape (the disk checkpoint the desktop
    //    app writes: {username, posts[]}, no profile header) must render too.
    let importTest = null;
    try {
      const raw = await fetch('preview-scan.json').then(r => r.json());
      const diskShape = { username: raw.profile.username, posts: raw.posts.slice(0, 5), complete: true, pages: 9, updatedAt: raw.savedAt };
      const file = new File([JSON.stringify(diskShape)], 'scan-cache.json', { type: 'application/json' });
      const before = (app.currentPosts || []).length;
      app.importData({ target: { files: [file] } });
      await wait(2500);
      const snap = app._displayedSnapshot || null;
      importTest = {
        postsBefore: before,
        postsAfter: (app.currentPosts || []).length,
        coverageShown: q('postsScanned'),
        displayedSnapshot: snap ? {
          scanPosts: snap.scanPosts, knownPosts: snap.knownPosts,
          complete: snap.scanReport ? snap.scanReport.complete : null,
        } : null,
        followerMetricsAfter: q('statsEngRate'),
        toasts: toasts(),
      };
    } catch (e) { importTest = { error: String(e && e.message || e) }; }

    report = Object.assign(pageState, { scanTest, importTest });
  } catch (e) {
    report = { harnessError: String((e && e.stack) || e) };
  }
  out.textContent = 'REPORT_JSON:' + JSON.stringify(report, null, 1) + ':END_REPORT';
})();
<\/script>
</body></html>`;

let checks = 0, failures = 0;
function check(label, ok, detail) {
    checks++;
    if (ok) { console.log('  ✅ ' + label + (detail ? '  — ' + detail : '')); return true; }
    failures++;
    console.log('  ❌ ' + label + (detail ? '  — ' + detail : ''));
    return false;
}

function cleanup() {
    if (keep) return;
    try { fs.rmSync(HARNESS, { force: true }); } catch (e) { }
}

/* ── 1. The build must exist ──────────────────────────────────────────────── */
if (rebuild || !fs.existsSync(path.join(WEB, 'index.html'))) {
    console.log('\n▶ Building web/ first…');
    const b = spawnSync(process.execPath, [path.join(ROOT, 'build-web.js')], { stdio: 'inherit' });
    if (b.status !== 0) { console.error('build-web.js failed'); process.exit(1); }
}
if (!fs.existsSync(path.join(WEB, 'preview-scan.json'))) {
    console.error('web/preview-scan.json is missing — run `node build-web.js`');
    process.exit(1);
}

/* ── 2. What the bundled scan says it is (the test's own expectations) ───── */
const bundled = JSON.parse(fs.readFileSync(path.join(WEB, 'preview-scan.json'), 'utf8'));
const appVersion = 'v' + JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const expectedScanned = bundled.posts.length;
const expectedTotal = bundled.profile && typeof bundled.profile.posts === 'number' ? bundled.profile.posts : null;
const expectedCoverage = expectedTotal
    ? expectedScanned + " of the account's " + expectedTotal + ' posts'
    : expectedScanned + ' posts';
const expectedPartial = bundled.scanReport && bundled.scanReport.complete === false;

/* ── 3. A browser to check with ──────────────────────────────────────────── */
const browser = findBrowser();
if (!browser) {
    console.log('\n⏭️  SKIPPED — no Chrome/Edge/Chromium found on this machine.');
    console.log('   Point CHROME_PATH at a Chromium-based browser to run the web smoke test.\n');
    process.exit(0);
}

/* ── 3b. When --url is given, prove the deployed copy IS this build ────────
   Every file fetch()es back with the same sha256 as the local build, so the
   browser checks below describe the deployed page, not just a local folder. */
const https = require('https');

function fetchBytes(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https:') ? https : http;
        mod.get(url, res => {
            if (res.statusCode !== 200) { res.resume(); return resolve({ status: res.statusCode }); }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({ status: 200, body: Buffer.concat(chunks) }));
        }).on('error', reject);
    });
}

function localFiles(dir, prefix, out) {
    out = out || [];
    for (const name of fs.readdirSync(dir)) {
        const abs = path.join(dir, name);
        const rel = prefix ? prefix + '/' + name : name;
        if (fs.statSync(abs).isDirectory()) localFiles(abs, rel, out);
        else out.push(rel);
    }
    return out;
}

async function checkDeployedCopy() {
    const sha = b => require('crypto').createHash('sha256').update(b).digest('hex');
    const files = localFiles(WEB, '').filter(f => f !== '_check.html');
    const bad = [], missing = [];
    let compared = 0;
    for (const rel of files) {
        let got;
        try { got = await fetchBytes(DEPLOYED + '/' + rel); }
        catch (e) { missing.push(rel + ' (' + e.message + ')'); continue; }
        if (got.status !== 200) { missing.push(rel + ' (HTTP ' + got.status + ')'); continue; }
        compared++;
        if (sha(got.body) !== sha(fs.readFileSync(path.join(WEB, rel)))) bad.push(rel);
    }
    console.log('\n── The deployed copy (' + DEPLOYED + ') ───────');
    check('every file the build produced is served by the deployment',
        missing.length === 0, missing.length ? 'missing: ' + missing.slice(0, 3).join(', ') : files.length + ' files reachable');
    // `compared` matters: a file that never downloaded was never checked, so an
    // all-404 deployment must fail here rather than report "0 differ".
    check('the deployment is byte-for-byte this build, not a stale one',
        compared === files.length && bad.length === 0,
        bad.length ? 'differs: ' + bad.slice(0, 3).join(', ')
            : compared + '/' + files.length + ' files compared and identical');
}

/* ── 4. Serve web/ over real HTTP (fetch() is blocked on file:// URLs) ───── */
fs.writeFileSync(HARNESS, HARNESS_HTML);
const server = spawn(process.execPath, [path.join(ROOT, 'serve-web.js'), '--port', String(PORT)], { stdio: 'ignore' });
const stopServer = () => { try { server.kill(); } catch (e) { } };
process.on('exit', stopServer);
process.on('SIGINT', () => { stopServer(); cleanup(); process.exit(130); });

function waitForServer() {
    return new Promise(resolve => {
        const ping = (left) => {
            http.get('http://127.0.0.1:' + PORT + '/index.html', res => { res.resume(); resolve(true); })
                .on('error', () => left <= 0 ? resolve(false) : setTimeout(() => ping(left - 1), 250));
        };
        ping(40);
    });
}

/* ── 5. Drive the real browser ───────────────────────────────────────────── */
function dumpPage(url) {
    const profileDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'swa-webcheck-'));
    try {
        const res = spawnSync(browser, [
            '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--user-data-dir=' + profileDir, '--virtual-time-budget=60000', '--dump-dom', url,
        ], { timeout: 180000, maxBuffer: 128 * 1024 * 1024, encoding: 'utf8' });
        return res.stdout || '';
    } finally {
        try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) { }
    }
}

function extractReport(html) {
    const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    const m = withoutScripts.match(/REPORT_JSON:([\s\S]*?):END_REPORT/);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return { parseError: e.message }; }
}

(async function main() {
    if (!(await waitForServer())) {
        stopServer(); cleanup();
        console.error('❌ serve-web.js did not start on port ' + PORT);
        process.exit(1);
    }

    if (DEPLOYED) await checkDeployedCopy();

    console.log('\n▶ Loading the preview in ' + path.basename(browser) + ' (about 30s)…');
    const report = extractReport(dumpPage(URL_CHECK));
    stopServer(); cleanup();

    if (!report) { console.error('\n❌ the page produced no report — it never finished loading.'); process.exit(1); }
    if (report.harnessError) { console.error('\n❌ harness error:\n' + report.harnessError); process.exit(1); }

    console.log('\n── The page itself ─────────────────────────────────────');
    check('the app boots in a plain browser', report.booted === true);
    check('boot completes with no failed step, module or early error',
        !!(report.bootReport && report.bootReport.ok),
        report.bootReport ? 'failed: ' + JSON.stringify(report.bootReport.failedSteps) + ' missing: ' + JSON.stringify(report.bootReport.modulesMissing) : 'no boot report');
    check('no "failed to load" screen', report.failureSplash === false);
    check('the runtime error log is empty', report.errorLogCount === 0,
        report.errorLogCount ? JSON.stringify(report.errorLog) : '0 entries');
    check('the version is shown without Node', report.version === appVersion, report.version);
    check('this really is preview mode', report.previewMode === true);
    check('none of the page\'s own assets failed to load',
        (report.resourceErrors || []).every(u => !/\/assets\//.test(u)),
        (report.resourceErrors || []).length ? 'failed: ' + report.resourceErrors.join(', ') : 'no resource errors');

    console.log('\n── What the visitor is told ────────────────────────────');
    check('the preview notice is on screen', report.previewBar === true);
    check('the notice states the real coverage (' + expectedCoverage + ')',
        report.previewBarText.indexOf(expectedCoverage) !== -1, expectedCoverage);
    if (expectedPartial) {
        check('the notice says the walk was cut short',
            /cut short by Instagram/.test(report.previewBarText));
    }
    check('the freshness strip says this is a SAVED scan, not live data',
        /Saved scan/.test(report.freshness || ''), (report.freshness || '').split('\n')[0]);

    console.log('\n── Real data, really rendered ──────────────────────────');
    check('every scanned post is in the grid', report.posts.cardsInGrid === expectedScanned,
        report.posts.cardsInGrid + '/' + expectedScanned);
    check('post thumbnails load in a browser', report.images.loadedInBrowser > 0,
        report.images.loadedInBrowser + '/' + report.images.total + ' images' +
        (report.images.failed.length ? ' (first failures: ' + report.images.failed.join(', ') + ')' : ''));
    check('the headline metrics are filled in, not "—"',
        report.stats.engRate !== '—' && report.stats.recentLikes !== '—',
        'ER ' + report.stats.engRate + ' · avg likes ' + report.stats.recentLikes);
    check('the format mix survived the import',
        report.posts.photos !== '—' && report.posts.videos !== '—' && report.posts.carousels !== '—',
        'photo ' + report.posts.photos + ' · video/reel ' + report.posts.videos + ' · carousel ' + report.posts.carousels);
    check('the dashboard charts were drawn by Chart.js', report.chartCanvasesDrawn >= 7,
        report.chartCanvasesDrawn + ' canvases with a real size');

    console.log('\n── Scanning, honestly refused ──────────────────────────');
    check('a scan click is handled, not thrown', report.scanTest.returned === 'null (handled)',
        report.scanTest.returned);
    check('it adds nothing to the error log', report.scanTest.errorsAdded === 0);
    check('it tells the tester where scanning does work',
        report.scanTest.toasts.some(t => /desktop app/.test(t)), (report.scanTest.toasts[0] || '(no toast)').slice(0, 90));
    check('the scan methods are flagged as web-blocked',
        !!(report.webPreviewFlags && report.webPreviewFlags.scanBlocked));

    console.log('\n── A tester\'s own scan file ────────────────────────────');
    check('the importer was extended for the web page',
        !!(report.webPreviewFlags && report.webPreviewFlags.importerWrapped));
    check('a disk-checkpoint scan ({username, posts[]}) renders',
        !report.importTest.error && report.importTest.postsAfter > 0,
        report.importTest.error || (report.importTest.postsAfter + ' posts shown (was ' + report.importTest.postsBefore + ')'));
    check('the imported scan\'s coverage travels with it into the saved snapshot',
        !!(report.importTest.displayedSnapshot && report.importTest.displayedSnapshot.complete === true),
        JSON.stringify(report.importTest.displayedSnapshot));
    check('a file with no profile header leaves follower metrics unknown, not guessed',
        report.importTest.followerMetricsAfter === '—',
        'engagement rate after the header-less import: ' + report.importTest.followerMetricsAfter);

    console.log('\n───────────────────────────────────────────────────────');
    if (failures === 0) {
        console.log('✅ WEB PREVIEW — ' + checks + '/' + checks + ' checks passed');
        process.exit(0);
    }
    console.log('❌ WEB PREVIEW — ' + (checks - failures) + '/' + checks + ' checks passed, ' + failures + ' failed');
    console.log('\nFull report:\n' + JSON.stringify(report, null, 1));
    process.exit(1);
})();
