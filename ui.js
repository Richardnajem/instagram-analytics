// SWA - ui Module
// Extends InstagramAnalytics.prototype
// Auto-generated from app.js refactoring

(function() {
'use strict';
const P = InstagramAnalytics.prototype;

P.applySavedTheme = function() {
        document.documentElement.setAttribute('data-theme', this.settings.theme || 'dark');
    }

P.setupPlatformSelector = function() {
        const selector = document.getElementById('platformSelector');
        const dropdown = document.getElementById('platformDropdown');
        if (!selector || !dropdown) return;

        selector.addEventListener('click', (e) => {
            if (e.target.closest('.platform-option')) return;
            selector.classList.toggle('open');
        });

        dropdown.querySelectorAll('.platform-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const platform = option.dataset.platform;
                if (platform && platform !== this.currentPlatform) {
                    this.switchPlatform(platform);
                }
                selector.classList.remove('open');
            });
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#platformSelector')) {
                selector.classList.remove('open');
            }
        });
    }

P.switchPlatform = function(platform) {
        if (!this.platforms[platform]) return;
        const prevPlatform = this.currentPlatform;
        this.currentPlatform = platform;
        this.settings.platform = platform;
        this._postsRendered = false;
        this.saveSettings();

        const info = this.platforms[platform];

        // Update platform dropdown UI
        const currentEl = document.getElementById('platformCurrent');
        const iconEl = document.getElementById('platformIcon');
        const nameEl = document.getElementById('platformName');
        const badgeEl = document.getElementById('platformIndicatorBadge');
        const profileBadgeEl = document.getElementById('profilePlatformBadge');

        if (iconEl) iconEl.textContent = info.icon;
        if (nameEl) nameEl.textContent = info.name;
        if (badgeEl) badgeEl.innerHTML = `${info.icon} ${info.name}`;
        if (profileBadgeEl) profileBadgeEl.innerHTML = `${info.icon} ${info.name}`;

        // Update active state in dropdown
        document.querySelectorAll('.platform-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.platform === platform);
        });

        // Apply platform data attribute to body
        document.documentElement.setAttribute('data-platform', platform);
        document.documentElement.setAttribute('data-current-platform', platform);

        // Update accent colors
        document.documentElement.style.setProperty('--platform-accent', info.color);
        document.documentElement.style.setProperty('--platform-glow', info.glow);

        // Update placeholder
        const input = document.getElementById('usernameInput');
        if (input) {
            const placeholders = {
                instagram: 'Enter Instagram username...',
                tiktok: 'Enter TikTok username...',
                snapchat: 'Enter Snapchat username...',
                facebook: 'Enter Facebook page name...',
                threads: 'Enter Threads username...',
                x: 'Enter X/Twitter username...'
            };
            input.placeholder = placeholders[platform] || 'Enter username...';
            input.value = '';
        }

        // Update button text
        const btnText = document.getElementById('fetchBtnText');
        if (btnText) btnText.textContent = `🔍 Scan ${info.name} Profile`;

        // Clear current data (null-guard every element so a missing node can't
        // abort the platform switch — and by extension the boot sequence).
        this.currentProfile = null;
        this.currentPosts = [];
        this.displayProfile(null, []);
        const profileBadge = document.getElementById('profileBadge');
        if (profileBadge) profileBadge.style.display = 'none';
        const gridEl = document.getElementById('postsGrid');
        if (gridEl) gridEl.innerHTML = '';
        const postsEmptyEl = document.getElementById('postsEmpty');
        if (postsEmptyEl) postsEmptyEl.style.display = ''; // reset to CSS default
        const summaryEl = document.getElementById('postSummaryRow');
        if (summaryEl) summaryEl.style.display = 'none';
        const chartsEl = document.getElementById('postChartsSection');
        if (chartsEl) chartsEl.style.display = 'none';

        // Clear dashboard post preview
        const dashPreview = document.getElementById('dashPostsPreview');
        const dashTitle = document.getElementById('dashPostsTitle');
        const dashEmpty = document.getElementById('dashPostsEmpty');
        const dashFooter = document.getElementById('dashPostsFooter');
        if (dashPreview) { dashPreview.innerHTML = ''; dashPreview.style.display = 'none'; }
        if (dashTitle) dashTitle.style.display = 'none';
        if (dashEmpty) dashEmpty.style.display = 'none';
        if (dashFooter) dashFooter.style.display = 'none';

        // Hide any sticky posts loading overlay
        this._hidePostsLoading();

        showToast(`🔄 Switched to ${info.name} — scan a profile to get started`, 'info');
    }

