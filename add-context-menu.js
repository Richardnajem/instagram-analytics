const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');
const idx = c.lastIndexOf('window.app = new InstagramAnalytics');

const methods = `

    /* ── Context Menu ── */
    statExplanations() {
        return {
            'Followers': {
                what: 'Total number of accounts following this profile.',
                good: 'Steady growth rate of 1-5% per week is healthy.',
                bad: 'Stagnant or declining follower count over 30+ days.',
                industry: 'Avg growth varies by niche — 2-10% weekly for active accounts.'
            },
            'Engagement Rate': {
                what: '(Avg likes + avg comments) / followers x 100.',
                good: '2-6% for most tiers. Above 3% is strong.',
                bad: 'Below 1% indicates low audience resonance or fake followers.',
                industry: '<1K: 5-10% | 1-10K: 3-6% | 10-100K: 2-3% | 100K+: 1-2%'
            },
            'Account Health Status': {
                what: 'Composite score based on engagement, posting, profile, and benchmarks.',
                good: '75-100: Excellent | 55-74: Good',
                bad: '0-34: Critical — multiple areas need improvement.',
                industry: 'Composite benchmark derived from 1M+ Instagram accounts.'
            },
            'Growth Velocity': {
                what: 'Daily follower growth rate as percentage of total followers.',
                good: '0.15-0.5% per day (1-3.5% weekly).',
                bad: 'Below 0.05% per day means stagnation.',
                industry: '0.1-0.3% daily is healthy organic growth for most niches.'
            },
        };
    }

    setupContextMenu() {
        document.addEventListener('contextmenu', (e) => {
            const statEl = e.target.closest('.stat-value, .metric-value, .adv-metric-value');
            if (!statEl) { this.hideContextMenu(); return; }
            e.preventDefault();
            const exps = this.statExplanations();
            let matched = null, best = 0;
            const txt = (statEl.textContent || '').trim().toLowerCase();
            for (const key of Object.keys(exps)) {
                const kl = key.toLowerCase();
                let s = txt.includes(kl) || kl.includes(txt) ? 10 : 0;
                if (!s) {
                    const words = txt.split(/\\s+/).filter(w => w.length > 2);
                    for (const w of words) { if (kl.includes(w)) s += 2; }
                }
                if (s > best) { best = s; matched = key; }
            }
            const exp = matched && best >= 3 ? exps[matched] : null;
            if (!exp) {
                this.showContextMenu(e.clientX, e.clientY, {
                    what: (statEl.textContent || '').trim() || 'Statistic',
                    good: 'Hover for tooltip or right-click a labeled metric.',
                    bad: '', industry: 'Right-click any metric for detailed context.'
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
            + '<div class="ctx-header">' + title + '</div>'
            + '<div class="ctx-section"><div class="ctx-section-title">What</div><div class="ctx-text">' + (exp.what || 'KPI.') + '</div></div>'
            + (exp.good ? '<div class="ctx-section ctx-good"><div>Good Range</div><div>' + exp.good + '</div></div>' : '')
            + (exp.bad ? '<div class="ctx-section ctx-bad"><div>Bad Range</div><div>' + exp.bad + '</div></div>' : '')
            + (exp.industry ? '<div class="ctx-section ctx-industry"><div>Industry Avg</div><div>' + exp.industry + '</div></div>' : '')
            + '<div class="ctx-footer">Right-click for details</div>';
        menu.style.display = 'block';
        requestAnimationFrame(() => {
            const mw = 340, mh = Math.min(menu.offsetHeight || 400, window.innerHeight - 40);
            menu.style.left = Math.max(10, Math.min(x, window.innerWidth - mw - 10)) + 'px';
            menu.style.top = Math.max(10, Math.min(y, window.innerHeight - mh - 10)) + 'px';
        });
    }

    hideContextMenu() {
        const menu = document.getElementById('statContextMenu');
        if (menu) menu.style.display = 'none';
    }
`;

c = c.substring(0, idx) + methods + c.substring(idx);
fs.writeFileSync('app.js', c, 'utf8');
console.log('Context menu methods added successfully');
