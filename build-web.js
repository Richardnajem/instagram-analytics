/* build-web.js — assemble the shareable ONLINE preview of SWA.

   Output: `web/` — a plain static site (no server, no build step, no Node at
   runtime) that can be uploaded to any static host and opened in a browser.

   What it does
   ────────────
   1. Copies the renderer exactly as the desktop app loads it: `index.html`, the
      stylesheets and every module in the same order. The ONLY edits are the two
      vendor script paths (`node_modules/chart.js/...` → `vendor/...`), so nothing
      the app does can drift from the copy.
   2. Copies Chart.js and GSAP out of `node_modules/` (the app never uses a CDN —
      the preview keeps that property).
   3. Picks the best REAL scan available and writes it as `web/preview-scan.json`
      so a visitor sees a populated dashboard instead of an empty one:
         a. `preview-scan.json` (the committed snapshot of a real scan), else
         b. the scan the desktop app checkpointed to its user-data folder, else
         c. the shipped `smallworld_scan_results.json`.
      The chosen file is normalised to the shape `_importScanData()` reads, and
      when the profile counts can be read out of the profile text the scan itself
      captured, they are filled in — never guessed, never rounded up.
   4. Writes `preview-meta.json` (version, build time, where the data came from)
      which `web-preview.js` shows in its banner.

   Nothing is fabricated anywhere: if a value was not captured, it stays null and
   the app prints "—" for it. Coverage and the data's age are always stated.

   Usage
   ─────
     node build-web.js            # → web/
     node serve-web.js            # → http://127.0.0.1:4173 (local check)
   Then upload the CONTENTS of `web/` to any static host.
*/
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'web');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/* ── The renderer, in the order index.html loads it ─────────────────────────
   `history-scan.js` is deliberately absent: only the Electron main process
   requires it. Keep this list in step with index.html — the build verifies
   every script the page asks for exists in the output. */
const RENDERER = [
    'index.html',
    'styles.css',
    'post-analysis.css',
    'boot-diagnostics.js',
    'web-preview.js',
    'app.js',
    'post-analysis.js',
    'utils.js',
    'scraping.js',
    'metrics.js',
    'charts.js',
    'ui.js',
    'project-inventory.js',
    'instagram-auth.js',
    'storage.js',
    'error-handling.js',
    'animations.js',
    'context-menu.js',
];

const VENDOR = [
    { from: 'node_modules/chart.js/dist/chart.umd.min.js', to: 'vendor/chart.umd.min.js', page: 'node_modules/chart.js/dist/chart.umd.min.js' },
    { from: 'node_modules/gsap/dist/gsap.min.js', to: 'vendor/gsap.min.js', page: 'node_modules/gsap/dist/gsap.min.js' },
];

const ASSETS = ['assets/swa_logo.png', 'assets/swa_logo.svg'];

const CACHE_FILE = 'smallworld_foundation.json';
const SHIPPED_SCAN = 'smallworld_scan_results.json';
const COMMITTED_SNAPSHOT = 'preview-scan.json';

const NO_HEADER = process.argv.includes('--no-header');

/* ── helpers ───────────────────────────────────────────────────────────────── */
function log(msg) { console.log(msg); }
function die(msg) { console.error('\n❌ ' + msg + '\n'); process.exit(1); }

function copyFile(rel, dest) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) die('missing source file: ' + rel + (rel.startsWith('node_modules/') ? ' — run `npm ci` first' : ''));
    const target = dest || path.join(OUT, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(src, target);
    return fs.statSync(target).size;
}

/** Electron user-data scan cache — the freshest real scan on this machine. */
function diskScanFile() {
    const home = process.env.APPDATA || process.env.HOME || '';
    if (!home) return null;
    const candidates = [
        path.join(home, 'swa-small-world-analytics', 'scan-cache', CACHE_FILE),
        path.join(home, 'Small World Analytics', 'scan-cache', CACHE_FILE),
    ];
    return candidates.find(f => fs.existsSync(f)) || null;
}

