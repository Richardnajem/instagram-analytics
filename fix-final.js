const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');

// 1. Find and replace the context menu methods with improved versions
const ctxStart = c.indexOf('/* ── Context Menu ── */');
const instIdx = c.lastIndexOf('window.app = new InstagramAnalytics');

if (ctxStart === -1) {
    console.log('Context menu header not found');
    process.exit(1);
}

const improvedContextMenu = `
    /* ── Context Menu ── */
    statExplanations() {
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
            'Posts Scanned': { what: 'Number of recent posts analyzed.', good: '12-24 posts gives meaningful analysis.', bad: 'Less than 6 posts may not represent performance.', industry: 'Standard analysis samples 12-24 recent posts.' },
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

    setupContextMenu() {
        document.addEventListener('contextmenu', (e) => {
            const statEl = e.target.closest('.stat-value, .metric-value, .profile-stat-val, .adv-dash-val, .adv-metric-value, .fake-stat-val, .stat-label-tooltip, .adv-metric-label, .adv-dash-label');
            if (!statEl) { this.hideContextMenu(); return; }
            e.preventDefault();
            const exps = this.statExplanations();
            let matched = null, best = 0;
            const parent = statEl.closest('.card, .adv-metric-card, .adv-dash-item, .profile-stat, .fake-stat, .metric-card, .stat-card');
            let statText = '';
            const lbl = parent?.querySelector('.stat-label, .stat-label-tooltip, .adv-metric-label, .adv-dash-label, .profile-stat-lbl, .fake-stat-lbl, .metric-card h4, .stat-note, .adv-dash-header');
            if (lbl) statText = lbl.textContent.trim();
            if (!statText || statText.length < 2) {
                statText = statEl.previousElementSibling?.textContent?.trim() || (statEl.textContent || '').trim() || '';
            }
            statText = statText.replace(/[:：]/g, '').trim().toLowerCase();
            for (const key of Object.keys(exps)) {
                const kl = key.toLowerCase();
                let s = statText.includes(kl) || kl.includes(statText) ? 12 : 0;
                if (!s) {
                    const words = statText.split(/\\s+/).filter(w => w.length > 2);
                    for (const w of words) { if (kl.includes(w)) s += 2; }
                }
                s += kl.length * 0.01;
                if (s > best) { best = s; matched = key; }
            }
            const exp = matched && best >= 4 ? exps[matched] : null;
            if (!exp) {
                this.showContextMenu(e.clientX, e.clientY, {
                    what: (statEl.textContent || '').trim() || 'Statistic value',
                    good: 'Hover over any stat for tooltip explanations.',
                    bad: '', industry: 'Right-click labeled metrics for detailed context.'
                }, 'Statistic');
            } else {
                this.showContextMenu(e.clientX, e.clientY, exp, matched);
            }
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#statContextMenu')) this.hideContextMenu();
        });
        document.addEventListener('scroll', () => this.hideContextMenu(), { passive: true });
        window.addEventListener('resize', () => this.hideContextMenu());
    }

    showContextMenu(x, y, exp, title) {
        let menu = document.getElementById('statContextMenu');
        if (!menu) {
            menu = document.createElement('div'); menu.id = 'statContextMenu';
            menu.className = 'stat-context-menu'; document.body.appendChild(menu);
        }
        menu.innerHTML = ''
            + '<div class="ctx-header">📊 ' + title + '</div>'
            + '<div class="ctx-section"><div class="ctx-section-title">💡 What is this?</div><div class="ctx-text">' + (exp.what || 'Key performance indicator.') + '</div></div>'
            + (exp.good ? '<div class="ctx-section"><div class="ctx-section-title ctx-good">✅ Good Range</div><div class="ctx-text ctx-good-text">' + exp.good + '</div></div>' : '')
            + (exp.bad ? '<div class="ctx-section"><div class="ctx-section-title ctx-bad">⚠️ Bad / Needs Attention</div><div class="ctx-text ctx-bad-text">' + exp.bad + '</div></div>' : '')
            + (exp.industry ? '<div class="ctx-section"><div class="ctx-section-title ctx-industry">📈 Industry Average / Benchmark</div><div class="ctx-text ctx-industry-text">' + exp.industry + '</div></div>' : '')
            + '<div class="ctx-footer">Right-click any stat for details</div>';
        menu.style.display = 'block';
        menu.style.opacity = '0';
        requestAnimationFrame(() => {
            const mw = 340, mh = Math.min(menu.offsetHeight || 400, window.innerHeight - 40);
            menu.style.left = Math.max(10, Math.min(x, window.innerWidth - mw - 10)) + 'px';
            menu.style.top = Math.max(10, Math.min(y, window.innerHeight - mh - 10)) + 'px';
            menu.style.opacity = '1';
            menu.style.transform = 'scale(1)';
        });
    }

    hideContextMenu() {
        const menu = document.getElementById('statContextMenu');
        if (menu) { menu.style.display = 'none'; menu.style.opacity = '0'; }
    }
`;

// Replace from ctxStart to instIdx
const beforeCtx = c.substring(0, ctxStart);
const afterInst = c.substring(instIdx);
const newFile = beforeCtx + improvedContextMenu + '\n' + afterInst;

fs.writeFileSync('app.js', newFile, 'utf8');
console.log('Context menu methods updated with improved versions');
