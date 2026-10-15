const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');

// 1. Fix renderPostCharts call - guard against hidden parent page
const old1 = `        this.renderPostCharts(posts);
    }

    openPost(url) {
        try {
            const { shell } = require('electron');
            shell.openExternal(url);
        } catch {
            window.open(url, '_blank');
        }
    }`;

const new1 = `        // Only render post charts if the posts page is currently active (to avoid zero-dimension canvas errors)
        const postsPage = document.getElementById('posts');
        if (postsPage && postsPage.classList.contains('active')) {
            this.renderPostCharts(posts);
        } else {
            this._postChartsPending = true;
        }
    }

    openPost(url) {
        try {
            const { shell } = require('electron');
            shell.openExternal(url);
        } catch {
            window.open(url, '_blank');
        }
    }`;

if (!c.includes(old1)) {
    console.log('ERROR: Pattern 1 not found!');
    process.exit(1);
}
c = c.replace(old1, new1);
console.log('Edit 1 applied ✓');

// 2. Fix generatePostSuggestions dedup logic
const old2 = `        for (const tip of pool) {
            if (tips.length >= 6) break;
            if (!tips.includes(tip)) tips.push(tip);
        }
        // Ensure minimum 4 tips always
        while (tips.length < 4) {
            const idx = tips.length % pool.length;
            tips.push(pool[idx]);
        }
        return tips.slice(0, 6);`;

const new2 = `        const usedTips = new Set(tips);
        for (const tip of pool) {
            if (tips.length >= 6) break;
            if (!usedTips.has(tip)) {
                tips.push(tip);
                usedTips.add(tip);
            }
        }
        if (tips.length < 4) {
            for (const tip of pool) {
                if (tips.length >= 4) break;
                if (!usedTips.has(tip)) {
                    tips.push(tip);
                    usedTips.add(tip);
                }
            }
        }
        return tips.slice(0, 6);`;

if (!c.includes(old2)) {
    console.log('ERROR: Pattern 2 not found!');
    process.exit(1);
}
c = c.replace(old2, new2);
console.log('Edit 2 applied ✓');

// 3. Fix navigateTo to add deferred post chart rendering
const old3 = `            if (pageId === 'analysis' && this.currentProfile) {
                requestAnimationFrame(() => this.renderMarketingAnalysis(this.currentProfile, this.currentPosts));
            }
        };`;

const new3 = `            if (pageId === 'analysis' && this.currentProfile) {
                requestAnimationFrame(() => this.renderMarketingAnalysis(this.currentProfile, this.currentPosts));
            }
            // Deferred post chart rendering: render post charts when Posts page becomes visible
            if (pageId === 'posts' && this.currentPosts?.length && this._postChartsPending) {
                this._postChartsPending = false;
                requestAnimationFrame(() => this.renderPostCharts(this.currentPosts));
            }
        };`;

if (!c.includes(old3)) {
    console.log('ERROR: Pattern 3 not found!');
    process.exit(1);
}
c = c.replace(old3, new3);
console.log('Edit 3 applied ✓');

fs.writeFileSync('app.js', c, 'utf8');
console.log('All 3 edits applied successfully!');