/** "3,429" / "12.5K" / "1.2M" → number, or null when it is not a count. */
function compactCount(str) {
    if (str == null) return null;
    const m = String(str).replace(/,/g, '').trim().match(/^([\d.]+)\s*([KkMm])?$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (isNaN(n)) return null;
    if (m[2] === 'K' || m[2] === 'k') return Math.round(n * 1000);
    if (m[2] === 'M' || m[2] === 'm') return Math.round(n * 1000000);
    return Math.round(n);
}

/**
 * Instagram prints "<n> Followers, <n> Following, <n> Posts - <name> (@handle) on
 * Instagram: "<bio>"" in the profile description. A scan that captured that text
 * captured those real counts with it, so read them back out instead of leaving
 * follower-derived metrics blank. Values that are already present are never
 * overwritten, and a count that is not in the text stays null ("—").
 */
function readCountsFromDescription(profile) {
    const desc = String((profile && profile.bio) || '');
    if (!/on Instagram:/i.test(desc)) return { filled: [] };
    const grab = (label) => {
        const m = desc.match(new RegExp('([\\d.,]+\\s*[KkMm]?)\\s+' + label, 'i'));
        return m ? compactCount(m[1]) : null;
    };
    const followers = grab('Followers');
    const following = grab('Following');
    const posts = grab('Posts');
    const bioMatch = desc.match(/on Instagram:\s*"([\s\S]*)"\s*\.?\s*$/i);

    const filled = [];
    if (followers != null && profile.followers == null) { profile.followers = followers; filled.push('followers'); }
    if (following != null && profile.following == null) { profile.following = following; filled.push('following'); }
    if (posts != null && profile.posts == null) { profile.posts = posts; filled.push('posts'); }
    if (bioMatch && /on Instagram:/i.test(profile.bio || '')) profile.bio = bioMatch[1].trim();
    return { filled };
}

/* ── Optional: read the profile header off the real page ────────────────────
   An anonymous API request is refused (401) and a plain HTML fetch only returns
   the JS shell — which is why the desktop app reads the header out of a rendered
   page. The build can do the same with the Chrome already on the machine, so the
   preview can show follower-based metrics instead of "—" everywhere. It is
   best-effort and optional: no browser (or no network) simply leaves the values
   null, which the app already renders as an honest unknown. Nothing is guessed. */

const { findBrowser } = require('./web-tools.js');

function decodeEntities(s) {
    return String(s || '')
        .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/gi, "'");
}

function metaContent(html, attr, name) {
    const re = new RegExp('<meta[^>]*' + attr + '="' + name + '"[^>]*>', 'i');
    const tag = (html.match(re) || [])[0];
    if (!tag) return null;
    const c = tag.match(/content="([^"]*)"/i);
    return c ? decodeEntities(c[1]) : null;
}

