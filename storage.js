// SWA - storage Module
// Extends InstagramAnalytics.prototype
// Auto-generated from app.js refactoring

(function() {
'use strict';
const P = InstagramAnalytics.prototype;

P.loadBuildLog = function() {
        try { const s = localStorage.getItem('swaBuildLog'); return s ? JSON.parse(s) : []; } catch { return []; }
    }

P.saveBuildLog = function() {
        try {
            if (this.buildLog.length > 100) this.buildLog = this.buildLog.slice(-100);
            localStorage.setItem('swaBuildLog', JSON.stringify(this.buildLog));
        } catch (e) {
            console.error('[SWA] Failed to save build log:', e.message);
        }
    }

P.logBuildEvent = function(type, message) {
        if (!this.buildLog) this.buildLog = [];
        this.buildLog.unshift({ type, message, version: this.getVersion(), timestamp: new Date().toISOString() });
        if (this.buildLog.length > 100) this.buildLog = this.buildLog.slice(0, 100);
        this.saveBuildLog();
    }

P.loadErrorLog = function() {
        try { const s = localStorage.getItem('swaErrorLog'); return s ? JSON.parse(s) : []; } catch { return []; }
    }

P.saveErrorLog = function() {
        try {
            if (!this.errorLog) this.errorLog = [];
            if (this.errorLog.length > 200) this.errorLog = this.errorLog.slice(-200);
            localStorage.setItem('swaErrorLog', JSON.stringify(this.errorLog));
        } catch (e) {
            // Silently fail - localStorage might be full or unavailable
            console.error('[SWA] Failed to save error log:', e.message);
        }
    }

P.saveApiSettings = function() {
        this.settings.instagramApiUrl = document.getElementById('instagramApiUrl')?.value || '';
        this.settings.accessToken = document.getElementById('accessToken')?.value || '';
        this.settings.igBusinessAccountId = document.getElementById('igBusinessAccountId')?.value || '';
        this.settings.igUsername = document.getElementById('igUsername')?.value || '';
        this.settings.igPassword = document.getElementById('igPassword')?.value || '';
        this.settings.apiTimeout = parseInt(document.getElementById('apiTimeout')?.value) || 10000;
        // Save auto-fetch toggle
        const autoFetchToggle = document.getElementById('autoFetchToggle');
        if (autoFetchToggle) this.settings.autoFetch = autoFetchToggle.checked;
        // Save default username
        const defaultUsernameInput = document.getElementById('defaultUsernameInput');
        if (defaultUsernameInput) this.settings.defaultUsername = defaultUsernameInput.value.trim() || 'smallworld_foundation';
        this.saveSettings();
        showToast('Settings saved!', 'success');
    }

P.exportData = function() {
        const blob = new Blob([JSON.stringify({ settings: this.settings, history: this.history, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `swa-${new Date().toISOString().split('T')[0]}.json` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        showToast('Exported!', 'success');
    }

// ── CSV export of the currently scanned posts ──
// Spreadsheet-friendly dump with ISO dates and direct post URLs.
P.exportPostsCsv = function() {
        try {
            const posts = this.currentPosts || [];
            if (!posts.length) { showToast('No posts to export — scan a profile first', 'warning'); return; }
            const p = this.currentProfile || {};
            const cols = ['shortcode', 'postType', 'timestamp', 'isoDate', 'likes', 'comments', 'videoViews', 'caption', 'hashtags', 'mentions', 'location', 'url'];
            const esc = (v) => {
                if (v == null) return '';
                const s = String(v).replace(/"/g, '""');
                return /[",\n\r]/.test(s) ? '"' + s + '"' : s;
            };
            const rows = posts.map(post => {
                const ts = post.timestamp || null;
                const iso = ts ? new Date(ts * 1000).toISOString() : '';
                return [
                    post.shortcode || '',
                    post.postType || (post.isVideo ? 'video' : 'photo'),
                    ts || '',
                    iso,
                    post.likes ?? '',
                    post.comments ?? '',
                    post.videoViews ?? post.views ?? '',
                    post.caption || '',
                    (post.hashtags || []).join(' '),
                    (post.mentions || []).join(' '),
                    post.location || '',
                    post.shortcode ? `https://www.instagram.com/p/${post.shortcode}/` : '',
                ].map(esc).join(',');
            });
            const csv = cols.join(',') + '\n' + rows.join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const a = Object.assign(document.createElement('a'), {
                href: URL.createObjectURL(blob),
                download: `swa-posts-${(p.username || 'profile')}-${new Date().toISOString().split('T')[0]}.csv`,
            });
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            showToast(`✅ Exported ${posts.length} posts to CSV`, 'success');
        } catch (e) {
            showToast('CSV export failed: ' + e.message, 'error');
        }
    }

// ── Copy a concise text summary to the clipboard ──
P.copyProfileSummary = function() {
        try {
            const p = this.currentProfile;
            const posts = this.currentPosts || [];
            if (!p) { showToast('Scan a profile first', 'warning'); return; }
            const totalLikes = posts.reduce((s, x) => s + (x.likes || 0), 0);
            const totalComments = posts.reduce((s, x) => s + (x.comments || 0), 0);
            const avgLikes = posts.length ? Math.round(totalLikes / posts.length) : null;
            const avgComments = posts.length ? Math.round(totalComments / posts.length) : null;
            const er = (p.followers && avgLikes != null)
                ? (((avgLikes + (avgComments || 0)) / p.followers) * 100).toFixed(2) + '%' : 'n/a';
            const text = [
                `@${p.username} — Small World Analytics summary`,
                `Followers: ${p.followers != null ? this.fmt(p.followers) : 'unknown'}`,
                `Following: ${p.following != null ? this.fmt(p.following) : 'unknown'}`,
                `Posts (total): ${p.posts != null ? this.fmt(p.posts) : 'unknown'}  ·  scanned: ${posts.length}`,
                `Avg likes/post: ${avgLikes != null ? this.fmt(avgLikes) : 'unknown'}`,
                `Avg comments/post: ${avgComments != null ? this.fmt(avgComments) : 'unknown'}`,
                `Engagement rate: ${er}`,
                `Generated: ${new Date().toLocaleString()}`,
            ].join('\n');
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(
                    () => showToast('✅ Summary copied to clipboard', 'success'),
                    () => showToast('Copy failed — clipboard unavailable', 'error'));
            } else {
                showToast('Clipboard not available', 'warning');
            }
        } catch (e) {
            showToast('Copy failed: ' + e.message, 'error');
        }
    }


P.importData = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const r = new FileReader();
        r.onload = e => {
            try {
                const d = JSON.parse(e.target.result);

                // ── Detect scan data format (has profile + posts array) ──
                if (d.profile && d.posts && Array.isArray(d.posts)) {
                    this._importScanData(d);
                    return;
                }

                // ── Default: settings/history import ──
                if (d.settings) Object.assign(this.settings, d.settings);
                if (d.history) this.history = [...d.history, ...this.history];
                this.saveSettings(); this.saveHistory();
                this.renderHistory(); this.renderCharts(this.currentPosts); this.updateStats();
                showToast('Imported!', 'success');
            } catch { showToast('Import failed — invalid file', 'error'); }
        };
        r.readAsText(file);
    }

    /**
     * Load a scan (imported file, saved snapshot or a scan result) into view.
     * opts.stayHere: keep the current page instead of jumping to the Dashboard
     *                (used when restoring a snapshot on the Projects tab).
     * opts.skipSnapshot: do not re-write the snapshot library (used when what
     *                we are loading IS the snapshot).
     */
    P._importScanData = function(data, opts) {
        const options = opts || {};
        try {
            const scanProfile = data.profile;
            const scanPosts = data.posts;

            // Map scan profile to app format
            // Preserve the scan's real fetchedAt + follower counts (may be null
            // when anonymous access is rate-limited) so the freshness indicator
            // and live-refresh logic report the true age of this data.
            // The account's TOTAL post count is a distinct number from "posts we
            // scanned". The CLI scanners write the *collected* count into
            // totalPosts, which is why the shown post number looked wrong. A
            // recorded total is therefore trusted ONLY when it cannot merely be
            // the scanned count (i.e. it is strictly larger). Unknown totals stay
            // null so login-based enrichment can supply the real media_count.
            const scannedCount = scanPosts.length;
            const totalCandidates = [data.totalPosts, scanProfile.totalPosts, scanProfile.postsCount, scanProfile.posts];
            let explicitTotal = null;
            for (const c of totalCandidates) {
                if (typeof c === 'number' && c > scannedCount) { explicitTotal = c; break; }
            }
            const profile = {
                username: scanProfile.username || '',
                fullName: scanProfile.fullName || '',
                bio: scanProfile.bio || '',
                profilePicUrl: scanProfile.profilePicUrl || '',
                followers: scanProfile.followers ?? null,
                following: scanProfile.following ?? null,
                posts: explicitTotal ?? null,
                postsScanned: scannedCount,
                isVerified: scanProfile.isVerified ?? false,
                isPrivate: false,
                externalUrl: scanProfile.externalUrl || '',
                userId: scanProfile.userId || data.userId || null,
                fetchedAt: scanProfile.fetchedAt || data.fetchedAt || new Date().toISOString(),
            };

            // Map scan posts to app format
            const posts = scanPosts.map((p) => {
                // Parse date string to timestamp
                let timestamp = p.timestamp || null;
                if (!timestamp && p.date) {
                    const parsed = new Date(p.date);
                    if (!isNaN(parsed.getTime())) timestamp = Math.floor(parsed.getTime() / 1000);
                }

                // Map type string to postType
                const typeStr = (p.type || '').toLowerCase();
                let postType = 'photo';
                let isVideo = false;
                if (typeStr.includes('reel') || typeStr.includes('video')) {
                    postType = typeStr.includes('reel') ? 'reel' : 'video';
                    isVideo = true;
                } else if (typeStr.includes('carousel')) {
                    postType = 'carousel';
                }

                return {
                    shortcode: p.shortcode || '',
                    thumbnail: p.thumbnail || p.ogImage || '',
                    likes: p.likes ?? null,
                    comments: p.comments ?? null,
                    caption: p.caption || '',
                    isVideo,
                    postType,
                    carouselCount: p.carouselCount || 0,
                    timestamp,
                    views: p.videoViews || null,
                    location: p.location || null,
                };
            });

            // Followers are often missing from anonymous (rate-limited) scan data.
            // Earlier versions fabricated a follower count from an assumed 3%
            // engagement rate — that displayed a made-up number as if it were
            // measured, and made the engagement rate circular (it always came out
            // to ~3%). Keep the value unknown so every follower-derived metric
            // honestly shows "—" until a real count is available from a
            // logged-in scan or the saved scan file.
            if (profile.followers == null) {
                console.log('[SWA] ℹ️ Follower count unavailable in this scan — follower-based metrics will show "—" until a verified scan.');
            }

            // Set app state
            this.currentProfile = profile;
            this.currentPosts = posts;

            // Immediately render with data we have
            this.displayProfile(profile, posts);
            this.renderPostGrid(posts);
            this.renderDashboardPosts(posts);
            this.renderCharts(posts);
            this.renderMarketingAnalysis(profile, posts);
            this.renderMaps(profile, posts);
            this.updateStats();

            // Load images async (thumbnails) — re-renders when done
            this.loadProfileImages(profile, posts).then(() => {
                this.displayProfile(profile, posts);
                this.renderPostGrid(posts);
                this.renderDashboardPosts(posts);
            }).catch(() => {});

            // Save to history
            this.saveProfileToHistory(profile, profile.username, posts);
            // Persist as last search so it loads on next app launch, and into the
            // per-account snapshot library so this result survives even if the
            // single "last search" key is lost.
            this.saveLastSearch(profile, posts);
            if (!options.skipSnapshot && typeof this.saveScanSnapshot === 'function') {
                this._displayedSnapshot = this.saveScanSnapshot(profile, posts, {
                    scanReport: data.scanReport || null,
                    methods: data.methods || [],
                    source: data.fromLibrary ? 'library' : 'import',
                }) || this._displayedSnapshot || null;
            } else if (data.fromLibrary && data.savedAt) {
                // Loading the snapshot itself — remember which one is on screen so
                // the freshness strip can say how old it is.
                this._displayedSnapshot = Object.assign({}, data, {
                    username: profile.username,
                    profilePosts: (data.profile && data.profile.posts) || null,
                    knownPosts: posts.length,
                    scanPosts: (data.posts || []).length,
                });
                this._liveFetchAt = null;
            }

            // Background: fill in real profile stats (followers / bio / photo)
            // that a posts-only scan left blank. Never blocks the UI.
            this._enrichMissingProfileInfo(profile.username);

            // Update search input
            const input = document.getElementById('usernameInput');
            if (input) input.value = profile.username;

            showToast(`✅ Imported @${profile.username} — ${posts.length} posts loaded`, 'success');

            // Navigate to dashboard to show the data (unless asked to stay put)
            if (!options.stayHere) this.navigateTo('dashboard');
            if (typeof this.renderScanFreshness === 'function') this.renderScanFreshness();
        } catch (err) {
            console.error('[SWA] Scan import error:', err);
            showToast('❌ Failed to import scan data: ' + err.message, 'error');
        }
    }

    // Background enrichment: fetch real profile stats for a posts-only scan and
    // re-render when something was filled in. Runs at most once per username per
    // session, and never when auto-fetch is disabled.
    P._enrichMissingProfileInfo = function (username) {
        try {
            if (!username) return;
            if (this.settings && this.settings.autoFetch === false) return;
            const p = this.currentProfile;
            if (!p || p.username !== username) return;
            if (p.followers != null && p.posts != null) return; // already have real data
            if (typeof this.fetchProfileInfo !== 'function') return;
            this._profileInfoTried = this._profileInfoTried || {};
            if (this._profileInfoTried[username]) return;
            this._profileInfoTried[username] = true;
            this.fetchProfileInfo(username, this.currentProfile && this.currentProfile.userId).then(info => {
                if (!info || !this.currentProfile || this.currentProfile.username !== username) return;
                let changed = false;
                ['followers', 'following', 'posts', 'bio', 'fullName', 'profilePicUrl', 'externalUrl', 'isVerified'].forEach(k => {
                    if (info[k] != null && (this.currentProfile[k] == null || this.currentProfile[k] === '')) {
                        this.currentProfile[k] = info[k];
                        changed = true;
                    }
                });
                if (!changed) return;
                this.displayProfile(this.currentProfile, this.currentPosts);
                this.updateStats();
                this.saveLastSearch(this.currentProfile, this.currentPosts);
                showToast('✅ Loaded live profile stats for @' + username, 'success');
            }).catch(() => {});
        } catch (e) { /* non-fatal */ }
    };

P.loadUnfollowHistory = function() {
        try {
            const s = localStorage.getItem('swaUnfollowHistory');
            return s ? JSON.parse(s) : {};
        } catch { return {}; }
    }

P.saveUnfollowHistory = function() {
        try {
            localStorage.setItem('swaUnfollowHistory', JSON.stringify(this._unfollowedFakeCounts || {}));
        } catch (e) {
            console.error('[SWA] Failed to save unfollow history:', e.message);
        }
    }

// ── Last Search Persistence ──────────────────────────────────
// Saves the current profile + posts to localStorage so the app
// can display the most recent search immediately on next launch.

P.saveLastSearch = function(profile, posts) {
        try {
            if (!profile || !profile.username) return;
            const data = {
                profile: {
                    username: profile.username,
                    fullName: profile.fullName || '',
                    bio: profile.bio || '',
                    profilePicUrl: profile.profilePicUrl || '',
                    followers: profile.followers ?? null,
                    following: profile.following ?? null,
                    posts: profile.posts ?? null,
                    postsScanned: profile.postsScanned ?? null,
                    userId: profile.userId || null,
                    isVerified: profile.isVerified ?? false,
                    isPrivate: profile.isPrivate ?? false,
                    externalUrl: profile.externalUrl || '',
                    fetchedAt: profile.fetchedAt || new Date().toISOString(),
                },
                posts: (posts || []).map(p => ({
                    shortcode: p.shortcode || '',
                    thumbnail: p.thumbnail || '',
                    likes: p.likes ?? null,
                    comments: p.comments ?? null,
                    caption: p.caption || '',
                    isVideo: p.isVideo ?? false,
                    postType: p.postType || 'photo',
                    carouselCount: p.carouselCount || 0,
                    timestamp: p.timestamp || null,
                    views: p.views || null,
                    location: p.location || null,
                    shares: p.shares || null,
                    saves: p.saves || null,
                })),
                savedAt: new Date().toISOString(),
            };
            localStorage.setItem('swaLastSearch', JSON.stringify(data));
            console.log(`[SWA] 💾 Saved last search: @${profile.username} (${posts.length} posts)`);
        } catch (e) {
            console.error('[SWA] Failed to save last search:', e.message);
        }
    }

P.loadLastSearch = function() {
        try {
            const raw = localStorage.getItem('swaLastSearch');
            if (raw) {
                const data = JSON.parse(raw);
                if (data && data.profile && data.profile.username && Array.isArray(data.posts) && data.posts.length > 0) {
                    return data;
                }
            }
        } catch (e) {
            console.warn('[SWA] Could not load last search:', e.message);
        }
        // Fall back to the snapshot library. A single corrupt or evicted key must
        // not lose the most recent scan — the library holds one snapshot per
        // account and is rewritten on every successful scan.
        try {
            const snap = this.latestSnapshot && this.latestSnapshot();
            if (snap && snap.profile && snap.profile.username && Array.isArray(snap.posts) && snap.posts.length) {
                console.log('[SWA] 📥 Restored the most recent scan from the snapshot library: @' + snap.profile.username);
                return {
                    profile: snap.profile,
                    posts: snap.posts,
                    savedAt: snap.savedAt,
                    scanReport: snap.scanReport || null,
                    methods: snap.methods || [],
                    fromLibrary: true,
                };
            }
        } catch (e) { /* library unavailable — nothing else to restore */ }
        return null;
    }

/* ── Scan snapshot library ───────────────────────────────────────────────
   The MOST RECENT results per account, kept on disk (localStorage) so that:

     • a failed, throttled or interrupted scan never wipes what we already
       know — the newest data stays on screen while the fresh scan loads;
     • launching the app shows the last scan immediately instead of an empty
       dashboard, with its real age stated;
     • a scan that returns fewer posts than the last one MERGES rather than
       replaces, so older posts collected earlier are never silently lost.

   Honesty rules applied here (AGENTS.md §"Data-honesty rules"):
     • `scanPosts` is how many posts THIS run collected; `knownPosts` is the
       whole merged set. The two are never presented as the same number.
     • `complete`/`coverage` are copied from the scan report, so a partial walk
       stays labelled partial when it is restored.
     • `savedAt` is when the snapshot was written; the UI always shows its age.
   ───────────────────────────────────────────────────────────────────────── */

P.SCAN_LIBRARY_KEY = 'swaScanLibrary';

/** How many accounts and how many posts per account the library keeps. */
P.SNAPSHOT_LIMITS = { accounts: 6, posts: 600 };

P.loadScanLibrary = function() {
        try {
            const raw = localStorage.getItem(this.SCAN_LIBRARY_KEY || 'swaScanLibrary');
            const lib = raw ? JSON.parse(raw) : null;
            if (!lib || typeof lib !== 'object' || !lib.accounts || typeof lib.accounts !== 'object') {
                return { accounts: {}, updatedAt: null };
            }
            return lib;
        } catch (e) {
            console.warn('[SWA] Could not read the scan library:', e.message);
            return { accounts: {}, updatedAt: null };
        }
    }

P.saveScanLibrary = function(lib) {
        try {
            localStorage.setItem(this.SCAN_LIBRARY_KEY || 'swaScanLibrary', JSON.stringify(lib));
            return true;
        } catch (e) {
            // localStorage can be full. Trim the library to the newest snapshot
            // and retry once — losing the older snapshots beats losing all of them.
            try {
                const accounts = (lib && lib.accounts) || {};
                const names = Object.keys(accounts).sort((a, b) =>
                    new Date(accounts[b].savedAt || 0) - new Date(accounts[a].savedAt || 0));
                const trimmed = { accounts: {}, updatedAt: new Date().toISOString() };
                if (names[0]) trimmed.accounts[names[0]] = accounts[names[0]];
                localStorage.setItem(this.SCAN_LIBRARY_KEY || 'swaScanLibrary', JSON.stringify(trimmed));
                console.warn('[SWA] Scan library was full — kept only the newest account (' + (names[0] || 'none') + ')');
                return true;
            } catch (e2) {
                console.error('[SWA] Failed to save the scan library:', e2.message);
                return false;
            }
        }
    }

/** Merge two post lists by shortcode, preferring a real (non-null) value. */
function mergeSnapshotPosts(oldPosts, newPosts) {
    const byCode = new Map();
    const put = (list, preferNew) => (list || []).forEach(p => {
        if (!p || !p.shortcode) return;
        const prev = byCode.get(p.shortcode);
        if (!prev) { byCode.set(p.shortcode, Object.assign({}, p)); return; }
        Object.keys(p).forEach(k => {
            const v = p[k];
            if (v == null || v === '') return;
            const existing = prev[k];
            const known = existing != null && existing !== '';
            if (!known || preferNew) prev[k] = v;
        });
    });
    put(oldPosts, false);
    put(newPosts, true);
    return [...byCode.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/**
 * Persist the most recent scan for one account.
 * meta: { scanReport, methods, source, scanPosts }
 */
P.saveScanSnapshot = function(profile, posts, meta) {
        try {
            if (!profile || !profile.username) return null;
            const fresh = Array.isArray(posts) ? posts.filter(p => p && p.shortcode) : [];
            // A run that collected nothing new must not erase the previous result.
            const limits = this.SNAPSHOT_LIMITS || { accounts: 6, posts: 600 };
            const lib = this.loadScanLibrary();
            const key = String(profile.username).toLowerCase();
            const prev = lib.accounts[key] || null;
            const previousScanAt = (prev && prev.savedAt) || null;
            const merged = mergeSnapshotPosts(prev ? prev.posts : [], fresh);
            if (!merged.length) return prev;

            const trimmed = merged.length > limits.posts;
            const kept = trimmed ? merged.slice(0, limits.posts) : merged;
            const scanReport = (meta && meta.scanReport) || (this.lastScanReport || null);

            // Two scans can finish inside the same millisecond, and a tie would
            // make "which snapshot is the newest" (and therefore which one is
            // dropped at the storage limit) arbitrary. Stamp the newest one
            // strictly later than whatever is already saved.
            let stamp = Date.now();
            Object.keys(lib.accounts).forEach(function (k) {
                const t = new Date(lib.accounts[k].savedAt || 0).getTime();
                if (isFinite(t) && t >= stamp) stamp = t + 1;
            });
            const savedAt = new Date(stamp).toISOString();

            const snapshot = {
                username: key,
                profile: {
                    username: profile.username,
                    fullName: profile.fullName || '',
                    bio: profile.bio || '',
                    profilePicUrl: profile.profilePicUrl || '',
                    followers: profile.followers ?? null,
                    following: profile.following ?? null,
                    posts: profile.posts ?? null,
                    postsScanned: profile.postsScanned ?? null,
                    userId: profile.userId || profile._userId || null,
                    isVerified: profile.isVerified ?? false,
                    isPrivate: profile.isPrivate ?? false,
                    externalUrl: profile.externalUrl || '',
                    fetchedAt: profile.fetchedAt || new Date().toISOString(),
                },
                posts: kept.map(p => ({
                    shortcode: p.shortcode,
                    thumbnail: p.thumbnail || '',
                    url: p.url || '',
                    likes: p.likes ?? null,
                    comments: p.comments ?? null,
                    caption: p.caption || '',
                    isVideo: p.isVideo ?? false,
                    postType: p.postType || 'photo',
                    carouselCount: p.carouselCount || 0,
                    timestamp: p.timestamp || null,
                    views: p.views ?? null,
                    location: p.location || null,
                    hashtags: p.hashtags || [],
                })),
                savedAt: savedAt,
                scanPosts: fresh.length,
                knownPosts: kept.length,
                profilePosts: profile.posts ?? null,
                truncated: trimmed,
                previousScanAt: previousScanAt,
                // Coverage is copied from the scan report — a partial walk stays
                // labelled partial after a reload.
                complete: scanReport ? scanReport.complete === true : false,
                scanReport: scanReport || null,
                methods: (meta && meta.methods) || (scanReport && scanReport.methods) || this._lastScanMethods || [],
                source: (meta && meta.source) || 'scan',
            };

            lib.accounts[key] = snapshot;
            // Keep the library bounded: newest accounts win.
            const names = Object.keys(lib.accounts).sort((a, b) =>
                new Date(lib.accounts[b].savedAt || 0) - new Date(lib.accounts[a].savedAt || 0));
            names.slice(limits.accounts).forEach(n => { delete lib.accounts[n]; });
            lib.updatedAt = snapshot.savedAt;
            this.saveScanLibrary(lib);
            console.log('[SWA] 💾 Scan snapshot saved: @' + key + ' — ' + fresh.length +
                ' posts this run, ' + kept.length + ' known' + (trimmed ? ' (trimmed to newest ' + limits.posts + ')' : ''));
            return snapshot;
        } catch (e) {
            console.error('[SWA] Failed to save the scan snapshot:', e.message);
            return null;
        }
    }

P.loadScanSnapshot = function(username) {
        if (!username) return null;
        const lib = this.loadScanLibrary();
        return lib.accounts[String(username).toLowerCase()] || null;
    }

P.listScanSnapshots = function() {
        const lib = this.loadScanLibrary();
        return Object.keys(lib.accounts)
            .map(k => lib.accounts[k])
            .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
    }

P.latestSnapshot = function() {
        const all = this.listScanSnapshots();
        return all.length ? all[0] : null;
    }

/** Remove every saved scan snapshot (used by the Settings reset button). */
P.clearScanSnapshots = function() {
        this.saveScanLibrary({ accounts: {}, updatedAt: new Date().toISOString() });
    }

/**
 * Human-readable age of a saved scan. Stated in plain words because "2 hours
 * ago" is the honest answer to "is this live?" — the app never implies fresh
 * data it does not have.
 */
P.snapshotAgeLabel = function(savedAt) {
        if (!savedAt) return 'age unknown';
        const ms = Date.now() - new Date(savedAt).getTime();
        if (!isFinite(ms)) return 'age unknown';
        if (ms < 0) return 'just now';
        const mins = Math.floor(ms / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return mins + ' min ago';
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + ' hour' + (hrs === 1 ? '' : 's') + ' ago';
        const days = Math.floor(hrs / 24);
        if (days < 31) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
        const months = Math.round(days / 30.44);
        if (months < 18) return months + ' month' + (months === 1 ? '' : 's') + ' ago';
        return new Date(savedAt).toLocaleDateString();
    }

})();
