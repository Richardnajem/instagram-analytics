// SWA - charts Module
// Extends InstagramAnalytics.prototype
// Auto-generated from app.js refactoring

(function() {
'use strict';
const P = InstagramAnalytics.prototype;

P.renderAnalysisCharts = function(a, posts = []) {
        const { lc, gc } = this.chartTheme();
        const opts = title => this.chartOpts(title);

        // Content mix
        const cmEl = document.getElementById('contentMixChart');
        if (cmEl) {
            if (this.charts.contentMix) this.charts.contentMix.destroy();
            this.charts.contentMix = new Chart(cmEl, {
                type: 'doughnut',
                data: {
                    labels: ['Photos', 'Videos', 'Reels', 'Carousels'],
                    datasets: [{
                        data: [a.photos || 0, Math.max(0, a.videos - (a.reels || 0)), a.reels || 0, a.carousels || 0],
                        backgroundColor: ['rgba(124,58,237,.75)', 'rgba(236,72,153,.75)', 'rgba(6,182,212,.75)', 'rgba(250,204,21,.75)'],
                        borderColor: ['#7c3aed', '#ec4899', '#06b6d4', '#facc15'], borderWidth: 2
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '60%',
                    plugins: { legend: { labels: { color: lc } }, title: { display: true, text: 'Content Type Mix', color: lc, font: { size: 12, weight: '700' } } }
                }
            });
        }

        // Top posts
        const tpEl = document.getElementById('topPostsChart');
        if (tpEl && a.sortedByLikes.length) {
            if (this.charts.topPosts) this.charts.topPosts.destroy();
            const top = a.sortedByLikes.slice(0, 6);
            this.charts.topPosts = new Chart(tpEl, {
                type: 'bar',
                data: {
                    labels: top.map((p, i) => p.timestamp ? new Date(p.timestamp * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : `Post ${i + 1}`),
                    datasets: [{
                        label: 'Likes', data: top.map(p => p.likes || 0),
                        backgroundColor: top.map((_, i) => `hsla(${265 + i * 20},75%,58%,0.8)`), borderRadius: 8
                    },
                    {
                        label: 'Comments', data: top.map(p => p.comments || 0),
                        backgroundColor: top.map((_, i) => `hsla(${185 + i * 15},75%,55%,0.8)`), borderRadius: 8
                    }]
                },
                options: { ...opts('Top Posts Performance'), scales: { x: { stacked: false, ticks: { color: lc }, grid: { color: gc } }, y: { stacked: false, ticks: { color: lc }, grid: { color: gc } } } }
            });
        }

        // Engagement benchmark
        const egEl = document.getElementById('engagementGaugeChart');
        if (egEl) {
            if (this.charts.engGauge) this.charts.engGauge.destroy();
            const labels = ['<0.5%\nWeak', '0.5-1%\nBelow avg', '1-2%\nAverage', '2-3%\nGood', '3-6%\nStrong', '6%+\nViral'];
            const benchmark = [0.5, 0.5, 1, 1, 3, 99];
            const colors = ['#ef444480', '#f9731680', '#facc1580', '#60a5fa80', '#34d39980', '#10b98180'];
            this.charts.engGauge = new Chart(egEl, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        { label: 'Industry Benchmark', data: benchmark, backgroundColor: colors, borderRadius: 4 },
                        {
                            label: `Your Rate (${a.engRate.toFixed(2)}%)`,
                            data: labels.map((_, i) => {
                                const lo = [0, .5, 1, 2, 3, 6][i]; const hi = [.5, 1, 2, 3, 6, 99][i];
                                return a.engRate >= lo && a.engRate < hi ? Math.min(a.engRate - lo, hi - lo) : 0;
                            }),
                            backgroundColor: a.gradeColor + 'cc', borderRadius: 4
                        }
                    ]
                },
                options: { ...opts('Engagement vs Industry Benchmarks') }
            });
        }

        // Weekday heatmap
        const wdEl = document.getElementById('weekdayChart');
        if (wdEl && posts.length) {
            if (this.charts.weekday) this.charts.weekday.destroy();
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayCounts = Array(7).fill(0);
            const dayEng = Array(7).fill(0);
            posts.forEach(p => {
                if (!p.timestamp) return;
                const d = new Date(p.timestamp * 1000).getDay();
                dayCounts[d]++;
                dayEng[d] += (p.likes || 0) + (p.comments || 0);
            });
            this.charts.weekday = new Chart(wdEl, {
                type: 'bar',
                data: {
                    labels: days,
                    datasets: [
                        { label: 'Posts', data: dayCounts, backgroundColor: 'rgba(124,58,237,.7)', borderRadius: 6 },
                        { label: 'Engagement', data: dayEng, backgroundColor: 'rgba(6,182,212,.7)', borderRadius: 6 }
                    ]
                },
                options: opts('Best Posting Days')
            });
        }

        // Engagement mix (likes vs comments)
        const emEl = document.getElementById('engagementMixChart');
        if (emEl) {
            if (this.charts.engMix) this.charts.engMix.destroy();
            this.charts.engMix = new Chart(emEl, {
                type: 'doughnut',
                data: {
                    labels: ['Likes', 'Comments'],
                    datasets: [{
                        data: [a.totalLikes || 0, a.totalCmnts || 0],
                        backgroundColor: ['rgba(236,72,153,.8)', 'rgba(6,182,212,.8)'],
                        borderColor: ['#ec4899', '#06b6d4'], borderWidth: 2
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '55%',
                    plugins: { legend: { labels: { color: lc } }, title: { display: true, text: 'Likes vs Comments Mix', color: lc, font: { size: 12, weight: '700' } } }
                }
            });
        }
    }

P.renderMaps = function(profile, posts) {
        const empty = document.getElementById('mapsEmpty');
        const content = document.getElementById('mapsContent');
        if (!empty || !content) return;

        if (!posts.length || !profile) {
            empty.style.display = 'block';
            content.style.display = 'none';
            return;
        }

        empty.style.display = 'none';
        content.style.display = 'block';

        const { lc, gc } = this.chartTheme();
        const a = this.computeAnalysis(profile, posts);

        // Performance Radar Chart
        const radarEl = document.getElementById('performanceRadarChart');
        if (radarEl) {
            if (this.charts.performanceRadar) this.charts.performanceRadar.destroy();
            const maxVal = Math.max(a.engRate * 2, a.likeRate * 2, a.cmntRate * 2, (a.ffRatio || 1) * 5, a.videoRatio, a.profileScore / 10);
            this.charts.performanceRadar = new Chart(radarEl, {
                type: 'radar',
                data: {
                    labels: ['Engagement Rate', 'Like Rate', 'Comment Rate', 'FF Ratio', 'Video %', 'Profile Score'],
                    datasets: [{
                        label: `@${profile.username}`,
                        data: [
                            Math.min(a.engRate * 10, 100),
                            Math.min(a.likeRate * 10, 100),
                            Math.min(a.cmntRate * 10, 100),
                            Math.min((a.ffRatio || 0) * 20, 100),
                            a.videoRatio,
                            a.profileScore
                        ],
                        backgroundColor: 'rgba(124,58,237,.25)',
                        borderColor: '#7c3aed',
                        borderWidth: 2,
                        pointBackgroundColor: '#7c3aed',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: lc } },
                        title: { display: true, text: 'Performance Radar', color: lc, font: { size: 13, weight: '700' } }
                    },
                    scales: {
                        r: {
                            min: 0, max: 100,
                            ticks: { color: lc, backdropColor: 'transparent' },
                            grid: { color: gc },
                            angleLines: { color: gc }
                        }
                    }
                }
            });
        }

        // Posting Timeline Chart
        const timelineEl = document.getElementById('postingTimelineChart');
        if (timelineEl) {
            if (this.charts.postingTimeline) this.charts.postingTimeline.destroy();
            const sorted = [...posts].filter(p => p.timestamp).sort((a, b) => a.timestamp - b.timestamp);
            const labels = sorted.map((p, i) => p.timestamp
                ? new Date(p.timestamp * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' })
                : `#${i + 1}`);
            this.charts.postingTimeline = new Chart(timelineEl, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Likes',
                            data: sorted.map(p => p.likes || 0),
                            borderColor: '#ec4899',
                            backgroundColor: 'rgba(236,72,153,.1)',
                            fill: true, tension: .4,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Comments',
                            data: sorted.map(p => p.comments || 0),
                            borderColor: '#06b6d4',
                            backgroundColor: 'rgba(6,182,212,.1)',
                            fill: true, tension: .4,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: lc } },
                        title: { display: true, text: 'Posting Timeline', color: lc, font: { size: 13, weight: '700' } }
                    },
                    scales: {
                        x: { ticks: { color: lc }, grid: { color: gc } },
                        y: { beginAtZero: true, ticks: { color: lc }, grid: { color: gc }, position: 'left' },
                        y1: { beginAtZero: true, ticks: { color: lc }, grid: { drawOnChartArea: false }, position: 'right' }
                    }
                }
            });
        }
    }

