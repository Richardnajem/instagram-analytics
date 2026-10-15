/**
 * history-scan.js — Full-history pagination core for Instagram scans
 * ==================================================================
 * PURPOSE
 *   Instagram's feed APIs paginate — the old app code stopped after a fixed
 *   10/20/25 pages, so an account with 900 posts only ever reported ~240–480.
 *   Every analytics number derived from "all posts" was therefore computed on
 *   a truncated slice of the account's life.
 *
 *   This module walks the pagination cursors until the source says there is
 *   nothing left, so a scan covers EVERY post since the account began. It is
 *   deliberately dependency-free (no Electron, no https) so it can be unit
 *   tested with a fake page fetcher — see test_full_history.js.
 *
 * CONTRACT
 *   fetchPage(cursor) -> Promise<{
 *       items: Array,        // raw items for this page (any shape)
 *       nextCursor: string,  // cursor for the following page (null/'' when done)
 *       moreAvailable: bool  // true while the source has more pages
 *   }>
 *
 *   paginateAll(...) -> Promise<{
 *       items, pages, attempts, complete, lastCursor, stoppedReason, error
 *   }>
 *
 *   `complete === true` means the walk reached the true end of the account
 *   history. Anything else is an honest partial result that can be resumed by
 *   passing `lastCursor` back in as `startCursor` — never silently presented
 *   as the full history.
 */
'use strict';

/** Hard ceilings that exist only to stop a runaway loop, not to truncate. */
const SAFETY_MAX_PAGES = 1000;  // 1000 pages x 24 posts = 24,000 posts
const SAFETY_MAX_POSTS = 50000;

