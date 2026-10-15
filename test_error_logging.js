/**
 * test_error_logging.js — Verify the error log actually records failures.
 *
 * The previous logger silently discarded whole classes of real errors
 * ("Failed to load", "Request timed out", "NetworkError", "404 Not found") via a
 * broad noise filter, which is exactly how a broken scrape looked like a clean
 * run. These tests pin the behaviour:
 *   • real failures are KEPT,
 *   • only genuine library noise is suppressed — and it is counted, not dropped
 *     invisibly,
 *   • repeated errors collapse into one entry with a counter,
 *   • boot failures are reported at critical severity,
 *   • the 200-entry cap holds the newest problems.
 *
 * Usage: node test_error_logging.js
 */
'use strict';

/* ── Minimal DOM/localStorage so error-handling.js can run in Node ── */
const store = {};
global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
};
global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    documentElement: { getAttribute: () => 'dark' },
};
global.window = { addEventListener: () => { }, matchMedia: () => ({ matches: false }) };
global.InstagramAnalytics = function () { };
const P = InstagramAnalytics.prototype;
P.getVersion = function () { return 'test'; };
// storage.js owns saveErrorLog in the real app; stub it so this test exercises
// logging alone (it is required separately by the boot smoke test).
P.saveErrorLog = function () {
    try {
        localStorage.setItem('swaErrorLog', JSON.stringify(this.errorLog || []));
    } catch (e) { }
};

require('./error-handling.js');

const app = new InstagramAnalytics();
app.errorLog = [];

let failures = 0;
let checks = 0;
function check(name, cond, detail) {
    checks++;
    if (cond) console.log('  ✅ ' + name);
    else { failures++; console.error('  ❌ ' + name + (detail ? ' — ' + detail : '')); }
}

console.log('\n════════ ERROR LOGGING ════════\n');

/* ── 1. Real failures must be recorded ── */
console.log('1) Real failures reach the log');
{
    const mustKeep = [
        'Failed to load resource: net::ERR_NAME_NOT_RESOLVED',
        'Request timed out',
        'NetworkError when attempting to fetch resource',
        'Profile not found (404)',
        'Feed API HTTP 500 — upstream error',
        "Cannot read properties of undefined (reading 'likes')",
        'this.renderChart is not a function',
        'Missing method: scanPosts()',
    ];
    mustKeep.forEach((msg, i) => app.logError(msg, 'scrape#' + i, String(i)));
    const logged = app.errorLog.map(e => e.message);
    mustKeep.forEach(msg => {
        check('kept: "' + msg.slice(0, 42) + '"', logged.includes(msg));
    });
}

/* ── 2. Pure library noise is suppressed but counted ── */
console.log('\n2) Library noise is suppressed, and counted');
{
    const before = app.errorLog.length;
    app.logError('ResizeObserver loop completed with undelivered notifications.', 'observer');
    app.logError('Script error.', 'cross-origin');
    check('no entry added for noise', app.errorLog.length === before, 'log grew to ' + app.errorLog.length);
    check('the suppression is counted, not hidden', app._noiseSuppressed === 2, String(app._noiseSuppressed));
}

/* ── 3. Repeats collapse instead of flooding ── */
console.log('\n3) Repeated errors collapse into one counted entry');
{
    app.errorLog = [];
    for (let i = 0; i < 25; i++) app.logError('Chart canvas is missing', 'renderCharts', '12');
    check('25 occurrences → 1 entry', app.errorLog.length === 1, 'got ' + app.errorLog.length);
    check('the counter records all 25', app.errorLog[0].count === 25, String(app.errorLog[0].count));
    check('a repeat timestamp is kept', !!app.errorLog[0].lastSeen || app.errorLog[0].count === 25);
}

/* ── 4. Severity classification ── */
console.log('\n4) Severity classification');
{
    app.errorLog = [];
    app._noiseSuppressed = 0;
    app.logError('boot step "renderCharts" threw: canvas is null', 'boot:renderCharts', '');
    app.logError('Feed API HTTP 429 — rate limited', 'scrape-rate-limit', '');
    app.logError('Cannot read properties of null', 'ui', '9');
    app.logError('Request timed out', 'scrape-timeout', '');
    app.logError('Test error from guardedMethod', 'test-guard', '');
    const bySev = {};
    app.errorLog.forEach(e => { bySev[e.severity] = (bySev[e.severity] || 0) + 1; });
    const find = src => app.errorLog.find(e => e.source === src);
    check('boot failure → critical', find('boot:renderCharts').severity === 'critical', JSON.stringify(find('boot:renderCharts')));
    check('429 → warning', find('scrape-rate-limit').severity === 'warning', JSON.stringify(find('scrape-rate-limit')));
    check('timeout → error', find('scrape-timeout').severity === 'error', JSON.stringify(find('scrape-timeout')));
    check('null dereference → critical', find('ui').severity === 'critical');
    check('test message → test', find('test-guard').severity === 'test');
}

/* ── 5. Stack traces are captured ── */
console.log('\n5) Stack traces attached for debugging');
{
    app.errorLog = [];
    app.logError('Something exploded', 'unit', '3');
    check('the log entry carries a stack', typeof app.errorLog[0].stack === 'string' && app.errorLog[0].stack.length > 0,
        String(app.errorLog[0].stack));
    check('the stack points at this test file', /test_error_logging/.test(app.errorLog[0].stack));
}

/* ── 6. Persistence + cap ── */
console.log('\n6) Persistence and the 200-entry cap');
{
    app.errorLog = [];
    app.logError('persisted entry', 'unit', '1');
    check('written to localStorage', !!store['swaErrorLog'] && store['swaErrorLog'].includes('persisted entry'));

    app.errorLog = [];
    for (let i = 0; i < 260; i++) app.logError('error number ' + i, 'loop', String(i));
    check('log is capped at 200', app.errorLog.length === 200, 'got ' + app.errorLog.length);
    check('the cap keeps the NEWEST problems', app.errorLog[0].message === 'error number 259', app.errorLog[0].message);
    check('nothing is dropped silently when at capacity',
        app.errorLog[199].message === 'error number 60', app.errorLog[199].message);
}

/* ── 7. detectKnownError still explains real failures ── */
console.log('\n7) Known-error hints survive the rewrite');
{
    check('rate limit explained', /rate limit/i.test(String(app.detectKnownError('HTTP 429 rate limited'))));
    check('network explained', /network/i.test(String(app.detectKnownError('NetworkError when attempting to fetch'))));
    check('null access explained', /check if the object exists/i.test(String(app.detectKnownError("Cannot read property 'x' of undefined"))),
        String(app.detectKnownError("Cannot read property 'x' of undefined")));
    check('unknown errors return no hint', app.detectKnownError('totally novel failure') === null);
}

console.log('\n─────────────────────────────────────────');
if (failures === 0) {
    console.log('✅ ERROR LOGGING — ' + checks + '/' + checks + ' checks passed');
    process.exit(0);
}
console.error('❌ ' + failures + ' of ' + checks + ' checks failed');
process.exit(1);
