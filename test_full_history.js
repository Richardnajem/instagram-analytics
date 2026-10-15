/**
 * test_full_history.js — Prove the full-history scanner really walks to the end
 * of an account instead of stopping at a fixed page count.
 *
 * Runs the SHIPPED history-scan.js against fake paginated feeds that mimic
 * Instagram's real behaviour: cursors, overlapping pages, rate limits, hard
 * failures and an account with years of posts.
 *
 * Usage: node test_full_history.js
 */
'use strict';

const hs = require('./history-scan.js');

let failures = 0;
let checks = 0;

function check(name, condition, detail) {
    checks++;
    if (condition) {
        console.log('  ✅ ' + name);
    } else {
        failures++;
        console.error('  ❌ ' + name + (detail ? ' — ' + detail : ''));
    }
}

/** Fake paginated source, as a stand-in for a real Instagram feed. */
function makeFeed(opts) {
    const total = opts.total;
    const pageSize = opts.pageSize || 24;
    const overlap = opts.overlap || 0;         // duplicate items between pages
    const failOn = opts.failOn || {};          // { [pageIndex]: 'error message' }
    const failTimes = opts.failTimes || {};    // { [pageIndex]: n }
    const seenFailures = {};
    const calls = [];
    let index = 0;

    const fetchPage = async (cursor) => {
        const page = cursor == null ? 0 : Number(cursor);
        calls.push(page);
        if (failOn[page]) {
            // failTimes === undefined means "always fails"; a number means the
            // first N attempts fail, then the page recovers (throttling).
            const allowedFailures = failTimes[page] == null ? Infinity : failTimes[page];
            seenFailures[page] = (seenFailures[page] || 0) + 1;
            if (seenFailures[page] <= allowedFailures) {
                throw new Error(failOn[page]);
            }
        }
        // Items are newest-first; page 0 holds the newest posts.
        const start = page * pageSize;
        const end = Math.min(total, start + pageSize);
        const items = [];
        for (let i = start; i < end; i++) {
            items.push({
                code: 'POST' + i,
                media_type: i % 5 === 0 ? 2 : 1,
                product_type: i % 10 === 0 ? 'clips' : '',
                like_count: 100 - i,
                comment_count: 5 + (i % 7),
                taken_at: 1700000000 - i * 86400,
                caption: { text: 'Post ' + i + (i % 3 === 0 ? ' #tag' : '') },
            });
        }
        if (overlap && page > 0) {
            for (let i = start; i < Math.min(end, start + overlap); i++) {
                items.push({ code: 'POST' + i, like_count: 100 - i, comment_count: 5 + (i % 7) });
            }
        }
        const moreAvailable = end < total;
        index++;
        return {
            items,
            nextCursor: moreAvailable ? String(page + 1) : null,
            moreAvailable,
        };
    };

    return { fetchPage, calls, get pages() { return index; } };
}

