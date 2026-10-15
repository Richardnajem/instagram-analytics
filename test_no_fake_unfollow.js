/**
 * test_no_fake_unfollow.js — Prove the unfollow path never fabricates a result.
 *
 * The old `performUnfollow` had a "Simulated fallback" that, with no Instagram
 * connection, still claimed success and *decremented the estimated fake-follower
 * counts*. Its API branch invented ten random account IDs and unfollowed
 * whatever they happened to be. Both presented invented work as real data.
 *
 * This test asserts the honesty contract now in instagram-auth.js:
 *   • without a connection, NOTHING is unfollowed and the user is told why,
 *   • the estimated follower numbers are never moved by an unfollow,
 *   • no random/simulated account IDs exist in the module,
 *   • the API path refuses an empty list instead of guessing.
 *
 * Usage: node test_no_fake_unfollow.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Minimal globals the module expects (it only reads them at call time).
global.InstagramAnalytics = function () { };
const P = InstagramAnalytics.prototype;

const toasts = [];
global.showToast = function (message, type) { toasts.push({ message: String(message), type }); };
global.localStorage = {
    _d: {},
    getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; },
};

// Load the module under test (defines P.performUnfollow, P.unfollowViaInstagramAPI, …).
require('./instagram-auth.js');

let failures = 0;
let checks = 0;
function check(name, cond, detail) {
    checks++;
    if (cond) console.log('  ✅ ' + name);
    else { failures++; console.error('  ❌ ' + name + (detail ? ' — ' + detail : '')); }
}

function makeApp(connected) {
    const app = new InstagramAnalytics();
    app._unfollowedFakeCounts = {};
    app.fmt = (n) => String(n);
    app.saveUnfollowHistory = function () { /* no-op in test */ };
    app.isInstagramLoggedIn = () => connected
        ? { loggedIn: true, hasSession: true, hasApiToken: false }
        : { loggedIn: false, hasSession: false, hasApiToken: false };
    return app;
}

function makeButton() {
    return { disabled: false, textContent: '🚫 Unfollow', style: {} };
}

(async function main() {
    console.log('\n════ UNFOLLOW HONESTY ════════\n');

    // 1) No connection → refuses, explains, and changes nothing.
    {
        const app = makeApp(false);
        const btn = makeButton();
        toasts.length = 0;
        await app.performUnfollow('Ghost/Bot Account', 250, btn);

        check('warns instead of claiming success',
            toasts.some(t => t.type === 'warning' && /Nothing unfollowed/i.test(t.message)),
            JSON.stringify(toasts));
        check('says what is needed (connect / real IDs)',
            toasts.some(t => /connect Instagram|real account IDs|estimated categories/i.test(t.message)));
        check('records NO unfollowed count', Object.keys(app._unfollowedFakeCounts).length === 0,
            JSON.stringify(app._unfollowedFakeCounts));
        check('button is not left as a fake success',
            btn.textContent === '🚫 Unfollow' && btn.disabled === false, btn.textContent);
    }

    // 2) Connected but no real IDs → still refuses and moves nothing.
    {
        const app = makeApp(true);
        const btn = makeButton();
        toasts.length = 0;
        await app.performUnfollow('Ghost/Bot Account', 250, btn);

        check('connected but no real IDs → no unfollow recorded',
            Object.keys(app._unfollowedFakeCounts).length === 0);
        check('connected but no real IDs → explains the estimate is not actionable',
            toasts.some(t => /estimated categories only|No real account/i.test(t.message)));
    }

    // 3) The API helper refuses an empty list rather than inventing IDs.
    {
        let threw = false;
        try {
            await P.unfollowViaInstagramAPI.call(makeApp(true), [], { session: {} });
        } catch (err) {
            threw = /No real account IDs/i.test(err.message);
        }
        check('API helper rejects an empty ID list', threw);
    }

    // 4) Static: the module contains no random/simulated unfollow logic.
    {
        const src = fs.readFileSync(path.join(__dirname, 'instagram-auth.js'), 'utf8');
        check('no simulated ID generation', !/simulatedIds/.test(src));
        check('no Math.random anywhere in the module', !/Math\.random/.test(src));
        check('no "Simulated" success path', !/Unfollowed \(Simulated\)/.test(src));
    }

    console.log('\n─────────────────────────────────────────');
    console.log((failures ? `❌ UNFOLLOW HONESTY — ${failures} check(s) failed`
        : `✅ UNFOLLOW HONESTY — ${checks}/${checks} checks passed`) + '\n');
    process.exit(failures ? 1 : 0);
})();