P.renderPostGrid = function(posts) {
        const grid = document.getElementById('postsGrid');
        const empty = document.getElementById('postsEmpty');
        const summary = document.getElementById('postSummaryRow');
        const chartsSection = document.getElementById('postChartsSection');
        if (!grid) return;
        this._postsRendered = true;

        if (!posts || !posts.length) {
            grid.innerHTML = '';
            if (empty) empty.style.display = ''; // reset to CSS default (flex via .posts-empty-state)
            if (summary) summary.style.display = 'none';
            if (chartsSection) chartsSection.style.display = 'none';
            return;
        }

        if (empty) empty.style.display = 'none';
        if (summary) summary.style.display = 'grid';
        if (chartsSection) chartsSection.style.display = 'block';

        const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
        const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);
        const avgLikes = Math.round(totalLikes / posts.length);
        const avgLikesFloat = totalLikes / posts.length;
        const followers = this.currentProfile?.followers || 0;

        const avgCommentsFloat = totalComments / posts.length;
        const avgEngRate = followers
            ? ((avgLikesFloat + avgCommentsFloat) / followers * 100).toFixed(2) + '%' : '—';

        // Best performing post
        const sortedByEng = [...posts].sort((a, b) => ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)));
        const bestPost = sortedByEng[0];

        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? '—'; };
        // "scanned / account total (x%)" — shows how much of the account this
        // scan actually covers, so a partial history is visible at a glance.
        set('postsScanned', this.coverageLabel ? this.coverageLabel(posts) : String(posts.length));
        set('postsTotalLikes', this.fmt(totalLikes));
        set('postsAvgLikes', this.fmt(avgLikes));
        set('postsTotalComments', this.fmt(totalComments));
        setTxt('postsPhotoCount', String(posts.filter(p => p.postType === 'photo').length));
        setTxt('postsVideoCount', String(posts.filter(p => p.postType === 'video' || p.postType === 'reel').length));
        setTxt('postsCarouselCount', String(posts.filter(p => p.postType === 'carousel').length));
        setTxt('postsAvgEngRate', avgEngRate);



        // Generate post card HTML with error isolation for each post
        try {
            const postCards = posts.map((post, i) => {
                try {
                    return this._renderPostCard(post, i, posts, followers, avgLikesFloat, avgCommentsFloat, bestPost);
                } catch (e) {
                    console.warn('[SWA] Error rendering post card', i, ':', e.message);
                    return `<div class="post-card" style="border-color:rgba(239,68,68,.3);padding:1rem;text-align:center;color:var(--text-muted);font-size:.8rem">
                        ⚠️ Could not render post #${i + 1}
                    </div>`;
                }
            }).join('');
            grid.innerHTML = postCards;
        } catch (e) {
            console.error('[SWA] Fatal error generating post grid:', e.message);
            grid.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted);grid-column:1/-1">
                <span style="font-size:2rem;display:block;margin-bottom:.5rem">⚠️</span>
                Could not render posts. Check the Error Log for details.
            </div>`;
        }

        // Render post charts only if the posts page is currently active (to avoid zero-dimension canvas errors)
        const postsPage = document.getElementById('posts');
        if (postsPage && postsPage.classList.contains('active')) {
            try { this.renderPostCharts(posts); } catch (e) { console.warn('[SWA] Post charts render skipped:', e.message); }
            this._postChartsPending = false; // Clear pending flag to prevent deferred double-render
        } else {
            this._postChartsPending = true;
        }
    }

P._renderPostCard = function(post, i, posts, followers, avgLikesFloat, avgCommentsFloat, bestPost) {
        // Use proxied data URL first, fallback to original URL, then placeholder
        const imgSrc = post._thumbnailData || post._thumbnailUrl || post.thumbnail || post._thumbnailPlaceholder || '';
        const type = post.postType || (post.isVideo ? 'video' : 'photo');
        const icon = this.getPostTypeIcon(type);
        const typeLabel = this.getPostTypeLabel(type);
        // Tips are evidence-backed objects ({text, evidence, strength}) computed
        // against this account's own measured numbers; each one shows the value
        // it was derived from so it can be checked rather than trusted.
        const tips = this.generatePostSuggestions(post, avgLikesFloat, followers, avgCommentsFloat, { posts, followers });
        const tipHtml = (tips || []).map(t => {
            const text = typeof t === 'string' ? t : (t && t.text) || '';
            const evidence = (t && typeof t === 'object' && t.evidence)
                ? `<span style="display:block;font-size:.68rem;color:var(--text-muted);opacity:.8;margin-top:2px">📎 ${this.escHtml(t.evidence)}</span>` : '';
            return `<div class="post-tip">${text}${evidence}</div>`;
        }).join('');
        const tipStr = `<div class="post-tips"><span class="post-tips-label">💡 ${(tips && tips.length) || 0} data-backed tips</span>
                <div class="post-tips-list">${tipHtml || '<div class="post-tip">No measured data on this post yet</div>'}</div></div>`;
        const instaUrl = post.shortcode ? `https://www.instagram.com/p/${post.shortcode}/` : '';
        const carouselBadge = post.carouselCount > 1 ? `<div class="post-type-badge carousel-badge">📸 ${post.carouselCount}</div>` : '';
        const postEngRate = followers ? (((post.likes || 0) + (post.comments || 0)) / followers * 100).toFixed(2) : '0.00';
        const isBest = bestPost && post.shortcode === bestPost.shortcode;
        const caption = post.caption || '';
        const hashtagCount = (caption.match(/#[\w]+/g) || []).length;
        const mentionCount = (caption.match(/@[\w.]+/g) || []).length;
        const captionLen = caption.length;

        // Engagement rate color coding
        const erNum = parseFloat(postEngRate);
        const erColor = erNum >= 3 ? '#10b981' : erNum >= 1 ? '#f59e0b' : '#ef4444';

        return `<div class="post-card${isBest ? ' best-post' : ''}" style="animation-delay:${i * .06}s"
                    ${instaUrl ? `onclick="window.app.openPost('${instaUrl}')" title="Click to open on Instagram"` : ''}>
            <div class="post-thumb-wrap">
                ${imgSrc
                ? `<img class="post-thumb" src="${imgSrc}" alt="${typeLabel} post"
                           loading="lazy"
                           onerror="this.outerHTML='<div class=post-thumb-placeholder>${icon}</div>'">`
                : `<div class="post-thumb-placeholder">${icon}</div>`}
                <div class="post-type-badge ${type}">${icon} ${typeLabel}</div>
                ${carouselBadge}
                ${isBest ? '<div class="post-type-badge" style="background:#10b981;color:#fff">🏆 Best</div>' : ''}
                <div class="post-overlay">
                    <span class="overlay-metric"><span class="overlay-icon">❤️</span> ${this.fmt(post.likes)}</span>
                    <span class="overlay-metric"><span class="overlay-icon">💬</span> ${this.fmt(post.comments)}</span>
                    ${post.views ? `<span class="overlay-metric"><span class="overlay-icon">👁️</span> ${this.fmt(post.views)}</span>` : ''}
                    ${instaUrl ? '<span style="font-size:.7rem;opacity:.8">↗ Open</span>' : ''}
                </div>
            </div>
            <div class="post-engagement-row">
                <div class="post-engagement-item">
                    <span class="eng-icon">❤️</span>
                    <span class="eng-value">${this.fmt(post.likes)}</span>
                    <span class="eng-label">likes</span>
                </div>
                <div class="post-engagement-item">
                    <span class="eng-icon">💬</span>
                    <span class="eng-value">${this.fmt(post.comments)}</span>
                    <span class="eng-label">comments</span>
                </div>
                ${post.views ? `<div class="post-engagement-item">
                    <span class="eng-icon">👁️</span>
                    <span class="eng-value">${this.fmt(post.views)}</span>
                    <span class="eng-label">views</span>
                </div>` : ''}
            </div>
            <div class="post-meta">
                ${post.shares ? `<span class="post-shares">🔄 ${this.fmt(post.shares)}</span>` : ''}
                ${post.saves ? `<span class="post-saves">🔖 ${this.fmt(post.saves)}</span>` : ''}
                ${post.reposts ? `<span class="post-reposts">🔁 ${this.fmt(post.reposts)}</span>` : ''}
                ${post.bookmarks ? `<span class="post-bookmarks">📑 ${this.fmt(post.bookmarks)}</span>` : ''}
                ${post.screenshots ? `<span class="post-screenshots">📸 ${this.fmt(post.screenshots)}</span>` : ''}
                ${post.duration ? `<span class="post-duration">⏱️ ${post.duration}s</span>` : ''}
                ${post.timestamp ? `<span class="post-date">📅 ${new Date(post.timestamp * 1000).toLocaleDateString()}</span>` : ''}
            </div>
            <div class="post-eng-bar">
                <span class="post-eng-rate" style="color:${erColor}" title="Engagement Rate for this post">ER: ${postEngRate}%</span>
                <span class="post-eng-rank" title="Rank by engagement among scanned posts">#${i + 1}/${posts.length}</span>
            </div>
            ${caption ? `<div class="post-caption" title="Full caption (${captionLen} chars, ${hashtagCount} hashtags, ${mentionCount} mentions)">${caption.substring(0, 120).replace(/</g, '&lt;')}${caption.length > 120 ? '…' : ''}</div>` : ''}
            <div class="post-details-row">
                ${hashtagCount > 0 ? `<span class="post-detail-tag" title="${hashtagCount} hashtags used">🏷️ ${hashtagCount} tags</span>` : ''}
                ${mentionCount > 0 ? `<span class="post-detail-tag" title="${mentionCount} mentions">👤 ${mentionCount} mentions</span>` : ''}
                ${captionLen > 100 ? `<span class="post-detail-tag" title="Caption length: ${captionLen} chars">📝 ${captionLen} chars</span>` : ''}
                ${post.carouselCount > 1 ? `<span class="post-detail-tag" title="${post.carouselCount} slides in carousel">📸 ${post.carouselCount} slides</span>` : ''}
            </div>
            ${tipStr}
        </div>`;
    }

P._directRenderPosts = function(posts) {
        // Fallback: directly populate the posts grid without relying on renderPostGrid
        // Used when guardedMethod catches an error in renderPostGrid
        const grid = document.getElementById('postsGrid');
        const empty = document.getElementById('postsEmpty');
        const summary = document.getElementById('postSummaryRow');
        const chartsSection = document.getElementById('postChartsSection');
        if (!grid) return;

        if (!posts || !posts.length) {
            grid.innerHTML = '';
            if (empty) empty.style.display = ''; // reset to CSS default (flex via .posts-empty-state)
            if (summary) summary.style.display = 'none';
            if (chartsSection) chartsSection.style.display = 'none';
            return;
        }

        if (empty) empty.style.display = 'none';
        if (summary) summary.style.display = 'grid';
        if (chartsSection) chartsSection.style.display = 'block';

        // Set summary stats directly
        const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? '—'; };
        const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
        const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);
        setStat('postsScanned', this.coverageLabel ? this.coverageLabel(posts) : String(posts.length));
        setStat('postsTotalLikes', this.fmt(totalLikes));
        setStat('postsAvgLikes', this.fmt(Math.round(totalLikes / posts.length)));
        setStat('postsTotalComments', this.fmt(totalComments));

        // Build simple cards for each post
        let html = '';
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            const type = post.postType || (post.isVideo ? 'video' : 'photo');
            const icon = this.getPostTypeIcon ? this.getPostTypeIcon(type) : '🖼️';
            const imgSrc = post._thumbnailData || post._thumbnailUrl || post.thumbnail || post._thumbnailPlaceholder || '';
            const followers = this.currentProfile?.followers || 0;
            const postEngRate = followers ? (((post.likes || 0) + (post.comments || 0)) / followers * 100).toFixed(2) : '0.00';
            const erColor = parseFloat(postEngRate) >= 3 ? '#10b981' : parseFloat(postEngRate) >= 1 ? '#f59e0b' : '#ef4444';
            const caption = (post.caption || '').substring(0, 80);
            html += '<div class="post-card" style="animation-delay:' + (i * 0.06) + 's">' +
                '<div class="post-thumb-wrap">' +
                    (imgSrc
                        ? '<img class="post-thumb" src="' + imgSrc + '" alt="" loading="lazy" onerror="this.outerHTML=\'<div class=post-thumb-placeholder>' + icon + '</div>\'">'
                        : '<div class="post-thumb-placeholder">' + icon + '</div>') +
                    '<div class="post-type-badge ' + type + '">' + icon + ' ' + (this.getPostTypeLabel ? this.getPostTypeLabel(type) : type) + '</div>' +
                '</div>' +
                '<div class="post-engagement-row">' +
                    '<div class="post-engagement-item"><span class="eng-icon">❤️</span> <span class="eng-value">' + this.fmt(post.likes) + '</span> <span class="eng-label">likes</span></div>' +
                    '<div class="post-engagement-item"><span class="eng-icon">💬</span> <span class="eng-value">' + this.fmt(post.comments) + '</span> <span class="eng-label">comments</span></div>' +
                    (post.views ? '<div class="post-engagement-item"><span class="eng-icon">👁️</span> <span class="eng-value">' + this.fmt(post.views) + '</span> <span class="eng-label">views</span></div>' : '') +
                '</div>' +
                '<div class="post-eng-bar">' +
                    '<span class="post-eng-rate" style="color:' + erColor + '">ER: ' + postEngRate + '%</span>' +
                    '<span class="post-eng-rank">#' + (i + 1) + '/' + posts.length + '</span>' +
                '</div>' +
                (caption ? '<div class="post-caption">' + caption.replace(/</g, '&lt;') + (post.caption && post.caption.length > 80 ? '…' : '') + '</div>' : '') +
            '</div>';
        }
        grid.innerHTML = html;
    }