const DEFAULTS = {
    minDelayMs: 800,     // pause between pages — keeps us under rate limits
    maxRetries: 3,       // transient failures retried per page
    retryBaseMs: 2000,   // exponential backoff base for those retries
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

function errText(err) {
    if (!err) return 'unknown error';
    return String(err.message || err);
}

/**
 * Transient failures worth retrying. Rate limits, throttling, 5xx and socket
 * errors are all "try again"; a 404 / private / not-found is terminal.
 */
function isRetryableError(err) {
    const msg = errText(err);
    if (/not found|404|private|invalid|forbidden to access/i.test(msg)) return false;
    return /429|rate limit|throttl|too many|timed? ?out|timeout|ECONN|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|EPIPE|HTTP 5\d\d|bad gateway|service unavailable|network|fetch failed|aborted/i.test(msg);
}

/** Stable identity for a raw post so overlapping pages can be de-duplicated. */
function itemKey(raw) {
    if (!raw) return null;
    return raw.code || raw.shortcode || raw.id || raw.pk || null;
}

/**
 * Walk pagination to the end of the account history.
 *
 * @param {object} options
 * @param {function} options.fetchPage      required — (cursor) => page
 * @param {string}  [options.startCursor]   resume point from a previous run
 * @param {number}  [options.maxPages]      cap (default: safety ceiling only)
 * @param {number}  [options.maxPosts]      cap (default: safety ceiling only)
 * @param {function} [options.onPage]       ({page, posts, moreAvailable}) progress
 * @param {function} [options.onProgress]   same, plus retry/phase events
 * @param {function} [options.shouldStop]   () => true to abort cooperatively
 */
async function paginateAll(options) {
    const opts = options || {};
    const fetchPage = opts.fetchPage;
    if (typeof fetchPage !== 'function') {
        throw new TypeError('paginateAll requires a fetchPage(cursor) function');
    }

    const maxPages = Number.isFinite(opts.maxPages) ? opts.maxPages : SAFETY_MAX_PAGES;
    const maxPosts = Number.isFinite(opts.maxPosts) ? opts.maxPosts : SAFETY_MAX_POSTS;
    const minDelayMs = opts.minDelayMs == null ? DEFAULTS.minDelayMs : opts.minDelayMs;
    const maxRetries = opts.maxRetries == null ? DEFAULTS.maxRetries : opts.maxRetries;
    const retryBaseMs = opts.retryBaseMs == null ? DEFAULTS.retryBaseMs : opts.retryBaseMs;
    const onPage = typeof opts.onPage === 'function' ? opts.onPage : null;
    const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
    const shouldStop = typeof opts.shouldStop === 'function' ? opts.shouldStop : null;

    const items = [];
    const seen = new Set();
    let cursor = opts.startCursor || null;
    let pages = 0;
    let attempts = 0;
    let complete = false;
    let stoppedReason = 'exhausted';
    let error = null;

    while (pages < maxPages && items.length < maxPosts) {
        if (shouldStop && shouldStop()) { stoppedReason = 'cancelled'; break; }

        // ── Fetch one page, retrying transient failures ──
        let page = null;
        let lastErr = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            attempts++;
            try {
                page = await fetchPage(cursor);
                lastErr = null;
                break;
            } catch (err) {
                lastErr = err;
                const retriable = isRetryableError(err);
                if (!retriable || attempt >= maxRetries) break;
                const waitMs = Math.round(retryBaseMs * Math.pow(2, attempt));
                if (onProgress) {
                    onProgress({
                        phase: 'retry', page: pages + 1, posts: items.length,
                        attempt: attempt + 1, maxRetries, waitMs, error: errText(err),
                    });
                }
                await sleep(waitMs);
            }
        }

        if (!page) {
            error = lastErr || new Error('page fetch failed');
            stoppedReason = 'error';
            break;
        }

        // ── Collect this page (ignore anything already seen) ──
        const batch = Array.isArray(page.items) ? page.items : [];
        let added = 0;
        for (const raw of batch) {
            const key = itemKey(raw);
            if (key && seen.has(key)) continue;
            if (key) seen.add(key);
            items.push(raw);
            added++;
        }

        pages++;
        const nextCursor = page.nextCursor == null ? null : String(page.nextCursor);
        const moreAvailable = page.moreAvailable === true;
        cursor = nextCursor;

        const progress = {
            phase: 'page', page: pages, posts: items.length, added,
            batchSize: batch.length, cursor: nextCursor, moreAvailable,
            complete: false,
        };
        if (onPage) onPage(progress);
        if (onProgress) onProgress(progress);

        // ── Stop conditions, in order of truthfulness ──
        if (!moreAvailable || !nextCursor) { complete = true; stoppedReason = 'exhausted'; break; }
        if (batch.length === 0) { complete = true; stoppedReason = 'empty-page'; break; }
        if (pages >= maxPages) { stoppedReason = 'page-cap'; break; }
        if (items.length >= maxPosts) { stoppedReason = 'post-cap'; break; }
        if (minDelayMs > 0) await sleep(minDelayMs);
    }

    if (onProgress && stoppedReason !== 'exhausted') {
        onProgress({
            phase: 'done', page: pages, posts: items.length,
            complete, stoppedReason, error: error ? errText(error) : null,
        });
    }

    return {
        items, pages, attempts, complete,
        lastCursor: cursor,
        stoppedReason,
        error,
        fetchedAt: new Date().toISOString(),
    };
}

/* ══════════════════════════════════════════════════════════════════════════
   NORMALISERS — one post shape for every source
   ══════════════════════════════════════════════════════════════════════════ */

function numbers(...candidates) {
    for (const c of candidates) {
        if (c === 0) return 0;
        if (typeof c === 'number' && isFinite(c)) return c;
        if (typeof c === 'string' && c.trim() !== '' && isFinite(Number(c))) return Number(c);
    }
    return null;
}

function captionOf(item) {
    if (!item) return '';
    if (typeof item.caption === 'string') return item.caption;
    if (item.caption && typeof item.caption.text === 'string') return item.caption.text;
    const edges = item.edge_media_to_caption && item.edge_media_to_caption.edges;
    if (Array.isArray(edges) && edges[0] && edges[0].node) return edges[0].node.text || '';
    return item.caption_text || '';
}