async function run() {
    console.log('\n════════ FULL-HISTORY PAGINATION ════════\n');

    /* ── 1. The core promise: every post, however old the account is ── */
    console.log('1) Account with 912 posts (38 pages)');
    {
        const feed = makeFeed({ total: 912 });
        const result = await hs.paginateAll({ fetchPage: feed.fetchPage, minDelayMs: 0 });
        const posts = hs.sortNewestFirst(result.items.map(hs.mapMobileFeedItem).filter(Boolean));
        check('fetched all 912 posts', posts.length === 912, 'got ' + posts.length);
        check('walked 38 pages', result.pages === 38, 'got ' + result.pages);
        check('reports complete history', result.complete === true, 'stoppedReason=' + result.stoppedReason);
        check('no silent truncation', result.stoppedReason === 'exhausted', result.stoppedReason);

        const oldest = posts[posts.length - 1];
        check('oldest post is the account\u2019s first', oldest.shortcode === 'POST911', oldest.shortcode);
        const cov = hs.coverage(posts, 912);
        check('coverage 100% against the account total', cov.percent === 100 && cov.missing === 0,
            JSON.stringify(cov));

        // Deep-history analytics that were impossible before: value of the first year.
        const year = posts.filter(p => p.timestamp >= 1700000000 - 365 * 86400);
        check('dates span multiple years', year.length > 0 && year.length < posts.length,
            'first-year posts=' + year.length);
    }

    /* ── 2. Overlapping pages must not double-count ── */
    console.log('\n2) Feed repeats 3 items between pages');
    {
        const feed = makeFeed({ total: 200, overlap: 3 });
        const result = await hs.paginateAll({ fetchPage: feed.fetchPage, minDelayMs: 0 });
        check('de-duplicated 200 unique posts', result.items.length === 200, 'got ' + result.items.length);
    }

    /* ── 3. Rate limiting is survived, not fatal ── */
    console.log('\n3) Rate limited (429) on pages 1 and 2');
    {
        const feed = makeFeed({
            total: 300,
            failOn: { 1: 'HTTP 429 rate limited', 2: 'HTTP 429 too many requests' },
            failTimes: { 1: 2, 2: 3 },
        });
        const result = await hs.paginateAll({
            fetchPage: feed.fetchPage, minDelayMs: 0, retryBaseMs: 1, maxRetries: 4,
        });
        check('all 300 posts despite throttling', result.items.length === 300, 'got ' + result.items.length);
        check('completed after retries', result.complete === true, 'stoppedReason=' + result.stoppedReason);
    }

    /* ── 4. A hard failure keeps the real data and stays honest ── */
    console.log('\n4) Page 5 fails permanently');
    {
        let retryEvents = 0;
        const feed = makeFeed({ total: 500, failOn: { 5: 'HTTP 500 server error' } });
        const result = await hs.paginateAll({
            fetchPage: feed.fetchPage, minDelayMs: 0, retryBaseMs: 1, maxRetries: 1,
            onProgress: e => { if (e.phase === 'retry') retryEvents++; },
        });
        check('keeps the 120 posts already collected', result.items.length === 120, 'got ' + result.items.length);
        check('does NOT claim to be complete', result.complete === false);
        check('reports why it stopped', result.stoppedReason === 'error' && !!result.error);
        check('retried the failure first', retryEvents > 0, 'retries=' + retryEvents);
        check('resume cursor is offered', result.lastCursor === '5', String(result.lastCursor));
    }

    /* ── 5. Resume continues where the failure left off ── */
    console.log('\n5) Resume from the saved cursor');
    {
        const feed = makeFeed({ total: 500 });
        const result = await hs.paginateAll({ fetchPage: feed.fetchPage, startCursor: '5', minDelayMs: 0 });
        check('resumed at page 5', feed.calls[0] === 5, 'first call=' + feed.calls[0]);
        check('fetched the remaining 380 posts', result.items.length === 380, 'got ' + result.items.length);
        check('second run is complete', result.complete === true);
    }

    /* ── 6. Non-retryable failures fail fast (no pointless backoff) ── */
    console.log('\n6) Private / not-found fails immediately');
    {
        let calls = 0;
        const result = await hs.paginateAll({
            fetchPage: async () => { calls++; throw new Error('Profile not found (404)'); },
            retryBaseMs: 1,
        });
        check('no retries for a 404', calls === 1, 'calls=' + calls);
        check('surfaces the error', /404/.test(String(result.error && result.error.message)));
    }

    /* ── 7. Explicit caps still work when a caller asks for one ── */
    console.log('\n7) Explicit maxPages cap is honoured (quick scan mode)');
    {
        const feed = makeFeed({ total: 1000 });
        const result = await hs.paginateAll({ fetchPage: feed.fetchPage, maxPages: 20, minDelayMs: 0 });
        check('stops at the requested 20 pages', result.pages === 20, 'pages=' + result.pages);
        check('flags a capped run as incomplete', result.complete === false && result.stoppedReason === 'page-cap');
    }

    /* ── 8. Post mapping captures real per-post analytics ── */
    console.log('\n8) Per-post analytics fields');
    {
        const post = hs.mapMobileFeedItem({
            code: 'ABC123', media_type: 2, product_type: 'clips',
            like_count: 4210, comment_count: 137, play_count: 91234, view_count: 91234,
            video_duration: 27.4, taken_at: 1712345678,
            caption: { text: 'Behind the scenes #charity @partner' },
            image_versions2: { candidates: [{ width: 1080, url: 'big.jpg' }, { width: 320, url: 'small.jpg' }] },
            location: { name: 'Dubai' },
            usertags: { in: [{ user: 'a' }] },
        });
        check('shortcode mapped', post.shortcode === 'ABC123');
        check('likes are real integers', post.likes === 4210);
        check('comments are real integers', post.comments === 137);
        check('video plays captured', post.videoViews === 91234);
        check('posted date captured', post.timestamp === 1712345678);
        check('type is reel', post.postType === 'reel');
        check('duration kept (not rounded to 0)', post.videoDuration === 27.4);
        check('best thumbnail chosen', post.thumbnail === 'big.jpg');
        check('location captured', post.location === 'Dubai');
        check('hashtags + mentions parsed from the real caption',
            post.hashtags[0] === '#charity' && post.mentions[0] === '@partner',
            JSON.stringify({ h: post.hashtags, m: post.mentions }));
        check('provenance marked as live API data', post.source === 'mobile_api');
    }

    /* ── 9. Merge keeps the richest real values ── */
    console.log('\n9) Merge across scans');
    {
        const older = [{ shortcode: 'X1', likes: 100, comments: 4, caption: 'hi', timestamp: 5 }];
        const newer = [{ shortcode: 'X1', likes: 260, comments: null, hashtags: ['#a'], timestamp: 5 }];
        const merged = hs.mergePosts(older, newer);
        check('one post after merge', merged.length === 1);
        check('kept the higher like count', merged[0].likes === 260, String(merged[0].likes));
        check('never lost the comment count', merged[0].comments === 4, String(merged[0].comments));
        check('filled in the new hashtags', merged[0].hashtags[0] === '#a');
    }

    /* ── 10. Coverage is never invented ── */
    console.log('\n10) Honest coverage reporting');
    {
        const posts = [{ shortcode: 'a', likes: 1, comments: 0, timestamp: 10 },
                       { shortcode: 'b', likes: null, comments: null, timestamp: 20 }];
        const unknown = hs.coverage(posts, null);
        check('unknown total stays null', unknown.total === null && unknown.percent === null);
        check('counts posts that do carry engagement', unknown.withEngagement === 1);
        const partial = hs.coverage(posts, 10);
        check('partial scan reports 20%', partial.percent === 20, String(partial.percent));
        check('flags incompleteness', partial.complete === false && partial.missing === 8);
    }

    console.log('\n─────────────────────────────────────────');
    if (failures === 0) {
        console.log('✅ FULL HISTORY — ' + checks + '/' + checks + ' checks passed');
        process.exit(0);
    }
    console.error('❌ ' + failures + ' of ' + checks + ' checks failed');
    process.exit(1);
}

run().catch(err => {
    console.error('❌ test crashed:', err);
    process.exit(1);
});
