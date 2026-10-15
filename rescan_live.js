/**
 * rescan_live.js — Live data rescan for @smallworld_foundation
 * =============================================================
 * Fetches REAL profile stats + ALL posts (with like/comment counts)
 * using the most reliable available method:
 *   1. Instaloader helper (Python) — full metadata incl. captions, hashtags
 *   2. Fallback: Mobile API v1 feed with fresh cookies (via instaloader)
 *
 * Writes BOTH smallworld_scan_results.json and smallworld_full_scan.json
 * with a `fetchedAt` timestamp so consumers always know how fresh the data is.
 * NEVER writes fabricated/hardcoded values — un-fetched fields are null.
 *
 * Usage: node rescan_live.js [--userid 374059210]
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TARGET = process.argv[2] || 'smallworld_foundation';
const RESULTS_FILE = 'smallworld_scan_results.json';
const FULL_FILE = 'smallworld_full_scan.json';

// Known numeric user ID for smallworld_foundation (from prior real lookups).
// Passing it skips the often-blocked anonymous username resolution.
const KNOWN_USER_ID = '374059210';

function tryParse(text) {
    try { return JSON.parse(text); } catch { return null; }
}

function loadExisting(file) {
    try { return tryParse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** Load the Instagram session exported by the app (Settings > Instagram Login).
 * Returns { sessionid, csrftoken, cookies, userId } or null. */
function loadSession() {
    try {
        const f = path.join(__dirname, 'ig_session.json');
        if (!fs.existsSync(f)) return null;
        const s = tryParse(fs.readFileSync(f, 'utf8'));
        if (s && (s.sessionid || s.cookies)) return s;
    } catch { /* non-fatal */ }
    return null;
}

