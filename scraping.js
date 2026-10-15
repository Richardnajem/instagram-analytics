// SWA - scraping Module
// Extends InstagramAnalytics.prototype
// Auto-generated from app.js refactoring

(function () {
    'use strict';
    const P = InstagramAnalytics.prototype;

    P.fetchProfile = async function (username) {
        return this.fetchPlatformProfile(username, this.currentPlatform);
    };

    /* ═══════════════════════════════════════════════════════════════════════
       PERSIST THE LATEST RESULTS

       Every scan — complete, partial or failed-after-collecting — writes what
       it collected to two places:
         • swaLastSearch  (the single "most recent" record)
         • the snapshot library, one entry per account, which MERGES instead of
           replacing so a short throttled scan cannot wipe a long one.
       Because of this the app always has real results to show, even while a
       slower fresh scan is still running or after a crash.
    ═══════════════════════════════════════════════════════════════════════ */
    P._persistScanResult = function (profile, posts, meta) {
        try {
            if (!profile || !profile.username || !(posts && posts.length)) return null;
            this.saveLastSearch(profile, posts);
            const snap = this.saveScanSnapshot ? this.saveScanSnapshot(profile, posts, meta || {}) : null;
            // The screen is now showing live data, not a restored snapshot.
            if (snap) {
                this._displayedSnapshot = null;
                this._liveFetchAt = new Date().toISOString();
            }
            if (typeof this.renderScanFreshness === 'function') this.renderScanFreshness();
            return snap;
        } catch (e) {
            console.warn('[SWA] Could not persist the scan result:', e && e.message);
            return null;
        }
    };

    /**
     * Ask the main process for the last scan it saved to disk for an account
     * (or the newest one it has). Independent of localStorage, so the most
     * recent results survive a crash, a reinstall or a cleared profile.
     */
    P.loadDiskScan = function (username) {
        return new Promise((resolve) => {
            try {
                const { ipcRenderer } = require('electron');
                const done = (_, data) => {
                    try { ipcRenderer.removeListener('saved-scan-result', done); } catch (e) { }
                    resolve(data || null);
                };
                ipcRenderer.on('saved-scan-result', done);
                ipcRenderer.send('get-saved-scan', { username: username || null });
                setTimeout(() => {
                    try { ipcRenderer.removeListener('saved-scan-result', done); } catch (e) { }
                    resolve(null);
                }, 8000);
            } catch (e) { resolve(null); }
        });
    };

    /*
     * A scan can fail before completing but still have collected posts (the
     * main process checkpoints them to disk). Show and save what was collected
     * — labelled as what it is — instead of leaving the previous screen up with
     * no explanation, and never present a partial walk as the whole account.
     */
    P._acceptPartialScan = function (username, err) {
        const partial = err && err.partial;
        const incoming = (partial && partial.posts) || [];
        if (!incoming.length) return false;
        const merged = this._mergeScannedPosts(this.currentPosts || [], incoming);
        this.currentPosts = merged;
        const profile = this.currentProfile && this.currentProfile.username === username
            ? this.currentProfile
            : Object.assign({ username: username, followers: null, following: null, posts: null },
                (partial.profile || {}), { fetchedAt: partial.updatedAt || new Date().toISOString() });
        Object.keys(partial.profile || {}).forEach(k => {
            if (profile[k] == null || profile[k] === '') profile[k] = partial.profile[k];
        });
        this.currentProfile = profile;
        this.lastScanReport = {
            username: username, complete: partial.complete === true,
            posts: merged.length, stoppedReason: 'scan-failed',
            resumedFromDisk: true, scannedAt: new Date().toISOString(),
        };
        this.displayProfile(profile, merged);
        if (this.currentPage === 'posts') this._renderPostsContent(merged);
        else this.renderPostGrid(merged);
        this.renderDashboardPosts(merged);
        this.renderCharts(merged);
        this.renderMarketingAnalysis(profile, merged);
        this.updateStats();
        this._persistScanResult(profile, merged, {
            scanReport: this.lastScanReport,
            source: 'partial-after-failure',
        });
        showToast('💾 The scan did not finish, but ' + merged.length +
            ' posts collected for @' + username + ' were kept and saved.', 'warning');
        return true;
    };


    P.imageProxy = function (url) {
        if (!url) return Promise.resolve(null);
        return new Promise(resolve => {
            try {
                const https = require('https');
                const zlib = require('zlib');
                const urlObj = new URL(url);
                const req = https.get({
                    hostname: urlObj.hostname,
                    path: urlObj.pathname + urlObj.search,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124',
                        'Referer': 'https://www.instagram.com/',
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                    },
                    timeout: 14000,
                }, res => {
                    const chunks = [];
                    const enc = res.headers['content-encoding'];
                    let stream = res;
                    if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
                    else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
                    const ct = res.headers['content-type'] || 'image/jpeg';
                    stream.on('data', d => chunks.push(d));
                    stream.on('end', () => {
                        const b64 = Buffer.concat(chunks).toString('base64');
                        resolve(b64 ? `data:${ct};base64,${b64}` : null);
                    });
                    stream.on('error', () => resolve(null));
                });
                req.on('timeout', () => { req.destroy(); resolve(null); });
                req.on('error', () => resolve(null));
            } catch { resolve(null); }
        });
    };

    P.scrapeProfile = async function (username) {
        const cleanUser = username.replace(/[^a-zA-Z0-9._]/g, '').toLowerCase();
        if (!cleanUser) throw new Error('Invalid username');

        /* ── Pick a random User-Agent for this request chain ── */
        const ua = this._randomUA();
        const mobileUA = this._randomMobileUA();

        // ── Best result accumulator: starts empty, then is built up by each strategy ──
        let bestResult = null;

        /* ═══════════════════════════════════════════════════════════════════════
           STRATEGY 1: Instaloader (Python) — PRIMARY — fetches ALL posts with full data
           Uses Python instaloader library to bypass Instagram's restrictions.
           Fetches complete post data including likes, comments, captions, hashtags,
           mentions, tagged users, video views, carousel counts, and locations.
           This is tried FIRST because it provides the most complete data.
        ═══════════════════════════════════════════════════════════════════════ */
        const ilAuth = this.isInstagramLoggedIn();
        if (!ilAuth || !ilAuth.loggedIn) {
            // Instaloader only ever succeeds with a real session; running it while
            // signed out spends ~20s in timeouts before the browser method — the
            // one that actually works anonymously — even starts.
            console.log('[SWA] ⏭️ Strategy 1 skipped: Instaloader needs a signed-in session — going straight to the browser method.');
        } else {
        console.log(`[SWA] 🔍 Strategy 1: Instaloader (Python) for @${cleanUser}`);
        try {
            const ilResult = await this._scrapeViaInstaloader(cleanUser, null, this.currentProfile && this.currentProfile._userId);
            if (ilResult && ilResult.profile && ilResult.profile.username) {
                console.log(`[SWA] ✅ Instaloader recovered profile for @${cleanUser} (${ilResult.posts?.length || 0} posts)`);
                // Helper resolves the numeric user ID internally (profile.userId) —
                // propagate it so later strategies / future scans skip the blocked
                // username lookup entirely.
                if (ilResult.profile.userId && !ilResult._userId) {
                    ilResult._userId = String(ilResult.profile.userId);
                }
                if (ilResult._userId) {
                    this.currentProfile = this.currentProfile || {};
                    this.currentProfile._userId = String(ilResult._userId);
                }
                bestResult = this._mergeResults(bestResult, ilResult);
                // Instaloader gives us ALL posts with full data — return immediately
                // if the profile is complete (has follower count). If the anonymous
                // path left profile stats blank, keep scanning so later strategies
                // can fill in followers/bio via _mergeResults.
                if (bestResult.posts && bestResult.posts.length > 0 &&
                    bestResult.profile && bestResult.profile.followers != null) {
                    return bestResult;
                }
            }
        } catch (e) {
            console.log(`[SWA] ℹ️ Instaloader failed for @${cleanUser}: ${e.message || e}`);
        }
        }

        /* ══ Random delay between retries ══ */
        await this._delay(500 + Math.random() * 1000);

        /* ═══════════════════════════════════════════════════════════════════════
           STRATEGY 2: IPC Browser-Based Scraper (fallback)
           Uses a real Chromium BrowserWindow to bypass Instagram's login wall.
           Instagram blocks Node.js https requests but allows real Chrome traffic.
           The IPC handler (main.js) fetches ALL posts via paginated Mobile API v1.
        ═══════════════════════════════════════════════════════════════════════ */
        console.log(`[SWA] 🔍 Strategy 2: IPC browser scrape for @${cleanUser}`);
        try {
            const ipcResult = await this.scrapeViaIPC(cleanUser);
            if (ipcResult && ipcResult.profile && ipcResult.profile.username) {
                console.log(`[SWA] ✅ IPC browser recovered profile for @${cleanUser} (${ipcResult.posts?.length || 0} posts)`);
                bestResult = this._mergeResults(bestResult, ipcResult);
                // The browser method returns the real header (followers) plus every
                // post Instagram exposes without a session. The remaining strategies
                // need a session or a token, so stop here instead of spending ~40s on
                // requests that can only come back 401/400 — unless a Graph API token
                // is configured, in which case Business Discovery still has the full
                // history to add.
                const hasGraphToken = !!(this.settings && this.settings.accessToken);
                if (!hasGraphToken && bestResult && bestResult.posts && bestResult.posts.length > 0 &&
                    bestResult.profile && bestResult.profile.followers != null) {
                    return bestResult;
                }
            }
        } catch (e) {
            console.log(`[SWA] ℹ️ IPC browser failed for @${cleanUser}: ${e.message || e}`);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           STRATEGY 2b: Business Discovery (official Meta API)
           The supported, accurate route: real like/comment counts for another
           professional account's public posts, paginated to the API's ceiling.
           Runs only when a token is configured; the browser pass above supplies
           the thumbnails this endpoint does not return.
        ═══════════════════════════════════════════════════════════════════════ */
        if (this.settings && this.settings.accessToken) {
            console.log(`[SWA] 🔑 Strategy 2b: Business Discovery (Graph API) for @${cleanUser}`);
            try {
                const bd = await this.scrapeViaBusinessDiscovery(cleanUser, {
                    onPage: (p) => { if (this._onScanProgress) { try { this._onScanProgress({ phase: 'page', page: p.page, posts: p.posts, username: cleanUser }); } catch (e) { } } },
                });
                if (bd && bd.profile) {
                    bestResult = this._mergeResults(bestResult, bd);
                    console.log(`[SWA] ✅ Business Discovery returned ${bd.posts.length} media items across ${bd._pages} page(s)`);
                    // Business Discovery can supply the whole history plus real
                    // counts; the strategies below all need a browser session that
                    // is not present, so stop once it produced media.
                    if (bd.posts.length > 0) return bestResult;
                } else {
                    console.log('[SWA] ℹ️ Business Discovery returned nothing — falling back');
                }
            } catch (e) {
                console.log(`[SWA] ℹ️ Business Discovery failed: ${e.message || e}`);
                if (this.logError) { try { this.logError('Business Discovery: ' + (e.message || e), 'scrapeProfile(business-discovery)', '0'); } catch (err) { } }
            }
        }

        await this._delay(500 + Math.random() * 1000);

        /* ═══════════════════════════════════════════════════════════════════════
           STRATEGY 3: i.instagram.com REST API + GraphQL pagination
           First gets profile info + first 12 posts from web_profile_info,
           then uses paginated GraphQL queries to fetch ALL remaining posts.
           Unlike the old code that returned early with 12 posts, this merges
           the profile data with ALL posts from GraphQL pagination.
        ═══════════════════════════════════════════════════════════════════════ */
        console.log(`[SWA] 🔍 Strategy 3: REST API + GraphQL pagination for @${cleanUser}`);
        try {
            // Step A: Get profile + userId from REST API (gives profile info + 12 posts)
            const body = await this.nodeGet('i.instagram.com',
                `/api/v1/users/web_profile_info/?username=${encodeURIComponent(cleanUser)}`,
                {
                    'User-Agent': mobileUA,
                    'X-IG-App-ID': this._randomAppId(),
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.instagram.com/',
                    'Origin': 'https://www.instagram.com',
                }
            );
            const user = JSON.parse(body)?.data?.user;
            if (user?.username) {
                const restResult = this.buildResult(user);
                if (user.id) {
                    restResult._userId = user.id;
                    // Step B: Use paginated GraphQL to get ALL posts (not just 12)
                    console.log(`[SWA] 📄 Fetching ALL posts via GraphQL pagination for userId=${user.id}...`);
                    const allPosts = await this._scrapePostsGraphQL(cleanUser, user.id);
                    if (allPosts && allPosts.length > 0) {
                        restResult.posts = allPosts;
                        console.log(`[SWA] ✅ GraphQL pagination fetched ${allPosts.length} posts total`);
                    } else {
                        console.log(`[SWA] ℹ️ GraphQL returned 0 additional posts, keeping ${restResult.posts?.length || 0} from REST API`);
                    }
                }
                bestResult = this._mergeResults(bestResult, restResult);
                // If we got a good number of posts, return
                if (bestResult && bestResult.posts && bestResult.posts.length >= 24) {
                    return bestResult;
                }
            }
        } catch (e) {
            console.log(`[SWA] ℹ️ REST API + GraphQL failed: ${e.message || e}`);
        }

        /* ══════════════════════════════════════════════════════════════════
           STRATEGY 3b: Mobile app API profile info
           Fills in real follower / following / media counts when the web
           endpoints are blocked (common for anonymous access).
        ══════════════════════════════════════════════════════════════════ */
        if (!bestResult || !bestResult.profile || bestResult.profile.followers == null || bestResult.profile.posts == null) {
            console.log(`[SWA] 🔍 Strategy 3b: Mobile API profile info for @${cleanUser}`);
            try {
                const mobile = await this._scrapeViaMobileAPI(cleanUser, bestResult && bestResult._userId);
                if (mobile && mobile.profile && mobile.profile.username) {
                    bestResult = this._mergeResults(bestResult, mobile);
                    console.log(`[SWA] ✅ Mobile API got real counts for @${cleanUser} (${mobile.profile.followers ?? '?'} followers, ${mobile.profile.posts ?? '?'} posts)`);
                }
            } catch (e) {
                console.log(`[SWA] ℹ️ Mobile API strategy failed: ${e.message || e}`);
            }
        }

        await this._delay(1000 + Math.random() * 1500);

        /* ═══════════════════════════════════════════════════════════════════════
           STRATEGY 4: GraphQL query directly (standalone — no REST API needed)
           Uses paginated GraphQL to discover userId from HTML, then fetches ALL posts.
        ═══════════════════════════════════════════════════════════════════════ */
        console.log(`[SWA] 🔍 Strategy 4: Direct GraphQL pagination for @${cleanUser}`);
        try {
            const posts = await this._scrapePostsGraphQL(cleanUser, null);
            if (posts && posts.length > 0) {
                console.log(`[SWA] ✅ Direct GraphQL fetched ${posts.length} posts for @${cleanUser}`);
                // Merge with bestResult — if we already have profile info, keep it
                const gqlResult = {
                    profile: bestResult?.profile || {
                        username: cleanUser,
                        fullName: '',
                        bio: '',
                        profilePicUrl: '',
                        followers: null,
                        following: null,
                        posts: null,
                        isVerified: false,
                        isPrivate: false,
                        externalUrl: '',
                        fetchedAt: new Date().toISOString(),
                    },
                    posts
                };
                bestResult = this._mergeResults(bestResult, gqlResult);
                if (bestResult && bestResult.posts && bestResult.posts.length >= 12) {
                    return bestResult;
                }
            }
        } catch (e) {
            console.log(`[SWA] ℹ️ Direct GraphQL failed: ${e.message || e}`);
        }

        await this._delay(500 + Math.random() * 1000);

        /* ═══════════════════════════════════════════════════════════════════════
           STRATEGY 5: HTML scrape with JSON extraction (last resort)
           Extracts profile + posts from the HTML of the profile page.
        ═══════════════════════════════════════════════════════════════════════ */
        console.log(`[SWA] 🔍 Strategy 5: HTML scrape for @${cleanUser}`);
        try {
            const html = await this.nodeGet('www.instagram.com',
                `/${encodeURIComponent(cleanUser)}/`,
                {
                    'User-Agent': ua,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.instagram.com/',
                    'Cache-Control': 'no-cache',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1'
                }
            );
            if (typeof html === 'string') {
                const htmlResult = this.scrapeFromHtml(html, cleanUser);
                if (htmlResult && htmlResult.profile) {
                    bestResult = this._mergeResults(bestResult, htmlResult);
                }
            }
        } catch (e) {
            console.log(`[SWA] ℹ️ HTML scrape failed: ${e.message || e}`);
        }

        // ── Final check: do we have a result? ──
        if (bestResult && bestResult.profile && bestResult.profile.username) {
            console.log(`[SWA] ✅ Returning merged result for @${cleanUser} (${bestResult.posts?.length || 0} posts)`);
            return bestResult;
        }

        throw new Error('Could not load Instagram profile — try again or log in via Settings for better results');
    };

    /**
     * Deduplicate posts by shortcode and order them newest-first.
     * Guarantees a stable, accurate grid regardless of which scan strategy
     * surfaced the posts (Instaloader, GraphQL, DOM scroll…).
     */
    P._dedupeAndSortPosts = function (posts) {
        if (!Array.isArray(posts) || posts.length === 0) return posts || [];
        const byId = new Map();
        for (const p of posts) {
            const key = p && (p.shortcode || p.code);
            if (!key) continue;
            const prev = byId.get(key);
            if (!prev) { byId.set(key, p); continue; }
            // Merge duplicate rows, filling missing engagement data.
            for (const k of Object.keys(p)) {
                if (p[k] != null && (prev[k] == null || prev[k] === '')) prev[k] = p[k];
            }
        }
        const arr = [...byId.values()];
        arr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        return arr;
    };

    /**
     * Merge two scan results (profile + posts), keeping the best data from each.
     * Posts are deduplicated by shortcode; richer data (non-null values) is preferred.
     * Profile fields from newer results fill in missing fields from older results.
     */
    P._mergeResults = function (existing, incoming) {
        if (!existing) { if (incoming) incoming.posts = this._dedupeAndSortPosts(incoming.posts); return incoming; }
        if (!incoming) { existing.posts = this._dedupeAndSortPosts(existing.posts); return existing; }

        // ── Merge profile: prefer non-null values from incoming ──
        const mergedProfile = { ...existing.profile };
        if (incoming.profile) {
            Object.keys(incoming.profile).forEach(key => {
                if (incoming.profile[key] != null && (mergedProfile[key] == null || mergedProfile[key] === '')) {
                    mergedProfile[key] = incoming.profile[key];
                }
            });
        }

        // ── Merge posts: deduplicate by shortcode, keep richer data ──
        const mergedPosts = {};
        const allPostArrays = [existing.posts || [], incoming.posts || []];
        for (const arr of allPostArrays) {
            for (const p of arr) {
                if (!p.shortcode) continue;
                const existingPost = mergedPosts[p.shortcode];
                if (!existingPost) {
                    mergedPosts[p.shortcode] = { ...p };
                } else {
                    // Merge: prefer non-null values (richer data)
                    Object.keys(p).forEach(key => {
                        if (p[key] != null && key !== 'shortcode') {
                            // Only overwrite if existing is null/undefined/empty
                            if (existingPost[key] == null || existingPost[key] === '') {
                                existingPost[key] = p[key];
                            }
                            // Always prefer string captions from Instaloader (longer = more complete)
                            if (key === 'caption' && typeof p[key] === 'string' && typeof existingPost[key] === 'string') {
                                if (p[key].length > existingPost[key].length) {
                                    existingPost[key] = p[key];
                                }
                            }
                            // Always prefer non-null likes/comments
                            if ((key === 'likes' || key === 'comments') && p[key] != null && existingPost[key] == null) {
                                existingPost[key] = p[key];
                            }
                            // Never overwrite a non-empty array with an empty one
                            if (Array.isArray(p[key]) && Array.isArray(existingPost[key]) &&
                                p[key].length === 0 && existingPost[key].length > 0) {
                                return; // skip — keep existing non-empty array
                            }
                        }
                    });
                }
            }
        }

        // The scan report must survive the merge: it is what says how much of
        // the account this walk actually covered, and it is stored with the
        // result so a partial walk stays labelled partial afterwards.
        return {
            profile: mergedProfile,
            posts: this._dedupeAndSortPosts(Object.values(mergedPosts)),
            _userId: existing._userId || incoming._userId || null,
            scanReport: incoming.scanReport || existing.scanReport || null,
            _methods: incoming._methods || existing._methods || null,
        };
    };

    /* ═══════════════════════════════════════════════════════════════════
       BUSINESS DISCOVERY (official, accurate)

       The supported way to read another professional account's public posts,
       including engagement: the target does NOT have to authorise anything, but
       the call is made with a token belonging to the user's OWN Instagram
       Business/Creator account linked to a Facebook Page.

         GET https://graph.facebook.com/v25.0/{ig-user-id}
            ?fields=business_discovery.username(target){username,followers_count,
                    media_count,media.limit(100){id,caption,media_type,permalink,
                    timestamp,like_count,comments_count,view_count}}
            &access_token={user-access-token}

       Required permissions: instagram_basic, instagram_manage_insights,
       pages_read_engagement. Posts of personal accounts are NOT reachable this
       way; hidden like counts are omitted rather than reported as zero.
       Pagination is by cursor (before/after), not by a `next` URL.
    ═══════════════════════════════════════════════════════════════════ */
    P._businessDiscoveryHost = function () {
        // Business Discovery only exists on graph.facebook.com. If the user
        // configured the Instagram-Login host, still call the Graph host.
        return 'graph.facebook.com';
    };

    P._businessDiscoveryVersion = function () {
        const configured = String((this.settings && this.settings.instagramApiUrl) || '');
        const m = configured.match(/^https?:\/\/graph\.facebook\.com\/(v[0-9.]+)/i);
        return m ? m[1] : 'v25.0';
    };

    /** Resolve the app user's own professional IG account id (the required path param). */
    P._resolveBusinessDiscoveryUserId = async function (token) {
        const host = this._businessDiscoveryHost();
        const v = this._businessDiscoveryVersion();
        if (this.settings && this.settings.igBusinessAccountId) {
            return String(this.settings.igBusinessAccountId).trim();
        }
        // /me/accounts → the Pages this user manages; the first linked professional account wins.
        try {
            const body = await this.nodeGet(host,
                `/${v}/me/accounts?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`,
                { 'Accept': 'application/json' });
            const pages = JSON.parse(body)?.data || [];
            for (const p of pages) {
                if (p.instagram_business_account && p.instagram_business_account.id) return String(p.instagram_business_account.id);
            }
        } catch (e) { /* fall through to the id field */ }
        try {
            const body = await this.nodeGet(host,
                `/${v}/me?fields=id,username&access_token=${encodeURIComponent(token)}`,
                { 'Accept': 'application/json' });
            const id = JSON.parse(body)?.id;
            if (id) return String(id);
        } catch (e) { /* nothing else to try */ }
        return null;
    };

    /** Turn a Business Discovery media object into the shape the rest of the app uses. */
    P._mapBusinessDiscoveryMedia = function (m) {
        if (!m) return null;
        const permalink = m.permalink || '';
        const scMatch = permalink.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
        const code = scMatch ? scMatch[1] : (m.id ? String(m.id) : '');
        if (!code) return null;
        const caption = m.caption || '';
        const hashtags = caption ? [...new Set(caption.match(/#[\w\u00c0-\u024f]+/g) || [])] : [];
        const mentions = caption ? [...new Set(caption.match(/@[\w.]+/g) || [])] : [];
        const type = String(m.media_type || '').toUpperCase();
        const postType = type === 'VIDEO' ? 'video' : (type === 'CAROUSEL_ALBUM' ? 'carousel' : 'photo');
        const ts = m.timestamp ? Math.floor(Date.parse(m.timestamp) / 1000) : null;
        return {
            shortcode: code,
            url: permalink || `https://www.instagram.com/p/${code}/`,
            // Business Discovery returns no thumbnail; the browser pass supplies it.
            thumbnail: '',
            likes: m.like_count != null ? m.like_count : null,
            comments: m.comments_count != null ? m.comments_count : null,
            caption,
            hashtags,
            mentions,
            isVideo: type === 'VIDEO',
            postType,
            carouselCount: type === 'CAROUSEL_ALBUM' ? 1 : 0,
            videoViews: m.view_count != null ? m.view_count : null,
            videoDuration: null,
            location: null,
            timestamp: (ts && !isNaN(ts)) ? ts : null,
            source: 'business_discovery',
        };
    };

    /**
     * Full public history + real engagement counts, through Meta's own API.
     * Returns null when no token is configured so the caller can fall back.
     */
    P.scrapeViaBusinessDiscovery = async function (username, opts) {
        const options = opts || {};
        const token = (options.token || (this.settings && this.settings.accessToken) || '').trim();
        if (!token) return null;
        const maxPages = options.maxPages || 100;   // 100 pages x 100 media = the documented 10k ceiling
        const host = this._businessDiscoveryHost();
        const v = this._businessDiscoveryVersion();

        const igUserId = options.igUserId || await this._resolveBusinessDiscoveryUserId(token);
        if (!igUserId) throw new Error('Business Discovery needs the IG user id of your own professional account (Settings → Instagram Graph API)');

        const posts = [];
        let page = 0, usernameBack = username, followers = null, mediaCount = null, after = null;

        while (page < maxPages) {
            page++;
            const cursor = after ? `.after(${after})` : '';
            const fields = 'business_discovery.username(' + username + ')' +
                '{username,id,followers_count,follows_count,media_count,' +
                'media.limit(100)' + cursor + '{id,caption,media_type,permalink,timestamp,like_count,comments_count,view_count}}';
            const body = await this.nodeGet(host,
                `/${v}/${encodeURIComponent(igUserId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`,
                { 'Accept': 'application/json' });
            let payload;
            try { payload = JSON.parse(body); } catch (e) { throw new Error('Business Discovery returned non-JSON: ' + String(body).slice(0, 160)); }
            if (payload && payload.error) {
                throw new Error('Business Discovery error: ' + (payload.error.message || 'unknown') +
                    (payload.error.code ? ' (code ' + payload.error.code + ')' : ''));
            }
            const bd = payload && payload.business_discovery;
            if (!bd) throw new Error('No business_discovery data returned — the target may be a personal or age-gated account');
            usernameBack = bd.username || usernameBack;
            followers = bd.followers_count != null ? bd.followers_count : followers;
            mediaCount = bd.media_count != null ? bd.media_count : mediaCount;
            const media = bd.media || {};
            const items = media.data || [];
            for (const m of items) {
                const mapped = this._mapBusinessDiscoveryMedia(m);
                if (mapped) posts.push(mapped);
            }
            const paging = media.paging || {};
            const nextAfter = (paging.cursors && paging.cursors.after) || null;
            // Stop when the API stops handing back a forward cursor, or the page
            // was short — either way the walk is over, not "complete by assumption".
            if (!nextAfter || items.length === 0 || !paging.next) break;
            if (options.onPage) { try { options.onPage({ page, posts: posts.length }); } catch (e) { } }
            after = nextAfter;
            await this._delay(options.pageDelayMs || 400);
        }

        const profile = {
            username: usernameBack,
            fullName: '',
            bio: '',
            profilePicUrl: '',
            followers,
            following: null,
            posts: mediaCount,
            isVerified: false,
            isPrivate: false,
            externalUrl: '',
            fetchedAt: new Date().toISOString(),
            _source: 'business_discovery',
        };
        return { profile, posts: this._dedupeAndSortPosts(posts), _source: 'business_discovery', _pages: page };
    };

    /* ── User-Agent rotation ──────────────────────────── */
    /* ── Lightweight profile-info refresh ────────────────────────────────
       Fetch ONLY the profile payload (followers / following / bio / pic /
       name / verified) for an already-loaded profile. Used to fill in fields
       a posts-only scan left blank, without re-scraping every post. Uses the
       saved session automatically when the user is logged in. */
    P.fetchProfileInfo = async function (username, userId) {
        const cleanUser = String(username || '').replace(/[^a-zA-Z0-9._]/g, '').toLowerCase();
        if (!cleanUser) return null;

        // Short-TTL cache: avoid hammering Instagram (and re-triggering rate
        // limits) when the same profile is refreshed repeatedly this session.
        const TTL_MS = 10 * 60 * 1000;
        this._profileInfoCache = this._profileInfoCache || {};
        const cached = this._profileInfoCache[cleanUser];
        if (cached && (Date.now() - cached.at) < TTL_MS) return cached.info;
        const remember = (info) => {
            if (info) this._profileInfoCache[cleanUser] = { at: Date.now(), info };
            return info;
        };

        // 1) Web profile-info endpoint (richest payload).
        try {
            const body = await this.nodeGet('i.instagram.com',
                `/api/v1/users/web_profile_info/?username=${encodeURIComponent(cleanUser)}`,
                {
                    'User-Agent': this._randomMobileUA(),
                    'X-IG-App-ID': this._randomAppId(),
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': `https://www.instagram.com/${encodeURIComponent(cleanUser)}/`,
                    'Origin': 'https://www.instagram.com',
                });
            const user = JSON.parse(body)?.data?.user;
            if (user?.username) return remember(this.buildResult(user).profile);
        } catch (e) {
            console.log(`[SWA] ℹ️ web_profile_info failed for @${cleanUser}: ${e.message || e} — trying mobile API`);
        }

        // 2) Mobile app API (often works when the web endpoint is blocked).
        try {
            const mobile = await this._scrapeViaMobileAPI(cleanUser, userId);
            if (mobile && mobile.profile && mobile.profile.username) return remember(mobile.profile);
        } catch (e) {
            console.log(`[SWA] ℹ️ Mobile API profile info failed for @${cleanUser}: ${e.message || e}`);
        }

        console.log(`[SWA] ℹ️ Profile-info refresh failed for @${cleanUser}`);
        return null;
    };

    /* ── Scraper #6: Mobile app API profile info ─────────────────────────
       i.instagram.com/api/v1/users/{id|username}/info returns
       follower_count / following_count / media_count and frequently succeeds
       where the web_profile_info endpoint returns 400. */
    P._scrapeViaMobileAPI = async function (username, userId) {
        const cleanUser = String(username || '').replace(/[^a-zA-Z0-9._]/g, '').toLowerCase();
        const headers = {
            'User-Agent': 'Instagram 317.0.0.0.35 Android (30/11; 420dpi; 1080x2187; OnePlus; 6T; OnePlus6T; qcom; en_US; 474786801)',
            'X-IG-App-ID': '567067343352427',
            'X-IG-Capabilities': '3brTvw==',
            'X-IG-Connection-Type': 'WIFI',
            'Accept': '*/*',
            'Accept-Language': 'en-US',
        };
        // Try the numeric id first (cheapest, avoids a username lookup).
        const id = userId || (this.currentProfile && this.currentProfile._userId) || (this.currentProfile && this.currentProfile.userId);
        if (id) {
            try {
                const body = await this.nodeGet('i.instagram.com', `/api/v1/users/${id}/info/`, headers);
                const user = JSON.parse(body)?.user;
                if (user && (user.username || user.pk)) return this._mapMobileUser(user, cleanUser);
            } catch (e) { /* fall through to username lookup */ }
        }
        // Fall back to a username lookup.
        try {
            const body = await this.nodeGet('i.instagram.com', `/api/v1/users/${encodeURIComponent(cleanUser)}/usernameinfo/`, headers);
            const user = JSON.parse(body)?.user;
            if (user) return this._mapMobileUser(user, cleanUser);
        } catch (e) { /* give up */ }
        return null;
    };

    P._mapMobileUser = function (user, fallbackUsername) {
        const uid = user.pk || user.id || user.user_id || null;
        const profile = {
            username: user.username || fallbackUsername,
            fullName: user.full_name || '',
            bio: user.biography || '',
            profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url || (user.hd_profile_pic_url_info && user.hd_profile_pic_url_info.url) || '',
            followers: user.follower_count ?? null,
            following: user.following_count ?? null,
            posts: user.media_count ?? null,
            isVerified: !!user.is_verified,
            isPrivate: !!user.is_private,
            externalUrl: user.external_url || '',
            userId: uid,
            fetchedAt: new Date().toISOString(),
        };
        return { profile, posts: [], _userId: uid != null ? String(uid) : null };
    };

    P._userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
    ];

    P._mobileUAs = [
        'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.72 Mobile Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'Instagram 269.0.0.18.75 Android (29/10; 420dpi; 1080x1920; OnePlus; HD1900; OnePlus7T; qcom; en_US; 420108292)',
        'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.72 Mobile Safari/537.36',
    ];

    P._appIds = [
        '936619743392459',  // Instagram Web
        '567067343352427',  // Instagram iOS
        '124024574287414',  // Instagram Android
        '121798164487962',  // Instagram Lite
    ];

    P._randomUA = function () {
        return this._userAgents[Math.floor(Math.random() * this._userAgents.length)];
    };

    P._randomMobileUA = function () {
        return this._mobileUAs[Math.floor(Math.random() * this._mobileUAs.length)];
    };

    P._randomAppId = function () {
        return this._appIds[Math.floor(Math.random() * this._appIds.length)];
    };

    /* ── GraphQL posts scrape ─────────────────────────── */
    // ⚠️ Instagram rotates query_hash / doc_id values every 2-4 weeks.
    // To find current values:
    //   1. Open instagram.com/{username}/ in Chrome DevTools
    //   2. Go to Network tab, filter "graphql/query" or "graphql"
    //   3. Find a POST request to /graphql/query
    //   4. In the Payload tab, look for "doc_id" or "query_hash" parameter
    //   5. Copy the value(s) and add them to the arrays below
    P._scrapePostsGraphQL = async function (username, userId) {
        if (!userId) {
            // Try to get userId from HTML first
            try {
                const html = await this.nodeGet('www.instagram.com',
                    `/${encodeURIComponent(username)}/`,
                    { 'User-Agent': this._randomUA(), 'Accept': 'text/html,*/*' }
                );
                const escapedUser = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const idMatch = html.match(/"profilePage_(\d+)"/) || html.match(new RegExp('"id":"(\\d+)","username":"' + escapedUser + '"'));
                if (idMatch) userId = idMatch[1];
                // Also try __NEXT_DATA__ pattern
                if (!userId) {
                    const nextMatch = html.match(/"id":"(\\d+)","is_private/);
                    if (nextMatch) userId = nextMatch[1];
                }
            } catch { }
        }
        if (!userId) return [];

        const ua = this._randomUA();
        const appId = this._randomAppId();
        const baseHeaders = {
            'User-Agent': ua,
            'Accept': 'application/json',
            'Referer': `https://www.instagram.com/${encodeURIComponent(username)}/`,
            'X-IG-App-ID': appId,
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://www.instagram.com',
            'X-ASBD-ID': '129477',
        };

        // ── Attempt 1: GET with query_hash (older format, still sometimes works) ──
        const queryHashes = [
            '69cba40317214236af40e7efa697781d',  // User media timeline (2025+)
            '452a673636280e5504746f34533036a7',  // User posts (2025+)
            '8c2a52996976f1ecb4e20ae6cb1e8e5c',  // User media timeline (legacy)
            '42323d64886122307be10013ad2dcc44',  // User posts (legacy)
            'e769aa130647d2354c40ea6a439bfc08',  // User feed timeline (legacy)
        ];
        // ── Paginated fetch: collect ALL posts, not just the first page ──
        const allEdges = [];
        let cursor = null;
        const maxPages = 50; // increased limit to fetch ALL posts (was 20)

        // ── Attempt 1: GET with query_hash (older format, still sometimes works) ──
        for (const queryHash of queryHashes) {
            try {
                allEdges.length = 0;
                cursor = null;
                for (let page = 0; page < maxPages; page++) {
                    const variables = JSON.stringify({ id: userId, first: 50, after: cursor });
                    const body = await this.nodeGet('www.instagram.com',
                        `/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(variables)}`,
                        { ...baseHeaders }
                    );
                    const data = JSON.parse(body);
                    const timeline = data?.data?.user?.edge_owner_to_timeline_media ||
                        data?.data?.user?.edge_feed ||
                        data?.data?.xdt_api__v1__feed__user_timeline_graphql_connection;
                    const edges = timeline?.edges || [];
                    if (edges.length === 0) break;
                    allEdges.push(...edges);
                    const pageInfo = timeline?.page_info;
                    if (pageInfo?.has_next_page && pageInfo?.end_cursor) {
                        cursor = pageInfo.end_cursor;
                        await this._delay(600 + Math.random() * 400);
                    } else {
                        break;
                    }
                }
                if (allEdges.length > 0) {
                    const pageCount = Math.ceil(allEdges.length / 50);
                    console.log(`[SWA] 📄 query_hash ${queryHash.substring(0, 8)}... fetched ${allEdges.length} posts across ${pageCount} pages`);
                    return this.extractPosts({ edge_owner_to_timeline_media: { edges: allEdges } });
                }
            } catch { }
        }

        // ── Attempt 2: POST with doc_id (Instagram's 2025+ format) ──
        const docIds = [
            '10015901848480474',  // User posts timeline (2025+)
            '8845758582119845',   // User media (2025+)
            '9310670392322965',   // User feed (2025+)
            '17888483320059182',  // User media timeline (2025+ alternate)
            '5587632691332174',   // User posts timeline (legacy)
            '5443204686453520',   // User media (legacy)
            '5006509564031732',   // User feed (legacy)
            '5015191076003067',   // User posts (alt legacy)
        ];

        for (const docId of docIds) {
            try {
                allEdges.length = 0;
                cursor = null;
                for (let page = 0; page < maxPages; page++) {
                    const variables = JSON.stringify({ id: userId, first: 50, after: cursor });
                    const body = await this.nodePost('www.instagram.com', '/graphql/query', {
                        ...baseHeaders,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }, `doc_id=${docId}&variables=${encodeURIComponent(variables)}`);
                    const data = JSON.parse(body);
                    const timeline = data?.data?.user?.edge_owner_to_timeline_media ||
                        data?.data?.user?.edge_feed ||
                        data?.data?.xdt_api__v1__feed__user_timeline_graphql_connection;
                    const edges = timeline?.edges || [];
                    if (edges.length === 0) break;
                    allEdges.push(...edges);
                    const pageInfo = timeline?.page_info;
                    if (pageInfo?.has_next_page && pageInfo?.end_cursor) {
                        cursor = pageInfo.end_cursor;
                        await this._delay(600 + Math.random() * 400);
                    } else {
                        break;
                    }
                }
                if (allEdges.length > 0) {
                    console.log(`[SWA] 📄 doc_id ${docId} fetched ${allEdges.length} posts across pages`);
                    return this.extractPosts({ edge_owner_to_timeline_media: { edges: allEdges } });
                }
            } catch { }
        }

        return [];
    };

    /* ── POST request helper (for doc_id-based GraphQL queries) ── */
    P.nodePost = function (hostname, path, headers = {}, body = '') {
        return this._requestRetry(() => this._nodePostOnce(hostname, path, headers, body),
            `POST ${hostname}${path}`);
    };

    P._nodePostOnce = function (hostname, path, headers = {}, body = '') {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const zlib = require('zlib');
            const req = https.request({
                hostname, path, method: 'POST',
                headers: { 'Accept-Encoding': 'gzip, deflate, br', ...this._igAuthHeaders(hostname), ...headers },
                timeout: 15000,
            }, res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                    return reject(new Error('Redirect on POST'));
                }
                if (res.statusCode === 404) return reject(new Error('Not found (404)'));
                if (res.statusCode === 429) return reject(new Error('Rate limited (429)'));
                if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));

                const chunks = [];
                const enc = res.headers['content-encoding'];
                let stream = res;
                if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
                else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
                else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());

                stream.on('data', d => chunks.push(d));
                stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
                stream.on('error', reject);
            });
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    };

    P.buildResult = function (user) {
        if (user.is_private) throw new Error('Account is private');
        const posts = this.extractPosts(user);
        return {
            profile: {
                username: user.username,
                fullName: user.full_name || '',
                bio: user.biography || '',
                profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url || '',
                followers: user.edge_followed_by?.count ?? user.follower_count ?? null,
                following: user.edge_follow?.count ?? user.following_count ?? null,
                posts: user.edge_owner_to_timeline_media?.count ?? user.media_count ?? null,
                isVerified: user.is_verified || false,
                isPrivate: false,
                externalUrl: user.external_url || '',
                fetchedAt: new Date().toISOString(),
            },
            posts
        };
    };

    P.getPostType = function (n) {
        const node = n.node || n;
        if (node.__typename === 'GraphSidecar' || node.edge_sidecar_to_children?.edges?.length) return 'carousel';
        if (node.is_video || node.__typename === 'GraphVideo' || node.product_type === 'clips') return node.product_type === 'clips' ? 'reel' : 'video';
        return 'photo';
    };

    P.getPostTypeIcon = function (type) {
        return { photo: '🖼️', video: '🎬', reel: '🎞️', carousel: '📸' }[type] || '🖼️';
    };

    P.getPostTypeLabel = function (type) {
        return { photo: 'Photo', video: 'Video', reel: 'Reel', carousel: 'Carousel' }[type] || 'Post';
    };

    P.extractPosts = function (user) {
        const edges = user.edge_owner_to_timeline_media?.edges ||
            user.edge_media_to_hobby?.edges ||
            user.xdt_api__v1__feed__user_timeline_graphql_connection?.edges || [];
        return edges.map(e => {
            const n = e.node || e.media || e;
            const postType = this.getPostType(n);
            const carouselCount = n.edge_sidecar_to_children?.edges?.length ||
                n.carousel_media_count || 0;
            
            // Extract caption text
            const caption = n.edge_media_to_caption?.edges?.[0]?.node?.text ||
                n.caption_text || n.caption?.text || '';
            
            // Extract hashtags and mentions from caption text
            let hashtags = [];
            let mentions = [];
            if (caption) {
                const htMatches = caption.match(/#[\w]+/g);
                if (htMatches) hashtags = [...new Set(htMatches)];
                const mnMatches = caption.match(/@[\w.]+/g);
                if (mnMatches) mentions = [...new Set(mnMatches)];
            }
            
            // Extract location name from node
            let locationName = '';
            try {
                const loc = n.location;
                if (loc) {
                    locationName = typeof loc === 'string' ? loc : (loc.name || loc.short_name || '');
                }
            } catch {}
            
            // Build video URL
            let videoUrl = null;
            if (n.video_url) videoUrl = n.video_url;
            
            // Video duration
            let videoDuration = null;
            if (n.video_duration != null) {
                videoDuration = typeof n.video_duration === 'number' ? Math.round(n.video_duration) : parseInt(n.video_duration) || null;
            }
            
            return {
                shortcode: n.shortcode || n.code || '',
                thumbnail: n.display_url || n.thumbnail_src ||
                    n.image_versions2?.candidates?.[0]?.url ||
                    n.thumbnail_resources?.slice(-1)?.[0]?.src || '',
                likes: n.edge_media_preview_like?.count ?? n.like_count ?? null,
                comments: n.edge_media_to_comment?.count ?? n.comment_count ?? null,
                caption: caption,
                hashtags: hashtags,
                mentions: mentions,
                isVideo: n.is_video || n.__typename === 'GraphVideo' || postType === 'reel',
                postType: postType,
                carouselCount: carouselCount,
                videoViews: n.video_view_count ?? n.play_count ?? null,
                videoUrl: videoUrl,
                videoDuration: videoDuration,
                location: locationName,
                timestamp: n.taken_at_timestamp ?? n.taken_at ?? null,
            };
        });
    };

    P.nodeGet = function (hostname, path, headers = {}, hops = 3) {
        return this._requestRetry(() => this._nodeGetOnce(hostname, path, headers, hops),
            `GET ${hostname}${path}`);
    };

    P._nodeGetOnce = function (hostname, path, headers = {}, hops = 3) {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const zlib = require('zlib');
            const req = https.request({
                hostname, path, method: 'GET',
                headers: { 'Accept-Encoding': 'gzip, deflate, br', ...this._igAuthHeaders(hostname), ...headers },
                timeout: 15000,
            }, res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops > 0) {
                    try {
                        const u = new URL(res.headers.location.startsWith('http')
                            ? res.headers.location : `https://${hostname}${res.headers.location}`);
                        return this._nodeGetOnce(u.hostname, u.pathname + u.search, headers, hops - 1).then(resolve).catch(reject);
                    } catch { }
                }
                if (res.statusCode === 404) return reject(new Error('Profile not found (404)'));
                if (res.statusCode === 429) return reject(new Error('Rate limited (429)'));
                if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));

                const chunks = [];
                const enc = res.headers['content-encoding'];
                let stream = res;
                if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
                else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
                else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());

                stream.on('data', d => chunks.push(d));
                stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
                stream.on('error', reject);
            });
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
            req.on('error', reject);
            req.end();
        });
    }

    /* ── Shared helpers ── */
    P._delay = (ms) => new Promise(r => setTimeout(r, ms));

    /* ── Authenticated Instagram requests ────────────────────────────────
       When the user is logged in (saved session), attach the session cookie
       and CSRF token to every instagram.com request. Authenticated calls
       bypass the anonymous access limit and return real follower/bio data
       instead of the stripped-down public payload. */
    P._igAuthHeaders = function (hostname) {
        try {
            if (!hostname || !/instagram\.com/i.test(String(hostname))) return {};
            const auth = this.isInstagramLoggedIn ? this.isInstagramLoggedIn() : null;
            if (!auth || !auth.loggedIn) return {};
            const parts = [];
            if (auth.sessionid) parts.push('sessionid=' + auth.sessionid);
            if (auth.csrftoken) parts.push('csrftoken=' + auth.csrftoken);
            if (auth.userId) parts.push('ds_user_id=' + auth.userId);
            const cookie = parts.length ? parts.join('; ') : this._cleanCookieHeader(auth.cookies);
            const headers = {};
            if (cookie) headers['Cookie'] = cookie;
            if (auth.csrftoken) headers['X-CSRFToken'] = auth.csrftoken;
            return headers;
        } catch { return {}; }
    };

    /* Reduce a raw Set-Cookie join into a valid Cookie request header,
       dropping attributes (Path, Domain, Expires, …) that are not allowed. */
    P._cleanCookieHeader = function (raw) {
        if (!raw || typeof raw !== 'string') return '';
        const ATTRS = /^(path|domain|expires|max-age|secure|httponly|samesite|version|comment)$/i;
        return raw.split(';')
            .map(s => s.trim())
            .filter(s => s && s.includes('='))
            .filter(s => !ATTRS.test(s.split('=')[0].trim()))
            .join('; ');
    };

    /* ── Retry transient HTTP failures with exponential backoff + jitter ──
       Rate limits (429), server errors (5xx) and DNS/socket/timeout issues
       are retried; genuine "not found"/"private" results surface immediately. */
    P._requestRetry = function (attemptFn, label = 'request', retries = 2) {
        let attempt = 0;
        const run = () => attemptFn().catch(err => {
            const msg = String((err && err.message) || err);
            const retriable = /429|rate limit|timed out|timeout|ECONN|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|EPIPE|HTTP 5\d\d|network/i.test(msg);
            if (!retriable || attempt >= retries) return Promise.reject(err);
            attempt++;
            const wait = Math.round(600 * Math.pow(2, attempt - 1) + Math.random() * 500);
            console.log(`[SWA] ↻ ${label} — retry ${attempt}/${retries} in ${wait}ms (${msg})`);
            return this._delay(wait).then(run);
        });
        return run();
    };

    /* Check if a string is a language name or platform name (not a real person's name) */
    P._isLanguageOrPlatformName = function (str) {
        if (!str || str.length < 2) return true;
        const lower = str.toLowerCase();
        // Block common language names that appear in localized OG titles
        const languageNames = [
            'afrikaans', 'albanian', 'amharic', 'arabic', 'armenian', 'basque',
            'belarusian', 'bengali', 'bosnian', 'bulgarian', 'burmese', 'catalan',
            'chinese', 'croatian', 'czech', 'danish', 'dutch', 'english', 'estonian',
            'filipino', 'finnish', 'french', 'galician', 'georgian', 'german',
            'greek', 'gujarati', 'haitian', 'hausa', 'hebrew', 'hindi',
            'hungarian', 'icelandic', 'indonesian', 'irish', 'italian', 'japanese',
            'javanese', 'kannada', 'kazakh', 'khmer', 'korean', 'kurdish',
            'latin', 'latvian', 'lithuanian', 'macedonian', 'malay', 'malayalam',
            'maltese', 'marathi', 'mongolian', 'nepali', 'norwegian', 'pashto',
            'persian', 'polish', 'portuguese', 'punjabi', 'romanian', 'russian',
            'serbian', 'sindhi', 'sinhala', 'slovak', 'slovene', 'somali',
            'spanish', 'sundanese', 'swahili', 'swedish', 'tamil', 'telugu',
            'thai', 'turkish', 'ukrainian', 'urdu', 'uzbek', 'vietnamese',
            'welsh', 'xhosa', 'yiddish', 'yoruba', 'zulu'
        ];
        // Block common platform/brand names that appear in OG titles
        const platformNames = [
            'instagram', 'facebook', 'twitter', 'tiktok', 'snapchat', 'youtube',
            'threads', 'linkedin', 'pinterest', 'reddit', 'tumblr', 'flickr',
            'photos', 'videos', 'photos and videos', 'reels', 'stories',
            'profile', 'page', 'account', 'error', 'not found', 'login',
            'sign up', 'sign in', 'log in'
        ];
        // Check exact match or contained within
        for (const name of languageNames) {
            if (lower === name) return true;
        }
        for (const name of platformNames) {
            if (lower === name) return true;
        }
        // If it matches a language code pattern (e.g., 'af', 'en', 'pt')
        if (/^[a-z]{2}$/.test(lower)) return true;
        return false;
    };

    P._cleanUsername = function (username, platform) {
        const clean = username.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9._]/g, '');
        if (!clean) throw new Error(`Invalid ${platform} username`);
        return clean;
    };

    P._makeProfile = function (username, platform, extra = {}) {
        return {
            username,
            platform,
            fullName: extra.fullName || '',
            bio: extra.bio || '',
            profilePicUrl: extra.profilePicUrl || '',
            followers: extra.followers ?? 0,
            following: extra.following ?? 0,
            posts: extra.posts ?? 0,
            isVerified: extra.isVerified ?? false,
            isPrivate: false,
            externalUrl: extra.externalUrl || '',
            fetchedAt: new Date().toISOString(),
            ...extra,
        };
    };

    P.scrapeTikTokProfile = async function () {
        throw new Error('TikTok profile scanning requires direct API access — not available yet');
    };

    P.scrapeSnapchatProfile = async function () {
        throw new Error('Snapchat profile scanning requires direct API access — not available yet');
    };

    P.scrapeFacebookProfile = async function () {
        throw new Error('Facebook profile scanning requires direct API access — not available yet');
    };

    P.scrapeThreadsProfile = async function () {
        throw new Error('Threads profile scanning requires direct API access — not available yet');
    };

    P.scrapeXProfile = async function () {
        throw new Error('X profile scanning requires direct API access — not available yet');
    };

    P.fetchPlatformProfile = async function (username, platform) {
        const platformInfo = this.platforms[platform] || this.platforms.instagram;
        if (!username?.trim()) { showToast('Enter a username', 'warning'); return; }

        if (platform === 'instagram') {
            if (this.isFetching) return;
            this.isFetching = true;
            this.setFetchingState(true);
            // If already on posts page, show loading overlay
            if (this.currentPage === 'posts') {
                this._showPostsLoading('⏳ Scanning Instagram profile...');
            }
            showToast(`🔍 Looking up @${username} on Instagram…`);
            try {
                const result = await this.scrapeProfile(username);
                // Merge new posts with existing posts to preserve likes/comments
                // from previous scans (API often returns null for anonymous access)
                const existingPosts = this.currentPosts || [];
                const existingMap = new Map(existingPosts.filter(p => p.shortcode).map(p => [p.shortcode, p]));
                const mergedPosts = (result.posts || []).map(p => {
                    const existing = p.shortcode ? existingMap.get(p.shortcode) : null;
                    if (existing) {
                        // Prefer non-null values from existing (scan data has real likes/comments)
                        return {
                            ...p,
                            likes: (p.likes != null) ? p.likes : existing.likes,
                            comments: (p.comments != null) ? p.comments : existing.comments,
                            caption: (p.caption && p.caption.length > (existing.caption || '').length) ? p.caption : (existing.caption || p.caption),
                            thumbnail: p.thumbnail || existing.thumbnail,
                            timestamp: p.timestamp || existing.timestamp,
                        };
                    }
                    return p;
                });
                this.currentProfile = result.profile;
                this.currentPosts = mergedPosts;
                result.posts = mergedPosts;
                // Propagate userId for future scanPosts strategies
                if (result._userId) this.currentProfile._userId = result._userId;
                showToast('🖼️ Loading images...');
                // Enrich posts with full captions and hashtags (async, non-blocking)
                this._enrichPostsWithCaptions(result.posts, username).then(enriched => {
                    result.posts = enriched;
                    this.currentPosts = enriched;
                    // Re-render so analysis sees enriched hashtags/mentions
                    if (this.currentPage === 'posts') {
                        this._renderPostsContent(enriched);
                    } else {
                        this.renderPostGrid(enriched);
                    }
                    this.renderDashboardPosts(enriched);
                }).catch(() => {});
                await this.loadProfileImages(result.profile, result.posts);
                this.displayProfile(result.profile, result.posts);
                this.saveProfileToHistory(result.profile, username, result.posts);
                this.renderCharts(result.posts);
                this.renderDashboardPosts(result.posts);
                this.renderMarketingAnalysis(result.profile, result.posts);
                this.renderMaps(result.profile, result.posts);
                this.updateStats();
                // Render posts — if already on posts page, use _renderPostsContent which
                // handles loading overlay and chart rendering in one pass
                if (this.currentPage === 'posts') {
                    this._renderPostsContent(this.currentPosts);
                } else {
                    this.renderPostGrid(result.posts);
                }
                showToast(`✅ @${username} — ${this.fmt(result.profile.followers)} followers, ${result.posts.length} posts`, 'success');
                // Remember how far this walk actually got, so the coverage line and
                // the saved snapshot can state it afterwards.
                if (result.scanReport) this.lastScanReport = result.scanReport;
                // Persist last search + snapshot so this result survives even if a
                // later scan fails, and so the next launch shows it immediately.
                this._persistScanResult(result.profile, result.posts, {
                    scanReport: result.scanReport || this.lastScanReport || null,
                    source: 'live-scan',
                });
            } catch (err) {
                var msg = err.message || 'Instagram scrape failed';
                showToast('❌ ' + msg, 'error');
                this.logError(msg, 'fetchPlatformProfile(instagram)', '0');
                // A failed scan that still collected posts keeps them on screen.
                this._acceptPartialScan(username, err);
                if (this.currentPage === 'posts') {
                    this._hidePostsLoading();
                }
                if (typeof this.renderScanFreshness === 'function') this.renderScanFreshness();
            } finally {
                this.isFetching = false;
                this.setFetchingState(false);
            }
            return;
        }
        username = username.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9._]/g, '');
        if (!username) { showToast('Invalid username', 'warning'); return; }
        if (this.isFetching) return;

        // Non-Instagram platforms don't have real scraping support yet
        if (platform !== 'instagram') {
            showToast(`${platformInfo.name} profile scanning requires direct API access — not available yet`, 'warning');
            return;
        }

        this.isFetching = true;
        this.setFetchingState(true);
        // If already on posts page, show loading overlay
        if (this.currentPage === 'posts') {
            this._showPostsLoading(`⏳ Scanning ${platformInfo.name} profile...`);
        }
        showToast(`🔍 Looking up @${username} on ${platformInfo.name}…`);

        try {
            const result = await this.scrapeProfile(username);
            if (!result) throw new Error('No data returned');
            this.currentProfile = result.profile;
            this.currentPosts = result.posts || [];
            this.currentProfile.platform = platform;
            // Propagate userId for future scanPosts strategies
            if (result._userId) this.currentProfile._userId = result._userId;

            showToast('🖼️ Loading content…');
            await this.loadProfileImages(result.profile, result.posts);
            this.displayProfile(result.profile, result.posts);
            this.saveProfileToHistory(result.profile, username, result.posts);
            this.renderCharts(result.posts);
            this.renderDashboardPosts(result.posts);
            this.renderMarketingAnalysis(result.profile, result.posts);
            this.renderMaps(result.profile, result.posts);
            this.updateStats();
            // Render posts — if already on posts page, use _renderPostsContent which
            // handles loading overlay and chart rendering in one pass
            if (this.currentPage === 'posts') {
                this._renderPostsContent(this.currentPosts);
            } else {
                this.renderPostGrid(result.posts);
            }
            showToast(`✅ @${username} — ${this.fmt(result.profile.followers)} followers/subscribers, ${result.posts.length} posts`, 'success');
            // Persist last search + snapshot so it loads on next app launch
            this._persistScanResult(result.profile, result.posts, {
                scanReport: result.scanReport || this.lastScanReport || null,
                source: 'live-scan',
            });
        } catch (err) {
            const msg = err.message || '';
            this.logError(msg || 'Fetch failed', 'fetchPlatformProfile(' + platform + ')', '0');
            if (msg.includes('private')) showToast(`🔒 @${username} is private on ${platformInfo.name}`, 'warning');
            else if (msg.includes('not found') || msg.includes('404')) showToast(`❌ @${username} not found on ${platformInfo.name}`, 'error');
            else if (msg.includes('rate') || msg.includes('429')) showToast(`⏳ Rate limited on ${platformInfo.name} — wait a moment`, 'warning');
            else showToast(`❌ ${msg || 'Fetch failed'}`, 'error');
            if (this.currentPage === 'posts') {
                this._hidePostsLoading();
            }
        } finally {
            this.isFetching = false;
            this.setFetchingState(false);
        }
    };

    /**
     * Browser (main-process) scrape over IPC.
     *
     * opts.fullHistory  walk the feed to the account's FIRST post instead of
     *                   stopping after the newest few hundred.
     * opts.startCursor  resume a previous walk from a saved cursor.
     * opts.resume       let the main process continue from its own cache.
     *
     * The watchdog is an IDLE timer, not a hard cap: a full-history walk of a
     * large account legitimately takes minutes, so it must not be killed while
     * it is still making progress. Every progress message resets it.
     */
    P.scrapeViaIPC = function (username, opts) {
        const options = opts || {};
        return new Promise((resolve, reject) => {
            try {
                const { ipcRenderer } = require('electron');
                // Get Instagram session cookies (if logged in) for authenticated browsing
                const auth = this.isInstagramLoggedIn();
                const sessionData = {
                    cookies: auth.cookies || '',
                    sessionid: auth.sessionid || '',
                    csrftoken: auth.csrftoken || '',
                    loggedIn: auth.loggedIn || false
                };
                const IDLE_MS = options.fullHistory ? 120000 : 35000;
                let settled = false;
                let timeout = null;

                const cleanup = () => {
                    if (timeout) { clearTimeout(timeout); timeout = null; }
                    try { ipcRenderer.removeListener('scrape-instagram-result', onResult); } catch (e) { }
                    try { ipcRenderer.removeListener('scrape-progress', onProgress); } catch (e) { }
                };
                const failIdle = () => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    reject(new Error('Scan stalled — no progress from Instagram for ' +
                        Math.round(IDLE_MS / 1000) + 's. Re-run the scan to resume: what was already collected is cached.'));
                };
                const onProgress = (_, p) => {
                    if (timeout) { clearTimeout(timeout); timeout = setTimeout(failIdle, IDLE_MS); }
                    if (this._onScanProgress) { try { this._onScanProgress(p); } catch (e) { } }
                };
                const onResult = (_, data) => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    if (!data) return reject(new Error('Empty IPC response'));
                    if (data.error) {
                        // The walk may have failed after collecting posts. Carry them
                        // on the error so the caller can still display and save them.
                        const err = new Error(data.error);
                        if (data.partial && data.partial.posts && data.partial.posts.length) {
                            err.partial = data.partial;
                        }
                        return reject(err);
                    }
                    if (data.success && data.result) {
                        const result = this._parseIPCResult(data.result, data.posts || [], username);
                        if (result) {
                            // If IPC returned posts, make sure profile has profilePicUrl from OG meta
                            if ((!result.profile.profilePicUrl) && data.result?.meta?.image) {
                                result.profile.profilePicUrl = data.result.meta.image;
                            }
                            // How far the walk actually got — surfaced in the UI and
                            // persisted, so a partial scan is never shown as complete.
                            if (data.scanReport) result.scanReport = data.scanReport;
                            return resolve(result);
                        }
                    }
                    reject(new Error('IPC parse failed'));
                };

                ipcRenderer.on('scrape-instagram-result', onResult);
                ipcRenderer.on('scrape-progress', onProgress);
                timeout = setTimeout(failIdle, IDLE_MS);
                ipcRenderer.send('scrape-instagram-profile', {
                    username,
                    session: sessionData,
                    fullHistory: options.fullHistory !== false,
                    resume: options.resume !== false,
                    startCursor: options.startCursor || null,
                });
            } catch (e) { reject(e); }
        });
    };



    P._parseIPCResult = function (raw, posts, username) {
        try {
            let user = null;
            // Handle both old format (type/data properties) and new format (user property)
            if (raw.user) {
                user = raw.user;
            } else if (raw.type === '__NEXT_DATA__' && raw.data) {
                user = raw.data?.props?.pageProps?.user ||
                    raw.data?.entry_data?.ProfilePage?.[0]?.graphql?.user ||
                    raw.data?.props?.pageProps?.data?.user;
            } else if (raw.type === '__INITIAL_STATE__' && raw.data) {
                const pathKey = Object.keys(raw.data).find(k => k.includes('ProfilePage'));
                if (pathKey) user = raw.data[pathKey]?.user;
            } else if (raw.type === 'additionalData' && raw.data) {
                user = raw.data?.graphql?.user || raw.data?.data?.user;
            } else if (raw.type === 'json_script' && raw.data) {
                user = raw.data?.graphql?.user || raw.data?.data?.user || raw.data?.user;
            } else if (raw.type === 'meta_only') {
                // Pass OG meta info through to _parseMetaOnly — include image URL
                const metaResult = this._parseMetaOnly({
                    description: raw.meta?.description || '',
                    title: raw.meta?.title || '',
                    image: raw.meta?.image || ''
                }, username);
                this._applyDomHeader(metaResult, raw);
                // _parseMetaOnly only knows the header; the browser method supplies
                // the posts, so attach them here — otherwise a successful scan comes
                // back with a live header and an empty grid.
                if (metaResult) {
                    if (posts && posts.length) metaResult.posts = posts;
                    if (raw._userId) metaResult._userId = String(raw._userId);
                    return metaResult;
                }
                // No parsable header — fall through to the generic path below, which
                // still returns the posts the browser method collected.
            } else if (raw.type === 'login_required') {
                throw new Error('Login wall — could not access profile');
            }

            if (user) {
                const result = this.buildResult(user);
                // Use OG image from meta if available and profile pic is missing
                if ((!result.profile.profilePicUrl) && raw.meta?.image) {
                    result.profile.profilePicUrl = raw.meta.image;
                }
                this._applyDomHeader(result, raw);
                // Save userId for future scanPosts strategies
                if (user.id) result._userId = user.id;
                // Merge any additional posts data from IPC (browser GraphQL/DOM-extracted posts).
                // The browser's posts often have more items (36+ with pagination) than buildResult
                // which is limited to ~12 from the embedded __NEXT_DATA__.
                if (posts && posts.length > 0) {
                    if (!result.posts || result.posts.length === 0) {
                        result.posts = posts;
                    } else if (posts.length > result.posts.length) {
                        // Browser has more posts — prefer them for richer grid
                        // Merge any enriched data (likes, captions, timestamps) from browser
                        const merged = {};
                        result.posts.forEach(p => { if (p.shortcode) merged[p.shortcode] = p; });
                        posts.forEach(p => {
                            if (p.shortcode && merged[p.shortcode]) {
                                // Merge — browser may have better data from OG enrichment.
                                // Only overwrite with non-null values to avoid losing valid data.
                                Object.keys(p).forEach(key => {
                                    if (p[key] != null) merged[p.shortcode][key] = p[key];
                                });
                            } else if (p.shortcode) {
                                merged[p.shortcode] = p;
                            }
                        });
                        result.posts = Object.values(merged);
                    }
                }
                return result;
            }
        } catch (e) { /* fall through */ }

        // Last resort: try to build from meta only if we have description.
        // This is also the path taken when the page exposed an unrelated blob
        // (e.g. a window global) that left `result.user` empty while the meta
        // header and the browser method's posts are perfectly good — so the
        // rendered header is applied here too.
        if (raw.meta && raw.meta.description) {
            const result = this._parseMetaOnly(raw.meta, username);
            this._applyDomHeader(result, raw);
            // Merge externally-supplied posts (from browser GraphQL/DOM extraction)
            if (result && posts && posts.length > 0) {
                result.posts = posts;
            }
            if (result && raw._userId) result._userId = String(raw._userId);
            // Even if _parseMetaOnly returned null (couldn't parse followers),
            // we may still have externally-supplied posts — return a basic profile
            if (!result && posts && posts.length > 0) {
                return {
                    profile: {
                        username,
                        fullName: username,
                        bio: raw.meta.description?.substring(0, 200) || '',
                        profilePicUrl: raw.meta.image || '',
                        followers: null,
                        following: null,
                        posts: posts.length,
                        isVerified: false,
                        isPrivate: false,
                        externalUrl: '',
                        fetchedAt: new Date().toISOString(),
                    },
                    posts,
                    _userId: null
                };
            }
            return result;
        }
        return null;
    };    P._parseMetaOnly = function (raw, username) {
        // Meta descriptions HTML-escape their inner quotes (and emoji arrive as
        // numeric entities), so decode before matching — otherwise the
        // `on Instagram: "…"` bio is never found.
        const decodeEntities = (s) => String(s || '')
            .replace(/&#x([0-9a-f]+);/gi, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (e) { return ''; } })
            .replace(/&#(\d+);/g, (m, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch (e) { return ''; } })
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
        const desc = decodeEntities(raw.description);
        const title = raw.title || '';
        const ogImage = raw.image || '';
        const match = desc.match(/([\d,.]+[KkMm]?)\s*Followers,?\s*Following/i) ||
            desc.match(/([\d,.]+[KkMm]?)\s*Followers/i);
        if (!match) return null;
        const followers = this._parseCompactNumber(match[1]);
        // Recover following + post counts from the same OG description so the
        // dashboard shows real numbers instead of "—" when only meta is available.
        const followingMatch = desc.match(/([\d,.]+[KkMm]?)\s*Following/i);
        const postsMatch = desc.match(/([\d,.]+[KkMm]?)\s*Posts/i);
        const following = followingMatch ? this._parseCompactNumber(followingMatch[1]) : null;
        const postCount = postsMatch ? this._parseCompactNumber(postsMatch[1]) : null;
        // Extract clean full name from title like "Full Name (@username) • Instagram photos and videos"
        const nameMatch = title.match(/^(.+?)\s*\(@/);
        let fullName = username;
        if (nameMatch) {
            fullName = nameMatch[1].trim();
            // Filter out language names, platform names, and other non-person strings
            if (this._isLanguageOrPlatformName(fullName)) {
                fullName = username;
            }
        }
        const unescape = decodeEntities;
        // Instagram's own meta description carries the bio after
        // `on Instagram: "…"`. That is real published text (not inferred), so use
        // it instead of leaving the bio blank.
        const bioMatch = desc.match(/on Instagram:\s*"([\s\S]*)"\s*\.?\s*$/) ||
            desc.match(/:\s*"([\s\S]{5,})"\s*\.?\s*$/);
        const bioText = bioMatch ? bioMatch[1].replace(/\s+/g, ' ').trim() : '';
        return {
            profile: {
                username,
                fullName: unescape(fullName),
                // Metrics text ("3,435 Followers, 6 Following…") is filtered out of
                // the bio above; only the quoted description is kept.
                bio: unescape(bioText),
                profilePicUrl: ogImage || '',
                followers,
                following,
                posts: postCount,
                isVerified: false,
                isPrivate: false,
                externalUrl: '',
                fetchedAt: new Date().toISOString(),
            },
            posts: []
        };
    };

    /* Fill bio / external link from the rendered profile header, which is more
       complete than the metrics-only meta description. Only fills blanks — a
       value that came from a richer source is never overwritten. */
    P._applyDomHeader = function (result, raw) {
        try {
            if (!result || !result.profile || !raw || !raw.dom) return result;
            if (raw.dom.bio && !result.profile.bio) result.profile.bio = raw.dom.bio;
            if (raw.dom.externalUrl && !result.profile.externalUrl) result.profile.externalUrl = raw.dom.externalUrl;
        } catch (e) { /* header is optional */ }
        return result;
    };

    P._parseCompactNumber = function (str) {
        if (!str) return 0;
        str = str.replace(/,/g, '');
        const m = str.match(/^([\d.]+)([KkMm])?$/);
        if (!m) return parseInt(str) || 0;
        const num = parseFloat(m[1]);
        if (m[2] === 'K' || m[2] === 'k') return Math.round(num * 1000);
        if (m[2] === 'M' || m[2] === 'm') return Math.round(num * 1000000);
        return Math.round(num);
    };

    /* ═══════════════════════════════════════════════════════════════════
       INSTALOADER INTEGRATION — Python subprocess wrapper
       Calls the instaloader_helper.py script to fetch posts via Python.
       ⚠️  On first use, auto-installs the Python `instaloader` package
           if it is not already present. This requires a working Python 3
           installation on the user's PATH.
    ═══════════════════════════════════════════════════════════════════ */
    P._scrapeViaInstaloader = function (username, count = null, knownUserId = null) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const path = require('path');
            const fs = require('fs');
            // In a packaged build the app runs from inside app.asar, and Python
            // cannot open a path inside an asar archive. The helper is therefore
            // unpacked beside it (asarUnpack in package.json), so resolve to the
            // real file when packaged and to the plain one when running unpacked.
            const scriptPath = path.join(__dirname, 'instaloader_helper.py')
                .replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');

            if (!fs.existsSync(scriptPath)) {
                return reject(new Error('instaloader_helper.py not found'));
            }

            // ── Detect available Python command ───────────────────────────
            const candidates = process.platform === 'win32'
                ? [{ cmd: 'python', args: [] }, { cmd: 'python3', args: [] }, { cmd: 'py', args: ['-3'] }, { cmd: 'py', args: [] }]
                : [{ cmd: 'python3', args: [] }, { cmd: 'python', args: [] }];

            const tryPython = (idx) => {
                if (idx >= candidates.length) {
                    return reject(new Error(
                        'Python 3 not found. Install Python from https://www.python.org/downloads/ ' +
                        'and ensure it is on your PATH, or install `instaloader` manually: pip install instaloader'
                    ));
                }

                const { cmd: pythonCmd, args: extraArgs } = candidates[idx];
                const procArgs = [...extraArgs, scriptPath, username];
                if (count) {
                    procArgs.push('--count', String(count));
                }

                // ── Pass saved Instagram session + known user ID so instaloader can
                //    bypass Instagram's anonymous access blocks (web_profile_info 400) ──
                try {
                    const auth = this.isInstagramLoggedIn();
                    if (auth && auth.loggedIn) {
                        if (auth.sessionid) procArgs.push('--sessionid', auth.sessionid);
                        if (auth.csrftoken) procArgs.push('--csrftoken', auth.csrftoken);
                        if (auth.cookies) procArgs.push('--cookies', auth.cookies);
                        if (auth.userId) procArgs.push('--userid', String(auth.userId));
                    }
                } catch (e) { }
                // Known user ID from a previous scan — skips the blocked username lookup
                const knownId = knownUserId || (this.currentProfile && this.currentProfile._userId);
                if (knownId && !procArgs.includes('--userid')) {
                    procArgs.push('--userid', String(knownId));
                }

                console.log(`[SWA] 🐍 Trying Python: ${pythonCmd}${extraArgs.length ? ' ' + extraArgs.join(' ') : ''}${count ? ` (max ${count} posts)` : ' (ALL posts)'}`);

                const proc = spawn(pythonCmd, procArgs, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    // A full-history walk of a large account legitimately runs for
                    // many minutes, so the ceiling is generous (30 min) when every
                    // post is being fetched; capped runs keep the short limit.
                    timeout: count ? 300000 : 1800000,
                    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
                });

                let stdout = '';
                let stderr = '';

                proc.stdout.on('data', (data) => { stdout += data.toString(); });
                proc.stderr.on('data', (data) => {
                    const chunk = data.toString();
                    stderr += chunk;

                    // Surface the Python walker's progress in the UI: its stdout is
                    // only the final JSON, so without this a long full-history walk
                    // shows nothing at all until it finishes.
                    try {
                        const feedWalk = chunk.match(/\[INFO\] Feed walk: (\d+) posts across (\d+) pages/);
                        const ilFetch = chunk.match(/\[INFO\] Fetched (\d+)\/(\d+) posts/);
                        if (typeof this._onScanProgress === 'function') {
                            if (feedWalk) {
                                this._onScanProgress({ phase: 'page', posts: Number(feedWalk[1]), page: Number(feedWalk[2]), source: 'instaloader' });
                            } else if (ilFetch) {
                                this._onScanProgress({ phase: 'page', posts: Number(ilFetch[1]), page: null, total: Number(ilFetch[2]), source: 'instaloader' });
                            }
                        }
                    } catch (e) { /* progress is best-effort */ }

                    // Detect missing instaloader and auto-install it
                    if (stderr.includes('No module named instaloader') || stderr.includes('ModuleNotFoundError')) {
                        proc.kill();
                        console.log(`[SWA] 📦 instaloader not found — auto-installing via ${pythonCmd}...`);
                        const pipArgs = [...extraArgs, '-m', 'pip', 'install', 'instaloader', '--quiet'];
                        const installProc = spawn(pythonCmd, pipArgs, { timeout: 60000 });
                        let installErrLog = '';
                        installProc.stderr.on('data', d => { installErrLog += d.toString(); });
                        installProc.on('close', (installCode) => {
                            if (installCode !== 0) {
                                console.log(`[SWA] ❌ Auto-install failed (exit ${installCode}): ${installErrLog.substring(0, 200)}`);
                                return reject(new Error(
                                    'instaloader is required. Please run: pip install instaloader\n' +
                                    'Or install Python from https://www.python.org/downloads/'
                                ));
                            }
                            console.log(`[SWA] ✅ instaloader installed! Retrying...`);
                            setTimeout(() => tryPython(idx), 1000);
                        });
                        installProc.on('error', (installErr) => {
                            console.log(`[SWA] ❌ Auto-install spawn failed: ${installErr.message}`);
                            return reject(new Error(
                                'instaloader is required. Please run: pip install instaloader\n' +
                                'Or install Python from https://www.python.org/downloads/'
                            ));
                        });
                        return;
                    }
                });

                proc.on('close', (code) => {
                    // Auto-install already took over (stderr marker) — its retry
                    // will resolve/reject this promise; don't reject here.
                    if (stderr.includes('No module named instaloader') || stderr.includes('ModuleNotFoundError')) {
                        return;
                    }
                    if (code !== 0 && !stdout.trim()) {
                        console.log(`[SWA] ℹ️ ${pythonCmd} exited with code ${code}: ${stderr.substring(0, 200)}`);
                        // Try next Python candidate
                        return tryPython(idx + 1);
                    }

                    try {
                        const result = JSON.parse(stdout.trim());
                        if (result.error) {
                            console.log(`[SWA] ℹ️ Instaloader error: ${result.error}`);
                            return reject(new Error(result.error));
                        }
                        console.log(`[SWA] ✅ Instaloader recovered ${result.posts?.length || 0} posts for @${username} via ${pythonCmd}`);
                        resolve(result);
                    } catch (e) {
                        console.log(`[SWA] ℹ️ Instaloader JSON parse failed: ${e.message}`);
                        if (idx + 1 < candidates.length) {
                            return tryPython(idx + 1);
                        }
                        reject(new Error('Instaloader returned invalid JSON'));
                    }
                });

                proc.on('error', (err) => {
                    console.log(`[SWA] ℹ️ ${pythonCmd} spawn failed: ${err.message}`);
                    tryPython(idx + 1); // Try next Python candidate
                });
            };

            tryPython(0);
        });
    };

    /* ═══════════════════════════════════════════════════════════════════
       PUBLIC JSON ENDPOINT — No libraries needed
       Uses i.instagram.com REST API with multiple endpoint variations
    ═══════════════════════════════════════════════════════════════════ */
    P._scrapeViaJSONEndpoint = async function (username) {
        const mobileUA = this._randomMobileUA();
        const appId = this._randomAppId();
        const baseHeaders = {
            'User-Agent': mobileUA,
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.instagram.com/',
            'Origin': 'https://www.instagram.com',
            'X-IG-App-ID': appId,
            'X-ASBD-ID': '129477',
        };

        /* Helper to safely parse user from JSON response */
        const parseUserFromResponse = (body) => {
            const data = JSON.parse(body);
            const user = data?.data?.user || data?.user;
            if (!user?.username) return null;
            if (user.is_private) throw new Error('Account is private');
            return user;
        };

        /* Endpoint 1: web_profile_info (returns profile + first 12 posts) */
        try {
            console.log(`[SWA] 🌐 JSON Endpoint: web_profile_info for @${username}`);
            const body = await this.nodeGet('i.instagram.com',
                `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
                baseHeaders
            );
            const user = parseUserFromResponse(body);
            if (user) {
                const result = this.buildResult(user);
                if (user.id) result._userId = user.id;
                return result;
            }
        } catch (e) {
            console.log(`[SWA] ℹ️ web_profile_info failed: ${e.message}`);
            if (e.message.includes('private')) throw e;
        }

        /* Endpoint 2: users/web_profile_info with different App ID */
        const altAppIds = ['567067343352427', '124024574287414', '121798164487962'];
        for (const altAppId of altAppIds) {
            try {
                console.log(`[SWA] 🌐 JSON Endpoint: trying alt App ID ${altAppId}`);
                const body = await this.nodeGet('i.instagram.com',
                    `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
                    { ...baseHeaders, 'X-IG-App-ID': altAppId }
                );
                const user = parseUserFromResponse(body);
                if (user) {
                    const result = this.buildResult(user);
                    if (user.id) result._userId = user.id;
                    return result;
                }
            } catch (e) {
                if (e.message.includes('private')) throw e;
            }
        }

        /* Endpoint 3: i.instagram.com API v1 users info (older endpoint) */
        try {
            console.log(`[SWA] 🌐 JSON Endpoint: api/v1/users/info for @${username}`);
            const body = await this.nodeGet('i.instagram.com',
                `/api/v1/users/${encodeURIComponent(username)}/info/`,
                baseHeaders
            );
            const user = parseUserFromResponse(body);
            if (user) {
                const result = this.buildResult(user);
                if (user.pk) result._userId = String(user.pk);
                return result;
            }
        } catch (e) {
            console.log(`[SWA] ℹ️ users/info failed: ${e.message}`);
            if (e.message.includes('private')) throw e;
        }

        throw new Error('All JSON endpoints failed');
    };

    /* ── Post-only HTML extraction (never throws, used as fallback) ── */
    P._extractPostsFromHtml = function (html) {
        try {
            // Pattern 1: Extract from embedded edge_owner_to_timeline_media in script tags
            const postEdgesMatch = html.match(/"edge_owner_to_timeline_media":\s*\{\s*"edges":\s*(\[[\s\S]*?\])\s*,\s*"page_info"/);
            if (postEdgesMatch) {
                const edges = JSON.parse(postEdgesMatch[1]);
                return edges.map(e => {
                    const n = e.node || e;
                    const postType = n.__typename === 'GraphSidecar' ? 'carousel' :
                        (n.is_video || n.__typename === 'GraphVideo' ? (n.product_type === 'clips' ? 'reel' : 'video') : 'photo');
                    const caption = n.edge_media_to_caption?.edges?.[0]?.node?.text || n.caption_text || '';
                    let hashtags = [], mentions = [];
                    if (caption) {
                        const htm = caption.match(/#[\w]+/g);
                        if (htm) hashtags = [...new Set(htm)];
                        const mnm = caption.match(/@[\w.]+/g);
                        if (mnm) mentions = [...new Set(mnm)];
                    }
                    let locName = '';
                    try { if (n.location) locName = typeof n.location === 'string' ? n.location : (n.location.name || ''); } catch {}
                    return {
                        shortcode: n.shortcode || '',
                        thumbnail: n.display_url || n.thumbnail_src || n.thumbnail_resources?.slice(-1)?.[0]?.src || '',
                        likes: n.edge_media_preview_like?.count ?? n.like_count ?? null,
                        comments: n.edge_media_to_comment?.count ?? n.comment_count ?? null,
                        caption: caption,
                        hashtags: hashtags,
                        mentions: mentions,
                        isVideo: !!n.is_video || n.__typename === 'GraphVideo',
                        postType: postType,
                        carouselCount: n.edge_sidecar_to_children?.edges?.length || 0,
                        videoViews: n.video_view_count ?? n.play_count ?? null,
                        videoUrl: n.video_url || null,
                        videoDuration: n.video_duration != null ? Math.round(n.video_duration) : null,
                        location: locName,
                        timestamp: n.taken_at_timestamp ?? n.taken_at ?? null,
                    };
                });
            }

            // Pattern 2: Extract post shortcodes from href attributes (/p/SHORTCODE/)
            const shortcodes = [];
            const seen = new Set();
            const hrefRegex = /href="[\/]*(?:p|reel)\/([A-Za-z0-9_-]+)"/g;
            let hrefMatch;
            while ((hrefMatch = hrefRegex.exec(html)) !== null) {
                if (!seen.has(hrefMatch[1])) {
                    seen.add(hrefMatch[1]);
                    shortcodes.push(hrefMatch[1]);
                }
            }
            // Also try JSON-encoded paths (\/p\/ or \/reel\/)
            const jsonPathRegex = /\\\/(?:p|reel)\\\/([A-Za-z0-9_-]+)/g;
            while ((hrefMatch = jsonPathRegex.exec(html)) !== null) {
                if (!seen.has(hrefMatch[1])) {
                    seen.add(hrefMatch[1]);
                    shortcodes.push(hrefMatch[1]);
                }
            }
            if (shortcodes.length > 0) {
                return shortcodes.map(sc => ({
                    shortcode: sc,
                    thumbnail: '',
                    likes: null,
                    comments: null,
                    caption: '',
                    hashtags: [],
                    mentions: [],
                    isVideo: false,
                    postType: 'photo',
                    carouselCount: 0,
                    videoViews: null,
                    videoUrl: null,
                    videoDuration: null,
                    location: '',
                    timestamp: null,
                }));
            }
        } catch { }
        return [];
    };

    P.scrapeFromHtml = function (html, username) {
        if (html.includes('"is_private":true') || html.includes('is_private\":true') ||
            html.includes('This Account is Private')) throw new Error('Account is private');
        if (html.includes('Page Not Found') || html.includes('"loginRequired"') ||
            html.includes('Sorry, this page isn')) throw new Error('Profile not found');

        // Extract OG meta tags early for fallback use
        const ogMatch = {
            image: html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']\s*\/?>/i) ||
                html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']\s*\/?>/i),
            title: html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']\s*\/?>/i) ||
                html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']\s*\/?>/i),
            desc: html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']\s*\/?>/i) ||
                html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']\s*\/?>/i),
        };
        const ogImageUrl = ogMatch.image ? ogMatch.image[1].replace(/&amp;/g, '&') : '';
        const ogTitle = ogMatch.title ? ogMatch.title[1] : '';
        const ogDesc = ogMatch.desc ? ogMatch.desc[1] : '';

        /* Strategy A: Try __NEXT_DATA__ (Instagram's current SSR format) */
        try {
            const nextMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
            if (nextMatch) {
                const data = JSON.parse(nextMatch[1]);
                const user = data?.props?.pageProps?.user ||
                    data?.props?.pageProps?.data?.user ||
                    data?.entry_data?.ProfilePage?.[0]?.graphql?.user;
                if (user?.username) {
                    const result = this.buildResult(user);
                    // Fill in profile pic from OG tags if buildResult didn't get it
                    if ((!result.profile.profilePicUrl || !user.profile_pic_url_hd) && ogImageUrl) {
                        result.profile.profilePicUrl = ogImageUrl;
                    }
                    return result;
                }
            }
        } catch { }

        /* Strategy B: Try _sharedData (legacy) */
        try {
            const shared = html.match(/window\._sharedData\s*=\s*(\{.+?\});\s*<\/script>/);
            if (shared) {
                const data = JSON.parse(shared[1]);
                const user = data?.entry_data?.ProfilePage?.[0]?.graphql?.user;
                if (user) {
                    const result = this.buildResult(user);
                    if (!result.profile.profilePicUrl && ogImageUrl) result.profile.profilePicUrl = ogImageUrl;
                    return result;
                }
            }
        } catch { }

        /* Strategy C: Try __additionalDataLoaded (legacy) */
        try {
            const additional = html.match(/window\.__additionalDataLoaded\([^,]+,(\{.+?\})\);/);
            if (additional) {
                const data = JSON.parse(additional[1]);
                const user = data?.graphql?.user || data?.data?.user;
                if (user) {
                    const result = this.buildResult(user);
                    if (!result.profile.profilePicUrl && ogImageUrl) result.profile.profilePicUrl = ogImageUrl;
                    return result;
                }
            }
        } catch { }

        /* Strategy D: Try embedded JSON blobs */
        try {
            const scripts = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g) || [];
            for (const s of scripts) {
                const content = s.replace(/<[^>]+>/g, '');
                if (content.includes(username)) {
                    const data = JSON.parse(content);
                    const user = data?.graphql?.user || data?.data?.user || data?.user;
                    if (user?.username) {
                        const result = this.buildResult(user);
                        if (!result.profile.profilePicUrl && ogImageUrl) result.profile.profilePicUrl = ogImageUrl;
                        return result;
                    }
                }
            }
        } catch { }

        /* Strategy E: Regex extraction (last resort, multiple field formats) */
        const g = (rx) => html.match(rx)?.[1] ?? null;

        const isPrivate = g(/"is_private":(true|false)/) === 'true';
        if (isPrivate) throw new Error('Account is private');

        /* Try modern Instagram field names first, then legacy */
        let followers = g(/"edge_followed_by":\{"count":(\d+)/) ||
            g(/"follower_count":(\d+)/) ||
            g(/followers\"?:\s*(\d+)/) ||
            g(/([\d,.]+[KkMm]?)\s*Followers/);
        let following = g(/"edge_follow":\{"count":(\d+)/) ||
            g(/"following_count":(\d+)/) ||
            g(/following\"?:\s*(\d+)/);
        let posts = g(/"edge_owner_to_timeline_media":\{"count":(\d+)/) ||
            g(/"media_count":(\d+)/) ||
            g(/posts\"?:\s*(\d+)/);
        // Better full_name extraction - context-aware to avoid matching random JSON
        let fullName = g(/"full_name":"(.*?)"(?=[,}])/i) || g(/"display_name":"(.*?)"/i) || '';
        // Filter out non-name strings, language names, and platform names
        if (fullName && (fullName.length < 2 || /^(true|false|null|undefined|0|1|\d+)$/i.test(fullName) || this._isLanguageOrPlatformName(fullName))) {
            fullName = '';
        }
        const verified = g(/"is_verified":(true|false)/) === 'true';
        const picUrl = g(/"profile_pic_url_hd":"(.*?)"/) || g(/"profile_pic_url":"(.*?)"/);
        const bio = g(/"biography":"(.*?)"/) || g(/"bio":"(.*?)"/);
        const extUrl = g(/"external_url":"(.*?)"/) || g(/"website":"(.*?)"/);

        const unescape = s => s ? s.replace(/\\n/g, '\n')
            .replace(/\\u([\dA-Fa-f]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
            .replace(/\\\//g, '/')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';

        /* Handle compact numbers like "1.2K" */
        if (followers && /[^\d]/.test(followers)) followers = String(this._parseCompactNumber(followers));
        if (following && /[^\d]/.test(following)) following = String(this._parseCompactNumber(following));
        if (posts && /[^\d]/.test(posts)) posts = String(this._parseCompactNumber(posts));

        if (!followers && !ogDesc) throw new Error('Could not parse Instagram response — try again in a moment');

        // If regex failed to extract followers but OG description has them, try parsing from OG
        if (!followers && ogDesc) {
            const followerMatch = ogDesc.match(/([\d,.]+[KkMm]?)\s*Follower/);
            if (followerMatch) followers = String(this._parseCompactNumber(followerMatch[1]));
        }
        if (!followers) throw new Error('Could not parse Instagram response — try again in a moment');

        // Use OG image as fallback for profile pic
        const finalPicUrl = unescape(picUrl || ogImageUrl || '');

        // Extract posts from HTML using shared post-only extraction (never throws)
        let extractedPosts = this._extractPostsFromHtml(html);

        // Derive fullName from OG title carefully
        let derivedFullName = unescape(fullName || username);
        if (!fullName && ogTitle) {
            const titleNameMatch = ogTitle.match(/^(.+?)\s*\(@/);
            if (titleNameMatch) {
                const candidate = titleNameMatch[1].trim();
                if (!this._isLanguageOrPlatformName(candidate) && candidate.length >= 2) {
                    derivedFullName = unescape(candidate);
                }
            }
        }

        return {
            profile: {
                username,
                fullName: derivedFullName,
                bio: unescape(bio || ogDesc || ''),
                profilePicUrl: finalPicUrl,
                followers: parseInt(followers) || null,
                following: parseInt(following) || null,
                posts: parseInt(posts) || null,
                isVerified: verified,
                isPrivate: false,
                externalUrl: unescape(extUrl || ''),
                fetchedAt: new Date().toISOString(),
            },
            posts: extractedPosts
        };
    };

    /* ═══════════════════════════════════════════════════════════════════
       ENHANCED SCANNING — Caption Enrichment & Comprehensive Analysis
       Integrated from scan_all_posts_enhanced.js
    ═══════════════════════════════════════════════════════════════════ */

    /**
     * Enrich posts with full captions and hashtags by fetching individual post pages.
     * Instagram's GraphQL timeline queries often omit or truncate captions,
     * so we fetch individual post pages to get complete caption data.
     * @param {Array} posts - Array of post objects from GraphQL
     * @param {string} username - Instagram username for referer header
     * @returns {Promise<Array>} Enriched posts with captions and hashtags
     */
    P._enrichPostsWithCaptions = async function (posts, username) {
        if (!posts || posts.length === 0) return posts;

        // Instaloader / Mobile API feed already return the COMPLETE caption +
        // parsed hashtags/mentions for every post — nothing left to enrich.
        // Skip the per-post HTML fetches entirely (saves 500ms-1s × N posts
        // and avoids hammering Instagram with extra requests).
        const allHaveCaptions = posts.every(p => p.caption && p.caption.length > 0);
        if (allHaveCaptions) {
            console.log(`[SWA] 📝 All ${posts.length} posts already have captions — skipping enrichment`);
            return posts;
        }

        console.log(`[SWA] 📝 Enriching ${posts.length} posts with captions & hashtags...`);
        const enrichedPosts = [];
        let enriched = 0;
        let skipped = 0;
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            
            // Skip if we already have good caption data
            if (post.caption && post.caption.length > 50) {
                // Extract hashtags from existing caption
                const hashtags = post.caption.match(/#[\w]+/g);
                post.hashtags = hashtags ? [...new Set(hashtags)] : [];
                enrichedPosts.push(post);
                skipped++;
                continue;
            }
            
            try {
                await this._delay(500 + Math.random() * 300);
                
                const body = await this.nodeGet('www.instagram.com', `/p/${post.shortcode}/`, {
                    'User-Agent': this._randomUA(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': `https://www.instagram.com/${username}/`,
                    'Cache-Control': 'no-cache',
                });
                
                // Extract caption from HTML
                const capMatch = body.match(/"edge_media_to_caption"[^}]*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                if (capMatch) {
                    post.caption = capMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                }
                
                // Extract hashtags from caption
                const hashtags = (post.caption || '').match(/#[\w]+/g);
                post.hashtags = hashtags ? [...new Set(hashtags)] : [];
                
                // Extract mentions from caption
                const mentions = (post.caption || '').match(/@[\w.]+/g);
                post.mentions = mentions ? [...new Set(mentions)] : [];
                
                post._captionEnriched = true;
                enriched++;
                
            } catch (e) {
                // If fetch fails, keep original post data
                post.hashtags = post.hashtags || [];
            }
            
            enrichedPosts.push(post);
        }
        
        console.log(`[SWA] ✅ Enrichment complete: ${skipped} skipped (had captions), ${enriched} enriched from pages`);
        return enrichedPosts;
    };

    /**
     * Analyze hashtags from posts and return frequency/engagement data
     * @param {Array} posts - Array of post objects with hashtags and engagement data
     * @returns {Object} Hashtag analysis with frequency, avg likes, avg comments
     */
    P.analyzeHashtags = function (posts) {
        const allHashtags = {};
        
        posts.forEach(post => {
            if (post.hashtags) {
                post.hashtags.forEach(tag => {
                    if (!allHashtags[tag]) {
                        allHashtags[tag] = { count: 0, posts: [], totalLikes: 0, totalComments: 0 };
                    }
                    allHashtags[tag].count++;
                    allHashtags[tag].posts.push(post.shortcode);
                    allHashtags[tag].totalLikes += post.likes || 0;
                    allHashtags[tag].totalComments += post.comments || 0;
                });
            }
        });
        
        const sortedHashtags = Object.entries(allHashtags)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 50);
        
        return {
            totalUniqueHashtags: Object.keys(allHashtags).length,
            postsWithHashtags: posts.filter(p => p.hashtags && p.hashtags.length > 0).length,
            topHashtags: sortedHashtags.map(([tag, data]) => ({
                tag,
                count: data.count,
                avgLikes: Math.round(data.totalLikes / data.count),
                avgComments: Math.round(data.totalComments / data.count)
            }))
        };
    };

    /**
     * Analyze engagement metrics across all posts
     * @param {Array} posts - Array of post objects
     * @returns {Object} Engagement analysis with totals, averages, and breakdown by type
     */
    P.analyzeEngagement = function (posts) {
        let totalLikes = 0;
        let totalComments = 0;
        let totalViews = 0;
        let postsWithLikes = 0;
        let postsWithComments = 0;
        let postsWithViews = 0;
        
        const engagementByType = {};
        
        posts.forEach(post => {
            const likes = post.likes || 0;
            const comments = post.comments || 0;
            const views = post.videoViews || 0;
            
            totalLikes += likes;
            totalComments += comments;
            totalViews += views;
            
            if (post.likes) postsWithLikes++;
            if (post.comments) postsWithComments++;
            if (post.videoViews) postsWithViews++;
            
            const type = post.postType || 'photo';
            if (!engagementByType[type]) {
                engagementByType[type] = { count: 0, totalLikes: 0, totalComments: 0, totalViews: 0 };
            }
            engagementByType[type].count++;
            engagementByType[type].totalLikes += likes;
            engagementByType[type].totalComments += comments;
            engagementByType[type].totalViews += views;
        });
        
        return {
            totalLikes,
            totalComments,
            totalViews,
            postsWithLikes,
            postsWithComments,
            postsWithViews,
            avgLikesPerPost: postsWithLikes > 0 ? Math.round(totalLikes / postsWithLikes) : 0,
            avgCommentsPerPost: postsWithComments > 0 ? Math.round(totalComments / postsWithComments) : 0,
            avgViewsPerPost: postsWithViews > 0 ? Math.round(totalViews / postsWithViews) : 0,
            engagementByType: Object.entries(engagementByType).map(([type, data]) => ({
                type,
                count: data.count,
                avgLikes: Math.round(data.totalLikes / data.count),
                avgComments: Math.round(data.totalComments / data.count),
                avgViews: Math.round(data.totalViews / data.count)
            }))
        };
    };

    /**
     * Analyze posting patterns over time
     * @param {Array} posts - Array of post objects with timestamps
     * @returns {Object} Time analysis with posting frequency and patterns
     */
    P.analyzePostingTimes = function (posts) {
        const postsWithTimestamp = posts.filter(p => p.timestamp);
        const analysis = {
            postsWithTimestamp: postsWithTimestamp.length,
            oldestPost: null,
            newestPost: null,
            avgDaysBetweenPosts: 0,
            postsByMonth: {},
            postsByDayOfWeek: {},
            postsByHour: {}
        };
        
        if (postsWithTimestamp.length > 0) {
            const timestamps = postsWithTimestamp.map(p => p.timestamp).sort((a, b) => a - b);
            analysis.oldestPost = new Date(timestamps[0] * 1000).toISOString();
            analysis.newestPost = new Date(timestamps[timestamps.length - 1] * 1000).toISOString();
            
            if (timestamps.length > 1) {
                const totalDays = (timestamps[timestamps.length - 1] - timestamps[0]) / (24 * 60 * 60);
                analysis.avgDaysBetweenPosts = Math.round(totalDays / (timestamps.length - 1) * 10) / 10;
            }
            
            postsWithTimestamp.forEach(post => {
                const date = new Date(post.timestamp * 1000);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                analysis.postsByMonth[monthKey] = (analysis.postsByMonth[monthKey] || 0) + 1;
                
                const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                analysis.postsByDayOfWeek[dayName] = (analysis.postsByDayOfWeek[dayName] || 0) + 1;
                
                const hour = date.getHours();
                analysis.postsByHour[hour] = (analysis.postsByHour[hour] || 0) + 1;
            });
        }
        
        return analysis;
    };

    /**
     * Run comprehensive analysis on posts
     * @param {Array} posts - Array of post objects
     * @returns {Object} Complete analysis with hashtags, engagement, content, and time data
     */
    P.runComprehensiveAnalysis = function (posts) {
        if (!posts || posts.length === 0) {
            return null;
        }
        
        const hashtagAnalysis = this.analyzeHashtags(posts);
        const engagementAnalysis = this.analyzeEngagement(posts);
        const timeAnalysis = this.analyzePostingTimes(posts);
        
        // Content type distribution
        const contentTypes = {};
        posts.forEach(post => {
            const type = post.postType || 'photo';
            contentTypes[type] = (contentTypes[type] || 0) + 1;
        });
        
        // Top posts by engagement
        const topPosts = posts
            .filter(p => p.likes || p.comments)
            .map(p => ({
                shortcode: p.shortcode,
                type: p.postType,
                likes: p.likes || 0,
                comments: p.comments || 0,
                engagement: (p.likes || 0) + (p.comments || 0) * 2
            }))
            .sort((a, b) => b.engagement - a.engagement)
            .slice(0, 10);
        
        return {
            totalPosts: posts.length,
            hashtagAnalysis,
            engagementAnalysis,
            timeAnalysis,
            contentTypeDistribution: Object.entries(contentTypes).map(([type, count]) => ({
                type,
                count,
                percentage: Math.round((count / posts.length) * 100)
            })),
            topPosts
        };
    };

    /* ── Scan Posts (re-fetch only posts, skip profile) ── */
    P.scanPosts = async function () {
        const profile = this.currentProfile;
        if (!profile || !profile.username) {
            showToast('No profile loaded — scan a profile first', 'warning');
            return;
        }

        const username = profile.username;
        const platform = this.currentPlatform || 'instagram';
        const platformInfo = this.platforms[platform] || this.platforms.instagram;

        if (this.isFetching) return;
        this.isFetching = true;
        this.setFetchingState(true);

        // Show loading on posts page
        if (this.currentPage === 'posts') {
            this._showPostsLoading(`⏳ Scanning posts for @${username}...`);
        }

        showToast(`🔍 Scanning posts for @${username}...`, 'info');

        try {
            let posts = [];

            if (platform !== 'instagram') {
                showToast(`Post scanning is only supported for Instagram — ${platformInfo.name} scanning requires direct API access`, 'warning');
                this.isFetching = false;
                this.setFetchingState(false);
                if (this.currentPage === 'posts') this._hidePostsLoading();
                return;
            }

            /* ═══════════════════════════════════════════════════════════════════════                STRATEGY 1: Instaloader (Python) — PRIMARY — fetches ALL posts with full data
               Uses a real Chromium BrowserWindow to bypass Instagram's login wall.
               Instagram blocks Node.js https but allows real Chrome traffic.
               This includes in-browser GraphQL with pagination for 24+ posts.
            ═══════════════════════════════════════════════════════════════════════ */
            /* ══ STRATEGY 0: Browser (rendered DOM) — tried FIRST ══════════════
               Every Instagram API endpoint returns 401/400 to an anonymous
               caller, while a real Chromium page still renders the profile and
               its newest posts. Running this first is what makes a signed-out
               scan return live data instead of nothing. */
            console.log(`[SWA] 🔍 scanPosts Strategy 0: browser (rendered DOM) for @${username}`);
            try {
                const ipcResult = await this.scrapeViaIPC(username);
                if (ipcResult && ipcResult.posts && ipcResult.posts.length > 0) {
                    posts = ipcResult.posts;
                    if (ipcResult._userId) profile._userId = ipcResult._userId;
                    console.log(`[SWA] ✅ Browser method recovered ${posts.length} posts for @${username}`);
                }
            } catch (e) {
                console.log(`[SWA] ℹ️ Browser method failed: ${e.message || e}`);
            }

            if (!posts || posts.length === 0) {
            console.log(`[SWA] 🔍 scanPosts Strategy 1: Instaloader (Python) for @${username}`);
            try {
                const ilResult = await this._scrapeViaInstaloader(username, null, profile && profile._userId); // Fetch ALL posts
                if (ilResult && ilResult.posts && ilResult.posts.length > 0) {
                    posts = ilResult.posts;
                    if (ilResult._userId) profile._userId = ilResult._userId;
                    console.log(`[SWA] ✅ IPC browser recovered ${posts.length} posts for @${username}`);
                }
            } catch (e) {
                console.log(`[SWA] ℹ️ IPC browser failed: ${e.message || e}`);
            }
            }

            /* ═══════════════════════════════════════════════════════════════════════
               STRATEGY 2: REST API (fallback — often blocked by Instagram now)
            ═══════════════════════════════════════════════════════════════════════ */
            if (!posts || posts.length === 0) {
                const mobileUA = this._randomMobileUA();
                try {
                    console.log(`[SWA] 🔍 scanPosts Strategy 2: REST API for @${username}`);
                    const body = await this.nodeGet('i.instagram.com',
                        `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
                        {
                            'User-Agent': mobileUA,
                            'X-IG-App-ID': this._randomAppId(),
                            'Accept': 'application/json',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Referer': 'https://www.instagram.com/',
                            'Origin': 'https://www.instagram.com',
                        }
                    );
                    const user = JSON.parse(body)?.data?.user;
                    if (user?.username) {
                        const result = this.buildResult(user);
                        if (result.posts && result.posts.length > 0) {
                            posts = result.posts;
                            console.log(`[SWA] ✅ REST API recovered ${posts.length} posts for @${username}`);
                            if (user.id) profile._userId = user.id;
                        }
                    }
                } catch (e) {
                    console.log(`[SWA] ℹ️ REST API failed: ${e.message || e}`);
                }
            }

            /* Strategy 3: GraphQL with known user ID */
            if (!posts || posts.length === 0) {
                console.log(`[SWA] 🔍 scanPosts Strategy 3: GraphQL for @${username}`);
                const userId = profile._userId || null;
                try {
                    posts = await this._scrapePostsGraphQL(username, userId);
                    if (posts && posts.length > 0) {
                        console.log(`[SWA] ✅ GraphQL recovered ${posts.length} posts for @${username}`);
                    }
                } catch (e) {
                    console.log(`[SWA] ℹ️ GraphQL failed: ${e.message || e}`);
                }
            }

            /* (The browser scrape used to be tried last here as "Strategy 4". It is
               now Strategy 0, so re-running the same 60s browser scan again on this
               path would only duplicate work for no extra posts.) */

            /* Strategy 5: Public JSON Endpoint */
            if (!posts || posts.length === 0) {
                console.log(`[SWA] 🔍 scanPosts Strategy 5: JSON Endpoint for @${username}`);
                try {
                    const jsonResult = await this._scrapeViaJSONEndpoint(username);
                    if (jsonResult && jsonResult.posts && jsonResult.posts.length > 0) {
                        posts = jsonResult.posts;
                        console.log(`[SWA] ✅ JSON Endpoint recovered ${posts.length} posts for @${username}`);
                    }
                } catch (e) {
                    console.log(`[SWA] ℹ️ JSON Endpoint failed: ${e.message || e}`);
                }
            }

            /* Strategy 6: HTML post-only extraction */
            if (!posts || posts.length === 0) {
                console.log(`[SWA] 🔍 scanPosts Strategy 6: HTML fallback for @${username}`);
                try {
                    const html = await this.nodeGet('www.instagram.com',
                        `/${encodeURIComponent(username)}/`,
                        {
                            'User-Agent': this._randomUA(),
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'Referer': 'https://www.instagram.com/',
                        }
                    );
                    if (typeof html === 'string') {
                        const extractedPosts = this._extractPostsFromHtml(html);
                        if (extractedPosts && extractedPosts.length > 0) {
                            posts = extractedPosts;
                            console.log(`[SWA] ✅ HTML recovered ${posts.length} posts for @${username}`);
                        }
                    }
                } catch (e) {
                    console.log(`[SWA] ❌ HTML fallback failed: ${e.message || e}`);
                }
            }

            this.currentPosts = posts || [];

            if (this.currentPosts.length === 0) {
                console.log(`[SWA] ℹ️ All post-fetching strategies returned 0 posts for @${username}`);
                showToast('🔒 Instagram is blocking anonymous post access. Try logging in via Settings > Instagram Login for better results.', 'warning');
                // Update the posts page with an in-page error message (not just a toast)
                if (this.currentPage === 'posts') {
                    this._renderPostsContent([]);
                }
            } else {
                // Load thumbnails
                showToast('🖼️ Loading images...', 'info');
                await this.loadProfileImages(profile, this.currentPosts);

                // Update all UI — _renderPostsContent handles rendering on the posts page
                this.renderDashboardPosts(this.currentPosts);
                this.renderCharts(this.currentPosts);
                this.renderMarketingAnalysis(profile, this.currentPosts);
                this.renderMaps(profile, this.currentPosts);
                this._renderPostsContent(this.currentPosts);
            }

            if (this.currentPosts.length > 0) {
                showToast(`✅ ${this.currentPosts.length} posts loaded`, 'success');
            }

        } catch (err) {
            const msg = err.message || 'Post scan failed';
            showToast('❌ ' + msg, 'error');
            this.logError(msg, 'scanPosts', '0');
        } finally {
            this.isFetching = false;
            this.setFetchingState(false);
            if (this.currentPage === 'posts') {
                this._hidePostsLoading();
            }
        }
    };

    /* Live progress for a long scan — drives the posts loading overlay so a
       multi-minute history walk shows pages/posts instead of looking frozen. */
    P._onScanProgress = function (p) {
        if (!p) return;
        this._scanProgress = p;
        try {
            if (p.phase === 'retry') {
                this._showPostsLoading('⏳ Instagram is throttling — retry ' + p.attempt + '/' + p.maxRetries + ' in ' + Math.round((p.waitMs || 0) / 1000) + 's…');
            } else if (p.phase === 'profile') {
                // The profile render + grid walk. These heartbeats also keep the
                // idle watchdog alive while the page is being read.
                this._showPostsLoading('⏳ Reading the profile page — ' + p.posts + ' post(s) visible…');
                this._setPostsLoadingProgress('Profile render · round ' + p.round + ' · ' + p.posts + ' posts visible');
            } else if (p.phase === 'enrich') {
                this._showPostsLoading('⏳ Reading post pages for real likes and captions — ' + (p.done || 0) + '/' + (p.total || '?') + '…');
                this._setPostsLoadingProgress('Post pages · ' + (p.done || 0) + '/' + (p.total || '?') + ' enriched · ' + (p.enriched || 0) + ' with data');
            } else if (p.phase === 'page') {
                const coverage = this._scanCoverage ? this._scanCoverage(this.currentPosts, this.currentProfile && this.currentProfile.posts) : null;
                const suffix = (coverage && coverage.total) ? ' of ' + coverage.total + ' (' + coverage.percent + '%)' : '';
                const where = p.page != null ? ' — page ' + p.page : (p.total ? ' of ' + p.total : '');
                this._showPostsLoading('⏳ Walking full history: ' + p.posts + ' posts collected' + suffix + where + '…');
                this._setPostsLoadingProgress((p.page != null ? 'Page ' + p.page + ' · ' : '') + p.posts + ' posts fetched' + suffix);
            }
        } catch (e) { /* overlay may not be mounted — progress is non-essential */ }
    };

    /* ═══════════════════════════════════════════════════════════════════════
       FULL-HISTORY SCAN
       Walks the account back to its very first post and merges what it finds
       with everything already loaded (repeated runs ACCUMULATE). Reports
       honest coverage: scanned vs the account's real post count, whether the
       walk reached the end, and what stopped it.
    ═══════════════════════════════════════════════════════════════════════ */
    P.scanFullHistory = async function () {
        const profile = this.currentProfile;
        if (!profile || !profile.username) {
            showToast('No profile loaded — scan a profile first', 'warning');
            return;
        }
        if (this.isFetching) return;

        const username = profile.username;
        this.isFetching = true;
        this.setFetchingState(true);
        this._scanProgress = null;
        if (this.currentPage === 'posts') {
            this._showPostsLoading('⏳ Walking the full history of @' + username + ' — every post since the account began…');
        }
        showToast('📚 Full-history scan started for @' + username + '.', 'info');

        try {
            const result = await this.scrapeViaIPC(username, { fullHistory: true, resume: true });
            const incoming = (result && result.posts) || [];
            if (result && result._userId) profile._userId = result._userId;

            // Merge (not replace): older posts found this run must survive
            // alongside the newest ones already on screen.
            const merged = this._mergeScannedPosts(this.currentPosts || [], incoming);
            this.currentPosts = merged;

            const report = (result && result.scanReport) || null;
            const coverage = this._scanCoverage(merged, profile.posts);
            this.lastScanReport = report ? Object.assign({}, report, { coverage }) : { coverage };

            if (merged.length > 0) {
                showToast('🖼️ Loading images for ' + merged.length + ' posts...', 'info');
                await this.loadProfileImages(profile, merged);
                this.renderDashboardPosts(merged);
                this.renderCharts(merged);
                this.renderMarketingAnalysis(profile, merged);
                this.renderMaps(profile, merged);
                if (this.currentPage === 'posts') this._renderPostsContent(merged);
                this.updateStats();
                // Persist so the full history is what the app shows next launch.
                this._persistScanResult(profile, merged, {
                    scanReport: this.lastScanReport,
                    source: 'full-history-scan',
                });
            }

            this._reportScanOutcome(coverage, merged.length);
        } catch (err) {
            const msg = (err && err.message) || 'Full-history scan failed';
            showToast('❌ ' + msg, 'error');
            if (this.logError) this.logError('[scanFullHistory] ' + msg, 'scanFullHistory', '0');
            // Keep whatever the walk already collected (it is checkpointed on
            // disk) rather than falling back to nothing.
            if (this._acceptPartialScan(username, err)) {
                if (this.currentPage === 'posts') this._renderPostsContent(this.currentPosts);
            } else if (typeof this.renderScanFreshness === 'function') {
                this.renderScanFreshness();
            }
        } finally {
            this.isFetching = false;
            this.setFetchingState(false);
            if (this.currentPage === 'posts') this._hidePostsLoading();
        }
    };

    /* Merge two post lists by shortcode, keeping the richest real values.
       Delegates to the shared, unit-tested history-scan module when it loads. */
    P._mergeScannedPosts = function (existing, incoming) {
        try {
            const hs = require('./history-scan.js');
            return hs.mergePosts(existing, incoming);
        } catch (e) {
            const byId = new Map();
            const add = list => (list || []).forEach(p => {
                if (!p || !p.shortcode) return;
                const prev = byId.get(p.shortcode);
                if (!prev) { byId.set(p.shortcode, Object.assign({}, p)); return; }
                Object.keys(p).forEach(k => {
                    if (p[k] == null || p[k] === '') return;
                    if (prev[k] == null || prev[k] === '') prev[k] = p[k];
                });
            });
            add(existing); add(incoming);
            return [...byId.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }
    };

    /* Is the account's WHOLE history already in hand?
       True only when the walk reached the end of the account, or we hold at
       least as many posts as the account reports having. An unknown total is
       NEVER treated as complete: the newest page is not the whole account, and
       saying otherwise is what hides the older posts. */
    P._scanIsComplete = function (posts) {
        const report = this.lastScanReport || {};
        if (report.complete === true) return true;
        const total = this.currentProfile ? Number(this.currentProfile.posts) : NaN;
        if (!Number.isFinite(total) || total <= 0) return false;
        return (posts || []).length >= total;
    };

    /* How much of the account this scan actually holds. */
    P._scanCoverage = function (posts, totalPosts) {
        try {
            const hs = require('./history-scan.js');
            return hs.coverage(posts, totalPosts);
        } catch (e) { return { scanned: (posts || []).length, total: null, percent: null }; }
    };

    /* Tell the user exactly what happened — never imply a partial walk was full. */
    P._reportScanOutcome = function (coverage, postsLoaded) {
        const report = this.lastScanReport || {};
        const complete = report.complete === true;
        const parts = [];
        parts.push((coverage && coverage.scanned ? coverage.scanned : postsLoaded) + ' posts');
        if (coverage && coverage.percent != null) parts.push(coverage.percent + '% of the account');
        if (coverage && coverage.oldest) parts.push('back to ' + new Date(coverage.oldest * 1000).toLocaleDateString());
        if (coverage && coverage.scanned && coverage.engagementPercent != null) {
            parts.push(coverage.engagementPercent + '% carry like/comment data');
        }
        if (complete) {
            showToast('✅ Full history complete — ' + parts.join(' · '), 'success');
        } else {
            const why = report.stoppedReason ? ' (' + report.stoppedReason + ')' : '';
            showToast('⚠️ Partial history' + why + ' — ' + parts.join(' · ') + '. Run it again to continue where it stopped.', 'warning');
        }
    };

})();