P.openPost = function(url) {
        try {
            const { shell } = require('electron');
            shell.openExternal(url);
        } catch {
            window.open(url, '_blank');
        }
    }

P.updateSearchSuggestions = function(query) {
        const container = document.getElementById('searchSuggestions');
        if (!container) return;
        if (!query?.trim()) { container.style.display = 'none'; return; }
        const history = this.history.filter(h =>
            h.username?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 6);
        if (!history.length) { container.style.display = 'none'; return; }
        container.style.display = 'block';
        container.innerHTML = history.map(h =>
            `<div class="suggestion-item" data-username="${h.username}">
                <span style="font-weight:600">@${h.username}</span>
                <span style="font-size:.75rem;color:var(--text-muted)">${this.fmt(h.metrics?.followers)} followers</span>
            </div>`
        ).join('');
        container.querySelectorAll('.suggestion-item').forEach(el => {
            el.addEventListener('click', () => {
                const username = el.dataset.username;
                document.getElementById('usernameInput').value = username;
                container.style.display = 'none';
                this.fetchProfile(username);
            });
        });
    }

P.closeSearchSuggestions = function() {
        const container = document.getElementById('searchSuggestions');
        if (container) container.style.display = 'none';
    }

P.setupSidebar = function() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.dataset.page !== this.currentPage) this.navigateTo(item.dataset.page);
            });
        });
    }

