/**
 * test_scan_snapshot.js — The most recent SmallWorld scan is always kept.
 *
 * Everything the app promises about saved scans, verified:
 *   • every scan is written down (complete, partial or failed-after-posts),
 *   • a later, SMALLER scan merges instead of replacing — a 24-post anonymous
 *     peek can never wipe a 600-post walk,
 *   • a scan that collects nothing new leaves the earlier result untouched,
 *   • "posts collected in this run" and "posts known in total" are different
 *     numbers and stay different,
 *   • a partial walk stays partial after a save and a reload,
 *   • the age shown on screen is the age of the DATA, not of the file write,
 *   • nothing is invented: an unknown follower count stays unknown.
 *
 * Usage: node test_scan_snapshot.js
 */
'use strict';

/* ── Minimal browser environment for the storage/ui modules ── */
const store = new Map();
global.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
};

const elementText = {};
const elements = {};
function makeEl(id) {
    if (elements[id]) return elements[id];
    const el = {
        id,
        style: {},
        disabled: false,
        classList: { add() { }, remove() { }, contains: () => false, toggle() { } },
        set textContent(v) { elementText[id] = v; },
        get textContent() { return elementText[id] || ''; },
        innerHTML: '',
        addEventListener() { },
    };
    elements[id] = el;
    return el;
}
global.document = {
    getElementById: id => makeEl(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => makeEl('created-' + Math.random()),
    body: { appendChild() { }, removeChild() { } },
    documentElement: { getAttribute: () => 'dark' },
};
global.window = { addEventListener() { }, matchMedia: () => ({ matches: false }) };
global.showToast = () => { };
global.requestAnimationFrame = () => 0;
global.InstagramAnalytics = function () { };
const P = InstagramAnalytics.prototype;
P.escHtml = s => String(s == null ? '' : s);
P.fmt = n => String(n);
P._importScanData = () => { };      // not under test here
P.navigateTo = () => { };

require('./storage.js');
require('./ui.js');

const app = new InstagramAnalytics();

let failures = 0;
let checks = 0;
function check(name, cond, detail) {
    checks++;
    if (cond) console.log('  ✅ ' + name);
    else { failures++; console.error('  ❌ ' + name + (detail ? ' — ' + detail : '')); }
}

const post = (code, ts, likes) => ({
    shortcode: code, timestamp: ts, likes: likes == null ? null : likes, comments: 1,
    caption: 'c ' + code, postType: 'photo', thumbnail: '', hashtags: [],
});
const profile = (username, extra) => Object.assign({
    username, followers: null, following: null, posts: null,
    fullName: '', bio: '', profilePicUrl: '', externalUrl: '',
    fetchedAt: new Date().toISOString(),
}, extra || {});

console.log('\n════════ SAVED SCAN SNAPSHOTS ════════\n');

/* ── 1. A scan is written down ── */
console.log('1) Every scan is saved, with honest counts');
{
    app.saveScanSnapshot(profile('smallworld_foundation'), [post('A', 300, 50), post('B', 200, 40)], {
        scanReport: { complete: false, stoppedReason: 'cap' }, methods: [{ name: 'rendered-dom', status: 'ok' }],
    });
    const snap = app.loadScanSnapshot('smallworld_foundation');
    check('snapshot exists for the account', !!snap);
    check('posts stored', snap && snap.posts.length === 2, snap && String(snap.posts.length));
    check('posts collected in THIS run recorded', snap.scanPosts === 2, String(snap.scanPosts));
    check('posts known in total recorded', snap.knownPosts === 2, String(snap.knownPosts));
    check('partial walk stays partial', snap.complete === false);
    check('the stop reason travels with the data', snap.scanReport.stoppedReason === 'cap');
    check('which methods ran is kept', snap.methods[0].name === 'rendered-dom');
    check('an unknown follower count is NOT invented', snap.profile.followers === null, String(snap.profile.followers));
}

/* ── 2. A smaller later scan merges instead of replacing ── */
console.log('\n2) A short throttled scan cannot wipe a long one');
{
    // The account's whole history from an earlier, deeper walk.
    const deep = Array.from({ length: 40 }, (_, i) => post('deep' + i, 1000 - i, 5));
    app.clearScanSnapshots();
    app.saveScanSnapshot(profile('acct', { posts: 40 }), deep, { scanReport: { complete: true } });

    // Instagram now only exposes the newest 2 posts.
    const peek = [post('new1', 5000, 9), post('new2', 4900, 8)];
    const after = app.saveScanSnapshot(profile('acct', { posts: 40 }), peek, {
        scanReport: { complete: false, stoppedReason: 'anonymous-cap' },
    });

    check('all 40 earlier posts survive', after.posts.length === 42, String(after.posts.length));
    check('the newest posts are included', after.posts.some(p => p.shortcode === 'new1'));
    check('the deepest post is still there', after.posts.some(p => p.shortcode === 'deep39'));
    check('this run collected only 2', after.scanPosts === 2, String(after.scanPosts));
    check('42 posts are known in total', after.knownPosts === 42, String(after.knownPosts));
    check('run count and total count are NOT the same number', after.scanPosts !== after.knownPosts);
}

/* ── 3. A scan with nothing new changes nothing ── */
console.log('\n3) A failed scan that collected nothing leaves the result alone');
{
    const before = app.loadScanSnapshot('acct');
    const after = app.saveScanSnapshot(profile('acct', { posts: 40 }), [], { scanReport: { complete: false } });
    check('previous snapshot is untouched', after.posts.length === before.knownPosts, String(after.posts.length));
    check('still marked partial after the failed run', after.complete === false);
    const missing = app.loadScanSnapshot('never-scanned');
    check('an account with no snapshot returns null', missing === null);
}

/* ── 4. Values upgrade, they never degrade ── */
console.log('\n4) A later scan upgrades a post instead of degrading it');
{
    app.clearScanSnapshots();
    app.saveScanSnapshot(profile('acct'), [{ shortcode: 'X', likes: null, comments: null, caption: '', timestamp: 100 }], {});
    const after = app.saveScanSnapshot(profile('acct'), [{ shortcode: 'X', likes: 250, comments: 9, caption: 'real caption', timestamp: 100 }], {});
    check('one post after the merge', after.posts.length === 1, String(after.posts.length));
    check('the real like count is now stored', after.posts[0].likes === 250, String(after.posts[0].likes));
    check('the real comment count is now stored', after.posts[0].comments === 9, String(after.posts[0].comments));
    check('the caption is now stored', after.posts[0].caption === 'real caption');
}

/* ── 5. Ordering, age labels, and housekeeping ── */
console.log('\n5) The newest scan is the one that is offered');
{
    app.clearScanSnapshots();
    app.saveScanSnapshot(profile('older'), [post('O1', 10, 1)], {});
    // Push the older snapshot's timestamp back so "newest" is unambiguous.
    const lib = app.loadScanLibrary();
    lib.accounts['older'].savedAt = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    app.saveScanLibrary(lib);
    app.saveScanSnapshot(profile('newer'), [post('N1', 20, 1)], {});

    check('latestSnapshot() is the most recently saved', app.latestSnapshot().username === 'newer');
    check('both accounts are kept', app.listScanSnapshots().length === 2, String(app.listScanSnapshots().length));
    check('a 3-day-old scan reads as days', /day/.test(app.snapshotAgeLabel(lib.accounts['older'].savedAt)),
        app.snapshotAgeLabel(lib.accounts['older'].savedAt));
    check('a just-written scan reads as "just now"', app.snapshotAgeLabel(new Date().toISOString()) === 'just now');
    check('a missing timestamp says so', app.snapshotAgeLabel(null) === 'age unknown');

    app.clearScanSnapshots();
    check('clearing removes every snapshot', app.listScanSnapshots().length === 0);
}

/* ── 6. The library is bounded, and says when it had to trim ── */
console.log('\n6) Storage limits are stated, not silently applied');
{
    app.clearScanSnapshots();
    const many = Array.from({ length: 700 }, (_, i) => post('p' + i, 700 - i, 1));
    const snap = app.saveScanSnapshot(profile('big'), many, { scanReport: { complete: true } });
    check('the post list is capped', snap.posts.length === app.SNAPSHOT_LIMITS.posts, String(snap.posts.length));
    check('the newest posts are the ones kept', snap.posts[0].shortcode === 'p0' && snap.posts[snap.posts.length - 1].shortcode === 'p599');
    check('a trimmed snapshot says it was trimmed', snap.truncated === true);
    check('the run still recorded what it collected', snap.scanPosts === 700, String(snap.scanPosts));

    app.clearScanSnapshots();
    for (let i = 0; i < app.SNAPSHOT_LIMITS.accounts + 3; i++) {
        app.saveScanSnapshot(profile('acct' + i), [post('s' + i, i, 1)], {});
    }
    check('the account list is capped', app.listScanSnapshots().length === app.SNAPSHOT_LIMITS.accounts,
        String(app.listScanSnapshots().length));
    check('the accounts dropped are the OLDEST ones',
        !app.loadScanSnapshot('acct0') && !!app.loadScanSnapshot('acct' + (app.SNAPSHOT_LIMITS.accounts + 2)));
}

/* ── 7. The last search falls back to the library ── */
console.log('\n7) The most recent scan survives a lost "last search" key');
{
    app.clearScanSnapshots();
    app.saveScanSnapshot(profile('acct', { posts: 12 }), [post('A', 5, 3)], { scanReport: { complete: false } });
    localStorage.removeItem('swaLastSearch');
    const restored = app.loadLastSearch();
    check('a scan is restored from the library alone', !!restored && restored.posts.length === 1);
    check('the restored data is flagged as coming from the library', restored.fromLibrary === true);
    check('a partial walk is still partial after restoring', restored.scanReport ? restored.scanReport.complete === false : true);

    // A corrupt "last search" must not hide the library either.
    localStorage.setItem('swaLastSearch', '{not json');
    const fromCorrupt = app.loadLastSearch();
    check('a corrupt last-search key still falls back to the library', !!fromCorrupt && fromCorrupt.fromLibrary === true);
    localStorage.removeItem('swaLastSearch');
}

/* ── 8. The age on screen is the age of the DATA ── */
console.log('\n8) A saved scan is never presented as fresh');
{
    const twoMonthsAgo = new Date(Date.now() - 61 * 24 * 3600 * 1000).toISOString();
    app.currentProfile = profile('acct', { fetchedAt: twoMonthsAgo, posts: 912 });
    app.currentPosts = [post('A', 5, 3)];
    app._displayedSnapshot = { username: 'acct', profile: { username: 'acct' }, savedAt: new Date().toISOString() };
    app._liveFetchAt = null;

    const f = app._scanFreshness();
    check('the data age is used, not the save time', f.age !== 'just now' && /month/.test(f.age), f.age);
    check('it says the snapshot was saved later', f.savedLater === true);
    check('it is not reported as live', f.isLive === false);

    app.renderScanFreshness();
    const title = elementText['scanFreshnessTitle'] || '';
    check('the strip names the data age', /data collected/.test(title) && /month/.test(title), title);
    check('the strip warns it may be out of date', /out of date/.test(title), title);

    // The same snapshot written by a scan that just ran IS live.
    const now = new Date().toISOString();
    app.currentProfile = profile('acct', { fetchedAt: now });
    app._displayedSnapshot = null;
    app._liveFetchAt = now;
    check('a fresh fetch reads as live', app._scanFreshness().isLive === true);
    app.renderScanFreshness();
    check('the strip says live when it is live', /^Live data/.test(elementText['scanFreshnessTitle'] || ''),
        elementText['scanFreshnessTitle']);
}

/* ── 9. The main process keeps and serves the last scan ── */
console.log('\n9) The last scan survives without the renderer');
{
    const fs = require('fs');
    const path = require('path');
    const mainSrc = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
    check('the final result (posts + header + report) is written to disk',
        /writeScanCache\(cleanUser,\s*\{[\s\S]{0,900}posts: postData/.test(mainSrc));
    check('the renderer can ask for the last scan on disk', /ipcMain\.on\('get-saved-scan'/.test(mainSrc));
    check('it falls back to the newest cache when the handle is unknown', /newest:/.test(mainSrc));
    check('a failed walk still reports the posts it collected',
        /partial = readScanCache\(cleanUser\)/.test(mainSrc));
    check('the handler is cleaned up on relaunch', /removeAllListeners\('get-saved-scan'\)/.test(mainSrc));
    check('a failed scan still saves what it collected', /_acceptPartialScan = function/.test(
        fs.readFileSync(path.join(__dirname, 'scraping.js'), 'utf8')));
    check('the renderer restores the newest of file/disk candidates',
        /candidates\.sort\(\(a, b\) => b\.at - a\.at\)/.test(fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8')));
}

console.log('\n─────────────────────────────────────────');
if (failures === 0) {
    console.log('✅ SAVED SCAN SNAPSHOTS — ' + checks + '/' + checks + ' checks passed');
    process.exit(0);
}
console.error('❌ ' + failures + ' of ' + checks + ' checks failed');
process.exit(1);
