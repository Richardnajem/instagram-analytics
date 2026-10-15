// SWA – Small World Analytics 2026 | v1.1.6 Optimized
'use strict';

/* ── Toast helper ──────────────────────────────────── */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container || !message) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    const colors = { error: '#ef4444', warning: '#f59e0b', info: '#7c3aed', success: '#10b981' };
    toast.style.borderLeftColor = colors[type] || colors.info;
    toast.innerHTML = message;
    container.appendChild(toast);
    // Smooth exit animation before removing
    setTimeout(() => {
        toast.style.animation = 'toastOut .35s cubic-bezier(.4,0,.2,1) forwards';
        setTimeout(() => toast.remove(), 380);
    }, 5500);
}

/* ═══════════════════════════════════════════════════
   InstagramAnalytics — main app class
═══════════════════════════════════════════════════ */
class InstagramAnalytics {
    constructor() {
        this.settings = this.loadSettings();
        this.history = this.loadHistory();
        this.buildLog = this.loadBuildLog();
        this.errorLog = this.loadErrorLog();
        this.currentProfile = null;
        this.currentPosts = [];
        this.charts = {};
        this.currentPage = 'dashboard';
        this.isFetching = false;
        this._unfollowedFakeCounts = this.loadUnfollowHistory();
        this._domCache = {};
        this._selectedPeriod = 'all';
        this.currentPlatform = 'instagram';

        // Platform configurations
        this.platforms = {
            instagram: {
                name: 'Instagram', icon: '📷', color: '#7c3aed', glow: 'rgba(124,58,237,.3)',
                postTypes: ['photo', 'video', 'reel', 'carousel'],
                metrics: ['likes', 'comments', 'followers', 'engagement_rate', 'reach', 'saves', 'shares'],
                desc: 'Photos, Reels, Stories',
                homeUrl: 'https://www.instagram.com/',
                expectedER: { '<1K': '5-10%', '1-10K': '3-6%', '10-100K': '2-3%', '100K+': '1-2%' }
            },
            tiktok: {
                name: 'TikTok', icon: '🎵', color: '#ff0050', glow: 'rgba(255,0,80,.25)',
                postTypes: ['video', 'photo'],
                metrics: ['likes', 'comments', 'followers', 'views', 'shares', 'saves'],
                desc: 'Videos, Trends, Sounds',
                homeUrl: 'https://www.tiktok.com/',
                expectedER: { '<1K': '10-18%', '1-10K': '6-12%', '10-100K': '4-8%', '100K+': '2-5%' }
            },
            snapchat: {
                name: 'Snapchat', icon: '👻', color: '#fffc00', glow: 'rgba(255,252,0,.25)',
                postTypes: ['snap', 'story', 'spotlight'],
                metrics: ['views', 'screenshots', 'subscribers', 'completion_rate'],
                desc: 'Snaps, Stories, Spotlight',
                homeUrl: 'https://www.snapchat.com/',
                expectedER: { '<1K': '15-25%', '1-10K': '10-20%', '10-100K': '5-15%', '100K+': '3-8%' }
            },
            facebook: {
                name: 'Facebook', icon: '👍', color: '#1877f2', glow: 'rgba(24,119,242,.25)',
                postTypes: ['photo', 'video', 'link', 'status'],
                metrics: ['likes', 'comments', 'shares', 'followers', 'reach'],
                desc: 'Pages, Groups, Reels',
                homeUrl: 'https://www.facebook.com/',
                expectedER: { '<1K': '4-8%', '1-10K': '2-5%', '10-100K': '1-3%', '100K+': '0.5-1.5%' }
            },
            threads: {
                name: 'Threads', icon: '🥵', color: '#000000', glow: 'rgba(255,255,255,.2)',
                postTypes: ['text', 'photo', 'video'],
                metrics: ['likes', 'comments', 'reposts', 'followers', 'views'],
                desc: 'Text, Photos, Discussions',
                homeUrl: 'https://www.threads.net/',
                expectedER: { '<1K': '8-15%', '1-10K': '5-10%', '10-100K': '3-6%', '100K+': '1-3%' }
            },
            x: {
                name: 'X', icon: '𝕏', color: '#ffffff', glow: 'rgba(255,255,255,.15)',
                postTypes: ['tweet', 'photo', 'video'],
                metrics: ['likes', 'replies', 'reposts', 'followers', 'views', 'bookmarks'],
                desc: 'Tweets, Media, Trends',
                homeUrl: 'https://x.com/',
                expectedER: { '<1K': '3-8%', '1-10K': '1-5%', '10-100K': '0.5-3%', '100K+': '0.2-1%' }
            }
        };

        this.applySavedTheme();
        // Boot when the DOM is ready. If the document has already finished
        // parsing by the time this script runs (injected/cached loads), the
        // DOMContentLoaded event may never fire again — boot directly instead.
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.boot());
        } else {
            setTimeout(() => this.boot(), 0);
        }
    }

    /* ── Boot ─────────────────────────────────────── */
    boot() {
        // Mark boot as started so the watchdog in index.html never shows a
        // false "failed to load" screen on a slow-but-successful launch.
        window.__swaBooted = true;
        if (window.__swaBootMark) window.__swaBootMark('boot:start');
        this._bootFailures = [];
        this._verifyMethods();
        // Anything thrown before logging existed (module load, construction)
        // is flushed into the real error log now that logError is available.
        if (window.__swaDrainBootErrors) {
            try {
                var drainedErrors = window.__swaDrainBootErrors(this);
                this._bootEarlyErrorCount = Array.isArray(drainedErrors) ? drainedErrors.length : 0;
            } catch (e) { /* never break boot */ }
        }
        this._bootEarlyErrorCount = this._bootEarlyErrorCount || 0;
        this.initIntro();
        // Each step below is isolated so a single failure can't abort the whole
        // boot and leave the user staring at a half-initialised shell.
        this._bootStep('setupSidebar', () => this.setupSidebar());
        this._bootStep('setupEventListeners', () => this.setupEventListeners());
        this._bootStep('setupWindowControls', () => this.setupWindowControls());
        this._bootStep('renderCharts', () => this.renderCharts([]));
        this._bootStep('renderHistory', () => this.renderHistory());
        this._bootStep('updateStats', () => this.updateStats());
        this._bootStep('populateSettings', () => this.populateSettings());
        this._bootStep('readVersion', () => this.readVersion());
        this._bootStep('initEntranceAnimations', () => this.initEntranceAnimations());
        this._bootStep('initMagneticCards', () => this.initMagneticCards());
        this._bootStep('initScrollReveal', () => this.initScrollReveal());

        // Build log: auto-log app launch
        this.logBuildEvent('launch', `App started v${this.getVersion()}`);

        // Clear stale errors older than 7 days to prevent error log bloat
        if (this.errorLog && this.errorLog.length > 50) {
            const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            this.errorLog = this.errorLog.filter(e => new Date(e.timestamp).getTime() > weekAgo);
            // Keep at most the latest 30 entries
            if (this.errorLog.length > 30) this.errorLog = this.errorLog.slice(0, 30);
            this.saveErrorLog();
            this._updateErrorBadge();
        }
        this.renderBuildLog();
        this.renderErrorLog();
        this.renderMetricExplanations();

        // Global error handler — catches uncaught exceptions
        window.addEventListener('error', e => {
            this.logError(e.message || 'Unknown error', e.filename, e.lineno);
        });
        // Enhanced unhandled rejection handler is set up by setupEnhancedErrorHandling() below

        // Wrap critical methods with error-catching guards
        this.initGuardedMethods();
        // Enhance global error routing
        this.setupEnhancedErrorHandling();

        this._bootStep('setupContextMenu', () => this.setupContextMenu());
        this._bootStep('setupPlatformSelector', () => this.setupPlatformSelector());

        // ── Boot self-check ──────────────────────────────────────────────
        // Every launch records whether it actually came up cleanly: duration,
        // failed steps, module-load problems and pre-log errors. "Boots properly
        // every time" is only verifiable if it is written down.
        try {
            var earlyErrors = this._bootEarlyErrorCount || 0;
            var moduleReport = window.__swaBootModuleReport ? window.__swaBootModuleReport() : null;
            var missingModules = moduleReport ? moduleReport.missingModules : [];
            var failedSteps = this._bootFailures || [];
            this.bootReport = {
                ok: failedSteps.length === 0 && missingModules.length === 0 && earlyErrors === 0,
                durationMs: window.__swaBoot ? (Date.now() - window.__swaBoot.startedAt) : null,
                failedSteps: failedSteps,
                modulesMissing: missingModules,
                missingMethods: moduleReport && moduleReport.missingMethods ? moduleReport.missingMethods : [],
                earlyErrors: earlyErrors,
                // Missing assets (fonts/images) are recorded but do not count as a
                // broken boot — they are reported separately.
                assetsFailed: (window.__swaBoot && window.__swaBoot.resourceErrors) ? window.__swaBoot.resourceErrors.length : 0,
                at: new Date().toISOString(),
            };
            if (typeof this.logBuildEvent === 'function') {
                this.logBuildEvent('boot', 'Boot ' + (this.bootReport.ok ? 'OK' : 'with issues') +
                    ' in ' + this.bootReport.durationMs + 'ms' +
                    (failedSteps.length ? ' — failed: ' + failedSteps.join(', ') : '') +
                    (missingModules.length ? ' — missing modules: ' + missingModules.join(', ') : ''));
            }
            if (!this.bootReport.ok && typeof this.logError === 'function') {
                this.logError('Boot completed with issues — failed steps: ' + (failedSteps.join(', ') || 'none') +
                    '; missing modules: ' + (missingModules.join(', ') || 'none') +
                    '; pre-log errors: ' + earlyErrors, 'boot', '', { severity: 'critical' });
            } else if (typeof this.logBuildEvent === 'function') {
                this.logBuildEvent('boot-clean', 'All boot steps and modules verified');
            }
            if (typeof this._updateErrorPageStats === 'function') this._updateErrorPageStats();
        } catch (e) { /* the boot report must never be able to break boot */ }

        // Load saved platform
        if (this.settings.platform && this.platforms[this.settings.platform]) {
            this._bootStep('switchPlatform', () => this.switchPlatform(this.settings.platform));
        }

        // Export any saved Instagram session to ig_session.json so CLI scan tools
        // (rescan_live.js) can reuse it to bypass anonymous rate limits. Sessions
        // saved before this feature are also picked up here on every launch.
        try {
            const auth = this.isInstagramLoggedIn();
            if (auth && auth.loggedIn && auth.hasSession) {
                this.saveInstagramSession({
                    sessionid: auth.sessionid || '',
                    csrftoken: auth.csrftoken || '',
                    userId: auth.userId || '',
                    username: auth.username || '',
                    cookies: auth.cookies || '',
                    loggedInAt: new Date().toISOString()
                });
            }
        } catch (e) { /* non-fatal */ }

        // Auto-load the last search data so the app shows the most recent
        // profile immediately on launch — no manual re-fetch needed.
        // Tries localStorage first (saved by saveLastSearch), then falls back
        // to the on-disk scan file from external tools.
        const lastSearch = this.loadLastSearch();
        if (lastSearch && lastSearch.profile && lastSearch.posts) {
            this._importScanData(lastSearch, { skipSnapshot: !!lastSearch.fromLibrary });
            console.log(`[SWA] 📥 Auto-loaded last search from localStorage: @${lastSearch.profile.username}`);
        } else if (this.currentPlatform === 'instagram') {
            this._loadSavedScanData();
        }
        // The freshness strip: says whether what just loaded is live or saved,
        // keeps showing the saved scan while a fresh one runs, and offers a
        // one-click restore of the newest saved scan.
        this._bootStep('scanFreshness', () => this.setupScanFreshness());

        // Default username for auto-search on app launch
        const DEFAULT_USERNAME = this.settings.defaultUsername || 'smallworld_foundation';
        const usernameInput = document.getElementById('usernameInput');
        if (usernameInput && !usernameInput.value) {
            usernameInput.value = DEFAULT_USERNAME;
        }

        // Auto-fetch the default profile after intro animation completes
        // Only auto-fetch on Instagram since the default is an Instagram handle.
        // Skips the network call when a fresh (< 15 min) saved scan is already
        // displayed; re-fetches live when the loaded data is stale or absent.
        if (this.currentPlatform === 'instagram' && this.settings.autoFetch !== false) {
            setTimeout(() => {
                if (usernameInput && usernameInput.value.trim() && !this.isFetching) {
                    const fresh = this.currentProfile && this.currentProfile.fetchedAt &&
                        (Date.now() - new Date(this.currentProfile.fetchedAt).getTime()) < 15 * 60 * 1000;
                    if (!this.currentProfile || !fresh) {
                        // The saved scan stays on screen the whole time (see
                        // renderScanFreshness) — an empty dashboard would read as
                        // "no data" rather than "refreshing".
                        this.fetchProfile(usernameInput.value.trim());
                    }
                }
            }, 2500);
        }

        // Keep live data fresh — re-fetch the current profile whenever the app
        // regains focus and the loaded data is older than 15 minutes (respects
        // the autoFetch setting). Combined with the launch auto-fetch, this
        // guarantees the dashboard never shows stale numbers for long.
        // A cooldown of 5 min between auto-refresh attempts prevents hammering
        // the API when Instagram is rate-limiting anonymous access.
        this._lastAutoRefresh = 0;
        window.addEventListener('focus', () => {
            if (this.settings.autoFetch === false) return;
            if (!this.currentProfile || !this.currentProfile.username) return;
            if (this.isFetching) return;
            // Cooldown: don't auto-refresh more than once every 5 minutes
            const sinceLast = Date.now() - this._lastAutoRefresh;
            if (sinceLast < 5 * 60 * 1000) return;
            const last = this.currentProfile.fetchedAt ? new Date(this.currentProfile.fetchedAt).getTime() : 0;
            const ageMinutes = last ? (Date.now() - last) / 60000 : Infinity;
            if (ageMinutes < 15) return;
            this._lastAutoRefresh = Date.now();
            showToast(`🔄 Refreshing live data for @${this.currentProfile.username}…`, 'info');
            this.fetchProfile(this.currentProfile.username);
        });

        window.addEventListener('beforeunload', () => { this.saveSettings(); this.saveHistory(); this.saveBuildLog(); this.saveErrorLog(); if (this.currentProfile && this.currentPosts) this.saveLastSearch(this.currentProfile, this.currentPosts); });
    }

    /* Runs a boot step in isolation so one failure can't abort startup.
       Failures are recorded (not just logged) so the boot report can state
       plainly whether this launch came up clean. */
    _bootStep(label, fn) {
        try {
            return fn();
        } catch (e) {
            var msg = `[boot:${label}] ${e && e.message ? e.message : e}`;
            this._bootFailures = this._bootFailures || [];
            this._bootFailures.push(label);
            try { console.error(`[SWA] boot step "${label}" failed:`, e); } catch {}
            try {
                if (typeof this.logError === 'function') {
                    this.logError(msg, 'boot:' + label, '', { severity: 'critical', stack: e && e.stack });
                }
            } catch {}
            return null;
        }
    }

    /* ── Load the last saved scan on launch ───────────────────────────────
       Two independent stores are checked and the NEWER one wins:

         1. the scan file shipped next to the app (smallworld_scan_results.json)
         2. the last scan this machine collected, checkpointed to the app's
            user-data folder by the main process as it walked

       (2) is what makes the most recent SmallWorld scan survive a cleared
       localStorage, a crash mid-scan or a reinstall. Either way the age of
       what loaded is stated on screen, and the freshness strip keeps showing
       it while a slower live scan runs.
    ────────────────────────────────────────────────────────────────────── */
    async _loadSavedScanData() {
        const candidates = [];
        try {
            const fs = require('fs');
            const path = require('path');
            const scanFile = path.join(__dirname, 'smallworld_scan_results.json');
            if (fs.existsSync(scanFile)) {
                const data = JSON.parse(fs.readFileSync(scanFile, 'utf8'));
                if (data && data.profile && Array.isArray(data.posts) && data.posts.length > 0) {
                    candidates.push({
                        data,
                        at: Date.parse(data.savedAt || data.scannedAt || data.profile.fetchedAt || 0) || 0,
                        label: 'shipped scan file',
                    });
                }
            }
        } catch (e) {
            console.warn('[SWA] Could not read the shipped scan file:', e.message);
        }

        try {
            if (typeof this.loadDiskScan === 'function') {
                const disk = await this.loadDiskScan(null);
                if (disk && Array.isArray(disk.posts) && disk.posts.length) {
                    // A disk checkpoint carries the posts and the walk's state. Its
                    // profile header is whatever the scan captured (may be null on
                    // an anonymous scan) — unknown stays unknown, never guessed.
                    const header = disk.profile || {};
                    candidates.push({
                        data: {
                            profile: Object.assign({
                                username: disk.username || header.username || '',
                                fullName: header.fullName || '',
                                bio: header.bio || '',
                                profilePicUrl: header.profilePicUrl || '',
                                followers: header.followers ?? null,
                                following: header.following ?? null,
                                posts: header.posts ?? null,
                                externalUrl: header.externalUrl || '',
                                isVerified: header.isVerified ?? false,
                                userId: disk.userId || header.userId || null,
                                fetchedAt: disk.updatedAt || new Date().toISOString(),
                            }),
                            posts: disk.posts,
                            savedAt: disk.updatedAt || null,
                            scanReport: disk.scanReport || {
                                complete: disk.complete === true,
                                pages: disk.pages || null,
                                stoppedReason: disk.stoppedReason || null,
                                posts: disk.posts.length,
                            },
                        },
                        at: Date.parse(disk.updatedAt || 0) || 0,
                        label: 'last scan saved on this machine',
                    });
                }
            }
        } catch (e) {
            console.warn('[SWA] Could not read the on-disk scan:', e.message);
        }

        if (!candidates.length) return null;
        candidates.sort((a, b) => b.at - a.at);
        const best = candidates[0];
        this._importScanData(best.data);
        console.log('[SWA] 📥 Auto-loaded ' + best.data.posts.length + ' posts from the ' + best.label);
        return best.data;
    }

    getVersion() {
        try {
            const path = require('path');
            return require(path.join(__dirname, 'package.json')).version || '1.1.6';
        } catch { return '1.1.6'; }
    }

    readVersion() {
        const el = document.getElementById('appVersion');
        if (!el) return;
        try {
            const p = require('path');
            const pkg = require(p.join(__dirname, 'package.json'));
            el.textContent = `v${pkg.version || '1.1.6'}`;
        } catch {
            el.textContent = 'v1.1.6';
        }
    }

    /* ═══════════════════════════════════════════════
       RUNTIME SAFETY — warn if methods are missing
    ═══════════════════════════════════════════════ */
    _verifyMethods() {
        // Methods expected to exist on the prototype (from module files)
        // Check them once at boot to catch missing modules early
        const critical = [
            'loadSettings', 'loadHistory', 'loadBuildLog', 'loadErrorLog',
            'loadUnfollowHistory', 'saveSettings', 'saveHistory',
            'saveBuildLog', 'saveErrorLog', 'applySavedTheme',
            'initIntro', 'setupSidebar', 'setupEventListeners',
            'renderCharts', 'renderHistory', 'updateStats',
            'populateSettings', 'initEntranceAnimations',
            'initMagneticCards', 'initScrollReveal',
            'logBuildEvent', 'renderBuildLog', 'renderErrorLog',
            'renderMetricExplanations', 'logError',
            'setupContextMenu', 'setupPlatformSelector', 'switchPlatform',
            'fetchProfile', 'fetchPlatformProfile', 'imageProxy',
            'loadProfileImages', 'displayProfile', 'saveProfileToHistory',
            'renderPostGrid', 'renderDashboardPosts', 'renderMarketingAnalysis', 'renderMaps',
            'setFetchingState', 'fmt', 'escHtml',
            'computeAdvancedMetrics', 'computeAnalysis',
            'estimateFakeFollowers', 'renderFakeFollowerList',
            'destroyCharts', 'chartTheme', 'chartOpts',
            'guardedMethod', 'extractErrorContext',
            'detectKnownError', 'initGuardedMethods', 'setupEnhancedErrorHandling',
            'scrapeFromHtml', 'saveInstagramSession', 'isInstagramLoggedIn',
            'updateIgLoginUI', 'loginToInstagram', 'logoutInstagram',
            'renderProjectInventoryPage', 'exportProjectInventoryExcel',
            'saveScanSnapshot', 'loadScanSnapshot', 'latestSnapshot', 'snapshotAgeLabel',
            'renderScanFreshness', 'setupScanFreshness', 'restoreLatestSnapshot'
        ];
        const missing = critical.filter(name => typeof this[name] !== 'function');
        if (missing.length === 0) {
            // All good — silent in production
        } else {
            console.warn(`[SWA] ⚠️ ${missing.length} method(s) missing from prototype:`);
            missing.forEach(name => {
                console.warn(`  ❌ this.${name}() — check module files or loading order`);
                // Also log to the app's error system if available
                if (typeof this.logError === 'function') {
                    this.logError(`Missing method: ${name}()`);
                }
            });
        }
    }

    /* ── IPC window controls ──────────────────────── */
    setupWindowControls() {
        try {
            const { ipcRenderer } = require('electron');
            document.getElementById('tbMinimize')?.addEventListener('click', () => ipcRenderer.send('window-minimize'));
            document.getElementById('tbMaximize')?.addEventListener('click', () => ipcRenderer.send('window-maximize'));
            document.getElementById('tbClose')?.addEventListener('click', () => ipcRenderer.send('window-close'));
        } catch { /* not in Electron */ }
    }


    /* ═══════════════════════════════════════════════
       PROFILE FETCH — Node.js https (3 strategies)
    ═══════════════════════════════════════════════ */

    

    /* Image Proxy — Node.js https → base64 data URL */

    async loadProfileImages(profile, posts) {
        // Load profile picture — try proxy first, fallback to direct URL
        if (profile.profilePicUrl) {
            try {
                const data = await this.imageProxy(profile.profilePicUrl);
                if (data) {
                    profile._profilePicData = data;
                } else {
                    // Proxy failed — keep original URL for direct browser loading
                    profile._profilePicData = null;
                }
            } catch {
                profile._profilePicData = null;
            }
        }
        // Load thumbnails with concurrency limit to avoid overwhelming the network
        const loadThumbnail = async (post) => {
            if (!post.thumbnail) {
                // For posts without thumbnails, generate a colored placeholder
                post._thumbnailData = null;
                post._thumbnailPlaceholder = this._generateThumbnailPlaceholder(post.postType || 'photo');
                return;
            }
            try {
                const data = await this.imageProxy(post.thumbnail);
                if (data) {
                    post._thumbnailData = data;
                    post._thumbnailUrl = null; // Don't need original URL if we have proxy data
                } else {
                    // If proxy fails, keep the original URL as fallback for direct use
                    post._thumbnailData = null;
                    post._thumbnailUrl = post.thumbnail;
                }
            } catch {
                post._thumbnailData = null;
                post._thumbnailUrl = post.thumbnail; // Use original URL as fallback
            }
        };
        // Process in batches of 6 to avoid connection saturation
        const batchSize = 6;
        for (let i = 0; i < posts.length; i += batchSize) {
            const batch = posts.slice(i, i + batchSize);
            await Promise.all(batch.map(loadThumbnail));
        }
    }

    _generateThumbnailPlaceholder(type) {
        // Generate a data URL placeholder with a gradient matching the post type
        const colorMap = {
            photo: ['#7c3aed', '#a855f7'],
            video: ['#2563eb', '#06b6d4'],
            reel: ['#ec4899', '#f43f5e'],
            carousel: ['#f59e0b', '#f97316'],
            default: ['#4b5563', '#6b7280']
        };
        const [c1, c2] = colorMap[type] || colorMap.default;
        // Use simple SVG shapes/letter as fallback icon (cross-browser safe)
        const iconShape = type === 'video' ? '<polygon points="105,75 105,225 225,150" fill="rgba(255,255,255,0.3)"/>' :
            type === 'reel' ? '<rect x="90" y="90" width="120" height="120" rx="8" stroke="rgba(255,255,255,0.3)" stroke-width="4" fill="none"/><polygon points="115,110 115,190 175,150" fill="rgba(255,255,255,0.3)"/>' :
            type === 'carousel' ? '<rect x="80" y="100" width="100" height="100" rx="6" fill="rgba(255,255,255,0.2)"/><rect x="105" y="100" width="100" height="100" rx="6" fill="rgba(255,255,255,0.3)"/><rect x="130" y="100" width="100" height="100" rx="6" fill="rgba(255,255,255,0.4)"/>' :
            '<circle cx="150" cy="150" r="60" fill="rgba(255,255,255,0.2)"/><circle cx="135" cy="130" r="15" fill="rgba(255,255,255,0.3)"/><polygon points="100,190 200,190 170,150 130,150" fill="rgba(255,255,255,0.3)"/>';
        return 'data:image/svg+xml,' + encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
                <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${c1}"/>
                    <stop offset="100%" style="stop-color:${c2}"/>
                </linearGradient></defs>
                <rect width="300" height="300" fill="url(#g)" rx="8"/>
                ${iconShape}
            </svg>`
        );
    }

    /* ═══════════════════════════════════════════════
       ADVANCED METRICS ENGINE — 44 Instagram Signals
       Computes estimated values from available data;
       API-required metrics are clearly marked.
    ═══════════════════════════════════════════════ */

    /* ── Render advanced metrics visual cards ── */

    /* Marketing Analysis Engine */






    /* ═══════════════════════════════════════════════
       RENDER MAPS — Performance Radar + Timeline
    ═══════════════════════════════════════════════ */

    /* ═══════════════════════════════════════════════
       COMPREHENSIVE POST ANALYSIS
       Multiple methods for best insights per scenario
    ═══════════════════════════════════════════════ */

    /**
     * Run comprehensive post analysis and render results
     * Uses multiple analysis methods combined for best insights
     */
    runComprehensiveAnalysis() {
        if (!this.currentProfile || !this.currentPosts || this.currentPosts.length === 0) {
            showToast('⚠️ No profile or posts loaded. Scan a profile first.', 'warning');
            return;
        }

        const resultsContainer = document.getElementById('postAnalysisResults');
        const btn = document.getElementById('runPostAnalysisBtn');
        
        if (!resultsContainer || !btn) return;

        // Show loading state
        btn.innerHTML = '⏳ Analyzing...';
        btn.disabled = true;
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = `
            <div class="analysis-loading">
                <div class="analysis-loading-spinner"></div>
                <div class="analysis-loading-text">Running comprehensive analysis...</div>
            </div>
        `;

        // Use requestAnimationFrame to allow UI to update before running analysis
        requestAnimationFrame(() => {
            try {
                const analysis = this.analyzePostsComprehensive(this.currentProfile, this.currentPosts);
                
                if (analysis) {
                    resultsContainer.innerHTML = this._buildPostAnalysisHTML(analysis);
                    showToast('✅ Comprehensive analysis complete!', 'success');
                } else {
                    resultsContainer.innerHTML = `
                        <div class="analysis-empty">
                            <div class="analysis-empty-icon">📊</div>
                            <div class="analysis-empty-title">No Analysis Data</div>
                            <div class="analysis-empty-desc">Unable to generate analysis. Make sure you have loaded posts.</div>
                        </div>
                    `;
                }
            } catch (err) {
                console.error('Analysis error:', err);
                resultsContainer.innerHTML = `
                    <div class="analysis-empty">
                        <div class="analysis-empty-icon">❌</div>
                        <div class="analysis-empty-title">Analysis Error</div>
                        <div class="analysis-empty-desc">${err.message}</div>
                    </div>
                `;
                showToast('❌ Analysis failed: ' + err.message, 'error');
            } finally {
                btn.innerHTML = '🚀 Run Comprehensive Analysis';
                btn.disabled = false;
            }
        });
    }

    /* ═══════════════════════════════════════════════
       SCRAPER — delegated to scraping.js
    ═══════════════════════════════════════════════ */
}

// App is instantiated after all modules load (see index.html)