P._showPostsLoading = function(text) {
        const overlay = document.getElementById('postsLoadingOverlay');
        const textEl = document.getElementById('postsLoadingText');
        if (overlay) overlay.classList.remove('hidden');
        if (textEl && text) textEl.textContent = text;
    }

// Live scan progress (pages walked / posts collected). Kept separate from the
// headline text so the status line can update rapidly during a long history walk
// without flickering the main label.
P._setPostsLoadingProgress = function(text) {
        const el = document.getElementById('postsLoadingProgress');
        if (el) el.textContent = text || '';
    }

P._hidePostsLoading = function() {
        const overlay = document.getElementById('postsLoadingOverlay');
        if (overlay) overlay.classList.add('hidden');
        this._setPostsLoadingProgress('');
    }

P._renderPostsContent = function(posts) {
        // Centralized posts rendering logic used by both navigateTo and fetch completion
        const empty = document.getElementById('postsEmpty');
        const grid = document.getElementById('postsGrid');
        const summary = document.getElementById('postSummaryRow');
        const chartsSection = document.getElementById('postChartsSection');
        const scanBtn = document.getElementById('scanPostsBtn');

        this._hidePostsLoading();

        if (!posts || !posts.length) {
            if (grid) grid.innerHTML = '';
            if (empty) empty.style.display = 'flex';
            if (summary) summary.style.display = 'none';
            if (chartsSection) chartsSection.style.display = 'none';
            // Show the scan posts button if a profile is loaded but posts are empty
            if (scanBtn && this.currentProfile && this.currentProfile.username) {
                scanBtn.style.display = 'inline-flex';
                const fh = document.getElementById('fullHistoryBtn');
                if (fh) {
                    fh.style.display = 'inline-flex';
                    fh.textContent = '📚 Scan Full History';
                }
                const desc = document.getElementById('postsEmptyDesc');
                if (desc) desc.innerHTML = `Profile <strong>@${this.currentProfile.username}</strong> loaded, but no posts were fetched. Try scanning again using a different method.`;
            }
            return;
        }

        // The newest page is NOT the whole account. While the history is only
        // partially covered — or the account's real total is unknown, so it
        // cannot be proven complete — the full-history action stays offered, so
        // the older posts can still be fetched. It is hidden only once the
        // account's whole history is actually in hand.
        if (scanBtn) scanBtn.style.display = 'none';
        const fhBtn = document.getElementById('fullHistoryBtn');
        const historyComplete = this._scanIsComplete ? this._scanIsComplete(posts) : false;
        if (fhBtn) {
            fhBtn.style.display = historyComplete ? 'none' : 'inline-flex';
            fhBtn.textContent = historyComplete
                ? '📚 Full History Loaded'
                : '📚 Continue Full History';
        }
        const desc = document.getElementById('postsEmptyDesc');
        if (desc) desc.innerHTML = 'Scan a profile on the <strong>Dashboard</strong> to see posts with thumbnails, engagement metrics, and AI-powered improvement tips.';

        if (empty) empty.style.display = 'none';
        if (summary) summary.style.display = 'grid';
        if (chartsSection) chartsSection.style.display = 'block';

        try {
            const result = this.renderPostGrid(posts);
            if (result === null) {
                console.warn('[SWA] renderPostGrid returned null — forcing direct render');
                this._directRenderPosts(posts);
            }
        } catch (err) {
            console.warn('[SWA] renderPostGrid threw — forcing direct render:', err.message);
            this._directRenderPosts(posts);
        }

        // Deferred chart rendering
        if (this._postChartsPending) {
            this._postChartsPending = false;
            requestAnimationFrame(() => {
                try { this.renderPostCharts(posts); }
                catch (e) { console.warn('[SWA] Deferred chart render:', e.message); }
            });
        }
    }

