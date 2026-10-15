/**
 * test_boot_smoke.js — Does the app actually boot, every time?
 *
 * Launches the REAL index.html in a hidden Electron window (same webPreferences
 * as main.js), waits for boot, then inspects the live app:
 *   • window.__swaBooted and app.bootReport — did boot complete cleanly?
 *   • the module self-check — did every module file load and define its methods?
 *   • pre-boot error buffer — was anything thrown before logging existed?
 *   • the new full-history surface (button, progress element, scanFullHistory)
 *   • history-scan.js is require()-able from the renderer (the merge/coverage
 *     helpers the scan path depends on)
 *
 * Usage: npx electron test_boot_smoke.js
 * Exit code 0 = app booted clean; 1 = something failed (details printed).
 */
'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');

const consoleErrors = [];
const consoleWarns = [];
let pageErrors = [];

function fail(msg) {
    console.error('  ❌ ' + msg);
    failures++;
}
let failures = 0;
function pass(msg) {
    console.log('  ✅ ' + msg);
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
        },
    });

    win.webContents.on('console-message', (event, level, message) => {
        // level: 0 verbose, 1 info, 2 warning, 3 error
        if (level >= 3) consoleErrors.push(message);
        else if (level === 2) consoleWarns.push(message);
    });
    win.webContents.on('render-process-gone', (e, details) => {
        pageErrors.push('render process gone: ' + JSON.stringify(details));
    });
    win.webContents.on('did-fail-load', (e, code, desc) => {
        pageErrors.push('did-fail-load ' + code + ' ' + desc);
    });

    console.log('\n════════ BOOT SMOKE TEST ════════\n');

    try {
        await win.loadFile(path.join(__dirname, 'index.html'));
    } catch (err) {
        console.error('  ❌ index.html failed to load: ' + err.message);
        app.exit(1);
        return;
    }

    // Give boot (plus its async intro animation) time to finish.
    await new Promise(r => setTimeout(r, 4000));

    let diag = null;
    try {
        diag = await win.webContents.executeJavaScript(`(function () {
            var a = window.app || null;
            var req = typeof require === 'function' ? require : null;
            var historyScan = 'not-required';
            try {
                if (req) {
                    var hs = req('./history-scan.js');
                    historyScan = (hs && typeof hs.paginateAll === 'function' && typeof hs.mergePosts === 'function' && typeof hs.coverage === 'function')
                        ? 'ok' : 'missing-exports';
                }
            } catch (e) { historyScan = 'error: ' + e.message; }

            return {
                booted: window.__swaBooted === true,
                bootReport: (a && a.bootReport) ? a.bootReport : null,
                moduleReport: (window.__swaBootModuleReport ? window.__swaBootModuleReport() : null),
                bootErrorBuffer: (window.__swaBoot ? window.__swaBoot.errors.length : -1),
                bootErrorMessages: (window.__swaBoot ? window.__swaBoot.errors.map(function (e) { return e.type + ': ' + e.message; }) : []),
                assetFailures: (window.__swaBoot && window.__swaBoot.resourceErrors) ? window.__swaBoot.resourceErrors.length : 0,
                assetFailuresUrls: (window.__swaBoot && window.__swaBoot.resourceErrors) ? window.__swaBoot.resourceErrors.map(function (r) { return r.url; }) : [],
                methodTypes: {
                    scanFullHistory: typeof (a && a.scanFullHistory),
                    scrapeViaIPC: typeof (a && a.scrapeViaIPC),
                    _onScanProgress: typeof (a && a._onScanProgress),
                    coverageLabel: typeof (a && a.coverageLabel),
                    renderDataQualityBanner: typeof (a && a.renderDataQualityBanner),
                    generatePostSuggestions: typeof (a && a.generatePostSuggestions),
                    logError: typeof (a && a.logError),
                    _isNoiseMessage: typeof (a && a._isNoiseMessage),
                },
                elements: {
                    fullHistoryBtn: !!document.getElementById('fullHistoryBtn'),
                    postsLoadingProgress: !!document.getElementById('postsLoadingProgress'),
                    errBootStatus: !!document.getElementById('errBootStatus'),
                    errSummary: !!document.getElementById('errSummary'),
                },
                scriptOrder: Array.prototype.map.call(document.scripts, function (s) { return s.getAttribute('src'); })
                    .filter(Boolean),
                errorLogLength: (a && a.errorLog) ? a.errorLog.length : -1,
                errorLogTop: (a && a.errorLog && a.errorLog.length) ? {
                    message: a.errorLog[0].message, severity: a.errorLog[0].severity, source: a.errorLog[0].source,
                } : null,
                historyScan: historyScan,
            };
        })()`);
    } catch (err) {
        console.error('  ❌ diagnostics could not be read: ' + err.message);
        app.exit(1);
        return;
    }

    /* ── Boot completed ── */
    if (diag.booted) pass('window.__swaBooted is true (boot ran)');
    else fail('boot never ran — window.__swaBooted is not true');

    if (diag.bootReport) {
        if (diag.bootReport.ok) {
            pass('boot report is clean (' + diag.bootReport.durationMs + 'ms, ' +
                (diag.bootReport.failedSteps || []).length + ' failed steps)');
        } else {
            fail('boot finished with issues: ' + JSON.stringify({
                failedSteps: diag.bootReport.failedSteps,
                modulesMissing: diag.bootReport.modulesMissing,
                missingMethods: diag.bootReport.missingMethods,
                earlyErrors: diag.bootReport.earlyErrors,
            }));
        }
    } else {
        fail('no boot report — the boot self-check did not run');
    }

    /* ── Every module loaded ── */
    const mr = diag.moduleReport;
    if (mr && mr.ok) pass('all ' + mr.modulesChecked + ' module files loaded with their methods');
    else fail('modules missing: ' + JSON.stringify(mr ? mr.missingModules : mr) +
        ' methods: ' + JSON.stringify(mr ? mr.missingMethods : null));

    if (diag.bootErrorBuffer === 0) pass('no JavaScript errors were thrown before logging started');
    else fail(diag.bootErrorBuffer + ' pre-boot JS error(s) captured: ' + JSON.stringify(diag.bootErrorMessages));

    // Missing assets (e.g. the Google Fonts stylesheet in an offline sandbox) are
    // reported, not treated as a broken boot.
    if (diag.assetFailures) {
        console.log('  ℹ️  ' + diag.assetFailures + ' asset(s) could not be fetched (offline/blocked resource — not a code error): ' +
            (diag.assetFailuresUrls || []).join(', '));
        // A local script we ship failing to load WOULD be a code error.
        const localFailures = (diag.assetFailuresUrls || []).filter(u => /\.(js|css)(\?|$)/.test(u) && !/^https?:/i.test(u));
        if (localFailures.length) fail('local asset(s) failed to load: ' + localFailures.join(', '));
        else pass('no local script/stylesheet failed to load');
    } else {
        pass('all assets fetched');
    }

    /* ── Full-history surface is wired ── */
    Object.keys(diag.methodTypes).forEach(function (name) {
        if (diag.methodTypes[name] === 'function') pass('app.' + name + '() is defined');
        else fail('app.' + name + '() is ' + diag.methodTypes[name]);
    });

    Object.keys(diag.elements).forEach(function (id) {
        if (diag.elements[id]) pass('#' + id + ' present in the DOM');
        else fail('#' + id + ' missing from index.html');
    });

    /* ── Script order: boot-diagnostics must load first ── */
    const scripts = diag.scriptOrder || [];
    const diagIdx = scripts.indexOf('boot-diagnostics.js');
    const appIdx = scripts.indexOf('app.js');
    if (diagIdx >= 0 && appIdx >= 0 && diagIdx < appIdx) pass('boot-diagnostics.js loads before app.js');
    else fail('boot-diagnostics.js must load before app.js (got diag=' + diagIdx + ', app=' + appIdx + ')');

    /* ── Shared scan core usable from the renderer ── */
    if (diag.historyScan === 'ok') pass('history-scan.js is loadable in the renderer (paginateAll/mergePosts/coverage)');
    else fail('history-scan.js not usable in the renderer: ' + diag.historyScan);

    /* ── No real errors logged during boot ── */
    if (diag.errorLogLength === 0) pass('error log is empty after boot');
    else {
        // Rate-limit / network noise from the background auto-refresh is expected
        // in a sandboxed run; anything else means boot had a real problem.
        const top = diag.errorLogTop || {};
        const benign = /rate limit|429|blocked|Failed to load resource|net::|NetworkError|timeout|not found|404/i.test(String(top.message || ''));
        if (benign) console.log('  ℹ️  ' + diag.errorLogLength + ' console error(s) logged, first is network-related: ' + String(top.message).slice(0, 80));
        else fail('errors logged during boot — first: ' + JSON.stringify(top));
    }

    if (pageErrors.length) fail('page-level failures: ' + pageErrors.join(' | '));
    else pass('no page-level failures (render process alive)');

    if (consoleErrors.length) {
        console.log('  ℹ️  ' + consoleErrors.length + ' console error message(s) (network-scraper noise in a sandbox is normal)');
        consoleErrors.slice(0, 5).forEach(m => console.log('     · ' + String(m).slice(0, 140)));
    }

    console.log('\n─────────────────────────────────────────');
    if (failures === 0) {
        console.log('✅ BOOT OK — app came up clean');
        app.exit(0);
    } else {
        console.error('❌ ' + failures + ' boot check(s) failed');
        app.exit(1);
    }
});