function tagsFrom(caption, pattern) {
    if (!caption) return [];
    const found = caption.match(pattern);
    return found ? [...new Set(found)] : [];
}

/**
 * Normalise an Instagram Mobile API v1 feed item (i.instagram.com/api/v1).
 * These carry the real engagement fields we care about: like_count,
 * comment_count, taken_at, view_count/play_count for video, carousel count,
 * video duration, location and tagged users.
 */
function mapMobileFeedItem(item) {
    if (!item) return null;
    const shortcode = item.code || item.shortcode || '';
    if (!shortcode) return null;

    const mediaType = numbers(item.media_type);
    const productType = item.product_type || '';
    const isCarousel = mediaType === 8;
    const isVideo = mediaType === 2;
    const isReel = isVideo && productType === 'clips';
    const postType = isReel ? 'reel' : isVideo ? 'video' : isCarousel ? 'carousel' : 'photo';

    const candidates = (item.image_versions2 && item.image_versions2.candidates) || [];
    let thumbnail = '';
    if (candidates.length) {
        thumbnail = candidates.reduce((best, c) => ((c.width || 0) > (best.width || 0) ? c : best), candidates[0]).url || '';
    }

    const caption = captionOf(item);
    const videoVersions = item.video_versions || [];
    const videoViews = numbers(item.view_count, item.play_count, item.video_view_count, item.ig_play_count);

    return {
        shortcode,
        thumbnail,
        likes: numbers(item.like_count),
        comments: numbers(item.comment_count),
        caption,
        hashtags: tagsFrom(caption, /#[\w]+/g),
        mentions: tagsFrom(caption, /@[\w.]+/g),
        isVideo: isVideo || isReel,
        postType,
        carouselCount: numbers(item.carousel_media_count) || (isCarousel ? (item.carousel_media || []).length : 0),
        videoViews,
        videoUrl: (videoVersions[0] && videoVersions[0].url) || item.video_url || null,
        videoDuration: numbers(item.video_duration),
        timestamp: numbers(item.taken_at, item.taken_at_timestamp),
        location: (item.location && item.location.name) || item.location_name || null,
        usertags: numbers(item.usertags && item.usertags.in && item.usertags.in.length,
            Array.isArray(item.usertags) ? item.usertags.length : null) || 0,
        // Provenance: this value set came straight off the live API page.
        source: 'mobile_api',
    };
}

/** Normalise a GraphQL timeline node (very close, but separate field names). */
function mapGraphqlNode(node) {
    const n = (node && (node.node || node.media)) || node;
    if (!n) return null;
    const shortcode = n.shortcode || n.code || '';
    if (!shortcode) return null;

    const typename = n.__typename || '';
    const isSidecar = typename === 'GraphSidecar' || !!(n.edge_sidecar_to_children && n.edge_sidecar_to_children.edges);
    const isVideo = !!n.is_video || typename === 'GraphVideo';
    const isReel = isVideo && (n.product_type === 'clips');
    const postType = isSidecar ? 'carousel' : isReel ? 'reel' : isVideo ? 'video' : 'photo';

    const caption = captionOf(n);
    const likes = numbers(
        n.edge_media_preview_like && n.edge_media_preview_like.count,
        n.like_count,
    );
    const comments = numbers(
        n.edge_media_to_comment && n.edge_media_to_comment.count,
        n.comment_count,
    );

    let location = null;
    try {
        if (n.location) location = typeof n.location === 'string' ? n.location : (n.location.name || null);
    } catch { location = null; }

    return {
        shortcode,
        thumbnail: n.display_url || n.thumbnail_src || ((n.image_versions2 && n.image_versions2.candidates && n.image_versions2.candidates[0] && n.image_versions2.candidates[0].url) || ''),
        likes,
        comments,
        caption,
        hashtags: tagsFrom(caption, /#[\w]+/g),
        mentions: tagsFrom(caption, /@[\w.]+/g),
        isVideo,
        postType,
        carouselCount: numbers(
            n.edge_sidecar_to_children && n.edge_sidecar_to_children.edges && n.edge_sidecar_to_children.edges.length,
            n.carousel_media_count,
        ) || 0,
        videoViews: numbers(n.video_view_count, n.play_count),
        videoUrl: n.video_url || null,
        videoDuration: numbers(n.video_duration),
        timestamp: numbers(n.taken_at_timestamp, n.taken_at),
        location,
        usertags: 0,
        source: 'graphql',
    };
}

/* ══════════════════════════════════════════════════════════════════════════
   MERGE + COVERAGE
   ══════════════════════════════════════════════════════════════════════════ */

const NUMERIC_PREFER_LARGER = new Set(['likes', 'comments', 'videoViews', 'carouselCount']);

/**
 * Merge two post lists by shortcode, always keeping the richest real values.
 * Counts only ever move up (engagement is cumulative), never down to null.
 */
function mergePosts(existing, incoming) {
    const byShortcode = new Map();
    const add = (list) => {
        for (const p of list || []) {
            if (!p || !p.shortcode) continue;
            const prev = byShortcode.get(p.shortcode);
            if (!prev) { byShortcode.set(p.shortcode, { ...p }); continue; }
            for (const key of Object.keys(p)) {
                if (key === 'shortcode') continue;
                const inc = p[key];
                if (inc == null || inc === '') continue;
                const cur = prev[key];
                if (cur == null || cur === '') { prev[key] = inc; continue; }
                if (typeof inc === 'number' && typeof cur === 'number') {
                    // Counts only ever move up — a later page can know a bigger
                    // like/comment/view total, but never a smaller one.
                    if (NUMERIC_PREFER_LARGER.has(key) && inc > cur) prev[key] = inc;
                    continue;
                }
                if (key === 'hashtags' || key === 'mentions') {
                    if (Array.isArray(cur) && Array.isArray(inc) && inc.length > cur.length) prev[key] = inc;
                    continue;
                }
                if (key === 'caption' && typeof inc === 'string' && typeof cur === 'string' && inc.length > cur.length) {
                    prev[key] = inc;
                }
            }
        }
    };
    add(existing);
    add(incoming);
    return sortNewestFirst([...byShortcode.values()]);
}

/** Newest-first, timestamp descending — matches how every view expects posts. */
function sortNewestFirst(posts) {
    return [...(posts || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/**
 * How complete is this scan versus the account's real post count?
 * `percent` is null when Instagram never told us the total — never invented.
 */
function coverage(posts, totalPosts) {
    const scanned = (posts || []).length;
    const total = Number.isFinite(totalPosts) && totalPosts > 0 ? totalPosts : null;
    const withEngagement = (posts || []).filter(p => p && (p.likes != null || p.comments != null)).length;
    const timestamps = (posts || []).map(p => p && p.timestamp).filter(t => Number.isFinite(t) && t > 0);
    return {
        scanned,
        total,
        missing: total == null ? null : Math.max(0, total - scanned),
        percent: total == null ? null : Math.min(100, Math.round((scanned / total) * 1000) / 10),
        complete: total == null ? null : scanned >= total,
        withEngagement,
        engagementPercent: scanned ? Math.round((withEngagement / scanned) * 1000) / 10 : 0,
        oldest: timestamps.length ? Math.min(...timestamps) : null,
        newest: timestamps.length ? Math.max(...timestamps) : null,
    };
}

module.exports = {
    paginateAll,
    isRetryableError,
    itemKey,
    mapMobileFeedItem,
    mapGraphqlNode,
    mergePosts,
    sortNewestFirst,
    coverage,
    SAFETY_MAX_PAGES,
    SAFETY_MAX_POSTS,
    DEFAULTS,
};