P.navigateTo = function(pageId) {
        const oldPage = document.getElementById(this.currentPage);
        const newPage = document.getElementById(pageId);
        if (!newPage) return;

        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`.nav-item[data-page="${pageId}"]`)?.classList.add('active');

        const show = () => {
            oldPage?.classList.remove('active');
            newPage.classList.add('active');
            this.revealPageCards(newPage);

            if (pageId === 'dashboard') {
                this.renderCharts(this.currentPosts);
                this.renderDashboardPosts(this.currentPosts);
            }

            if (pageId === 'posts') {
                if (this.isFetching) {
                    // Still fetching — show loading overlay
                    this._showPostsLoading('⏳ Scanning profile...');
                    const grid = document.getElementById('postsGrid');
                    const empty = document.getElementById('postsEmpty');
                    const summary = document.getElementById('postSummaryRow');
                    const chartsSection = document.getElementById('postChartsSection');
                    if (grid) grid.innerHTML = '';
                    if (empty) empty.style.display = 'none';
                    if (summary) summary.style.display = 'none';
                    if (chartsSection) chartsSection.style.display = 'none';
                } else if (this.currentPosts && this.currentPosts.length > 0) {
                    // Data already loaded — render it
                    this._renderPostsContent(this.currentPosts);
                } else {
                    // No data yet — show empty state
                    this._hidePostsLoading();
                    const empty = document.getElementById('postsEmpty');
                    const grid = document.getElementById('postsGrid');
                    const summary = document.getElementById('postSummaryRow');
                    const chartsSection = document.getElementById('postChartsSection');
                    const scanBtn = document.getElementById('scanPostsBtn');
                    if (grid) grid.innerHTML = '';
                    if (empty) empty.style.display = 'flex';
                    if (summary) summary.style.display = 'none';
                    if (chartsSection) chartsSection.style.display = 'none';
                    // Show scan posts button if profile is loaded
                    if (scanBtn && this.currentProfile && this.currentProfile.username) {
                        scanBtn.style.display = 'inline-flex';
                        const fh = document.getElementById('fullHistoryBtn');
                        if (fh) {
                            fh.style.display = 'inline-flex';
                            fh.textContent = '📚 Scan Full History';
                        }
                        const desc = document.getElementById('postsEmptyDesc');
                        if (desc) desc.innerHTML = `Profile <strong>@${this.currentProfile.username}</strong> loaded, but no posts were fetched. Try scanning again.`;
                    }
                }
            }

            if (pageId === 'analysis' && this.currentProfile) {
                this.renderMarketingAnalysis(this.currentProfile, this.currentPosts);
            }
            if (pageId === 'metrics' && this.currentProfile) {
                this.displayProfile(this.currentProfile, this.currentPosts);
            }
            if (pageId === 'projects') {
                this.renderProjectInventoryPage();
            }
        };

        const reduce = typeof this.prefersReducedMotion === 'function' && this.prefersReducedMotion();
        if (oldPage && oldPage !== newPage && typeof gsap !== 'undefined' && !reduce) {
            gsap.to(oldPage, {
                opacity: 0, x: -30, duration: .22, ease: 'power2.in', onComplete: () => {
                    show();
                    gsap.fromTo(newPage, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: .32, ease: 'power2.out' });
                }
            });
        } else { show(); }

        this.currentPage = pageId;
    }

P.revealPageCards = function(page) {
        if (typeof gsap === 'undefined') return;
        if (typeof this.prefersReducedMotion === 'function' && this.prefersReducedMotion()) return;
        const cards = page.querySelectorAll('.card, .post-card');
        if (cards.length) gsap.fromTo(cards, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .5, stagger: .06, ease: 'back.out(1.4)', delay: .1 });
    }

P.setupEventListeners = function() {
        const input = document.getElementById('usernameInput');

        document.getElementById('fetchBtn')?.addEventListener('click', () => this.fetchProfile(input?.value));
        input?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { this.closeSearchSuggestions(); this.fetchProfile(e.target.value); }
            else if (e.key === 'Escape') this.closeSearchSuggestions();
        });
        input?.addEventListener('input', () => this.updateSearchSuggestions(input.value));
        input?.addEventListener('focus', () => this.updateSearchSuggestions(input.value));
        document.addEventListener('click', e => {
            if (!e.target.closest('.search-bar-inner') && !e.target.closest('.search-suggestions')) this.closeSearchSuggestions();
        });

        document.getElementById('refreshBtn')?.addEventListener('click', () => { const u = input?.value; if (u?.trim()) this.fetchProfile(u); else showToast('Enter a username first', 'warning'); });
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('exportData')?.addEventListener('click', () => this.exportData());
        document.getElementById('importFile')?.addEventListener('change', e => this.importData(e));
        document.getElementById('clearHistory')?.addEventListener('click', () => {
            if (confirm('Clear all history?')) { this.history = []; this.saveHistory(); this.renderHistory(); this.updateStats(); }
        });
        document.getElementById('apiSettingsForm')?.addEventListener('submit', e => { e.preventDefault(); this.saveApiSettings(); });
        document.getElementById('igLoginBtn')?.addEventListener('click', async () => {
            const username = document.getElementById('igUsername')?.value;
            const password = document.getElementById('igPassword')?.value;
            if (username && password) {
                await this.loginToInstagram(username, password);
                this.updateIgLoginUI();
            }
        });
        document.getElementById('igLogoutBtn')?.addEventListener('click', () => {
            this.logoutInstagram();
            this.updateIgLoginUI();
        });
        document.getElementById('chartColors')?.addEventListener('change', e => { this.settings.chartColors = e.target.value; this.saveSettings(); });
        document.getElementById('scanPostsBtn')?.addEventListener('click', () => this.scanPosts());
        document.getElementById('fullHistoryBtn')?.addEventListener('click', () => {
            const input = document.getElementById('usernameInput');
            if (!this.currentProfile && input?.value?.trim()) this.fetchProfile(input.value.trim());
            else this.scanFullHistory();
        });
        document.getElementById('errClearAllBtn')?.addEventListener('click', () => this.clearErrorLog());
        document.getElementById('errTestBtn')?.addEventListener('click', () => this.testErrorDetection());
    }

