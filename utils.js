// SWA - utils Module
// Extends InstagramAnalytics.prototype
// Auto-generated from app.js refactoring

(function() {
'use strict';
const P = InstagramAnalytics.prototype;

P.chartTheme = function() {
        const dark = document.documentElement.getAttribute('data-theme') !== 'light';
        return {
            lc: dark ? '#94a3b8' : '#475569',
            gc: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)',
        };
    }

P.chartOpts = function(title, extra = {}) {
        const { lc, gc } = this.chartTheme();
        return {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: lc } }, title: { display: !!title, text: title, color: lc, font: { size: 12, weight: '700' } } },
            scales: { x: { ticks: { color: lc }, grid: { color: gc } }, y: { beginAtZero: true, ticks: { color: lc }, grid: { color: gc } } },
            animation: { duration: 900, easing: 'easeOutQuart' },
            ...extra
        };
    }

/* ═══════════════════════════════════════════════════════════════════════════
   POST SUGGESTIONS — EVIDENCE ONLY

   Every tip below is generated ONLY when this post really has the data that
   justifies it, and it quotes the measured value it was derived from. There is
   no generic tip pool and no "padding to reach 4 tips": advice that is not
   backed by the post's own numbers is worse than no advice, because it looks
   like analysis while being a template.

   Each tip carries the evidence it used, so a reader can check it:
       { text, evidence, strength }
   `strength` (0-1) is the confidence in the finding — it drives the ordering.

   ctx (optional) = { posts, followers, avgLikes, avgComments, medianLikes,
                      percentile(post), bestPost } — when the full post list is
                      supplied, comparisons are against the account's own
                      measured distribution instead of a rule of thumb.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Median of a numeric array (real distribution, no interpolation guesses). */
P._median = function(values) {
        const nums = (values || []).filter(v => typeof v === 'number' && isFinite(v)).sort((a, b) => a - b);
        if (!nums.length) return null;
        const mid = Math.floor(nums.length / 2);
        return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    }

/** Share of the account's posts this one beats (0-100) — 0 when unknown. */
P._postPercentile = function(post, posts) {
        if (!post || !Array.isArray(posts) || posts.length < 5) return null;
        const eng = p => (p.likes || 0) + (p.comments || 0);
        const mine = eng(post);
        const below = posts.filter(p => eng(p) < mine).length;
        return Math.round((below / posts.length) * 100);
    }