function readHeaderFromRenderedPage(username) {
    const bin = findBrowser();
    if (!bin) return { ok: false, reason: 'no Chrome/Edge/Chromium found' };
    const { spawnSync } = require('child_process');
    const profileDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'swa-preview-'));
    try {
        const res = spawnSync(bin, [
            '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--user-data-dir=' + profileDir, '--virtual-time-budget=20000', '--dump-dom',
            'https://www.instagram.com/' + encodeURIComponent(username) + '/',
        ], { timeout: 90000, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
        const html = res.stdout || '';
        if (!html || html.length < 2000) {
            return { ok: false, reason: 'the page did not render (' + (res.error ? res.error.message : 'empty dump') + ')' };
        }
        const desc = metaContent(html, 'name', 'description') || metaContent(html, 'property', 'og:description') || '';
        const title = metaContent(html, 'property', 'og:title') || '';
        const image = metaContent(html, 'property', 'og:image') || '';
        const grab = (label) => {
            const m = desc.match(new RegExp('([\\d.,]+\\s*[KkMm]?)\\s+' + label, 'i'));
            return m ? compactCount(m[1]) : null;
        };
        const out = {
            followers: grab('Followers'),
            following: grab('Following'),
            posts: grab('Posts'),
            bio: '',
            fullName: (title.match(/^([^(@]+?)\s*\(@/i) || [])[1] || '',
            profilePicUrl: image,
            externalUrl: '',
        };
        const bioMatch = desc.match(/on Instagram:\s*"([\s\S]*)"\s*\.?\s*$/i);
        if (bioMatch) out.bio = bioMatch[1].trim();
        const ext = html.match(/l\.instagram\.com\/\?u=([^"&]+)/);
        if (ext) { try { out.externalUrl = decodeURIComponent(ext[1]); } catch (e) { out.externalUrl = ''; } }
        if (out.followers == null && out.posts == null) {
            return { ok: false, reason: 'Instagram served a sign-in wall instead of the profile' };
        }
        return { ok: true, header: out };
    } catch (e) {
        return { ok: false, reason: e.message };
    } finally {
        try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) { }
    }
}

/**
 * Normalise any real scan the project can produce into the shape
 * `_importScanData()` reads: { profile, posts[], savedAt, scanReport }.
 * Mirrors the mapping app.js already does in `_loadSavedScanData()`.
 */
function normaliseScan(raw, sourceLabel) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.posts) || !raw.posts.length) return null;

    const header = raw.profile || {};
    const username = header.username || raw.username ||
        (raw.profile && raw.profile.username) || '';
    if (!username) return null;

    const profile = {
        username: username,
        fullName: header.fullName || '',
        bio: header.bio || '',
        profilePicUrl: header.profilePicUrl || '',
        followers: header.followers != null ? header.followers : null,
        following: header.following != null ? header.following : null,
        posts: header.posts != null ? header.posts : null,
        externalUrl: header.externalUrl || '',
        isVerified: header.isVerified === true,
        userId: header.userId || raw.userId || null,
        fetchedAt: header.fetchedAt || raw.updatedAt || raw.fetchedAt || null,
    };
    const counts = readCountsFromDescription(profile);

    const scanned = raw.posts.length;
    const report = raw.scanReport || {
        complete: raw.complete === true,
        pages: raw.pages || null,
        stoppedReason: raw.stoppedReason || null,
        posts: scanned,
    };

    return {
        scan: {
            profile: profile,
            posts: raw.posts,
            savedAt: raw.savedAt || raw.updatedAt || null,
            scanReport: report,
            methods: raw.methods || [],
            source: sourceLabel,
        },
        countsFromDescription: counts.filled,
        scanned: scanned,
    };
}

/* ── 1. Clean output (guarded: only ever removes <root>/web) ─────────────── */
if (path.basename(OUT) !== 'web' || path.dirname(OUT) !== ROOT) die('refusing to clean ' + OUT);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
log('▶ Building the online preview into web/');

/* ── 2. Copy the renderer + vendor libraries + assets ───────────────────── */
let bytes = 0;
RENDERER.forEach(f => { bytes += copyFile(f); });
VENDOR.forEach(v => {
    copyFile(v.from, path.join(OUT, v.to));
    bytes += fs.statSync(path.join(OUT, v.to)).size;
});
ASSETS.forEach(f => {
    if (fs.existsSync(path.join(ROOT, f))) bytes += copyFile(f);
});
// The app icon doubles as the site icon: a shared link then shows the SWA logo in
// the tab instead of a blank page glyph, and the browser's automatic
// /favicon.ico request stops 404-ing.
if (fs.existsSync(path.join(ROOT, 'assets/swa_icon.ico'))) {
    bytes += copyFile('assets/swa_icon.ico', path.join(OUT, 'favicon.ico'));
}
log('  ✓ ' + RENDERER.length + ' renderer files, ' + VENDOR.length + ' vendor libs, assets copied (' +
    Math.round(bytes / 1024) + ' KB)');

/* ── 3. Point index.html's vendor scripts at vendor/ (only change made) ──── */
{
    const indexPath = path.join(OUT, 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    let swapped = 0;
    VENDOR.forEach(v => {
        const needle = 'src="' + v.page + '"';
        if (html.indexOf(needle) === -1) return;
        html = html.split(needle).join('src="' + v.to + '"');
        swapped++;
    });
    if (swapped !== VENDOR.length) {
        die('index.html no longer loads the expected vendor scripts (' + swapped + '/' + VENDOR.length + ' rewritten). ' +
            'Update VENDOR in build-web.js so the preview cannot ship with a broken script path.');
    }
    fs.writeFileSync(indexPath, html);
    log('  ✓ index.html vendor paths rewritten to vendor/');
}

/* ── 4. Verify every script/style the page asks for is actually in web/ ──── */
{
    const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
    const refs = [];
    html.replace(/(?:src|href)="([^"]+)"/g, (_, url) => {
        if (!/^(https?:)?\/\//.test(url) && !url.startsWith('data:')) refs.push(url);
        return _;
    });
    const missing = refs.filter(r => !fs.existsSync(path.join(OUT, r)));
    if (missing.length) die('the built page references files that were not copied:\n    ' + missing.join('\n    '));
    log('  ✓ all ' + refs.length + ' local <script>/<link> references resolve inside web/');
}

/* ── 5. Pick the best real scan and write preview-scan.json ─────────────── */
const committed = path.join(ROOT, COMMITTED_SNAPSHOT);
const disk = diskScanFile();
const sources = [];
if (fs.existsSync(committed)) sources.push({ file: committed, label: 'committed preview-scan.json snapshot' });
if (disk) sources.push({ file: disk, label: 'scan checkpointed by the desktop app' });
sources.push({ file: path.join(ROOT, SHIPPED_SCAN), label: 'scan shipped with the app' });

/* Most posts wins (a demo is only as good as its coverage); the more recently
   captured scan breaks a tie. Nothing here is invented — every candidate is a
   scan that really happened. */
let previewScan = null;
let sourceLabel = null;
for (const s of sources) {
    let raw = null;
    try { raw = JSON.parse(fs.readFileSync(s.file, 'utf8')); } catch (e) { log('  ⚠ could not read ' + path.basename(s.file) + ': ' + e.message); }
    const normalised = raw && normaliseScan(raw, s.label);
    if (!normalised) continue;
    const at = Date.parse(normalised.scan.profile.fetchedAt || normalised.scan.savedAt || 0) || 0;
    normalised.at = at;
    normalised.fromCommitted = s.file === committed;
    if (!previewScan || normalised.scanned > previewScan.scanned ||
        (normalised.scanned === previewScan.scanned && at > previewScan.at)) {
        previewScan = normalised;
        sourceLabel = s.label;
    }
}
if (!previewScan) die('no usable scan data found (' + sources.map(c => path.basename(c.file)).join(', ') + ')');

/* ── 5b. Top up the profile header if the scan did not capture it ──────── */
let headerFrom = null;
if (previewScan.countsFromDescription.length) {
    headerFrom = 'the profile text the scan itself captured';
} else if (!NO_HEADER && (previewScan.scan.profile.followers == null || previewScan.scan.profile.posts == null)) {
    log('  … the scan did not capture a profile header — reading it off the live page');
    const r = readHeaderFromRenderedPage(previewScan.scan.profile.username);
    if (r.ok) {
        const p = previewScan.scan.profile, h = r.header;
        ['followers', 'following', 'posts'].forEach(k => { if (p[k] == null && h[k] != null) p[k] = h[k]; });
        ['bio', 'fullName', 'profilePicUrl', 'externalUrl'].forEach(k => { if (!p[k] && h[k]) p[k] = h[k]; });
        headerFrom = 'the rendered Instagram profile page, read by the build at ' + new Date().toISOString();
    } else {
        log('  ⚠ could not read the header (' + r.reason + ') — follower-based metrics will show "—"');
    }
}

// Keep the committed snapshot in step with what was built, so the next build on
// another machine (or with no network) reproduces this preview.
if (!previewScan.fromCommitted || headerFrom) {
    fs.writeFileSync(committed, JSON.stringify(previewScan.scan, null, 2));
    log('  ✓ wrote ' + COMMITTED_SNAPSHOT + ' ← ' + sourceLabel);
}
fs.writeFileSync(path.join(OUT, 'preview-scan.json'), JSON.stringify(previewScan.scan, null, 2));

const sp = previewScan.scan.profile, rep = previewScan.scan.scanReport || {};
log('  ✓ preview-scan.json ← ' + sourceLabel);
log('      @' + sp.username + ' · ' + previewScan.scanned + ' posts scanned' +
    (sp.posts != null ? ' of ' + sp.posts + ' on the account' : ' (account total not captured)') +
    ' · complete=' + (rep.complete === true) + (rep.stoppedReason ? ' (' + rep.stoppedReason + ')' : ''));
log('      followers=' + (sp.followers != null ? sp.followers : '—') +
    ' following=' + (sp.following != null ? sp.following : '—') +
    ' captured=' + (sp.fetchedAt || 'unknown'));
if (headerFrom) log('      header from: ' + headerFrom);

/* ── 6. preview-meta.json — what the banner reports ─────────────────────── */
fs.writeFileSync(path.join(OUT, 'preview-meta.json'), JSON.stringify({
    version: pkg.version,
    productName: pkg.build && pkg.build.productName || 'Small World Analytics',
    builtAt: new Date().toISOString(),
    source: sourceLabel,
    dataFile: 'preview-scan.json',
    countsFrom: headerFrom,
    data: {
        username: sp.username,
        postsScanned: previewScan.scanned,
        postsOnAccount: sp.posts != null ? sp.posts : null,
        complete: rep.complete === true,
        collectedAt: sp.fetchedAt || null,
    },
}, null, 2));

/* ── 7. Report ──────────────────────────────────────────────────────────── */
let total = 0, files = 0;
(function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return walk(p);
        files++; total += fs.statSync(p).size;
    });
})(OUT);

log('\n✅ Online preview built: web/ (' + files + ' files, ' + (total / 1024 / 1024).toFixed(2) + ' MB)');
log('   Check it locally : node serve-web.js   →  http://127.0.0.1:4173');
log('   Share it         : upload the CONTENTS of web/ to any static host');
log('   Live scanning    : desktop app only — see README §"Online preview"');