P.setFetchingState = function(loading) {
        // The freshness strip follows every fetch: while a scan runs it keeps the
        // saved numbers on screen and labels them as the saved ones.
        if (typeof this.renderScanFreshness === 'function') this.renderScanFreshness();
        const btn = document.getElementById('fetchBtnText');
        const input = document.getElementById('usernameInput');
        const fetchBtn = document.getElementById('fetchBtn');
        if (btn) {
            const info = this.platforms[this.currentPlatform] || this.platforms.instagram;
            btn.textContent = loading ? '⏳ Scanning…' : `🔍 Scan ${info.name} Profile`;
        }
        if (input) input.disabled = loading;
        if (fetchBtn) fetchBtn.disabled = loading;
    }

P.populateSettings = function() {
        const s = this.settings;
        const $ = id => document.getElementById(id);
        if ($('instagramApiUrl')) $('instagramApiUrl').value = s.instagramApiUrl || '';
        if ($('accessToken')) $('accessToken').value = s.accessToken || '';
        if ($('igBusinessAccountId')) $('igBusinessAccountId').value = s.igBusinessAccountId || '';
        if ($('apiTimeout')) $('apiTimeout').value = s.apiTimeout || 10000;
        if ($('chartColors')) $('chartColors').value = s.chartColors || 'default';
        // Load auto-fetch toggle
        const autoFetchToggle = document.getElementById('autoFetchToggle');
        if (autoFetchToggle) autoFetchToggle.checked = s.autoFetch !== false;
        // Load default username
        const defaultUsernameInput = document.getElementById('defaultUsernameInput');
        if (defaultUsernameInput) defaultUsernameInput.value = s.defaultUsername || 'smallworld_foundation';
    }

P.toggleTheme = function() {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        this.settings.theme = next;
        this.saveSettings();
        this.renderCharts(this.currentPosts);
    }

P.saveProfileToHistory = function(p, username, posts) {
        this.history.unshift({
            timestamp: new Date().toISOString(),
            username,
            description: `Lookup: @${username}`,
            metrics: {
                followers: p.followers, following: p.following, posts: p.posts,
                isVerified: p.isVerified,
                avgLikes: posts.length ? Math.round(posts.reduce((s, x) => s + (x.likes || 0), 0) / posts.length) : null,
            }
        });
        if (this.history.length > 200) this.history = this.history.slice(0, 200);
        this.saveHistory();
        this.renderHistory();
    }

P.renderHistory = function() {
        const c = document.getElementById('progressHistoryContainer');
        if (!c) return;
        if (!this.history.length) { c.innerHTML = '<p style="color:var(--text-secondary)">No lookups yet.</p>'; return; }
        c.innerHTML = this.history.slice(0, 50).map((h, i) => `
            <div class="history-item" style="animation-delay:${i * .04}s">
                <h4>${new Date(h.timestamp).toLocaleString()} · ${h.description || 'Lookup'}</h4>
                <p>
                    ${h.username ? `<strong>@${h.username}</strong> | ` : ''}
                    Followers: <strong>${this.fmt(h.metrics?.followers)}</strong> |
                    Posts: <strong>${this.fmt(h.metrics?.posts)}</strong>
                    ${h.metrics?.avgLikes ? ` | Avg Likes: <strong>${this.fmt(h.metrics.avgLikes)}</strong>` : ''}
                    ${h.metrics?.isVerified ? ' <span style="color:#10b981">✔ Verified</span>' : ''}
                </p>
            </div>`).join('');
    }

P.updateStats = function() {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('historyCountDisplay', String(this.history.length));
        set('lastEntryDate', this.history.length ? new Date(this.history[0].timestamp).toLocaleDateString() : '—');
    }

P.loadSettings = function() { try { const s = localStorage.getItem('swaSettings'); return s ? JSON.parse(s) : this.defaultSettings(); } catch { return this.defaultSettings(); } }

P.defaultSettings = function() { return { instagramApiUrl: '', accessToken: '', igBusinessAccountId: '', apiTimeout: 10000, theme: 'dark', chartColors: "default", platform: "instagram", igUsername: '', igPassword: '', igSession: '', igUserId: '', autoFetch: true, defaultUsername: 'smallworld_foundation' }; }

P.saveSettings = function() { try { localStorage.setItem('swaSettings', JSON.stringify(this.settings)); } catch (e) { console.error('[SWA] Failed to save settings:', e.message); } }

P.loadHistory = function() { try { const s = localStorage.getItem('swaHistory'); return s ? JSON.parse(s) : []; } catch { return []; } }

P.saveHistory = function() { try { localStorage.setItem('swaHistory', JSON.stringify(this.history)); } catch (e) { console.error('[SWA] Failed to save history:', e.message); } }