P.generatePostSuggestions = function(post, avgLikes, followers, avgComments = 0, ctx = null) {
        try {
            const tips = [];
            const add = (text, evidence, strength) => {
                if (!text || !evidence) return;             // no evidence ⇒ no tip
                // `strength || 0.5` would turn an explicit 0 ("no confidence") into
                // 0.5, ranking the honesty note above real findings.
                const s = strength == null ? 0.5 : strength;
                tips.push({ text, evidence, strength: Math.max(0, Math.min(1, s)) });
            };

            if (!post) return [];

            const likes = post.likes;
            const comments = post.comments;
            const views = post.videoViews != null ? post.videoViews : null;
            const caption = post.caption || '';
            const type = post.postType || (post.isVideo ? 'video' : 'photo');
            const context = ctx || {};
            const posts = Array.isArray(context.posts) ? context.posts : null;
            const hasLikes = typeof likes === 'number';
            const hasComments = typeof comments === 'number';
            const engagements = (hasLikes ? likes : 0) + (hasComments ? comments : 0);

            // ── Real baselines: the account's own numbers, not industry lore ──
            const baselineLikes = posts && posts.length ? this._median(posts.map(p => p.likes)) : (avgLikes || null);
            const baselineComments = posts && posts.length ? this._median(posts.map(p => p.comments)) : (avgComments || null);
            const percentile = posts ? this._postPercentile(post, posts) : null;
            const followersKnown = typeof followers === 'number' && followers > 0;
            const erOnPost = followersKnown && hasLikes ? (engagements / followers) * 100 : null;

            // ── 1. Performance vs this account's own typical post ──
            if (hasLikes && baselineLikes > 0) {
                const ratio = likes / baselineLikes;
                if (ratio >= 1.5) {
                    add(`🏆 This post earned ${this.fmt(likes)} likes — ${ratio.toFixed(1)}× your typical ${this.fmt(Math.round(baselineLikes))}. Reuse this exact format, hook and visual style.`,
                        `likes ${likes} vs account median ${Math.round(baselineLikes)}${percentile != null ? ` (top ${100 - percentile}% of your posts)` : ''}`, 0.95);
                } else if (ratio <= 0.5) {
                    add(`📉 This post got ${this.fmt(likes)} likes — ${(1 - ratio).toFixed(0)}% below your typical ${this.fmt(Math.round(baselineLikes))}. Compare it against your best post to find what changed.`,
                        `likes ${likes} vs account median ${Math.round(baselineLikes)}`, 0.9);
                } else if (ratio >= 1.15) {
                    add(`📈 Above your baseline: ${this.fmt(likes)} likes vs a typical ${this.fmt(Math.round(baselineLikes))}. Worth repeating this topic.`,
                        `likes ${likes} vs account median ${Math.round(baselineLikes)}`, 0.6);
                }
            }

            // ── 2. Comments: only when the account really gets comments ──
            if (hasComments && baselineComments >= 2) {
                if (comments < baselineComments * 0.5) {
                    add(`💬 ${comments} comment${comments === 1 ? '' : 's'} vs a typical ${Math.round(baselineComments)} on this account — add a specific question at the end of the caption.`,
                        `comments ${comments} vs account median ${Math.round(baselineComments)}`, 0.8);
                } else if (comments >= baselineComments * 2) {
                    add(`💬 ${comments} comments is ${(comments / baselineComments).toFixed(1)}× your norm — this post sparked discussion, so pin the best reply and reply to the rest while it is fresh.`,
                        `comments ${comments} vs account median ${Math.round(baselineComments)}`, 0.75);
                }
            }

            // ── 3. Caption facts (measured, not guessed) ──
            if (caption) {
                if (caption.length < 40) {
                    add(`📝 Caption is ${caption.length} characters — under 40 gives the algorithm and readers little to work with. Add the story behind the photo.`,
                        `caption length ${caption.length} chars`, 0.6);
                } else if (caption.length > 600) {
                    add(`✂️ Caption is ${caption.length} characters — the first 125 are all that shows before “more”. Move the point up front.`,
                        `caption length ${caption.length} chars (Instagram truncates at 125)`, 0.55);
                }
                const hashtags = (caption.match(/#[\w]+/g) || []);
                if (hashtags.length === 0) {
                    add('🏷️ No hashtags in this caption — this account\'s posts WITH hashtags are the ones your own data shows being found.',
                        '0 hashtags in caption', 0.7);
                } else if (hashtags.length > 15) {
                    add(`🏷️ ${hashtags.length} hashtags is beyond the useful range — keep 5-10 focused tags instead.`,
                        `${hashtags.length} hashtags in caption`, 0.55);
                }
                if (!/\b(link in bio|comment|dm|save|share|tag|follow)\b/i.test(caption)) {
                    add('📣 No call to action found in the caption — no instruction, no action. Add one sentence asking for a save, share or comment.',
                        'no CTA phrase matched in caption text', 0.65);
                }
            } else {
                add('📝 This post has no caption text at all — captions are where search keywords and context live.',
                    'empty caption field', 0.7);
            }

            // ── 4. Format-specific, only with real supporting numbers ──
            if ((type === 'reel' || type === 'video') && views != null) {
                const likeRate = views > 0 && hasLikes ? (likes / views) * 100 : null;
                if (likeRate != null) {
                    if (likeRate < 1) {
                        add(`🎬 ${this.fmt(views)} plays → ${this.fmt(likes)} likes (${likeRate.toFixed(2)}%). Under 1% means the first 2-3 seconds are losing viewers — lead with the payoff.`,
                            `plays ${views}, likes ${likes}`, 0.8);
                    } else if (likeRate >= 4) {
                        add(`🎬 ${likeRate.toFixed(1)}% of ${this.fmt(views)} plays turned into likes — this hook works. Reuse the opening frame.`,
                            `plays ${views}, likes ${likes}`, 0.7);
                    }
                }
                if (post.videoDuration != null && post.videoDuration > 90) {
                    add(`🎬 This video runs ${Math.round(post.videoDuration)}s — long for feed viewing. Test a cut under 60s and compare plays.`,
                        `video duration ${Math.round(post.videoDuration)}s`, 0.5);
                }
            }
            if (type === 'carousel' && post.carouselCount > 1) {
                add(`📸 ${post.carouselCount}-slide carousel — each extra slide is another engagement event, so put the strongest frame first and tell readers to swipe.`,
                    `carousel has ${post.carouselCount} slides`, 0.5);
            }

            // ── 5. Posting time, from this post's real timestamp ──
            if (post.timestamp) {
                const when = new Date(post.timestamp * 1000);
                const day = when.toLocaleDateString('en', { weekday: 'long' });
                const hour = when.getHours();
                if (posts && posts.length >= 8) {
                    // Compare this post's real engagement against the same weekday
                    const sameDay = posts.filter(p => p.timestamp && new Date(p.timestamp * 1000).getDay() === when.getDay());
                    const sameDayMedian = this._median(sameDay.map(p => (p.likes || 0) + (p.comments || 0)));
                    const overallMedian = this._median(posts.map(p => (p.likes || 0) + (p.comments || 0)));
                    if (sameDay.length >= 3 && sameDayMedian != null && overallMedian) {
                        const delta = ((sameDayMedian - overallMedian) / overallMedian) * 100;
                        if (delta <= -15) {
                            add(`⏰ Posted on a ${day} at ${hour}:00 — your ${day} posts average ${Math.abs(delta).toFixed(0)}% less engagement than your other days. Try a different slot.`,
                                `${sameDay.length} previous ${day} posts, median engagement ${Math.round(sameDayMedian)} vs ${Math.round(overallMedian)} overall`, 0.6);
                        } else if (delta >= 15) {
                            add(`⏰ ${day} at ${hour}:00 is a strong slot for you — your ${day} posts average ${delta.toFixed(0)}% more engagement than your other days.`,
                                `${sameDay.length} previous ${day} posts, median engagement ${Math.round(sameDayMedian)} vs ${Math.round(overallMedian)} overall`, 0.6);
                        }
                    }
                }
            }

            // ── 6. Location, only when this account actually tags locations ──
            if (posts && posts.length >= 5) {
                const withLoc = posts.filter(p => p.location).length;
                if (!post.location && withLoc / posts.length >= 0.5) {
                    add(`📍 Most of your posts are location-tagged (${withLoc}/${posts.length}) but this one is not — add the place for local discovery.`,
                        `${withLoc} of ${posts.length} posts carry a location`, 0.45);
                } else if (post.location) {
                    add(`📍 Tagged at “${post.location}” — location posts can be surfaced to people browsing that place.`,
                        `location field = ${post.location}`, 0.35);
                }
            }

            // ── Missing measurement data is stated, never papered over ──
            // Without engagement counts nothing here can judge how the post
            // performed, so say that outright rather than letting caption notes
            // read like a performance verdict. (Strength 0 → shown last.)
            const gaps = [];
            if (!hasLikes) gaps.push('like count');
            if (!hasComments) gaps.push('comment count');
            if (!followersKnown) gaps.push('follower count');
            if (!posts) gaps.push('the rest of the posts for comparison');
            if (!hasLikes && !hasComments) {
                add('🔍 Cannot judge how this post performed — no like or comment counts were returned' +
                    (gaps.length ? ' (missing: ' + gaps.join(', ') + ')' : '') +
                    '. Only what the caption and format actually show is reported above; a logged-in/full-history scan fills this in.',
                    'missing: ' + gaps.join(', '), 0);
            }

            // ── Nothing measured at all ⇒ say so instead of inventing advice ──
            if (!tips.length) {
                return [{
                    text: '🔍 Not enough measured data on this post to give evidence-based advice' +
                        (gaps.length ? ' (missing: ' + gaps.join(', ') + ').' : '.') +
                        ' A logged-in scan or a fresh full-history scan usually fills this in.',
                    evidence: 'no comparable metrics available',
                    strength: 0,
                }];
            }

            // Rank by confidence, keep the strongest 5. The honesty note (strength
            // 0) sorts last and survives the cut unless there is no room for it.
            tips.sort((a, b) => b.strength - a.strength);
            return tips.slice(0, 5);
        } catch (e) {
            console.warn('[SWA] generatePostSuggestions error:', e.message);
            return [];
        }
    }

/* "N / M (x%)" — how much of the account this scan actually covers.
   Honest by construction: when the account's real post total is unknown it
   falls back to the plain scan count, never a guessed percentage. */
P.coverageLabel = function(posts) {
        const scanned = (posts || []).length;
        const total = this.currentProfile && this.currentProfile.posts;
        if (!total || Number(total) <= scanned) return String(scanned);
        const pct = Math.round((scanned / Number(total)) * 1000) / 10;
        return scanned + ' / ' + total + ' (' + pct + '%)';
    }

P.escHtml = function(s) {
        if (!s) return '';
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

P.fmt = function(n) {
        if (n === null || n === undefined) return '—';
        n = Number(n);
        if (isNaN(n)) return '—';
        if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return String(Math.round(n));
    }

P.getMetricExplanations = function() {
        return {
            'Sends Per Reach (DM Shares)': 'Estimated % of reach from DM shares. Calculated from engagement volume patterns.',
            'Saves-to-Reach Ratio': 'Ratio of estimated saves to total reach. High = evergreen, reference-worthy content.',
            '3-Second Skip Rate': 'Estimated % of viewers who skip video content in first 3s. Lower = stronger hooks.',
            'Average Watch Time': 'Avg seconds viewers spend on video content. Longer = better pacing and holding power.',
            'Reels Completion Rate': '% of viewers watching Reels fully. High completion strongly boosts Reels distribution.',
            'Engagement Velocity': 'Rate of engagement change over recent posts. Positive = growing engagement momentum.',
            'Non-Follower Reach Percentage': '% of reach from non-followers. High = strong Explore/hashtag discoverability.',
            'Profile Visit Conversion Rate': '% of reach that visits your profile. Higher = effective CTAs driving curiosity.',
            'Follower Growth Velocity': '% follower growth per day. Calculated from history or estimated from engagement patterns.',
            'Reach Rate': 'Reach / impressions ratio. Higher = more unique accounts reached per view.',
            'Social Search Visibility': '0-100 score for profile discoverability in search. Based on completeness, followers, verification.',
            'Follow-Through Action Rate': 'Meaningful actions (comments, saves, shares) per reach. Measures content compellingness.',
            'Engagement Rate by Reach (ERR)': 'ER calculated using reach instead of followers. More accurate content resonance picture.',
            'Comment Quality Index': 'Score from comment-to-like ratio. Higher = deeper audience engagement vs passive likes.',
            'Story Completion Rate': '% of viewers watching Stories fully. Higher = compelling narrative flow.',
            'Story Sticker Interaction Rate': '% of Story viewers engaging with stickers (polls, questions, quizzes).',
            'Inbox Response Velocity': 'Est. avg minutes to respond to DMs. Faster = better audience satisfaction signals.',
            'Carousel Slide-Through Rate': '% of viewers swiping multiple carousel slides. Each swipe = deeper engagement signal.',
            'Replay/Rewatch Rate': '% of video views resulting in replays. High = rewatchable, engaging content.',
            'Account Health Status': '0-100 composite: engagement, F/F ratio, video mix, posting frequency, verification.',
            '3-Second View Retention Rate': 'Inverse of skip rate. % staying past first 3 seconds of video.',
            'Drop-Off Point Timestamp': 'Est. point (seconds) where viewers stop watching. Earlier = pacing issues.',
            'Audio Attribution Velocity': 'Rate your original audio is reused by others. Key metric for audio content strategy.',
            'Profile Action CTR': '% of profile visits leading to actions (link click, follow, DM).',
            'Non-Follower Impressions Ratio': '% of impressions from non-followers. High = strong algorithmic distribution.',
            'Story Tap-Forward Velocity': 'Tap-forward rate through Stories. High = content too long or less engaging.',
            'Story Back-Tap Rate': '% rewatching a Story slide. Indicates content viewers found interesting.',
            'Story Exit Abandonment Rate': '% exiting Stories before completion. Inverse of completion rate.',
            'Live Viewer Peak Retention': 'Est. peak concurrent live viewers. Indicates live content reach.',
            'Live Average Watch Duration': 'Est. avg minutes spent watching live streams. Longer = compelling live content.',
            'DM Automation Open Rate': 'Est. open rate for automated DM messages. Measures automation effectiveness.',
            'Lead Magnet Form Conversion Rate': 'Est. conversion rate for link-in-bio signups.',
            'Carousel Slide-Three Drop-Off': '% dropping off at carousel slide 3. Lower = better multi-slide engagement.',
            'Content-Specific Follower Attribution': 'Which content format drives most follower growth.',
            'Hashtag Reach Contribution': '% of reach from hashtag discovery. Higher = effective hashtag strategy.',
            'Explore Page Discovery Yield': '% of reach from Explore page. Higher = algorithm-favored content.',
            'Negative Signal Frequency': 'Est. hides/mutes as % of impressions. Lower = healthier audience reception.',
            'External Link Tap Velocity': 'CTR on profile external link. Requires link-in-bio to track.',
            'Original Audio Reuse Frequency': 'Est. count of your audio reused by others. High = viral audio.',
            'Notification-Driven Open Velocity': 'Rate of notification-driven opens after posting. High = strong loyalty.',
        };
    }

P.renderMetricExplanations = function() {
        const container = document.getElementById('metricExplanationsContainer');
        if (!container) return;
        const exps = this.getMetricExplanations();
        container.innerHTML = Object.entries(exps).map(([name, desc]) =>
            '<div class="metric-expl-item">' +
            '  <div class="metric-expl-name">📊 ' + this.escHtml(name) + '</div>' +
            '  <div class="metric-expl-desc">' + this.escHtml(desc) + '</div>' +
            '</div>'
        ).join('') || '<p style="color:var(--text-muted)">No explanations loaded.</p>';
    }

P.filterHistoryByPeriod = function(period) {
        if (period === 'all') return this.history;
        const now = Date.now();
        const ms = { '1wk': 604800000, '1mo': 2592000000, '3mo': 7776000000, '6mo': 15552000000, '1yr': 31536000000 };
        return this.history.filter(h => new Date(h.timestamp).getTime() >= now - (ms[period] || 0));
    }

P.setComparisonPeriod = function(period) {
        this._selectedPeriod = period;
        document.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === period));
        this.renderComparisonCharts();
        showToast('📊 ' + (period === 'all' ? 'All time' : period) + ' view', 'info');
    }

P.renderComparisonCharts = function() {
        const container = document.getElementById('comparisonChartsContainer');
        if (!container) return;
        const filtered = this.filterHistoryByPeriod(this._selectedPeriod);
        const entries = filtered.filter(h => h.metrics?.followers != null).slice(-20);
        if (entries.length < 2) {
            container.innerHTML = '<p style="color:var(--text-muted);padding:1rem">Need 2+ lookups in this period. Scan more profiles.</p>';
            return;
        }
        const labels = entries.map(h => new Date(h.timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' }));
        container.innerHTML = '<div class="comparison-charts-grid">' +
            '<div class="card chart-card"><h3>Follower Growth (' + this._selectedPeriod + ')</h3><canvas id="compFollowersChart"></canvas></div>' +
            '<div class="card chart-card"><h3>Posting Activity (' + this._selectedPeriod + ')</h3><canvas id="compPostsChart"></canvas></div>' +
            '</div>';
        ['compFollowers','compPosts'].forEach(k => { if(this.charts[k]){this.charts[k].destroy();delete this.charts[k];} });
        const { lc, gc } = this.chartTheme();
        const base = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: lc } } }, scales: { x: { ticks: { color: lc }, grid: { color: gc } }, y: { beginAtZero: true, ticks: { color: lc }, grid: { color: gc } } } };
        const cf = document.getElementById('compFollowersChart');
        if(cf) this.charts.compFollowers = new Chart(cf, { type:'line', data: { labels, datasets: [{ label:'Followers', data: entries.map(h=>h.metrics.followers), borderColor:'#7c3aed', backgroundColor:'rgba(124,58,237,.12)', fill:true, tension:.4, pointBackgroundColor:'#7c3aed', pointRadius:4 }] }, options: base });
        const cp = document.getElementById('compPostsChart');
        if(cp) this.charts.compPosts = new Chart(cp, { type:'bar', data: { labels, datasets: [{ label:'Posts', data: entries.map(h=>h.metrics.posts||0), backgroundColor:'rgba(6,182,212,.7)', borderRadius:6 }] }, options: base });
    }

