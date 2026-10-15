// SWA - context-menu Module
// Extends InstagramAnalytics.prototype
// Auto-generated from app.js refactoring

(function() {
'use strict';
const P = InstagramAnalytics.prototype;

P.setupContextMenu = function() {
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
                    const words = statText.split(/\s+/).filter(w => w.length > 2);
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

P.showContextMenu = function(x, y, exp, title) {
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

P.hideContextMenu = function() {
        const menu = document.getElementById('statContextMenu');
        if (menu) { menu.style.display = 'none'; menu.style.opacity = '0'; }
    }


})();
