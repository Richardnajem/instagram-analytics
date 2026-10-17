/* ══════════════════════════════════════════════════════════════════════════════
   web-preview.js — the same app, running as a plain web page.

   `index.html` is loaded by Electron (where `require` exists, nodeIntegration is
   on, and the MAIN process does all the scanning) and by browsers, where none of
   that exists. This file makes the browser case work without changing a line of
   app logic:

     • It does NOTHING under Electron — the desktop app is untouched.
     • It turns auto-fetch OFF, so the page cannot try to scan Instagram from a
       browser. Instagram refuses anonymous cross-origin API calls (401 / CORS),
       and a made-up result would be worse than none, so the scan buttons are
       turned into an honest "scanning needs the desktop app" notice instead of
       failing with a network error.
     • It loads a REAL saved scan (preview-scan.json, written by build-web.js from
       an actual scan of the account) so the dashboard shows real numbers with
       their real coverage and age.
     • It says all of that, on screen, at the top of every page.
     • It lets a tester load their own scan file (Settings → 📥 Import JSON, or
       drop a file anywhere on the page) in any shape the app can produce.

   Data honesty (see AGENTS.md §"Data-honesty rules") applies here too: this file
   never invents a value, and every claim it prints is read back from the data
   that is actually loaded.
   ══════════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* Under Electron (nodeIntegration) both `require` and `process.versions.electron`
       exist: the real app is running, so this whole file is a no-op. */
    var IS_ELECTRON = typeof require === 'function' &&
        typeof process === 'object' && process && process.versions && process.versions.electron;
    if (IS_ELECTRON) return;

    window.__SWA_WEB_PREVIEW__ = true;

    var SAMPLE_FILE = 'preview-scan.json';
    var META_FILE = 'preview-meta.json';
    var meta = null;
    var sample = null;

    /* ── Start both fetches immediately, so the data is in hand by boot ─────── */
    function getJSON(url) {
        try {
            return fetch(url, { cache: 'no-cache' }).then(function (r) {
                return r.ok ? r.json() : null;
            }).catch(function () { return null; });
        } catch (e) { return Promise.resolve(null); }
    }
    var samplePromise = getJSON(SAMPLE_FILE).then(function (d) { sample = d; return d; });
    var metaPromise = getJSON(META_FILE).then(function (m) { meta = m; return m; });

    /* ── Disable auto-fetch BEFORE boot reads it ─────────────────────────────
       app.js constructs the app during parsing and boots on DOMContentLoaded, so
       registering this listener now (this script is loaded before app.js) means
       it runs first. Auto-fetch would otherwise fire a live scan ~2s after load,
       which a browser cannot do. */
    function disableAutoFetch() {
        try {
            if (window.app && window.app.settings) window.app.settings.autoFetch = false;
        } catch (e) { /* never break boot */ }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', disableAutoFetch);
    } else {
        disableAutoFetch();
    }

    /* ── Preview chrome (banner + a couple of CSS fixes) ────────────────────── */
    var STYLE = '' +
        '#swaPreviewBar{background:linear-gradient(90deg,rgba(124,58,237,.16),rgba(6,182,212,.12));' +
        'border:1px solid rgba(124,58,237,.45);border-radius:14px;padding:14px 16px;margin:0 0 18px;' +
        "font-family:'Inter',system-ui,sans-serif;color:#cbd5e1;position:relative}" +
        '#swaPreviewBar .pbar-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}' +
        '#swaPreviewBar .pbar-title{font-weight:800;font-size:.95rem;color:#f1f5f9;letter-spacing:.02em}' +
        '#swaPreviewBar .pbar-tag{font-size:.66rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;' +
        'background:rgba(124,58,237,.25);border:1px solid rgba(124,58,237,.5);color:#ddd6fe;border-radius:999px;padding:3px 10px}' +
        '#swaPreviewBar .pbar-row{font-size:.82rem;line-height:1.5;display:flex;gap:8px;margin-top:5px}' +
        '#swaPreviewBar .pbar-row b{color:#e2e8f0;font-weight:700}' +
        '#swaPreviewBar .pbar-row .pbar-ico{flex:0 0 auto;opacity:.9}' +
        '#swaPreviewBar .pbar-fine{font-size:.74rem;color:#94a3b8;margin-top:9px}' +
        '#swaPreviewBar .pbar-dismiss{position:absolute;top:8px;right:10px;background:none;border:none;color:#94a3b8;' +
        'font-size:1rem;cursor:pointer;line-height:1;padding:4px}' +
        '#swaPreviewBar .pbar-dismiss:hover{color:#e2e8f0}' +
        /* The window buttons belong to the frameless Electron window. In a browser
           tab they do nothing, so hide them rather than show dead controls. */
        'html.swa-web-preview .titlebar-controls{display:none}' +
        'html.swa-web-preview #titlebar{-webkit-app-region:no-drag}' +
        'html.swa-web-preview body.swa-dropping::after{content:"Drop a scan .json file to load it";' +
        'position:fixed;inset:12px;border:2px dashed #7c3aed;border-radius:18px;background:rgba(7,11,24,.86);' +
        'color:#e2e8f0;font-family:Inter,system-ui,sans-serif;font-weight:700;font-size:1.05rem;' +
        'display:flex;align-items:center;justify-content:center;z-index:99999;pointer-events:none}';

    function injectStyle() {
        if (document.getElementById('swaPreviewStyle')) return;
        var s = document.createElement('style');
        s.id = 'swaPreviewStyle';
        s.textContent = STYLE;
        (document.head || document.documentElement).appendChild(s);
    }

    function esc(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function fmtDate(iso) {
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return null;
            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
                ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        } catch (e) { return null; }
    }

    /** Everything the banner claims is read back from the data actually loaded. */
    function facts() {
        var app = window.app || {};
        var profile = app.currentProfile || {};
        var posts = app.currentPosts || [];
        var snap = app._displayedSnapshot || null;
        var report = (snap && snap.scanReport) || app.lastScanReport || null;
        var collectedAt = (snap && snap.savedAt) || profile.fetchedAt || null;
        return {
            username: profile.username || null,
            scanned: posts.length,
            total: typeof profile.posts === 'number' ? profile.posts : null,
            followers: profile.followers != null ? profile.followers : null,
            collectedAt: collectedAt,
            complete: report ? report.complete === true : null,
            fromSavedScan: !!snap,
        };
    }

    function renderBanner() {
        var host = document.getElementById('mainContent');
        if (!host) return;
        var f = facts();
        var old = document.getElementById('swaPreviewBar');
        if (old && old.parentNode) old.parentNode.removeChild(old);

        var lines = [];
        if (f.username && f.scanned) {
            var covered = f.total
                ? '<b>' + f.scanned.toLocaleString() + '</b> of the account\'s <b>' + f.total.toLocaleString() + ' posts</b>'
                : '<b>' + f.scanned.toLocaleString() + ' posts</b>';
            var when = fmtDate(f.collectedAt);
            lines.push('<div class="pbar-row"><span class="pbar-ico">💾</span><span>Showing a <b>real saved scan</b> of ' +
                '<b>@' + esc(f.username) + '</b> — ' + covered + (when ? ', collected <b>' + esc(when) + '</b>' : '') + '.</span></div>');
            if (f.complete === false) {
                lines.push('<div class="pbar-row"><span class="pbar-ico">⚠️</span><span>That walk was <b>cut short by Instagram\'s ' +
                    'anonymous rate limit</b>, so it is a partial history and every coverage figure on screen says so. ' +
                    'The desktop app continues a saved walk from where it stopped.</span></div>');
            } else if (f.complete === true) {
                lines.push('<div class="pbar-row"><span class="pbar-ico">✅</span><span>That walk reached the account\'s <b>first post</b> — ' +
                    'the analytics describe the whole account history.</span></div>');
            }
            if (meta && meta.countsFrom) {
                lines.push('<div class="pbar-row"><span class="pbar-ico">🔎</span><span>The follower / following / post totals come from ' +
                    esc(meta.countsFrom) + ' — they are counted, not estimated.</span></div>');
            }
        } else {
            lines.push('<div class="pbar-row"><span class="pbar-ico">💾</span><span>No scan data loaded yet — ' +
                'import a scan file (Settings → 📥 Import JSON) or drop one anywhere on this page.</span></div>');
        }

        lines.push('<div class="pbar-row"><span class="pbar-ico">🔍</span><span><b>Live scanning runs in the desktop app only.</b> ' +
            'Instagram refuses anonymous cross-origin requests, so a browser page cannot walk a profile — the ' +
            'Scan buttons below explain this instead of failing.</span></div>');
        lines.push('<div class="pbar-row"><span class="pbar-ico">🧪</span><span><b>Try your own data:</b> ' +
            'drop a scan .json anywhere on this page, or use Settings → 📥 Import JSON. ' +
            'Every other tab works normally.</span></div>');

        var built = meta && meta.builtAt ? fmtDate(meta.builtAt) : null;
        var fine = 'Read-only preview · nothing is uploaded — everything stays in your browser\'s own storage' +
            (meta && meta.version ? ' · app v' + esc(meta.version) : '') +
            (built ? ' · built ' + esc(built) : '');

        var bar = document.createElement('div');
        bar.id = 'swaPreviewBar';
        bar.innerHTML =
            '<button class="pbar-dismiss" id="swaPreviewDismiss" title="Hide this notice">✕</button>' +
            '<div class="pbar-head"><span class="pbar-title">🖥️ SWA — online preview</span>' +
            '<span class="pbar-tag">read-only</span></div>' +
            lines.join('') +
            '<div class="pbar-fine">' + fine + '</div>';
        host.insertBefore(bar, host.firstChild);
        var dismiss = document.getElementById('swaPreviewDismiss');
        if (dismiss) dismiss.addEventListener('click', function () {
            bar.parentNode.removeChild(bar);
            try { localStorage.setItem('swaPreviewBannerDismissed', '1'); } catch (e) { }
        });
    }

    /* ── Scanning needs Electron: say so instead of throwing ────────────────── */
    var NO_SCAN_MSG = '🖥️ Live scanning runs in the desktop app — Instagram refuses anonymous ' +
        'cross-origin requests from a browser page. Drop a scan .json file here (or Settings → 📥 Import JSON) ' +
        'to load real data into this preview.';

    /* `class InstagramAnalytics {}` at the top level of a classic script creates a
       global LEXICAL binding, not a window property — so reach it by identifier. */
    function appProto() {
        try {
            return (typeof InstagramAnalytics !== 'undefined' && InstagramAnalytics &&
                InstagramAnalytics.prototype) || null;
        } catch (e) { return null; }
    }

    function blockScanning() {
        try {
            var P = appProto();
            if (!P) return;
            ['fetchPlatformProfile', 'scanFullHistory', 'scanPosts', 'fetchProfileInfo', 'refreshLiveData'].forEach(function (name) {
                if (typeof P[name] !== 'function') return;
                var original = P[name];
                P[name] = function () {
                    if (typeof showToast === 'function') showToast(NO_SCAN_MSG, 'warning');
                    console.log('[SWA] scan blocked — web preview (' + name + ' needs the Electron main process)');
                    return Promise.resolve(null);
                };
                P[name]._swaWebBlocked = true;
                void original;
            });
        } catch (e) { console.warn('[SWA] could not block scanning in preview:', e && e.message); }
    }

    /* ── Accept any scan file the app can produce ────────────────────────────
       The desktop app writes scans in more than one shape (the Settings importer
       only understands {profile, posts}). Normalising here means a tester can
       hand the preview whatever their own app produced and see it render. */
    function normalizeScan(data) {
        if (!data || typeof data !== 'object') return null;

        // 1) Already the shape _importScanData expects.
        if (data.profile && Array.isArray(data.posts)) return data;

        // 2) Scan-library export: one entry per account — take the newest.
        if (data.accounts && typeof data.accounts === 'object') {
            var picks = Object.keys(data.accounts).map(function (k) { return data.accounts[k]; })
                .filter(function (s) { return s && s.profile && Array.isArray(s.posts); });
            if (!picks.length) return null;
            picks.sort(function (a, b) {
                return Date.parse(b.savedAt || b.updatedAt || 0) - Date.parse(a.savedAt || a.updatedAt || 0);
            });
            return picks[0];
        }

        // 3) Disk-checkpoint / bare scan: {username, posts[], complete, ...}
        if (Array.isArray(data.posts) && data.posts.length) {
            var header = data.profile || {};
            var username = header.username || data.username || '';
            if (!username) return null;
            return {
                profile: Object.assign({
                    username: username,
                    fullName: header.fullName || '',
                    bio: header.bio || '',
                    profilePicUrl: header.profilePicUrl || '',
                    followers: header.followers != null ? header.followers : null,
                    following: header.following != null ? header.following : null,
                    posts: header.posts != null ? header.posts : null,
                    externalUrl: header.externalUrl || '',
                    isVerified: header.isVerified === true,
                    userId: header.userId || data.userId || null,
                    fetchedAt: header.fetchedAt || data.updatedAt || null,
                }, {}),
                posts: data.posts,
                savedAt: data.updatedAt || data.savedAt || null,
                scanReport: data.scanReport || {
                    complete: data.complete === true,
                    pages: data.pages || null,
                    stoppedReason: data.stoppedReason || null,
                    posts: data.posts.length,
                },
                methods: data.methods || [],
                fromWebPreview: true,
            };
        }
        return null;
    }

    function installImporter() {
        try {
            var P = appProto();
            if (!P || typeof P.importData !== 'function' || P.importData._swaWebWrapped) return;
            var original = P.importData;
            var wrapped = function (event) {
                var file = event && event.target && event.target.files && event.target.files[0];
                if (!file) return original.call(this, event);
                var self = this;
                var r = new FileReader();
                r.onload = function (e) {
                    var normalized = null;
                    try { normalized = normalizeScan(JSON.parse(e.target.result)); } catch (err) { normalized = null; }
                    if (!normalized) {
                        if (typeof showToast === 'function') {
                            showToast('Import failed — that file has no posts array to read.', 'error');
                        }
                        return; // do NOT hand an unknown shape to the settings importer
                    }
                    self._importScanData(normalized, {});
                    setTimeout(function () { renderBanner(); }, 600);
                };
                r.readAsText(file);
            };
            wrapped._swaWebWrapped = true;
            P.importData = wrapped;
        } catch (e) { console.warn('[SWA] could not extend the importer:', e && e.message); }
    }

    function installDropZone() {
        if (window.__swaWebDropInstalled) return;
        window.__swaWebDropInstalled = true;
        var depth = 0;
        function scanFileFrom(list) {
            if (!list) return null;
            for (var i = 0; i < list.length; i++) {
                var f = list[i];
                if (f && (/\.json$/i.test(f.name) || f.type === 'application/json')) return f;
            }
            return null;
        }
        window.addEventListener('dragenter', function (e) {
            if (!scanFileFrom(e.dataTransfer && e.dataTransfer.items ? e.dataTransfer.items : null) &&
                !scanFileFrom(e.dataTransfer && e.dataTransfer.files)) return;
            depth++;
            document.body.classList.add('swa-dropping');
        });
        window.addEventListener('dragover', function (e) { e.preventDefault(); });
        window.addEventListener('dragleave', function () {
            depth = Math.max(0, depth - 1);
            if (!depth) document.body.classList.remove('swa-dropping');
        });
        window.addEventListener('drop', function (e) {
            var file = scanFileFrom(e.dataTransfer && e.dataTransfer.files);
            if (!file) return;
            e.preventDefault();
            depth = 0;
            document.body.classList.remove('swa-dropping');
            if (window.app && typeof window.app.importData === 'function') {
                window.app.importData({ target: { files: [file] } });
            }
        });
    }

    /* ── After boot: show the saved scan, the banner, and honest buttons ────── */
    function whenReady(fn, tries) {
        var attempts = tries == null ? 120 : tries; // ~30s ceiling
        if (window.__swaBooted && window.app) return fn();
        if (attempts <= 0) return fn(); // boot failed — still explain what the page is
        setTimeout(function () { whenReady(fn, attempts - 1); }, 250);
    }

    function install() {
        injectStyle();
        try { document.documentElement.classList.add('swa-web-preview'); } catch (e) { }
        installDropZone();
        installImporter();
        blockScanning();
        // Diagnostics a tester (or a headless check) can read back.
        window.__swaWebPreview = {
            scanBlocked: !!(appProto() && appProto().fetchPlatformProfile && appProto().fetchPlatformProfile._swaWebBlocked),
            importerWrapped: !!(appProto() && appProto().importData && appProto().importData._swaWebWrapped),
            isElectron: IS_ELECTRON,
        };

        whenReady(function () {
            // Keep the banner out of the way for a tester who already dismissed it,
            // but always re-show it when there is no data to explain.
            var dismissed = false;
            try { dismissed = localStorage.getItem('swaPreviewBannerDismissed') === '1'; } catch (e) { }

            var loaded = !!(window.app && window.app.currentProfile && (window.app.currentPosts || []).length);
            var finish = function () {
                var f = facts();
                if (!dismissed || (!f.username && !f.scanned)) renderBanner();
                // app.js reads the version out of package.json through require('path'),
                // which does not exist in a browser — supply the real one here.
                if (meta && meta.version) {
                    var el = document.getElementById('appVersion');
                    if (el) el.textContent = 'v' + meta.version;
                }
            };
            if (loaded) return finish();

            samplePromise.then(function (data) {
                var normalized = normalizeScan(data);
                if (normalized && window.app && typeof window.app._importScanData === 'function') {
                    try {
                        window.app._importScanData(normalized, { stayHere: true });
                        console.log('[SWA] 📥 Web preview loaded ' + normalized.posts.length +
                            ' posts from preview-scan.json (source: ' + ((meta && meta.source) || 'unknown') + ')');
                    } catch (e) { console.warn('[SWA] preview data failed to load:', e && e.message); }
                }
                setTimeout(finish, 700);
            });
        });
    }

    window.addEventListener('load', install);
    // If the load event already fired (script injected late), run now.
    if (document.readyState === 'complete') install();
    void metaPromise;
})();