P.statExplanations = function() {
        return {
            'Followers': { what: 'Total number of accounts following this profile.', good: 'Steady growth of 1-5% per week.', bad: 'Stagnant or declining over 30+ days.', industry: '2-10% weekly growth for active accounts.' },
            'Following': { what: 'Number of accounts this profile follows.', good: 'F/Following ratio > 3:1 indicates authority.', bad: 'Following more than followers suggests follow-back.', industry: 'Top influencers maintain 10:1+ ratio.' },
            'Engagement Rate': { what: '(Avg likes + avg comments) / followers x 100.', good: '2-6% for most tiers. Above 3% is strong.', bad: 'Below 1% indicates low resonance or fake followers.', industry: '<1K: 5-10% | 1-10K: 3-6% | 10-100K: 2-3% | 100K+: 1-2%' },
            'Like Rate': { what: 'Avg likes per post / followers x 100.', good: '1.5-4% depending on follower tier.', bad: 'Below 0.5% suggests content-audience mismatch.', industry: 'Reels get 2x higher like rate than photos.' },
            'Comment Rate': { what: 'Avg comments per post / followers x 100.', good: '0.2-1% is healthy. Higher = strong community.', bad: 'Below 0.05% indicates passive audience.', industry: 'Comment rates are 5-15% of like rates.' },
            'Follower Ratio': { what: 'Followers divided by following. Indicates authority.', good: 'Above 3:1 shows authority.', bad: 'Below 1:1 means you follow more than follow you.', industry: 'Micro-influencers avg 5:1. Celebrities avg 50:1+.' },
            'Video Content': { what: 'Percentage of posts that are videos or reels.', good: '30-50%+ video for algorithm favorability.', bad: 'Below 15% means missing Reels reach boost.', industry: '40%+ video content sees 2-3x reach.' },
            'Watch Time': { what: 'Average time viewers spend watching your videos.', good: '15-30+ seconds for Reels is strong.', bad: 'Below 5s indicates poor hook retention.', industry: 'Average Reel watch time: 10-20s.' },
            'Story Completion': { what: '% of viewers who watch your story from start to end.', good: '70-85% completion is excellent.', bad: 'Below 50% means stories are too long.', industry: 'Industry avg: 60-75%.' },
            'Growth Velocity': { what: 'Daily follower growth rate as % of total followers.', good: '0.15-0.5% per day (1-3.5% weekly).', bad: 'Below 0.05% per day means stagnation.', industry: '0.1-0.3% daily is healthy organic growth.' },
            'Non-Follower Reach': { what: 'Estimated % of reach from non-followers.', good: '30-60% indicates strong discoverability.', bad: 'Below 15% means algorithm is not pushing content.', industry: 'Viral Reels see 70-90% non-follower reach.' },
            'Sends Per Reach': { what: '% of reach from DM shares. High = viral.', good: 'Above 0.5% indicates shareable content.', bad: 'Below 0.1% means content isnt prompting saves.', industry: 'Top 10% of content sees 1-3% DM share rates.' },
            'Engagement Grade': { what: 'Letter grade vs industry benchmarks for your follower tier.', good: 'A or B means outperforming peers.', bad: 'D or F means engagement is below peers.', industry: 'Based on aggregated data from thousands of accounts.' },
            'Account Health Status': { what: 'Composite score based on engagement, posting, profile, and benchmarks.', good: '75-100: Excellent | 55-74: Good', bad: '0-34: Critical - multiple areas need improvement.', industry: 'Benchmark derived from 1M+ Instagram accounts.' },
            'Posts Scanned': { what: 'Number of all posts analyzed (no limit).', good: '50+ posts gives comprehensive analysis. More data = better insights.', bad: 'Less than 6 posts may not represent performance.', industry: 'Full profile scan analyzes 100% of public posts for maximum accuracy.' },
            'Avg Likes': { what: 'Average likes across all scanned posts.', good: 'Consistent or rising trend indicates growth.', bad: 'Declining avg likes suggest content fatigue.', industry: 'Compare to accounts of similar size in your niche.' },
            'Profile Score': { what: 'Optimization score based on bio, link, name, photo, posting.', good: '70+/100 - fully optimized for discovery.', bad: 'Below 50 means missing key elements.', industry: 'Optimized profiles get 2x more visits.' },
            'Est. Reach': { what: 'Estimated unique accounts that see your content.', good: '30-50% of followers reached per post is strong.', bad: 'Below 10% means algorithm limits distribution.', industry: 'Average organic reach: 10-35% of followers.' },
            'Fake Follower': { what: 'Estimated % of followers that may be bots or inactive.', good: '0-15% is normal for most accounts.', bad: 'Above 30% suggests significant quality issues.', industry: 'Average brand has 10-25% fake/inactive followers.' },
            'Audience Quality': { what: 'Assessment based on follower/following ratio.', good: 'Outstanding or Strong (ratio > 3:1).', bad: 'Follow-back strategy (ratio < 1:1).', industry: 'Top creators maintain 5:1+ ratio.' },
            'Post Frequency': { what: 'Avg posts per week over the scanned period.', good: '3-7 posts per week for steady growth.', bad: 'Below 2 posts/week - algorithm may deprioritize.', industry: '4-5x/week sees 30% more reach than 1-2x/week.' },
            'Avg Caption Length': { what: 'Average characters in post captions.', good: '150-300 chars - tells story without overwhelming.', bad: 'Below 50 chars misses opportunity. Above 500 causes drop-off.', industry: 'Captions with 150-300 chars get 20% more saves.' },
            'Hashtag Reach': { what: 'Estimated % of reach from hashtag discovery.', good: '20-40% from hashtags indicates good discovery.', bad: 'Below 10% means hashtag strategy needs work.', industry: '5-10 niche hashtags get 2x more reach.' },
            'Engagement Velocity': { what: 'Rate of change in engagement across recent posts.', good: 'Positive (+5-20%) indicates improving content.', bad: 'Negative (-5%+) means engagement is declining.', industry: 'Stable or slightly positive velocity is typical.' },
            'Saves Ratio': { what: '% of reach resulting from saves. High = evergreen.', good: 'Above 2% save rate indicates valuable content.', bad: 'Below 0.5% means content isnt saved.', industry: 'Tutorial posts get 3-5x more saves.' },
            'Social Search': { what: 'How discoverable profile is in Instagram search.', good: 'High (70+/100) - optimized for search.', bad: 'Low (below 40) - missing bio/link/name.', industry: 'Complete bio+link+name ranks 3x higher in search.' },
            'Skip Rate': { what: '% of viewers who skip within first 3 seconds.', good: 'Below 30% skip rate means strong hooks.', bad: 'Above 60% means viewers arent hooked early.', industry: 'Average skip rate: 40-55%.' },
            'Reels Completion': { what: '% of viewers who watch your Reels entirely.', good: 'Above 40% completion signals compelling content.', bad: 'Below 15% means Reels not retaining attention.', industry: 'Top Reels: 50-70% completion for 15-30s content.' },
            'Negative Signal': { what: 'Rate at which users hide, mute, or report your account.', good: 'Below 2% - very low negative feedback.', bad: 'Above 8% may trigger algorithmic shadowbanning.', industry: 'Average: 1-4% of impressions.' },
        };
    }

/* ── Motion preference ────────────────────────────────
   Single source of truth for whether the user asked the OS to reduce
   motion. When true, decorative animations are skipped so the app stays
   usable and comfortable for motion-sensitive users. */
P.prefersReducedMotion = function() {
        try {
            return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch { return false; }
    }


})();