P.renderBuildLog = function() {
        const container = document.getElementById('buildLogContainer');
        if (!container) return;
        if (!this.buildLog || !this.buildLog.length) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">No build events recorded yet.</p>';
            return;
        }
        container.innerHTML = this.buildLog.slice(0, 30).map(e => {
            const icons = { launch: '🚀', update: '📦', error: '❌', config: '⚙️', fetch: '🔍', export: '💾', import: '📥' };
            const icon = icons[e.type] || '📝';
            return '<div class="build-log-item">' +
                '<span class="build-log-icon">' + icon + '</span>' +
                '<span class="build-log-msg">' + this.escHtml(e.message) + '</span>' +
                '<span class="build-log-meta">' + new Date(e.timestamp).toLocaleString() + ' · v' + e.version + '</span>' +
            '</div>';
        }).join('');
    }

    P.clearBuildLog = function() {
        this.buildLog = [];
        this.saveBuildLog();
        this.renderBuildLog();
        showToast('Build log cleared', 'success');
    }

    P.renderDashboardPosts = function(posts) {
        const title = document.getElementById('dashPostsTitle');
        const empty = document.getElementById('dashPostsEmpty');
        const preview = document.getElementById('dashPostsPreview');
        const footer = document.getElementById('dashPostsFooter');
        if (!preview) return;

        if (!posts || !posts.length) {
            if (title) title.style.display = 'none';
            if (empty) empty.style.display = 'none';
            if (preview) preview.style.display = 'none';
            if (footer) footer.style.display = 'none';
            return;
        }

        if (title) title.style.display = '';
        if (empty) empty.style.display = 'none';
        if (preview) preview.style.display = '';
        if (footer) footer.style.display = '';

        const followers = this.currentProfile?.followers || 0;
        const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
        const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);
        const avgLikesFloat = posts.length ? totalLikes / posts.length : 0;
        const avgCommentsFloat = posts.length ? totalComments / posts.length : 0;

        // Sort by engagement to find best
        const sortedByEng = [...posts].sort((a, b) => ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)));
        const bestPost = sortedByEng[0];

        preview.innerHTML = posts.map((post, i) => {
            const imgSrc = post._thumbnailData || post._thumbnailUrl || post.thumbnail || post._thumbnailPlaceholder || '';
            const type = post.postType || (post.isVideo ? 'video' : 'photo');
            const icon = this.getPostTypeIcon(type);
            const postEngRate = followers ? (((post.likes || 0) + (post.comments || 0)) / followers * 100).toFixed(2) : '0.00';
            const instaUrl = post.shortcode ? `https://www.instagram.com/p/${post.shortcode}/` : '';
            const isBest = bestPost && post.shortcode === bestPost.shortcode;

            return `<div class="dash-post-thumb" style="animation-delay:${i * .05}s"
                        ${instaUrl ? `onclick="window.app.openPost('${instaUrl}')" title="Click to open on Instagram"` : ''}>
                ${imgSrc
                    ? `<img src="${imgSrc}" alt="Post" loading="lazy"
                           onerror="this.outerHTML='<div class=dash-post-placeholder>${icon}</div>'">`
                    : `<div class="dash-post-placeholder">${icon}</div>`}
                <span class="dash-post-type ${type}">${icon} ${this.getPostTypeLabel(type)}</span>
                ${isBest ? '<span class="dash-post-type-badge">🏆 Best</span>' : ''}
                <div class="dash-post-overlay">
                    <div class="dash-post-stats">
                        <span>❤️ ${this.fmt(post.likes)}</span>
                        <span>💬 ${this.fmt(post.comments)}</span>
                        ${post.views ? `<span>👁️ ${this.fmt(post.views)}</span>` : ''}
                    </div>
                </div>
                <span class="dash-post-er">ER ${postEngRate}%</span>
            </div>`;
        }).join('');
    }

P.updateIgLoginUI = function() {
        const auth = this.isInstagramLoggedIn();
        const loginBtn = document.getElementById('igLoginBtn');
        const logoutBtn = document.getElementById('igLogoutBtn');
        const statusEl = document.getElementById('igLoginStatus');
        if (auth.loggedIn) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'block';
            if (statusEl) statusEl.innerHTML = '<span style="color:#10b981">✅ Logged in as ' + auth.username + '</span>';
        } else {
            if (loginBtn) loginBtn.style.display = 'block';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (statusEl) statusEl.innerHTML = '';
        }
    }

/* ═══════════════════════════════════════════════════════════════════════
   DATA FRESHNESS STRIP
   The app keeps the last scan it collected for each account. This strip is
   the single place that says, in plain words, whether what is on screen is
   LIVE (fetched just now in this session) or SAVED (restored from the last
   scan), and how old it is. While a fresh scan runs it keeps the saved
   numbers visible and switches the strip to a "refreshing" state instead of
   blanking the dashboard.

   Why it exists: a rate-limited Instagram returns nothing, and an empty
   dashboard reads as "this account has no data" — which is a different and
   false claim. The strip keeps the two states visibly apart.
═══════════════════════════════════════════════════════════════════════ */

/** Which snapshot is currently displayed, and was it fetched in this session?
 *
 *  Two different times matter and are never confused:
 *    collectedAt — when the data was actually read from Instagram
 *                  (profile.fetchedAt, carried through every save/restore)
 *    savedAt     — when this machine last wrote the snapshot to disk
 *  The age on screen is always the age of the DATA. A file imported today that
 *  holds a scan from July must not read as "just now". */
P._scanFreshness = function () {
        const p = this.currentProfile;
        const posts = this.currentPosts || [];
        const snap = (this._displayedSnapshot && this._displayedSnapshot.profile &&
            p && this._displayedSnapshot.profile.username === p.username) ? this._displayedSnapshot : null;
        const collectedAt = (p && p.fetchedAt) || (snap && snap.savedAt) || null;
        const savedAt = (snap && snap.savedAt) || (p && p.fetchedAt) || null;
        const age = collectedAt ? this.snapshotAgeLabel(collectedAt) : 'age unknown';
        const savedAge = savedAt ? this.snapshotAgeLabel(savedAt) : null;
        const savedLater = !!(collectedAt && savedAt &&
            (new Date(savedAt).getTime() - new Date(collectedAt).getTime()) > 10 * 60 * 1000);
        const isLive = !!(this._liveFetchAt && collectedAt &&
            Math.abs(new Date(this._liveFetchAt).getTime() - new Date(collectedAt).getTime()) < 5000);
        return {
            hasData: !!(p && posts.length),
            snapshot: snap,
            collectedAt: collectedAt,
            savedAt: savedAt,
            age: age,
            savedAge: savedAge,
            savedLater: savedLater,
            isLive: isLive,
            liveAt: this._liveFetchAt || null,
        };
    }

