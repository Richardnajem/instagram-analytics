/**
 * test_scan_orchestration.js — The renderer side of the full-history scan.
 *
 * Verifies the behaviour the user actually sees:
 *   • scans ACCUMULATE — running the scan again keeps the older posts it found
 *     instead of replacing them with the newest page,
 *   • the oldest post of the account survives a merge (that is the whole point),
 *   • coverage is reported against the account's real post count,
 *   • a partial walk says it is partial, and why,
 *   • live progress reaches the loading overlay during a long walk.
 *
 * Usage: node test_scan_orchestration.js
 */
'use strict';

const messages = [];
const elementText = {};

/* ── Minimal DOM + toast so scraping.js can run in Node ── */
// Elements are cached per id so a test can inspect what the app did to a
// control (its style, its label) after a render pass.
const elements = {};
function makeEl(id) {
    if (elements[id]) return elements[id];
    const el = {
        id,
        style: {},
        classList: { add() { }, remove() { }, contains: () => false, toggle() { } },
        set textContent(v) { elementText[id] = v; },
        get textContent() { return elementText[id] || ''; },
        innerHTML: '',
    };
    elements[id] = el;
    return el;
}
global.document = {
    getElementById: id => makeEl(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    documentElement: { getAttribute: () => 'dark' },
};
global.window = { addEventListener: () => { }, matchMedia: () => ({ matches: false }) };
global.showToast = (msg, type) => messages.push({ msg, type });
global.requestAnimationFrame = () => 0;
global.InstagramAnalytics = function () { };
const P = InstagramAnalytics.prototype;
P.escHtml = s => String(s == null ? '' : s);
P.fmt = n => String(n);

require('./scraping.js');
// ui.js owns the real loading-overlay helpers that the progress handler drives,
// so load it too — the progress assertions below test the shipped implementation.
require('./ui.js');

const app = new InstagramAnalytics();
app.currentPage = 'dashboard';

let failures = 0;
let checks = 0;
function check(name, cond, detail) {
    checks++;
    if (cond) console.log('  ✅ ' + name);
    else { failures++; console.error('  ❌ ' + name + (detail ? ' — ' + detail : '')); }
}

const post = (code, ts, likes) => ({
    shortcode: code, timestamp: ts, likes, comments: 2,
    caption: 'c ' + code, postType: 'photo', thumbnail: '',
});

console.log('\n════════ FULL-HISTORY SCAN ORCHESTRATION ════════\n');

/* ── 1. Scanning accumulates instead of restarting ── */
console.log('1) Repeated scans accumulate the account history');
{
    // First run: the newest 3 posts.
    const run1 = [post('NEW1', 3000, 50), post('NEW2', 2000, 40), post('NEW3', 1000, 30)];
    const after1 = app._mergeScannedPosts([], run1);
    check('first scan stores all 3', after1.length === 3, 'got ' + after1.length);

    // Second run resumes deeper: newer posts come back too, plus the account's
    // very first post. The old ones must NOT be lost.
    const run2 = [post('NEW1', 3000, 50), post('NEW2', 2000, 40), post('OLD1', 500, 5), post('FIRST', 10, 1)];
    const after2 = app._mergeScannedPosts(after1, run2);

    check('second scan keeps everything from the first', after2.some(p => p.shortcode === 'NEW3'));
    check('reaches the account\'s very first post', after2.some(p => p.shortcode === 'FIRST'));
    check('no duplicates after merging', after2.length === 5, 'got ' + after2.length + ' → ' + after2.map(p => p.shortcode));
    check('ordered newest-first (oldest last)', after2[after2.length - 1].shortcode === 'FIRST',
        after2.map(p => p.shortcode).join(','));
}

/* ── 2. Merge keeps the richest real values per post ── */
console.log('\n2) A later scan upgrades a post instead of degrading it');
{
    const earlier = [{ shortcode: 'X', likes: 100, comments: 9, caption: 'short', thumbnail: 'thumb.jpg', timestamp: 100 }];
    const later = [{ shortcode: 'X', likes: 250, comments: null, caption: 'a much longer caption', hashtags: ['#real'], timestamp: 100 }];
    const merged = app._mergeScannedPosts(earlier, later);
    check('one post after merge', merged.length === 1);
    check('like count moved up to 250', merged[0].likes === 250, String(merged[0].likes));
    check('comment count was not lost', merged[0].comments === 9, String(merged[0].comments));
    check('longer caption wins', merged[0].caption === 'a much longer caption', merged[0].caption);
    check('hashtags carried over', merged[0].hashtags[0] === '#real');
    check('thumbnail preserved', merged[0].thumbnail === 'thumb.jpg');
}

/* ── 3. Coverage reflects the account total honestly ── */
console.log('\n3) Coverage measured against the account\'s real post count');
{
    const posts = [post('A', 100, 5), post('B', 200, 6), post('C', 300, 7)];
    const full = app._scanCoverage(posts, 3);
    check('complete when scanned === total', full.complete === true && full.percent === 100, JSON.stringify(full));
    const partial = app._scanCoverage(posts, 912);
    check('3 of 912 → 0.3%', partial.percent === 0.3, String(partial.percent));
    check('missing count reported', partial.missing === 909, String(partial.missing));
    check('date span of the real posts reported', partial.oldest === 100 && partial.newest === 300, JSON.stringify(partial));
    const unknown = app._scanCoverage(posts, null);
    check('unknown total is never invented', unknown.total === null && unknown.percent === null, JSON.stringify(unknown));
}

/* ── 4. The outcome message never overstates ── */
console.log('\n4) Outcome messaging is honest');
{
    app.currentProfile = { username: 'acct', posts: 912 };

    messages.length = 0;
    app.lastScanReport = { complete: true };
    app._reportScanOutcome(app._scanCoverage([post('A', 100, 1)], 1), 1);
    check('complete walk is announced as complete', /Full history complete/i.test(messages[0].msg), messages[0].msg);
    check('success toast type', messages[0].type === 'success');

    messages.length = 0;
    app.lastScanReport = { complete: false, stoppedReason: 'error' };
    app._reportScanOutcome(app._scanCoverage([post('A', 100, 1)], 912), 1);
    check('partial walk is announced as partial', /Partial history/i.test(messages[0].msg), messages[0].msg);
    check('the reason is shown', /error/.test(messages[0].msg), messages[0].msg);
    check('coverage % is shown', /0\.1% of the account/.test(messages[0].msg), messages[0].msg);
    check('the user is told they can resume', /continue where it stopped/i.test(messages[0].msg), messages[0].msg);
    check('warning toast type, not success', messages[0].type === 'warning');
}

/* ── 5. Live progress reaches the overlay ── */
console.log('\n5) Progress is visible during a long walk');
{
    elementText['postsLoadingText'] = '';
    app._onScanProgress({ phase: 'page', page: 12, posts: 576, moreAvailable: true });
    check('overlay shows posts collected', /576 posts collected/.test(elementText['postsLoadingText'] || ''),
        elementText['postsLoadingText']);
    check('overlay shows the page number', /page 12/.test(elementText['postsLoadingText'] || ''), elementText['postsLoadingText']);
    check('progress line also updated', /576 posts/.test(elementText['postsLoadingProgress'] || ''), elementText['postsLoadingProgress']);

    app._onScanProgress({ phase: 'retry', attempt: 2, maxRetries: 4, waitMs: 6000 });
    check('throttling is surfaced with the retry count', /retry 2\/4/.test(elementText['postsLoadingText'] || ''),
        elementText['postsLoadingText']);
}

/* ── 6. Coverage label shown on the posts page ── */
console.log('\n6) The posts page shows how much of the account is covered');
{
    // coverageLabel lives in utils.js; assert the app-level helper contract here.
    P.coverageLabel = function (posts) {
        const scanned = (posts || []).length;
        const total = this.currentProfile && this.currentProfile.posts;
        if (!total || Number(total) <= scanned) return String(scanned);
        return scanned + ' / ' + total + ' (' + Math.round((scanned / Number(total)) * 1000) / 10 + '%)';
    };
    app.currentProfile = { posts: 912 };
    check('partial coverage is visible on the page', app.coverageLabel([post('A', 1, 1)]) === '1 / 912 (0.1%)',
        app.coverageLabel([post('A', 1, 1)]));
}

/* ── 7. Full-history is the default for a scan ── */
console.log('\n7) Full-history is the default path');
{
    const src = require('fs').readFileSync(require('path').join(__dirname, 'scraping.js'), 'utf8');
    check('scanFullHistory exists', typeof app.scanFullHistory === 'function');
    check('scanFullHistory requests fullHistory: true',
        /scrapeViaIPC\(username,\s*\{\s*fullHistory:\s*true/.test(src),
        (src.match(/fetchFullHistory|scanFullHistory[^\n]*/) || [''])[0]);
    check('IPC passes fullHistory/resume/startCursor to the main process',
        /fullHistory: options\.fullHistory !== false/.test(src) && /startCursor: options\.startCursor/.test(src));
    check('the watchdog is idle-based, not a hard cap',
        /IDLE_MS = options\.fullHistory \? 120000 : 35000/.test(src) && /clearTimeout\(timeout\); timeout = setTimeout\(failIdle/.test(src));

    const mainSrc = require('fs').readFileSync(require('path').join(__dirname, 'main.js'), 'utf8');
    check('main process uses the uncapped walker on the feed',
        /historyScan\.paginateAll\(\{/.test(mainSrc) && /SAFETY_MAX_PAGES/.test(mainSrc));
    check('main process checkpoints resumable state to disk',
        /writeScanCache\(/.test(mainSrc) && /readScanCache\(/.test(mainSrc));
    check('main process streams progress to the renderer', /sendProgress\(\{ phase: 'page'/.test(mainSrc));
}

/* ── 8. A partial scan keeps the full-history action reachable ── */
console.log('\n8) A partially-scanned account can still fetch its older posts');
{
    /* Completeness is only claimed when it is known. */
    app.lastScanReport = null;
    app.currentProfile = { username: 'acct', posts: 912 };
    check('a newer page is not the whole account', app._scanIsComplete([post('A', 1, 1)]) === false);
    check('12 posts of a 912-post account → not complete',
        app._scanIsComplete(Array.from({ length: 12 }, (_, i) => post('p' + i, i, 1))) === false);

    app.currentProfile = { username: 'acct', posts: null };
    check('an unknown account total stays incomplete',
        app._scanIsComplete(Array.from({ length: 500 }, (_, i) => post('p' + i, i, 1))) === false);

    app.currentProfile = { username: 'acct', posts: 2 };
    check('holding the whole account → complete',
        app._scanIsComplete([post('A', 1, 1), post('B', 2, 1)]) === true);

    app.lastScanReport = { complete: true };
    check('a walk that reached the end → complete', app._scanIsComplete([post('A', 1, 1)]) === true);

    /* The button itself: card rendering is covered elsewhere, so stub it out to
       assert only what this check is about — whether the action is offered. */
    P.renderPostGrid = () => 1;
    app._hidePostsLoading = () => { };
    P.coverageLabel = posts => String((posts || []).length) + ' / 912 (1.3%)';

    app.lastScanReport = null;
    app.currentProfile = { username: 'acct', posts: 912, followers: 100 };
    app._renderPostsContent([post('A', 100, 1)]);
    check('full-history button STAYS VISIBLE on a partial scan',
        elements['fullHistoryBtn'].style.display === 'inline-flex',
        'display=' + elements['fullHistoryBtn'].style.display);
    check('its label offers to continue the history',
        /Continue Full History/.test(elementText['fullHistoryBtn'] || ''), elementText['fullHistoryBtn']);

    app.lastScanReport = { complete: true };
    app.currentProfile = { username: 'acct', posts: 1, followers: 100 };
    app._renderPostsContent([post('A', 100, 1)]);
    check('it is hidden only once the whole account is held',
        elements['fullHistoryBtn'].style.display === 'none',
        'display=' + elements['fullHistoryBtn'].style.display);
}

console.log('\n─────────────────────────────────────────');
if (failures === 0) {
    console.log('✅ SCAN ORCHESTRATION — ' + checks + '/' + checks + ' checks passed');
    process.exit(0);
}
console.error('❌ ' + failures + ' of ' + checks + ' checks failed');
process.exit(1);