/** Run instaloader_helper.py and return its parsed JSON result (or null). */
function runInstaloader(username, userId) {
    // Inside a packaged app __dirname is inside app.asar, which Python cannot
    // open — asarUnpack puts the helper beside the archive instead.
    const script = path.join(__dirname, 'instaloader_helper.py')
        .replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    if (!fs.existsSync(script)) return null;
    const args = [script, username];
    if (userId) args.push('--userid', String(userId));
    // Pass the saved Instagram session (if any) so authenticated requests
    // bypass Instagram's anonymous access rate limits.
    const session = loadSession();
    if (session) {
        console.log(`🔑 Using saved Instagram session${session.username ? ' for @' + session.username : ''}`);
        if (session.sessionid) args.push('--sessionid', session.sessionid);
        if (session.csrftoken) args.push('--csrftoken', session.csrftoken);
        if (session.cookies) args.push('--cookies', session.cookies);
        if (session.userId && !userId) args.push('--userid', String(session.userId));
    } else {
        console.log('ℹ️  No saved Instagram session found — trying anonymous (may be rate-limited).');
        console.log('   Tip: log in via the app (Settings > Instagram Login), then re-run.');
    }
    // No --count → fetch ALL posts
    // Try the same Python command fallbacks the app itself uses.
    const candidates = process.platform === 'win32'
        ? ['python', 'python3', 'py']
        : ['python3', 'python'];
    for (const cmd of candidates) {
        const res = spawnSync(cmd, args, {
            encoding: 'utf-8',
            timeout: 420000, // up to 7 min for all posts
            maxBuffer: 64 * 1024 * 1024,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        if (res.status !== 0) {
            if (cmd === candidates[0]) {
                const err = (res.stderr || '').toString().trim() || (res.error && res.error.message) || '';
                if (err) console.error('[rescan_live] instaloader stderr:', err.split('\n').slice(0, 8).join('\n'));
            }
            continue;
        }
        const parsed = tryParse(res.stdout);
        if (parsed) return parsed;
    }
    return null;
}

/** Map a raw instaloader post to the scan-file post format. */
function normalizePost(p) {
    if (!p) return null;
    let ts = p.timestamp || p.taken_at || p.taken_at_timestamp || null;
    // Older browser_extracted posts may only have a human-readable date string
    // (e.g. "June 30, 2026") with no numeric timestamp — parse it as a fallback.
    if (!ts && p.date) {
        const parsed = new Date(typeof p.date === 'number' ? p.date * 1000 : p.date);
        if (!isNaN(parsed.getTime())) ts = Math.floor(parsed.getTime() / 1000);
    }
    // Map the type from every known field shape (new live format + old scan files
    // that stored e.g. type: "Reel/Video" or "GraphVideo"). Case-insensitive.
    const typeStr = (p.typename || p.type || '').toString();
    const typeLower = typeStr.toLowerCase();
    const type = p.typename ||
        (p.postType === 'reel' ? 'GraphVideo' :
         p.postType === 'video' ? 'GraphVideo' :
         p.postType === 'carousel' ? 'GraphSidecar' :
         typeLower.includes('graph') ? typeStr :
         typeLower.includes('video') || typeLower.includes('reel') ? 'GraphVideo' :
         typeLower.includes('carousel') || typeLower.includes('sidecar') ? 'GraphSidecar' :
         'GraphImage');
    return {
        shortcode: p.shortcode || '',
        url: p.url || `https://www.instagram.com/p/${p.shortcode || ''}/`,
        type,
        likes: p.likes ?? p.like_count ?? null,
        comments: p.comments ?? p.comment_count ?? null,
        caption: (p.caption || '').substring(0, 500),
        hashtags: p.hashtags || [],
        mentions: p.mentions || [],
        timestamp: ts,
        date: ts ? new Date(ts * 1000).toISOString() : null,
        isVideo: !!p.isVideo || p.postType === 'reel' || p.postType === 'video',
        postType: p.postType || null,
        videoViewCount: p.videoViews ?? p.video_view_count ?? null,
        thumbnail: (p.thumbnail || p.display_url || '').substring(0, 300),
        location: p.location || null,
        carouselCount: p.carouselCount || p.carousel_media_count || 0,
        dimensions: p.dimensions || null,
        accessibilityCaption: (p.accessibilityCaption || '').substring(0, 300),
    };
}

/** Merge two post lists by shortcode, preferring richer (non-null) data. */
function mergePosts(a, b) {
    const map = new Map();
    const add = (list) => {
        for (const p of list || []) {
            if (!p || !p.shortcode) continue;
            const cur = map.get(p.shortcode);
            if (!cur) { map.set(p.shortcode, { ...p }); continue; }
            const merged = { ...cur };
            for (const key of Object.keys(p)) {
                if (p[key] == null) continue;
                if (cur[key] == null || cur[key] === '') merged[key] = p[key];
                else if (typeof p[key] === 'number' && typeof cur[key] === 'number' && p[key] > cur[key]) {
                    merged[key] = p[key]; // prefer larger like/comment counts (fresh)
                }
            }
            map.set(p.shortcode, merged);
        }
    };
    add(a);
    add(b);
    return [...map.values()];
}

function main() {
    const nowIso = new Date().toISOString();
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  LIVE RESCAN — @' + TARGET + '                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    // Load previous real data (so a temporary rate-limit never wipes good data)
    // Normalize previous posts to the same schema as live posts for consistent output.
    const prevResults = loadExisting(FULL_FILE) || {};
    const prevPosts = Array.isArray(prevResults.posts)
        ? prevResults.posts.map(normalizePost).filter(Boolean)
        : [];

    // 1) Instaloader (primary live path — same as the app uses)
    const live = runInstaloader(TARGET, KNOWN_USER_ID);

    let profile = null;
    let posts = [];

    if (live && live.profile && live.posts && live.posts.length > 0) {
        console.log(`✅ Instaloader live scan OK — ${live.posts.length} posts, ${live.postCount || live.posts.length} total`);
        profile = live.profile;
        posts = live.posts.map(normalizePost).filter(Boolean);
    } else if (live && live.profile) {
        console.log(`ℹ️  Instaloader resolved profile but fetched 0 posts (rate-limited?).`);
        console.log(`   Profile pic: ${(live.profile.profilePicUrl || '').substring(0, 80)}`);
        // Profile resolution itself is real data — keep it, fall back to previous posts
        profile = live.profile;
        posts = prevPosts;
        console.log(`   Keeping ${posts.length} posts from previous real scan (marked fetchedAt).`);
    } else {
        if (live && live.error) console.log(`ℹ️  Instaloader error: ${live.error}`);
        console.log('⚠️  Instaloader scan failed entirely — keeping previous real POSTS only.');
        // Do NOT inherit the old profile block: earlier scan files contained
        // hardcoded stats (e.g. followers: 3435) that must never come back.
        profile = null;
        posts = prevPosts;
    }

    // IMPORTANT: never inherit profile stats from previous files — the old scan
    // scripts hardcoded values (e.g. followers: 3435). Only LIVE-verified fields
    // are written; anything the live scan couldn't fetch stays null so the data
    // can never be mistaken for real when it wasn't.
    const mergedProfile = { ...(profile || {}), username: TARGET };
    mergedProfile.fetchedAt = nowIso;
    if (!mergedProfile.userId && KNOWN_USER_ID) mergedProfile.userId = KNOWN_USER_ID;
    // Empty-string fields mean "not fetched" → normalize to null
    for (const key of Object.keys(mergedProfile)) {
        if (mergedProfile[key] === '') mergedProfile[key] = null;
    }
    // Do NOT synthesize the account's total post count from the scanned posts —
    // that conflates "posts we fetched" with the real media count and is what
    // made the displayed post number wrong. Leave it unknown (null) and record
    // how many posts we actually scanned instead; the app shows "scanned" for
    // the total until a login-based scan supplies the real media_count.
    if (mergedProfile.posts === 0) mergedProfile.posts = null;
    const postsScanned = posts.length;

    // Dedupe / merge posts
    posts = mergePosts(posts, prevPosts);

    const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
    const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);
    const withData = posts.filter(p => p.likes != null || p.comments != null).length;

    const output = {
        profile: mergedProfile,
        fetchedAt: nowIso,
        totalPosts: (mergedProfile.posts != null ? mergedProfile.posts : null),
        postsScanned,
        engagement: {
            totalLikes,
            totalComments,
            avgLikesPerPost: posts.length ? Math.round(totalLikes / posts.length) : 0,
            avgCommentsPerPost: posts.length ? Math.round(totalComments / posts.length) : 0,
            postsWithEngagementData: withData,
        },
        posts,
    };

    // Write both files so any consumer gets the same fresh real data
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(output, null, 2));
    fs.writeFileSync(FULL_FILE, JSON.stringify(output, null, 2));

    console.log('');
    console.log('─'.repeat(56));
    console.log('  FINAL REAL DATA');
    console.log('─'.repeat(56));
    console.log(`  Profile:     @${mergedProfile.username}`);
    console.log(`  Full name:   ${mergedProfile.fullName || '(unavailable)'}`);
    console.log(`  Followers:   ${mergedProfile.followers ?? '(unavailable)'}`);
    console.log(`  Following:   ${mergedProfile.following ?? '(unavailable)'}`);
    console.log(`  User ID:     ${mergedProfile.userId || '(unavailable)'}`);
    console.log(`  Posts total: ${mergedProfile.posts ?? posts.length}`);
    console.log(`  Scanned:     ${posts.length} posts`);
    console.log(`  With data:   ${withData}/${posts.length} (likes/comments)`);
    console.log(`  Avg likes:   ${output.engagement.avgLikesPerPost}`);
    console.log(`  Avg cmts:    ${output.engagement.avgCommentsPerPost}`);
    console.log(`  Fetched at:  ${nowIso}`);
    console.log('─'.repeat(56));

    console.log(`\n✅ Wrote ${RESULTS_FILE} and ${FULL_FILE}`);
    if (withData < posts.length) {
        console.log('ℹ️  Some posts lack like/comment counts — Instagram is likely rate-limiting anonymous access.');
        console.log('   Log in via Settings > Instagram Login in the app for full access, then re-run this script.');
    }
}

main();