P.renderScanFreshness = function () {
        const strip = document.getElementById('scanFreshness');
        if (!strip) return;
        const f = this._scanFreshness();
        const icon = document.getElementById('scanFreshnessIcon');
        const title = document.getElementById('scanFreshnessTitle');
        const meta = document.getElementById('scanFreshnessMeta');
        const restore = document.getElementById('scanFreshnessRestore');
        const refresh = document.getElementById('scanFreshnessRefresh');

        // The newest saved snapshot, regardless of what is on screen.
        let latest = null;
        try { latest = this.latestSnapshot ? this.latestSnapshot() : null; } catch (e) { latest = null; }

        strip.classList.remove('hidden', 'is-stale', 'is-refreshing');

        if (!f.hasData && !latest) {
            strip.classList.add('hidden');
            return;
        }

        const coverage = (snap) => {
            if (!snap) return '';
            const total = snap.profilePosts;
            const known = snap.knownPosts != null ? snap.knownPosts : (snap.posts || []).length;
            let s = known + ' posts' + (total ? ' of ' + total : '') + ' known';
            if (snap.scanReport && snap.scanReport.coverage && snap.scanReport.coverage.percent != null) {
                s += ' · ' + snap.scanReport.coverage.percent + '% of the account';
            }
            if (snap.truncated) s += ' · trimmed to the newest ' + known;
            return s;
        };

        if (this.isFetching) {
            strip.classList.add('is-refreshing');
            if (icon) icon.textContent = '⏳';
            if (title) title.textContent = f.hasData
                ? 'Refreshing live data — showing the scan saved ' + f.age
                : 'Refreshing live data…';
            if (meta) {
                const who = (this.currentProfile && this.currentProfile.username) || '';
                meta.textContent = (who ? '@' + who + ' · ' : '') +
                    (f.hasData ? 'data collected ' + f.age + ' · ' : '') +
                    'the numbers below are the saved ones until this scan finishes.';
            }
        } else if (f.hasData && f.isLive) {
            if (icon) icon.textContent = '🟢';
            if (title) title.textContent = 'Live data — fetched just now' + (f.age === 'just now' ? '' : ' (' + f.age + ')');
            if (meta) {
                meta.textContent = '@' + ((this.currentProfile && this.currentProfile.username) || '') +
                    ' · ' + (this.currentPosts || []).length + ' posts on screen. Counts are as observed at retrieval time.';
            }
        } else if (f.hasData) {
            const ageMs = f.collectedAt ? Date.now() - new Date(f.collectedAt).getTime() : Infinity;
            const stale = !(ageMs < 60 * 60 * 1000);
            if (stale) strip.classList.add('is-stale');
            if (icon) icon.textContent = stale ? '💤' : '💾';
            if (title) title.textContent = 'Saved scan — data collected ' + f.age + (stale ? ' (may be out of date)' : '');
            if (meta) {
                meta.textContent = '@' + ((this.currentProfile && this.currentProfile.username) || '') +
                    ' · ' + (this.currentPosts || []).length + ' posts on screen' +
                    (f.snapshot ? ' · ' + coverage(f.snapshot) : '') +
                    (f.snapshot && f.snapshot.complete === false ? ' · the walk did not reach the first post' : '') +
                    (f.savedLater ? ' · saved to this machine ' + f.savedAge : '') +
                    '. Refresh to check for new posts.';
            }
        } else if (latest) {
            strip.classList.add('is-stale');
            if (icon) icon.textContent = '💾';
            const who = latest.profile ? latest.profile.username : '';
            const when = (latest.profile && latest.profile.fetchedAt) || latest.savedAt;
            if (title) title.textContent = 'Last saved scan for @' + who + ' — data collected ' + this.snapshotAgeLabel(when);
            if (meta) meta.textContent = coverage(latest) + '. Press “Use saved scan” to load it without a network call.';
        }

        // "Use saved scan" only makes sense while the on-screen data differs
        // from what is saved.
        if (restore) {
            const canRestore = !!(latest && latest.posts && latest.posts.length &&
                (!f.hasData || !f.snapshot || (f.snapshot && f.snapshot.savedAt !== latest.savedAt)));
            restore.style.display = canRestore ? '' : 'none';
        }
        if (refresh) refresh.disabled = !!this.isFetching;
    }

/** Restore the newest snapshot with no network call at all. */
P.restoreLatestSnapshot = function () {
        const snap = this.latestSnapshot ? this.latestSnapshot() : null;
        if (!snap || !snap.posts || !snap.posts.length) {
            showToast('No saved scan to restore yet — run a scan first', 'warning');
            return false;
        }
        this._liveFetchAt = null;
        // skipSnapshot + fromLibrary: what we are loading IS the snapshot, so it
        // must keep its original savedAt instead of looking freshly written.
        this._importScanData({
            profile: Object.assign({}, snap.profile, { fetchedAt: snap.profile.fetchedAt || snap.savedAt }),
            posts: snap.posts,
            savedAt: snap.savedAt,
            scanReport: snap.scanReport || null,
            methods: snap.methods || [],
            totalPosts: snap.profilePosts,
            fromLibrary: true,
        }, { skipSnapshot: true, stayHere: true });
        showToast('💾 Loaded the saved scan for @' + snap.username + ' (' + this.snapshotAgeLabel(snap.savedAt) + ')', 'success');
        this.renderScanFreshness();
        return true;
    }

P.setupScanFreshness = function () {
        const restore = document.getElementById('scanFreshnessRestore');
        if (restore) restore.addEventListener('click', () => this.restoreLatestSnapshot());
        const refresh = document.getElementById('scanFreshnessRefresh');
        if (refresh) refresh.addEventListener('click', () => {
            const user = (this.currentProfile && this.currentProfile.username) ||
                (this.settings && this.settings.defaultUsername) || 'smallworld_foundation';
            refresh.disabled = true;
            this.renderScanFreshness();
            Promise.resolve(this.fetchProfile(user)).then(() => this.renderScanFreshness());
        });
        this.renderScanFreshness();
    }

})();