P.renderPostCharts = function(posts) {
        const followers = this.currentProfile?.followers || 1;
        const labels = posts.map((p, i) => p.timestamp
            ? new Date(p.timestamp * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' })
            : `Post ${i + 1}`);
        const baseOpts = title => this.chartOpts(title);

        ['likesPerPostChart', 'commentsPerPostChart', 'engRatePerPostChart', 'likesCommentsScatterChart', 'postsTypeMixChart'].forEach(id => {
            if (this.charts[id]) { this.charts[id].destroy(); delete this.charts[id]; }
        });

        const lpc = document.getElementById('likesPerPostChart');
        if (lpc) {
            this.charts.likesPerPost = new Chart(lpc, {
                type: 'bar',
                data: {
                    labels, datasets: [{
                        label: 'Likes', data: posts.map(p => p.likes || 0),
                        backgroundColor: posts.map((_, i) => `hsla(${260 + i * 8}, 80%, 60%, 0.7)`), borderRadius: 8
                    }]
                },
                options: baseOpts('Likes Per Post')
            });
        }
        const cpc = document.getElementById('commentsPerPostChart');
        if (cpc) {
            this.charts.commentsPerPost = new Chart(cpc, {
                type: 'bar',
                data: {
                    labels, datasets: [{
                        label: 'Comments', data: posts.map(p => p.comments || 0),
                        backgroundColor: posts.map((_, i) => `hsla(${185 + i * 6}, 80%, 55%, 0.7)`), borderRadius: 8
                    }]
                },
                options: baseOpts('Comments Per Post')
            });
        }
        const erp = document.getElementById('engRatePerPostChart');
        if (erp) {
            this.charts.engRatePerPost = new Chart(erp, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Engagement Rate %',
                        data: posts.map(p => followers ? (((p.likes || 0) + (p.comments || 0)) / followers * 100) : 0),
                        borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.15)', fill: true, tension: .4
                    }]
                },
                options: baseOpts('Engagement Rate Per Post')
            });
        }
        const scatter = document.getElementById('likesCommentsScatterChart');
        if (scatter) {
            this.charts.likesCommentsScatter = new Chart(scatter, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Posts',
                        data: posts.map((p, i) => ({ x: p.likes || 0, y: p.comments || 0 })),
                        backgroundColor: 'rgba(236,72,153,.7)', pointRadius: 6
                    }]
                },
                options: {
                    ...baseOpts('Likes vs Comments'),
                    scales: {
                        x: { title: { display: true, text: 'Likes' }, beginAtZero: true },
                        y: { title: { display: true, text: 'Comments' }, beginAtZero: true }
                    }
                }
            });
        }
        const mix = document.getElementById('postsTypeMixChart');
        if (mix) {
            const counts = { photo: 0, video: 0, reel: 0, carousel: 0 };
            posts.forEach(p => { counts[p.postType || 'photo'] = (counts[p.postType || 'photo'] || 0) + 1; });
            this.charts.postsTypeMix = new Chart(mix, {
                type: 'pie',
                data: {
                    labels: ['Photos', 'Videos', 'Reels', 'Carousels'],
                    datasets: [{
                        data: [counts.photo, counts.video, counts.reel, counts.carousel],
                        backgroundColor: ['#7c3aed', '#ec4899', '#06b6d4', '#facc15']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });
        }
    }

P.renderCharts = function(latestPosts = []) {
        if (typeof Chart === 'undefined') return;
        this.destroyCharts(['engagement', 'growth', 'ratio', 'likes', 'engRateChart', 'postTypeChart']);
        const dark = document.documentElement.getAttribute('data-theme') !== 'light';
        const lc = dark ? '#94a3b8' : '#475569';
        const gc = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)';

        const baseOpts = title => ({
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: lc } }, title: { display: true, text: title, color: lc, font: { size: 13, weight: '700' } } },
            scales: { x: { ticks: { color: lc }, grid: { color: gc } }, y: { beginAtZero: true, ticks: { color: lc }, grid: { color: gc } } },
            animation: { duration: 900, easing: 'easeOutQuart' }
        });

        // 1. Followers over lookups
        const fentries = this.history.filter(h => h.metrics?.followers != null).slice(-20);
        const flabels = fentries.map(h => `@${h.username}`);
        const fdata = fentries.map(h => h.metrics.followers);
        const ec = document.getElementById('engagementChart');
        if (ec) this.charts.engagement = new Chart(ec, {
            type: 'line',
            data: {
                labels: flabels.length ? flabels : ['No data'], datasets: [{
                    label: 'Followers', data: fdata.length ? fdata : [0],
                    borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.12)', fill: true,
                    tension: .45, pointBackgroundColor: '#7c3aed', pointRadius: 4, pointHoverRadius: 7
                }]
            },
            options: baseOpts('Followers Over Lookups')
        });

        // 2. Posts over lookups
        const pentries = this.history.filter(h => h.metrics?.posts != null).slice(-14);
        const plabels = pentries.map(h => `@${h.username}`);
        const pdata = pentries.map(h => h.metrics.posts);
        const gc2 = document.getElementById('growthChart');
        if (gc2) this.charts.growth = new Chart(gc2, {
            type: 'bar',
            data: {
                labels: plabels.length ? plabels : ['No data'], datasets: [{
                    label: 'Posts', data: pdata.length ? pdata : [0],
                    backgroundColor: (ctx) => {
                        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 260);
                        g.addColorStop(0, 'rgba(124,58,237,.85)'); g.addColorStop(1, 'rgba(6,182,212,.35)'); return g;
                    }, borderRadius: 8
                }]
            },
            options: baseOpts('Posts Per Lookup')
        });

        // 3. Follower/Following ratio (doughnut)
        const rc = document.getElementById('ratioChart');
        if (rc && this.currentProfile) {
            const f1 = this.currentProfile.followers || 0;
            const f2 = this.currentProfile.following || 0;
            const existing = this.charts.ratio;
            if (existing) existing.destroy();
            this.charts.ratio = new Chart(rc, {
                type: 'doughnut',
                data: {
                    labels: ['Followers', 'Following'], datasets: [{
                        data: [f1, f2],
                        backgroundColor: ['rgba(124,58,237,.75)', 'rgba(6,182,212,.75)'],
                        borderColor: ['#7c3aed', '#06b6d4'], borderWidth: 2
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '65%',
                    plugins: { legend: { labels: { color: lc } }, title: { display: true, text: 'Followers vs Following', color: lc, font: { size: 13, weight: '700' } } }
                }
            });
        } else if (rc && !this.currentProfile) {
            const ctx = rc.getContext('2d');
            ctx.clearRect(0, 0, rc.width, rc.height);
            ctx.font = '14px Inter'; ctx.fillStyle = lc;
            ctx.textAlign = 'center';
            ctx.fillText('Fetch a profile to see ratio', rc.width / 2, rc.height / 2);
        }

        // 4. Recent post likes (line chart from latest posts)
        const lkc = document.getElementById('likesChart');
        if (lkc) {
            const posts = latestPosts.length ? latestPosts : (this.currentPosts || []);
            const existing = this.charts.likes;
            if (existing) existing.destroy();
            const lklabels = posts.map((p, i) => p.timestamp
                ? new Date(p.timestamp * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' })
                : `#${i + 1}`);
            const lkdata = posts.map(p => p.likes || 0);
            this.charts.likes = new Chart(lkc, {
                type: 'line',
                data: {
                    labels: lklabels.length ? lklabels : ['No data'],
                    datasets: [{
                        label: 'Likes', data: lkdata.length ? lkdata : [0],
                        borderColor: '#ec4899', backgroundColor: 'rgba(236,72,153,.12)', fill: true, tension: .4,
                        pointBackgroundColor: '#ec4899', pointRadius: 4, pointHoverRadius: 7
                    }]
                },
                options: baseOpts('Recent Post Likes')
            });
        }

        // 5. Engagement Rate Trend (new chart)
        const erc = document.getElementById('engRateChart');
        if (erc) {
            const posts = latestPosts.length ? latestPosts : (this.currentPosts || []);
            if (posts.length > 0) {
                this.charts.engRateChart = new Chart(erc, {
                    type: 'line',
                    data: {
                        labels: posts.map((p, i) => p.timestamp
                            ? new Date(p.timestamp * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' })
                            : `#${i + 1}`),
                        datasets: [{
                            label: 'Engagement Rate %',
                            data: posts.map(p => {
                                const f = this.currentProfile?.followers || 1;
                                return f ? (((p.likes || 0) + (p.comments || 0)) / f * 100) : 0;
                            }),
                            borderColor: '#facc15',
                            backgroundColor: 'rgba(250, 204, 21, .12)',
                            fill: true, tension: .4,
                            pointBackgroundColor: '#facc15',
                            pointRadius: 4,
                            pointHoverRadius: 7
                        }]
                    },
                    options: baseOpts('Engagement Rate Trend')
                });
            }
        }

        // 6. Post Type Breakdown (new chart)
        const ptc = document.getElementById('postTypeChart');
        if (ptc) {
            const posts = latestPosts.length ? latestPosts : (this.currentPosts || []);
            if (posts.length > 0) {
                const counts = { photo: 0, video: 0, reel: 0, carousel: 0 };
                posts.forEach(p => { counts[p.postType || 'photo'] = (counts[p.postType || 'photo'] || 0) + 1; });
                this.charts.postTypeChart = new Chart(ptc, {
                    type: 'doughnut',
                    data: {
                        labels: ['Photos', 'Videos', 'Reels', 'Carousels'],
                        datasets: [{
                            data: [counts.photo, counts.video, counts.reel, counts.carousel],
                            backgroundColor: ['rgba(124,58,237,.75)', 'rgba(236,72,153,.75)', 'rgba(6,182,212,.75)', 'rgba(250,204,21,.75)'],
                            borderColor: ['#7c3aed', '#ec4899', '#06b6d4', '#facc15'],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, cutout: '60%',
                        plugins: {
                            legend: { labels: { color: lc } },
                            title: { display: true, text: 'Post Type Breakdown', color: lc, font: { size: 13, weight: '700' } }
                        }
                    }
                });
            }
        }
    }

P.destroyCharts = function(ids) {
        ids.forEach(id => { if (this.charts[id]) { this.charts[id].destroy(); delete this.charts[id]; } });
    }


})();
