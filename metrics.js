// SWA - metrics Module
// Extends InstagramAnalytics.prototype
// Auto-generated from app.js refactoring

(function() {
'use strict';
const P = InstagramAnalytics.prototype;

P.computeAdvancedMetrics = function(profile, posts, analysis = null) {
        if (!analysis) analysis = this.computeAnalysis(profile, posts);
        const followers = profile.followers || 0;
        const following = profile.following || 0;
        const scanned = posts.length;

        /* Helper: compute a value + tier label + color */
        const score = (val, low, mid, high, labels) => {
            if (val >= high) return { value: val, tier: labels[2] || 'Excellent', color: '#10b981' };
            if (val >= mid) return { value: val, tier: labels[1] || 'Average', color: '#facc15' };
            return { value: val, tier: labels[0] || 'Needs Work', color: '#ef4444' };
        };

        const fmt = n => typeof n === 'number' ? n : 0;
        const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
        const totalCmnts = posts.reduce((s, p) => s + (p.comments || 0), 0);
        const avgLikes = scanned ? totalLikes / scanned : 0;
        const avgCmnts = scanned ? totalCmnts / scanned : 0;
        const engRate = analysis.engRate || 0;
        const estReach = followers && engRate ? Math.round(followers * (engRate / 100)) : Math.round(followers * 0.4);
        const estImpressions = estReach ? Math.round(estReach * 1.5) : 0;
        const erPerPost = posts.map(p => followers ? (((p.likes || 0) + (p.comments || 0)) / followers * 100) : 0);

        const sortedPosts = [...posts].filter(p => p.timestamp).sort((a, b) => a.timestamp - b.timestamp);
        const stamps = sortedPosts.map(p => p.timestamp);
        const spanDays = stamps.length > 1 ? Math.max(1, (stamps[stamps.length - 1] - stamps[0]) / 86400) : 7;
        const spanWeeks = spanDays / 7;

        // ── 1. Sends Per Reach (DM Shares) ──
        // Estimated: ~2-8% of engagement volume are DM shares.
        // Deterministic: DM volume scales with real CTA-heavy content (posts that
        // invite DMs/comments generate more share volume).
        const ctaCount = posts.filter(p => /\b(link in bio|comment|dm|shop|buy|click)\b/i.test(p.caption || '')).length;
        const ctaRatio = scanned ? ctaCount / scanned : 0;
        const estDmShares = Math.round((totalLikes + totalCmnts) * 0.03 * (0.8 + ctaRatio * 0.5));
        const sendsPerReach = estReach > 0 ? (estDmShares / estReach) * 100 : 0;
        const sendsPerReachScore = score(sendsPerReach, 0.1, 0.3, 0.8, ['Low DM Share', 'Moderate DM Share', 'High DM Share']);

        // ── 2. Saves-to-Reach Ratio ──
        // Estimated: saves are ~5-20% of likes.
        // Deterministic: saves scale with real carousel share (carousels drive saves).
        const carouselCount = posts.filter(p => p.postType === 'carousel').length;
        const carouselRatio = scanned ? carouselCount / scanned : 0;
        const estSaves = Math.round(totalLikes * 0.12 * (0.8 + carouselRatio * 0.4));
        const savesToReachRatio = estReach > 0 ? (estSaves / estReach) * 100 : 0;

        // ── 3. 3-Second Skip Rate ──
        // Estimated from video content engagement; higher comments = better retention
        const videoPosts = posts.filter(p => p.isVideo || p.postType === 'reel' || p.postType === 'video');
        const videoEngRatio = videoPosts.length > 0
            ? videoPosts.reduce((s, p) => s + ((p.likes || 0) + (p.comments || 0)), 0) / (videoPosts.length * Math.max(1, followers * 0.01))
            : 0.5;
        const skipRate3s = Math.max(0, Math.min(95, 100 - (videoEngRatio * 60 + 20)));

        // ── 4. Average Watch Time (seconds) ──
        // Estimated: better engagement = longer watch time; reels avg 15-45s
        const avgWatchTime = videoPosts.length > 0
            ? Math.round((15 + videoEngRatio * 30) * 10) / 10
            : 0;

        // ── 5. Reels Completion Rate ──
        const reels = posts.filter(p => p.postType === 'reel');
        const reelEngAvg = reels.length > 0
            ? reels.reduce((s, p) => s + ((p.likes || 0) + (p.comments || 0)), 0) / reels.length
            : 0;
        const reelsCompletionRate = reels.length > 0
            ? Math.max(0, Math.min(95, (reelEngAvg / Math.max(1, followers * 0.005)) * 40 + 15))
            : 0;

        // ── 6. Engagement Velocity ──
        // Rate of change in engagement over time
        let engagementVelocity = 0;
        if (sortedPosts.length >= 4) {
            const mid = Math.floor(sortedPosts.length / 2);
            const firstHalf = sortedPosts.slice(0, mid);
            const secondHalf = sortedPosts.slice(mid);
            const avgFirst = firstHalf.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0), 0) / firstHalf.length;
            const avgSecond = secondHalf.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0), 0) / secondHalf.length;
            engagementVelocity = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;
        }
        const evScore = score(engagementVelocity, -5, 5, 20, ['Declining', 'Stable', 'Growing']);

        // ── 7. Non-Follower Reach Percentage ──
        // Estimated: based on engagement rate vs follower count
        // Lower ER with many followers = more non-follower impressions.
        // Deterministic: discovery content (hashtags, videos) boosts non-follower reach.
        const hashtagRatio = scanned ? posts.filter(p => (p.caption || '').includes('#')).length / scanned : 0;
        const videoShare = scanned ? videoPosts.length / scanned : 0;
        const discoveryBoost = Math.min(30, hashtagRatio * 15 + videoShare * 10);
        let nonFollowerReachPct;
        if (followers < 1000) nonFollowerReachPct = 30 + discoveryBoost;
        else if (followers < 10000) nonFollowerReachPct = 25 + discoveryBoost;
        else if (followers < 100000) nonFollowerReachPct = 35 + discoveryBoost;
        else nonFollowerReachPct = 45 + discoveryBoost;
        nonFollowerReachPct = Math.min(85, Math.round(nonFollowerReachPct * 10) / 10);

        // ── 8. Profile Visit Conversion Rate ──
        // Estimated: visits as % of reach.
        // Deterministic: complete profiles + healthy content convert reach into visits.
        const completenessBoost = (profile.bio?.trim() ? 1 : 0) + (profile.profilePicUrl || profile._profilePicData ? 1 : 0) + (profile.isVerified ? 1 : 0);
        const profileVisitRate = Math.max(0.1, Math.min(15, (1 + completenessBoost * 0.5) * (1 + engRate * 0.5)));

        // ── 9. Follower Growth Velocity (from history) ──
        let followerGrowthVelocity = 0;
        if (this.history && this.history.length >= 2) {
            const entries = this.history.filter(h => h.metrics?.followers != null).slice(-10);
            if (entries.length >= 2) {
                const first = entries[entries.length - 1].metrics.followers;
                const last = entries[0].metrics.followers;
                const daysDiff = (new Date(entries[0].timestamp) - new Date(entries[entries.length - 1].timestamp)) / 86400000;
                if (daysDiff > 0 && first > 0) {
                    followerGrowthVelocity = ((last - first) / first / daysDiff) * 100;
                }
            }
        }
        // If no history, estimate from follower count and engagement.
        // Deterministic: real engagement trend proxies growth when no history exists.
        if (followerGrowthVelocity === 0 && followers > 0) {
            followerGrowthVelocity = engRate * 0.3 + Math.max(-1.5, Math.min(2, engagementVelocity / 10));
        }
        const fgvScore = score(followerGrowthVelocity, 0.01, 0.05, 0.15, ['Slow Growth', 'Moderate Growth', 'Rapid Growth']);

        // ── 10. Reach Rate (Reach / Impressions) ──
        const reachRate = estImpressions > 0 ? (estReach / estImpressions) * 100 : 0;

        // ── 11. Social Search Visibility ──
        // Based on profile completeness (bio, link, verified, name, avatar)
        let socialSearchScore = 0;
        if (profile.bio?.trim()) socialSearchScore += 20;
        if (profile.externalUrl) socialSearchScore += 15;
        if (profile.fullName?.trim()) socialSearchScore += 15;
        if (profile.profilePicUrl) socialSearchScore += 10;
        if (profile.isVerified) socialSearchScore += 15;
        socialSearchScore += Math.min(25, Math.round((followers / 1000) * 2));
        socialSearchScore = Math.min(100, socialSearchScore);

        // ── 12. Follow-Through Action Rate ──
        // Actions (comments + saves + shares) / reach
        const totalActions = totalLikes * 1 + totalCmnts * 2 + estSaves * 3 + estDmShares * 2;
        const followThroughRate = estReach > 0 ? (totalActions / estReach) * 100 : 0;

        // ── 13. Engagement Rate by Reach (ERR) ──
        const err = estReach > 0 ? ((totalLikes + totalCmnts) / scanned / estReach) * 100 : 0;

        // ── 14. Comment Quality Index ──
        // Based on comment-to-like ratio and hashtag engagement
        const commentLikeRatio = totalLikes > 0 ? totalCmnts / totalLikes : 0;
        const commentQualityIndex = Math.min(100, Math.round(commentLikeRatio * 200 * 10)) / 10;

        // ── 15. Story Completion Rate ──
        // Estimated from engagement patterns
        const storyCompletionRate = Math.round((55 + engRate * 5 + (profile.isVerified ? 10 : 0)) * 10) / 10;

        // ── 16. Story Sticker Interaction Rate ──
        const storyStickerRate = Math.round((2 + engRate * 1.5) * 10) / 10;

        // ── 17. Inbox Response Velocity (minutes) ──
        // Estimated based on engagement and account activity.
        // Deterministic: CTA-heavy accounts are treated as more responsive.
        // Floored at 0 so high-engagement accounts never show negative minutes.
        const inboxResponseVelocity = Math.round(Math.max(0, 120 - engRate * 15 + 30 * (1 - ctaRatio)) * 10) / 10;

        // ── 18. Carousel Slide-Through Rate ──
        const carousels = posts.filter(p => p.postType === 'carousel');
        const carouselSlideThrough = carousels.length > 0
            ? Math.round((60 + engRate * 3 + carousels.reduce((s, p) => s + (p.carouselCount || 3), 0) / carousels.length * 2) * 10) / 10
            : 0;

        // ── 19. Replay/Rewatch Rate ──
        const replayRate = videoPosts.length > 0
            ? Math.round((5 + videoEngRatio * 15) * 10) / 10
            : 0;

        // ── 20. Account Health Status (Multi-Factor) ──
        // Determine expected ER based on follower tier (industry benchmarks 2025-2026)
        let expectedER;
        if (followers < 1000) expectedER = 8;
        else if (followers < 5000) expectedER = 6.5;
        else if (followers < 10000) expectedER = 5;
        else if (followers < 50000) expectedER = 3.5;
        else if (followers < 100000) expectedER = 2.5;
        else if (followers < 500000) expectedER = 2;
        else if (followers < 1000000) expectedER = 1.5;
        else expectedER = 1;

        // Platform-specific adjustment
        const platformName = this.currentPlatform || 'instagram';
        const platformERAdjust = {
            instagram: 1.0,
            tiktok: 1.6,
            snapchat: 2.0,
            facebook: 0.7,
            threads: 1.2,
            x: 0.5,
        }[platformName] || 1.0;
        expectedER = expectedER * platformERAdjust;

        // ── Multi-factor health scoring (deterministic, no Math.random) ──

        // Factor 1: ER vs Benchmark (0-30 pts)
        const erRatioVsExpected = engRate / Math.max(0.01, expectedER);
        let erScore = 0;
        if (erRatioVsExpected >= 1.2) erScore = 30;
        else if (erRatioVsExpected >= 1.0) erScore = 28;
        else if (erRatioVsExpected >= 0.8) erScore = 22;
        else if (erRatioVsExpected >= 0.6) erScore = 16;
        else if (erRatioVsExpected >= 0.4) erScore = 10;
        else if (erRatioVsExpected >= 0.2) erScore = 5;
        else erScore = 0;

        // Factor 2: Follower/Following Ratio (0-15 pts)
        const ffRatioVal = analysis.ffRatio || 0;
        let ffScore = 0;
        if (ffRatioVal >= 10) ffScore = 15;
        else if (ffRatioVal >= 5) ffScore = 14;
        else if (ffRatioVal >= 3) ffScore = 12;
        else if (ffRatioVal >= 1.5) ffScore = 9;
        else if (ffRatioVal >= 1) ffScore = 6;
        else if (ffRatioVal >= 0.5) ffScore = 3;
        else ffScore = 1;

        // Factor 3: Posting Consistency (0-12 pts)
        let freqScore = 0;
        if (analysis.postsPerWeek) {
            const ppw = parseFloat(analysis.postsPerWeek);
            if (ppw >= 5) freqScore = 12;
            else if (ppw >= 3) freqScore = 11;
            else if (ppw >= 2) freqScore = 9;
            else if (ppw >= 1) freqScore = 5;
            else freqScore = 2;
        } else {
            freqScore = 3; // Neutral if unknown
        }

        // Factor 4: Content Diversity (0-10 pts)
        const hasPhotos = analysis.photos > 0;
        const hasVideos = analysis.videos > 0;
        const hasCarousels = analysis.carousels > 0;
        let diversity = 0;
        if (hasPhotos) diversity++;
        if (hasVideos) diversity++;
        if (hasCarousels) diversity++;
        let diversityScore = diversity === 3 ? 10 : diversity === 2 ? 8 : diversity === 1 ? 4 : 0;

        // Factor 5: Video/Reel Adoption (0-8 pts)
        let videoScore = 0;
        if (analysis.videoRatio >= 50) videoScore = 8;
        else if (analysis.videoRatio >= 35) videoScore = 7;
        else if (analysis.videoRatio >= 25) videoScore = 6;
        else if (analysis.videoRatio >= 15) videoScore = 4;
        else if (analysis.videoRatio > 0) videoScore = 2;

        // Factor 6: Engagement Consistency (0-10 pts)
        // Uses per-post ER variation as a consistency metric
        let consistencyScore = 5; // default
        if (scanned >= 3) {
            const erValues = posts.map(p => followers ? (((p.likes || 0) + (p.comments || 0)) / followers * 100) : 0);
            const meanEr = erValues.reduce((s, v) => s + v, 0) / erValues.length;
            if (meanEr > 0) {
                const variance = erValues.reduce((s, v) => s + Math.pow(v - meanEr, 2), 0) / erValues.length;
                const stdDev = Math.sqrt(variance);
                const cv = stdDev / meanEr; // Coefficient of variation
                if (cv < 0.5) consistencyScore = 10;      // Very consistent
                else if (cv < 0.8) consistencyScore = 8;  // Consistent
                else if (cv < 1.2) consistencyScore = 6;  // Moderate
                else if (cv < 1.8) consistencyScore = 4;  // Inconsistent
                else consistencyScore = 2;                 // Very inconsistent
            }
        }

        // Factor 7: Profile Completeness (0-15 pts)
        let profileScore_factor = 0;
        if (profile.bio?.trim()) profileScore_factor += 4;
        if (profile.externalUrl) profileScore_factor += 3;
        if (profile.fullName?.trim()) profileScore_factor += 2;
        if (profile.isVerified) profileScore_factor += 4;
        if (profile.profilePicUrl || profile._profilePicData) profileScore_factor += 2;

        // Composite health score
        let healthScore = 10 + erScore + ffScore + freqScore + diversityScore + videoScore + consistencyScore + profileScore_factor;

        // Penalty: very low engagement (< 0.5%) even with lots of followers
        if (engRate < 0.5 && followers > 1000) healthScore = Math.max(healthScore - 15, 5);
        // Bonus: verified account with good engagement
        if (profile.isVerified && erRatioVsExpected >= 0.8) healthScore += 5;
        // Penalty: FF ratio extremely low indicates fake followers
        if (ffRatioVal < 0.3 && followers > 500) healthScore = Math.max(healthScore - 10, 3);

        healthScore = Math.min(100, Math.max(0, healthScore));
        let healthStatus, healthColor;
        if (healthScore >= 80) { healthStatus = 'Excellent'; healthColor = '#10b981'; }
        else if (healthScore >= 65) { healthStatus = 'Good'; healthColor = '#34d399'; }
        else if (healthScore >= 50) { healthStatus = 'Fair'; healthColor = '#facc15'; }
        else if (healthScore >= 30) { healthStatus = 'Needs Work'; healthColor = '#f97316'; }
        else { healthStatus = 'Critical'; healthColor = '#ef4444'; }

        // ── 21. 3-Second View Retention Rate ──
        const retention3s = Math.max(0, Math.min(98, 100 - skipRate3s));

        // ── 22. Drop-Off Point Timestamp (seconds) ──
        // Deterministic: lower skip rate → viewers watch further → later drop-off.
        const dropOffPoint = avgWatchTime > 0 ? Math.round(avgWatchTime * (0.3 + (1 - skipRate3s / 100) * 0.4)) : 0;

        // ── 23. Audio Attribution Velocity ──
        // Accounts with more reach tend to have more audio reuse
        const audioAttribution = Math.round((estReach / Math.max(1, followers)) * 50 * 10) / 10;

        // ── 24. Profile Action Click-Through Rate ──
        const profileActionCTR = Math.round((1.5 + engRate * 0.8) * 10) / 10;

        // ── 25. Non-Follower Impressions Ratio ──
        const nonFollowerImpRatio = Math.round((nonFollowerReachPct * 0.85 + 10) * 10) / 10;

        // ── 26. Story Tap-Forward Velocity (tap/sec) ──
        // Deterministic: video-first accounts tap forward more (from real video share).
        const storyTapForward = Math.round((0.3 + videoShare * 0.5) * 100) / 100;

        // ── 27. Story Back-Tap Rate ──
        // Deterministic: back-taps scale with real engagement rate.
        // Clamped to the metric's historical range (2-10%).
        const storyBackTap = Math.round(Math.min(10, 2 + engRate * 1.5) * 10) / 10;

        // ── 28. Story Exit Abandonment Rate ──
        const storyExitRate = Math.round((100 - storyCompletionRate) * 10) / 10;

        // ── 29. Live Viewer Peak Retention ──
        const livePeakRetention = followers > 0
            ? Math.round(followers * (0.002 + engRate * 0.002) * 10) / 10
            : 0;

        // ── 30. Live Average Watch Duration (minutes) ──
        const liveAvgWatch = Math.round((3 + engRate * 1.5) * 10) / 10;

        // ── 31. DM Automation Open Rate ──
        const dmAutoOpenRate = Math.round((30 + engRate * 5 + (profile.externalUrl ? 10 : 0)) * 10) / 10;

        // ── 32. Lead Magnet Form Conversion Rate ──
        const leadMagnetConv = profile.externalUrl ? Math.round((2 + engRate * 1.5) * 10) / 10 : 0;

        // ── 33. Carousel Slide-Three Drop-Off ──
        const carouselSlide3Dropoff = carousels.length > 0
            ? Math.round((35 - engRate * 2 + carouselRatio * 10) * 10) / 10
            : 0;

        // ── 34. Content-Specific Follower Attribution ──
        // Which post types drive the most followers
        const postTypeFollowers = {
            photo: Math.round(followers * (analysis.photos && scanned ? (analysis.photos / scanned) * 0.25 : 0.1)),
            video: Math.round(followers * (analysis.videos && scanned ? (analysis.videos / scanned) * 0.3 : 0.1)),
            reel: Math.round(followers * (analysis.reels && scanned ? (analysis.reels / scanned) * 0.45 : 0.1)),
            carousel: Math.round(followers * (analysis.carousels && scanned ? (analysis.carousels / scanned) * 0.2 : 0.1)),
        };
        // Find the top content type for follower attribution
        const bestAttribution = Object.entries(postTypeFollowers).sort((a, b) => b[1] - a[1])[0];
        const attributionLabels = { photo: 'Photos', video: 'Videos', reel: 'Reels', carousel: 'Carousels' };

        // ── 35. Hashtag Reach Contribution ──
        const hashtagPosts = posts.filter(p => (p.caption || '').includes('#')).length;
        const hashtagReachPct = scanned > 0 && hashtagPosts > 0
            ? Math.round(((hashtagPosts / scanned) * 40 + engRate * 2) * 10) / 10
            : 0;

        // ── 36. Explore Page Discovery Yield ──
        const exploreYield = Math.round((engRate * 3 + (profile.isVerified ? 5 : 0) + 2) * 10) / 10;

        // ── 37. Negative Signal Frequency (Hides/Mutes) ──
        // Estimated from engagement patterns
        // Deterministic: negative signals fall as real engagement rises.
        let negativeSignalFreq;
        if (engRate < 0.5) negativeSignalFreq = Math.round((8 + Math.min(10, (0.5 - engRate) * 20)) * 10) / 10;
        else if (engRate < 1) negativeSignalFreq = Math.round((3 + Math.min(5, (1 - engRate) * 10)) * 10) / 10;
        else if (engRate < 3) negativeSignalFreq = Math.round((1 + Math.min(3, (3 - engRate) * 1.5)) * 10) / 10;
        else negativeSignalFreq = Math.round((0.5 + Math.max(0, Math.min(1, 3 - engRate) * 0.25)) * 10) / 10;

        // ── 38. External Link Tap Velocity ──
        const linkTapVelocity = profile.externalUrl ? Math.round((2 + engRate * 0.5) * 10) / 10 : 0;

        // ── 39. Original Audio Reuse Frequency ──
        // Deterministic: audio reuse scales with reel volume + real video engagement.
        const audioReuseFreq = reels.length > 0
            ? Math.round(Math.max(0, (reels.length * (engRate * 2 + Math.min(5, (videoEngRatio || 0) * 15))) * 10) / 10)
            : 0;

        // ── 40. Notification-Driven Open Velocity ──
        const notifOpenRate = Math.round((10 + engRate * 3 + (profile.isVerified ? 8 : 0)) * 10) / 10;

        return {
            // 1-5: Reach & Saves
            sendsPerReach: sendsPerReach.toFixed(2) + '%',
            sendsPerReachScore,
            estDmShares,
            savesToReachRatio: savesToReachRatio.toFixed(2) + '%',
            estSaves,
            skipRate3s: skipRate3s.toFixed(1) + '%',
            avgWatchTime: avgWatchTime.toFixed(1) + 's',
            avgWatchTimeRaw: avgWatchTime,
            reelsCompletionRate: reelsCompletionRate.toFixed(1) + '%',

            // 6-10: Growth & Reach
            engagementVelocity: engagementVelocity.toFixed(2) + '%',
            evScore,
            nonFollowerReachPct: nonFollowerReachPct.toFixed(1) + '%',
            profileVisitRate: profileVisitRate.toFixed(2) + '%',
            followerGrowthVelocity: followerGrowthVelocity.toFixed(3) + '%/day',
            fgvScore,
            reachRate: reachRate.toFixed(1) + '%',

            // 11-15: Discovery & Engagement
            socialSearchScore,
            socialSearchVisibility: socialSearchScore >= 70 ? 'High' : socialSearchScore >= 40 ? 'Medium' : 'Low',
            followThroughRate: followThroughRate.toFixed(2) + '%',
            err: err.toFixed(2) + '%',
            commentQualityIndex: commentQualityIndex.toFixed(1),
            storyCompletionRate: storyCompletionRate.toFixed(1) + '%',

            // 16-20: Stories & Response
            storyStickerRate: storyStickerRate.toFixed(1) + '%',
            inboxResponseVelocity: inboxResponseVelocity.toFixed(0) + ' min',
            carouselSlideThrough: carouselSlideThrough.toFixed(1) + '%',
            replayRate: replayRate.toFixed(1) + '%',
            healthScore,
            healthStatus,
            healthColor,

            // 21-25: Retention & CTAs
            retention3s: retention3s.toFixed(1) + '%',
            dropOffPoint: dropOffPoint.toFixed(0) + 's',
            audioAttribution: audioAttribution.toFixed(1),
            profileActionCTR: profileActionCTR.toFixed(1) + '%',
            nonFollowerImpRatio: nonFollowerImpRatio.toFixed(1) + '%',

            // 26-30: Stories Deep & Live
            storyTapForward: storyTapForward.toFixed(2) + '/s',
            storyBackTap: storyBackTap.toFixed(1) + '%',
            storyExitRate: storyExitRate.toFixed(1) + '%',
            livePeakRetention: livePeakRetention.toFixed(0),
            liveAvgWatch: liveAvgWatch.toFixed(1) + ' min',

            // 31-35: Conversion & Attribution
            dmAutoOpenRate: dmAutoOpenRate.toFixed(1) + '%',
            leadMagnetConv: leadMagnetConv.toFixed(1) + '%',
            carouselSlide3Dropoff: carouselSlide3Dropoff.toFixed(1) + '%',
            bestAttributionType: attributionLabels[bestAttribution[0]] || 'Reels',
            bestAttributionCount: this.fmt(bestAttribution[1]),
            hashtagReachPct: hashtagReachPct.toFixed(1) + '%',

            // 36-40: Discovery & Signals
            exploreYield: exploreYield.toFixed(1) + '%',
            negativeSignalFreq: negativeSignalFreq.toFixed(1) + '%',
            linkTapVelocity: linkTapVelocity.toFixed(1) + '%',
            audioReuseFreq: audioReuseFreq.toFixed(0),
            notifOpenRate: notifOpenRate.toFixed(1) + '%',

            // Raw values for charts
            _avgWatchTimeRaw: avgWatchTime,
            _skipRateRaw: skipRate3s,
            _retention3sRaw: retention3s,
            _replayRateRaw: replayRate,
            _engagementVelocityRaw: engagementVelocity,
            _nonFollowerReachRaw: nonFollowerReachPct,
            _nonFollowerImpRaw: nonFollowerImpRatio,
            _hashtagReachRaw: hashtagReachPct,
            _negativeSignalRaw: negativeSignalFreq,
            _storyCompletionRaw: storyCompletionRate,
            _carouselSlideThroughRaw: carouselSlideThrough,
            _carouselSlide3DropoffRaw: carouselSlide3Dropoff,
        };
    }

P.renderAdvancedMetricsCards = function(advanced) {
        if (!advanced) return;
        const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html ?? '—'; };
        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? '—'; };

        // Helper: metric pill
        // `est` marks a MODELLED value (derived from real signals, but not the
        // platform's own number). Measured values — likes, comments, plays,
        // post counts, dates — carry no tag. The distinction is shown in the UI
        // so an estimate is never read as a measurement.
        const metricPill = (label, value, tier, color, est) => `
            <div class="adv-metric-card">
                <div class="adv-metric-label">${label}${est ? ' <span style="font-size:.6rem;opacity:.6;border:1px solid currentColor;border-radius:4px;padding:0 3px;vertical-align:middle" title="Modelled from your real metrics — not reported by Instagram">est</span>' : ''}</div>
                <div class="adv-metric-value">${value}</div>
                ${tier ? `<div class="adv-metric-tier" style="color:${color || '#94a3b8'}">${tier}</div>` : ''}
            </div>`;

        const statusPill = (label, value, color, sub) => `
            <div class="adv-metric-card" style="border-left:3px solid ${color || '#7c3aed'}">
                <div class="adv-metric-label">${label}</div>
                <div class="adv-metric-value" style="color:${color || 'var(--text-primary)'}">${value}</div>
                ${sub ? `<div class="adv-metric-sub">${sub}</div>` : ''}
            </div>`;

        // Account Health - prominent
        set('advancedHealthStatus', statusPill(
            'Account Health Status',
            advanced.healthStatus ?? '—',
            advanced.healthColor ?? '#7c3aed',
            `Score: ${advanced.healthScore ?? 0}/100`
        ));

        // Growth velocity
        set('advancedGrowthVelocity', statusPill(
            'Follower Growth Velocity',
            advanced.followerGrowthVelocity ?? '—',
            advanced.fgvScore?.color ?? '#94a3b8',
            advanced.fgvScore?.tier ?? ''
        ));

        // Top attribution
        set('advancedTopAttribution', statusPill(
            'Content-Specific Follower Attribution',
            advanced.bestAttributionType ?? '—',
            '#7c3aed',
            `~${advanced.bestAttributionCount ?? '…'} followers driven by this format`
        ));

        // Quick metrics grid.
        //
        // The 5th element marks MODELLED signals (derived from real engagement
        // counts, but not reported by Instagram). Only signals computed directly
        // from measured numbers are left untagged, so nothing modelled can be
        // mistaken for a platform-reported metric:
        //   • Engagement Velocity   — real: first/second half of actual likes+comments
        //   • Comment Quality Index — real: actual comments ÷ actual likes
        const quickMetrics = [
            ['Sends Per Reach', advanced.sendsPerReach, advanced.sendsPerReachScore?.tier ?? '', advanced.sendsPerReachScore?.color ?? '', true],
            ['Saves-to-Reach Ratio', advanced.savesToReachRatio, '', '', true],
            ['3-Second Skip Rate', advanced.skipRate3s ?? '—', parseFloat(String(advanced.skipRate3s ?? '0')) > 50 ? 'High Skip' : 'Low Skip', parseFloat(String(advanced.skipRate3s ?? '0')) > 50 ? '#ef4444' : '#10b981', true],
            ['Average Watch Time', advanced.avgWatchTime, '', '', true],
            ['Reels Completion Rate', advanced.reelsCompletionRate ?? '—', parseFloat(String(advanced.reelsCompletionRate ?? '0').replace('%','')) > 30 ? 'Good' : 'Needs Work', parseFloat(String(advanced.reelsCompletionRate ?? '0').replace('%','')) > 30 ? '#10b981' : '#ef4444', true],
            ['Engagement Velocity', advanced.engagementVelocity ?? '—', advanced.evScore?.tier ?? '', advanced.evScore?.color ?? '', false],
            ['Non-Follower Reach %', advanced.nonFollowerReachPct, '', '', true],
            ['Profile Visit Conv. Rate', advanced.profileVisitRate, '', '', true],
            ['Reach Rate', advanced.reachRate, '', '', true],
            ['Social Search Visibility', advanced.socialSearchVisibility, '', '', true],
            ['Follow-Through Action Rate', advanced.followThroughRate, '', '', true],
            ['Engagement Rate by Reach', advanced.err, '', '', true],
            ['Comment Quality Index', advanced.commentQualityIndex, '', '', false],
            ['Story Completion Rate', advanced.storyCompletionRate, '', '', true],
            ['Story Sticker Interaction Rate', advanced.storyStickerRate, '', '', true],
            ['Inbox Response Velocity', advanced.inboxResponseVelocity, '', '', true],
            ['Carousel Slide-Through Rate', advanced.carouselSlideThrough, '', '', true],
            ['Replay/Rewatch Rate', advanced.replayRate, '', '', true],
            ['3-Second View Retention Rate', advanced.retention3s, '', '', true],
            ['Drop-Off Point Timestamp', advanced.dropOffPoint, '', '', true],
            ['Audio Attribution Velocity', advanced.audioAttribution, '', '', true],
            ['Profile Action CTR', advanced.profileActionCTR, '', '', true],
            ['Non-Follower Impressions Ratio', advanced.nonFollowerImpRatio, '', '', true],
            ['Story Tap-Forward Velocity', advanced.storyTapForward, '', '', true],
            ['Story Back-Tap Rate', advanced.storyBackTap, '', '', true],
            ['Story Exit Abandonment Rate', advanced.storyExitRate, '', '', true],
            ['Live Viewer Peak Retention', advanced.livePeakRetention, '', '', true],
            ['Live Avg Watch Duration', advanced.liveAvgWatch, '', '', true],
            ['DM Automation Open Rate', advanced.dmAutoOpenRate, '', '', true],
            ['Lead Magnet Form Conversion', advanced.leadMagnetConv, '', '', true],
            ['Carousel Slide-3 Drop-Off', advanced.carouselSlide3Dropoff, '', '', true],
            ['Hashtag Reach Contribution', advanced.hashtagReachPct, '', '', true],
            ['Explore Page Discovery Yield', advanced.exploreYield, '', '', true],
            ['Negative Signal Frequency', advanced.negativeSignalFreq, '', '', true],
            ['External Link Tap Velocity', advanced.linkTapVelocity, '', '', true],
            ['Original Audio Reuse Freq.', advanced.audioReuseFreq, '', '', true],
            ['Notification-Driven Open Vel.', advanced.notifOpenRate, '', '', true],
        ];

        const gridEl = document.getElementById('advancedMetricsGrid');
        if (gridEl) {
            const modelled = quickMetrics.filter(m => m[4]).length;
            gridEl.innerHTML = quickMetrics.map(([label, value, tier, color, est]) =>
                metricPill(label, value, tier, color, est)
            ).join('') +
            // Legend: how much of this page is measured vs modelled, stated plainly.
            '<div style="grid-column:1/-1;font-size:.72rem;color:var(--text-muted);margin-top:.5rem;line-height:1.5">' +
            '📌 ' + (quickMetrics.length - modelled) + ' of ' + quickMetrics.length +
            ' signals are measured directly from your posts (likes, comments, plays, dates). The remaining ' + modelled +
            ' are modelled from those real numbers and are tagged <strong>est</strong> — they are estimates, not Instagram-reported values.' +
            '</div>';
        }

        // Yield indicators (visual gauges for key metrics)
        const indicators = [
            { label: 'Growth Velocity', value: Math.min(100, Math.max(0, (parseFloat(String(advanced.followerGrowthVelocity ?? '0').replace('%/day','')) * 50 + 20))), color: advanced.fgvScore?.color ?? '#94a3b8' },
            { label: 'Health Score', value: advanced.healthScore ?? 0, color: advanced.healthColor ?? '#7c3aed' },
            { label: 'Social Search', value: advanced.socialSearchScore ?? 0, color: (advanced.socialSearchScore ?? 0) >= 70 ? '#10b981' : (advanced.socialSearchScore ?? 0) >= 40 ? '#facc15' : '#ef4444' },
            { label: 'Engagement Velocity', value: Math.min(100, Math.max(0, (advanced._engagementVelocityRaw ?? 0) * 3 + 50)), color: advanced.evScore?.color ?? '#94a3b8' },
        ];

        const indicatorsEl = document.getElementById('advancedIndicators');
        if (indicatorsEl) {
            indicatorsEl.innerHTML = indicators.map(i => `
                <div class="adv-indicator">
                    <div class="adv-indicator-label">${i.label}</div>
                    <div class="adv-indicator-bar-wrap">
                        <div class="adv-indicator-bar" style="width:${Math.min(100, Math.max(0, i.value))}%;background:${i.color};box-shadow:0 0 12px ${i.color}40"></div>
                    </div>
                </div>
            `).join('');
        }
    }

P.computeAnalysis = function(profile, posts) {
        const followers = profile.followers || 0;
        const following = profile.following || 0;
        const scanned = posts.length;
        const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
        const totalCmnts = posts.reduce((s, p) => s + (p.comments || 0), 0);
        const avgLikes = scanned ? totalLikes / scanned : 0;
        const avgCmnts = scanned ? totalCmnts / scanned : 0;
        const likeRate = followers ? (avgLikes / followers) * 100 : 0;
        const cmntRate = followers ? (avgCmnts / followers) * 100 : 0;
        const engRate = likeRate + cmntRate;
        const ffRatio = following ? (followers / following) : 0;
        const videos = posts.filter(p => p.isVideo).length;
        const videoRatio = scanned ? (videos / scanned) * 100 : 0;

        const stamps = posts.map(p => p.timestamp).filter(Boolean).sort((a, b) => a - b);
        const spanDays = stamps.length > 1 ? Math.max(1, (stamps[stamps.length - 1] - stamps[0]) / 86400) : null;
        const postsPerWeek = (spanDays && profile.posts) ? (profile.posts / (spanDays / 7)).toFixed(1) : null;
        const avgCaptionLen = posts.filter(p => p.caption).length
            ? Math.round(posts.filter(p => p.caption).reduce((s, p) => s + p.caption.length, 0) / posts.filter(p => p.caption).length) : 0;

        let grade, gradeColor, gradeDesc;
        if (engRate >= 6) { grade = 'A+'; gradeColor = '#10b981'; gradeDesc = 'Viral / Top Creator'; }
        else if (engRate >= 3) { grade = 'A'; gradeColor = '#34d399'; gradeDesc = 'Excellent'; }
        else if (engRate >= 2) { grade = 'B'; gradeColor = '#60a5fa'; gradeDesc = 'Strong'; }
        else if (engRate >= 1) { grade = 'C'; gradeColor = '#facc15'; gradeDesc = 'Average'; }
        else if (engRate >= 0.5) { grade = 'D'; gradeColor = '#f97316'; gradeDesc = 'Below Average'; }
        else { grade = 'F'; gradeColor = '#ef4444'; gradeDesc = followers ? 'Weak / Inactive' : 'No data'; }

        let aqLabel, aqColor;
        if (ffRatio >= 10) { aqLabel = 'Outstanding'; aqColor = '#10b981'; }
        else if (ffRatio >= 3) { aqLabel = 'Strong'; aqColor = '#34d399'; }
        else if (ffRatio >= 1) { aqLabel = 'Average'; aqColor = '#facc15'; }
        else { aqLabel = 'Follow-back strategy'; aqColor = '#f97316'; }

        const sortedByLikes = [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0));
        const bestPost = sortedByLikes[0] || null;

        const photos = posts.filter(p => p.postType === 'photo').length;
        const carousels = posts.filter(p => p.postType === 'carousel').length;
        const reels = posts.filter(p => p.postType === 'reel').length;
        const hashtagPosts = posts.filter(p => (p.caption || '').includes('#')).length;
        const ctaPosts = posts.filter(p => /\b(link in bio|comment|dm|shop|buy|click)\b/i.test(p.caption || '')).length;
        const estReach = followers && engRate ? Math.round(followers * (engRate / 100)) : null;
        const estImpressions = estReach ? Math.round(estReach * 1.5) : null;
        const profileScore = this.computeProfileScore(profile, { engRate, ffRatio, videoRatio, avgCaptionLen, postsPerWeek, hashtagPosts, scanned });

        /* ── Generate 6+ profile-level recommendations with data-driven WHY ── */
        const recs = [];
        const issues = [];

        if (!profile.bio?.trim()) {
            recs.push('📝 **Add a bio with keywords and clear value proposition** — Why: Profiles with bios get 2× more visits and 3× more follows. Without one, Instagram search rankings drop ~40%. Your discoverability is severely limited without this.');
            issues.push({ sev: 10, label: 'bio' });
        }
        if (!profile.externalUrl) {
            recs.push('🔗 **Add a link in bio** — Why: Profiles without links miss ~30% of referral traffic. Your content has no destination, so conversions are 3× lower. Add Linktree, website, or shop link.');
            issues.push({ sev: 9, label: 'url' });
        }
        if (engRate < 1 && followers > 0) {
            recs.push('📉 **Engagement critically low (' + engRate.toFixed(2) + '%)** — Why: Instagram’s algorithm uses ER as its #1 ranking signal. Below 1%, your content reaches only ~5-10% of followers vs 30-40% for 3%+ ER. Post Reels and ask questions to rebuild algorithmic trust.');
            issues.push({ sev: 10, label: 'er' });
        }
        if (ffRatio < 1) {
            recs.push('👥 **You follow more than followers (ratio: ' + ffRatio.toFixed(1) + '×)** — Why: A ratio below 1:1 signals follow-back strategy, reducing authority by ~35%. This can limit reach by 20-40%. Unfollow inactive accounts to improve above 3:1.');
            issues.push({ sev: 8, label: 'ff' });
        }
        if (videoRatio < 30 && scanned > 2) {
            recs.push('🎬 **Only ' + videoRatio.toFixed(0) + '% video content** — Why: Instagram prioritizes Reels with 2-3× more reach. Accounts with <30% video see 40% less non-follower reach. Increase to 40%+ for optimal discovery.');
            issues.push({ sev: 7, label: 'video' });
        }
        if (carousels === 0 && scanned > 4) {
            recs.push('📸 **Try carousel posts** — Why: Carousels generate 3× more saves and 2× longer dwell time. The algorithm heavily weights dwell time. Just 2-3 carousels/month can boost save rate by 40-60%.');
            issues.push({ sev: 6, label: 'carousel' });
        }
        if (avgCaptionLen < 50 && scanned > 2) {
            recs.push('📝 **Captions very short (avg ' + avgCaptionLen + ' chars)** — Why: Posts with 150-300 char captions get 22% more saves and 18% more shares. Storytelling with hooks keeps viewers reading, increasing dwell time.');
            issues.push({ sev: 7, label: 'caption' });
        }
        if (hashtagPosts < scanned * 0.5 && scanned > 2) {
            recs.push('🏷️ **Only ' + hashtagPosts + '/' + scanned + ' posts use hashtags** — Why: Posts with 5-10 niche hashtags get 2.4× more discovery reach. Hashtags are Instagram’s primary content categorization system.');
            issues.push({ sev: 8, label: 'hashtag' });
        }
        if (ctaPosts < scanned * 0.3 && scanned > 2) {
            recs.push('📣 **Add CTAs to more posts (' + ctaPosts + '/' + scanned + ')** — Why: Posts with clear calls-to-action convert at 3-5× higher rates. Add \"What do you think?\" or \"Link in bio\" to drive measurable actions.');
            issues.push({ sev: 6, label: 'cta' });
        }
        if (postsPerWeek && parseFloat(postsPerWeek) < 2) {
            recs.push('📅 **Posting only ' + postsPerWeek + '/wk (target: 3-5/wk)** — Why: Accounts posting 3-5×/week see 30% more reach. Gaps >5 days drop algorithmic ranking by up to 50%. Consistency is key.');
            issues.push({ sev: 9, label: 'freq' });
        }
        if (postsPerWeek && parseFloat(postsPerWeek) > 14) {
            recs.push('⚠️ **Posting ' + postsPerWeek + '/wk is very high** — Why: Posting >2×/day causes engagement fatigue. Quality drops, followers scroll past, and Instagram deprioritizes. Reduce to 5-7 high-quality posts/week.');
            issues.push({ sev: 5, label: 'overpost' });
        }
        if (!profile.fullName?.trim()) {
            recs.push('👤 **Add a display name** — Why: Profiles without display names appear 3× less professional. Instagram search ranks completed profiles 2.7× higher. This field is a ranking signal you’re ignoring.');
            issues.push({ sev: 7, label: 'name' });
        }
        if (followers > 0 && following > 0 && ffRatio < 2) {
            recs.push('📊 **Improve follower/following ratio (' + ffRatio.toFixed(1) + '×)** — Why: Ratio below 2:1 suggests follow-for-follow patterns attracting low-quality followers. These inactive accounts dilute your ER. Aim for 5:1+ through quality content.');
            issues.push({ sev: 6, label: 'ratio' });
        }
        if (scanned >= 5) {
            const mixedTypes = photos > 0 && videos > 0;
            if (!mixedTypes) {
                const dominantType = videos > 0 ? 'video' : 'photo';
                recs.push('🔄 **Diversify content formats (currently all ' + dominantType + 's)** — Why: Accounts using 3+ content types see 50% more reach. Each format signals different engagement to the algorithm.');
                issues.push({ sev: 6, label: 'diversify' });
            }
        }
        if (estReach && followers > 0) {
            const reachPct = (estReach / followers) * 100;
            if (reachPct < 15 && followers > 1000) {
                recs.push('🎯 **Low estimated reach (' + reachPct.toFixed(1) + '% of followers)** — Why: Your content reaches only ~' + reachPct.toFixed(0) + '% of followers vs 25-40% benchmark. The algorithm is limiting distribution. Increase Reels and improve posting time to rebuild trust.');
                issues.push({ sev: 9, label: 'reach' });
            }
        }
        if (scanned > 3) {
            const avgEng = (totalLikes + totalCmnts) / Math.max(1, scanned);
            const topEng = (sortedByLikes[0]?.likes || 0) + (sortedByLikes[0]?.comments || 0);
            if (scanned >= 4 && topEng > avgEng * 2) {
                recs.push('🏆 **Top post outperforms by ' + (topEng / Math.max(1, avgEng)).toFixed(1) + '×** — Why: One post greatly outperforms others. Analyze what made it successful: time, format, caption, or topic. Duplicate these winning patterns.');
            }
        }
        if (engRate >= 3 && followers > 0) {
            recs.push('🚀 **Excellent engagement (' + engRate.toFixed(2) + '%) — qualify for brand deals!** — Why: At ' + engRate.toFixed(1) + '% ER, you’re in the top 15% of accounts. Brands seek micro-influencers with 2%+ ER. Create a media kit and pitch to niche brands.');
        }
        if (profileScore < 60) {
            recs.push('⭐ **Profile health: ' + profileScore + '/100** — Why: Low score means Instagram can’t fully index or recommend you. Bio: ' + (profile.bio?.trim() ? '✅' : '❌') + ', Pic: ' + (profile.profilePicUrl ? '✅' : '❌') + ', Name: ' + (profile.fullName?.trim() ? '✅' : '❌') + '. Each missing element costs ~15-20 search ranking points.');
        }

        // Sort recommendations by severity (most impactful first).
        // Each recommendation is used at most once: matching by label alone made
        // one finding satisfy two different issues (e.g. "…all videos" matched the
        // 'video' label as well as 'diversify'), which printed the same advice twice.
        issues.sort((a, b) => b.sev - a.sev);
        const usedRecs = new Set();
        const orderedRecs = [];
        for (const issue of issues) {
            const found = recs.find(r => !usedRecs.has(r) && r.includes(issue.label));
            if (found) { usedRecs.add(found); orderedRecs.push(found); }
        }
        const remainingRecs = recs.filter(r => !usedRecs.has(r));
        recs.length = 0;
        recs.push(...orderedRecs, ...remainingRecs);

        if (!recs.length) {
            recs.push('✅ **Profile looks healthy!** — Why: Your metrics (ER ' + engRate.toFixed(2) + '%, ratio ' + ffRatio.toFixed(1) + '×, video ' + videoRatio.toFixed(0) + '%) are in good ranges. For continued growth: post Reels with trending audio, engage 15 min/day with your community.');
        }

        /* ── Data quality — what this analysis is actually standing on ──
           Generic advice used to be padded in until there were 6 items, which
           made a thin scan look like a thorough one. Instead the analysis now
           reports its own coverage, and when the real metrics cannot support a
           recommendation it says exactly which numbers are missing. */
        const accountTotal = Number(profile.posts);
        const dataQuality = {
            postsScanned: scanned,
            accountPosts: Number.isFinite(accountTotal) && accountTotal > scanned ? accountTotal : null,
            percentOfAccount: (Number.isFinite(accountTotal) && accountTotal > 0)
                ? Math.min(100, Math.round((scanned / accountTotal) * 1000) / 10) : null,
            withLikes: posts.filter(p => typeof p.likes === 'number').length,
            withComments: posts.filter(p => typeof p.comments === 'number').length,
            withViews: posts.filter(p => p.videoViews != null || p.views != null).length,
            withCaptions: posts.filter(p => p.caption).length,
            withDates: stamps.length,
            dateRangeDays: spanDays == null ? null : Math.round(spanDays),
            followersKnown: followers > 0,
            recommendations: recs.length,
        };

        // Stated when the evidence is thin AND whenever the scan does not cover
        // the whole account — a 30-of-912-post analysis must never read as if it
        // described the account. This is disclosure, never padding.
        const partialScan = dataQuality.accountPosts != null && dataQuality.percentOfAccount != null && dataQuality.percentOfAccount < 100;
        if (recs.length < 3 || partialScan) {
            const gaps = [];
            if (!followers) gaps.push('the follower count');
            if (dataQuality.withLikes < scanned) gaps.push((scanned - dataQuality.withLikes) + ' post(s) with no like count');
            if (dataQuality.withComments < scanned) gaps.push((scanned - dataQuality.withComments) + ' post(s) with no comment count');
            if (!dataQuality.withDates) gaps.push('post dates');
            if (partialScan) {
                gaps.push('the remaining ' + (dataQuality.accountPosts - scanned) + ' post(s) of this account');
            }
            recs.push('🔎 **Analysis based on ' + scanned + ' of ' + (dataQuality.accountPosts || scanned) + ' posts' +
                (dataQuality.percentOfAccount != null ? ' (' + dataQuality.percentOfAccount + '% of the account)' : '') + '** — Why: ' +
                (gaps.length ? 'missing ' + gaps.join(', ') + '. ' : '') +
                'Every recommendation above is computed from measured values only; nothing is padded in. ' +
                (partialScan ? 'Run 📚 Scan Full History with a logged-in session so all ' + dataQuality.accountPosts + ' posts are analysed.' : 'Run a fresh full-history scan after posting to keep the coverage at 100%.'));
        }

        return { followers, following, scanned, totalLikes, totalCmnts, avgLikes, avgCmnts,
            likeRate, cmntRate, engRate, ffRatio, videos, videoRatio, photos, carousels, reels,
            grade, gradeColor, gradeDesc, aqLabel, aqColor,
            bestPost, avgCaptionLen, postsPerWeek, recs, sortedByLikes, spanDays,
            estReach, estImpressions, profileScore, hashtagPosts, ctaPosts, dataQuality
        };
    }

    /* One-line "what this is based on" banner for the analysis page. Shows the
       real coverage so a thin scan is visible rather than implied. */
P.renderDataQualityBanner = function(a) {
        const q = a && a.dataQuality;
        if (!q) return '';
        const bits = [];
        bits.push('Analysed ' + q.postsScanned + (q.accountPosts ? ' / ' + q.accountPosts : '') +
            (q.percentOfAccount != null ? ' (' + q.percentOfAccount + '%)' : '') + ' posts');
        bits.push(q.withLikes + ' with like counts');
        bits.push(q.withComments + ' with comments');
        if (q.withViews) bits.push(q.withViews + ' with play counts');
        if (q.withDates > 1) bits.push('spanning ' + q.dateRangeDays + ' days');
        bits.push(q.recommendations + ' finding' + (q.recommendations === 1 ? '' : 's') + ' from measured data');
        return '<div class="rec-item" style="font-size:.78rem;color:var(--text-secondary);border-left-color:var(--violet,#7c3aed)">📊 ' +
            this.escHtml(bits.join(' · ')) + '</div>';
    }

P.computeProfileScore = function(profile, stats) {
        let score = 0;
        if (profile.bio?.trim()) score += 15;
        if (profile.fullName?.trim()) score += 10;
        if (profile.externalUrl) score += 15;
        if (profile.profilePicUrl || profile._profilePicData) score += 10;
        if (stats.engRate >= 1) score += 20;
        else if (stats.engRate >= 0.5) score += 10;
        if (stats.ffRatio >= 1) score += 10;
        if (stats.videoRatio >= 20) score += 10;
        if (stats.postsPerWeek && parseFloat(stats.postsPerWeek) >= 2) score += 10;
        return Math.min(100, score);
    }

P.renderMarketingAnalysis = function(profile, posts) {
        const a = this.computeAnalysis(profile, posts);
        const set = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html ?? '—'; };

        set('maGrade', `<span style="color:${a.gradeColor};font-size:2.8rem;font-weight:900;line-height:1">${a.grade}</span>`);
        set('maGradeDesc', a.gradeDesc);
        set('maEngRate', `${a.engRate.toFixed(2)}%`);
        set('maLikeRate', `${a.likeRate.toFixed(2)}%`);
        set('maCmntRate', `${a.cmntRate.toFixed(2)}%`);
        set('maFFRatio', `${a.ffRatio.toFixed(1)}×`);
        set('maAQLabel', `<span style="color:${a.aqColor};font-weight:700">${a.aqLabel}</span>`);
        set('maVideoRatio', `${a.videoRatio.toFixed(0)}%`);
        set('maAvgCaption', `${a.avgCaptionLen} chars`);
        set('maPostFreq', a.postsPerWeek ? `${a.postsPerWeek}/wk` : '—');

        const bp = a.bestPost;
        const bpEl = document.getElementById('maBestPost');
        if (bpEl && bp) {
            bpEl.innerHTML = `<div style="display:flex;gap:.75rem;align-items:center">
                ${bp._thumbnailData ? `<img src="${bp._thumbnailData}" style="width:60px;height:60px;border-radius:10px;object-fit:cover">` : '<div style="width:60px;height:60px;background:var(--violet-muted);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.5rem">🏆</div>'}
                <div>
                  <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:2px">Best Post</div>
                  <div style="font-weight:700;color:#10b981">❤️ ${this.fmt(bp.likes)} &nbsp; 💬 ${this.fmt(bp.comments)}</div>
                  <div style="font-size:.75rem;color:var(--text-secondary);margin-top:3px">${(bp.caption || 'No caption').substring(0, 80)}${bp.caption?.length > 80 ? '…' : ''}</div>
                </div></div>`;
        }

        const recEl = document.getElementById('maRecommendations');
        if (recEl) {
            // The banner makes the evidence base explicit: how many posts this was
            // computed from and how many carry real engagement data.
            recEl.innerHTML = this.renderDataQualityBanner(a) +
                a.recs.map(r => `<div class="rec-item">${r}</div>`).join('');
        }

        // Fake follower section
        const ff = this.estimateFakeFollowers(a.followers, a.engRate, a.ffRatio, a.videoRatio, this.currentPlatform);
        const setTxt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        setTxt('fakeRatioPct', `${ff.fakeRatio}%`);
        setTxt('fakeCount', this.fmt(ff.fakeCount));
        setTxt('authenticCount', this.fmt(ff.authentic));
        setTxt('expectedERDisplay', `${ff.expectedER}%`);
        const meterFill = document.getElementById('fakeMeterFill');
        if (meterFill) {
            const pct = Math.min(parseFloat(ff.fakeRatio), 90);
            meterFill.style.width = `${pct}%`;
            meterFill.style.background = pct > 50 ? '#ef4444' : pct > 25 ? '#f97316' : '#10b981';
        }

        // Render fake follower detailed list
        this.renderFakeFollowerList(ff);

        // Show analysis content
        const empty = document.getElementById('analysisEmpty');
        const content = document.getElementById('analysisContent');
        if (empty) empty.style.display = 'none';
        if (content) content.style.display = 'block';

        this.renderAnalysisCharts(a, posts);
    }

P.displayProfile = function(p, posts) {
        if (!p) {
            // Hide profile badge and clear stats when no profile is loaded (e.g. platform switch)
            const badge = document.getElementById('profileBadge');
            if (badge) badge.style.display = 'none';
            const dashTitle = document.getElementById('dashPostsTitle');
            const dashEmpty = document.getElementById('dashPostsEmpty');
            const dashPreview = document.getElementById('dashPostsPreview');
            const dashFooter = document.getElementById('dashPostsFooter');
            if (dashTitle) dashTitle.style.display = 'none';
            if (dashEmpty) dashEmpty.style.display = 'none';
            if (dashPreview) { dashPreview.innerHTML = ''; dashPreview.style.display = 'none'; }
            if (dashFooter) dashFooter.style.display = 'none';
            // Clear stats
            ['statsEngRate','ffRatioDisplay','recentLikesDisplay','reachDisplay',
             'dashHealthStatus','dashGrowthVel','dashSendsPerReach','dashNonFollowerReach',
             'dashWatchTime','dashEngVelocity','dashSavesRatio','dashSocialSearch',
             'statsErr','statsProfileCTR'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '—';
            });
            ['profileFullName','profileHandle','profileBio','profileExternal','profilePosts',
             'profileFollowers','profileFollowing','profileUpdatedAt'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '—';
                if (el) el.style.color = ''; // reset any freshness color
            });
            const avatar = document.getElementById('profileAvatar');
            if (avatar) { avatar.style.display = 'none'; avatar.src = ''; }
            // Remove any avatar placeholder
            const avatarWrap = document.querySelector('.profile-avatar-wrap');
            if (avatarWrap) {
                const ph = avatarWrap.querySelector('.avatar-placeholder');
                if (ph) ph.remove();
            }
            const vBadge = document.getElementById('verifiedBadge');
            if (vBadge) vBadge.style.display = 'none';
            const pBadge = document.getElementById('privateBadge');
            if (pBadge) pBadge.style.display = 'none';
            return;
        }
        document.getElementById('profileBadge').style.display = 'flex';
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? '—'; };

        // Profile picture — use proxied data URL if available, else direct URL, else initials placeholder
        const avatar = document.getElementById('profileAvatar');
        if (avatar) {
            // Always clean up any leftover avatar placeholder from a previous call
            const wrap = avatar.parentElement;
            const oldPlaceholder = wrap ? wrap.querySelector('.avatar-placeholder') : null;
            if (oldPlaceholder) oldPlaceholder.remove();

            if (p._profilePicData) {
                avatar.src = p._profilePicData;
                avatar.style.display = 'block';
            } else if (p.profilePicUrl) {
                avatar.src = p.profilePicUrl;
                avatar.onerror = function() {
                    // If direct load fails, generate initials placeholder
                    this.style.display = 'none';
                    const w = this.parentElement;
                    if (w && !w.querySelector('.avatar-placeholder')) {
                        const name = p.fullName || p.username || '?';
                        const initials = name.split(/\s+/).map(s => s[0]).join('').toUpperCase().substring(0, 2) || '?';
                        const colors = ['#7c3aed','#06b6d4','#ec4899','#10b981','#f59e0b','#3b82f6'];
                        const colorIdx = (p.username || '').length % colors.length;
                        const placeholder = document.createElement('div');
                        placeholder.className = 'avatar-placeholder';
                        placeholder.textContent = initials;
                        placeholder.style.cssText = `width:72px;height:72px;border-radius:50%;background:${colors[colorIdx]};display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;color:#fff;flex-shrink:0;border:2px solid ${colors[colorIdx]};box-shadow:0 0 16px ${colors[colorIdx]}40`;
                        w.appendChild(placeholder);
                    }
                };
                // Remove placeholder if image loads successfully
                avatar.onload = function() {
                    this.style.display = 'block';
                    const w = this.parentElement;
                    const ph = w ? w.querySelector('.avatar-placeholder') : null;
                    if (ph) ph.remove();
                };
            } else {
                // No profile pic URL at all — show initials placeholder immediately
                avatar.style.display = 'none';
                if (wrap && !wrap.querySelector('.avatar-placeholder')) {
                    const name = p.fullName || p.username || '?';
                    const initials = name.split(/\s+/).map(s => s[0]).join('').toUpperCase().substring(0, 2) || '?';
                    const colors = ['#7c3aed','#06b6d4','#ec4899','#10b981','#f59e0b','#3b82f6'];
                    const colorIdx = (p.username || '').length % colors.length;
                    const placeholder = document.createElement('div');
                    placeholder.className = 'avatar-placeholder';
                    placeholder.textContent = initials;
                    placeholder.style.cssText = `width:72px;height:72px;border-radius:50%;background:${colors[colorIdx]};display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;color:#fff;flex-shrink:0;border:2px solid ${colors[colorIdx]};box-shadow:0 0 16px ${colors[colorIdx]}40`;
                    wrap.appendChild(placeholder);
                }
            }
        }

        set('profileFullName', p.fullName || p.username);
        set('profileHandle', `@${p.username}`);
        set('profileBio', p.bio);

        // Live-data freshness indicator — shows when this profile was last fetched
        const updatedEl = document.getElementById('profileUpdatedAt');
        if (updatedEl) {
            updatedEl.style.display = '';
            if (p.fetchedAt) {
                const ageMs = Math.max(0, Date.now() - new Date(p.fetchedAt).getTime());
                const mins = Math.round(ageMs / 60000);
                const hrs = ageMs / 3600000;
                const days = ageMs / 86400000;
                updatedEl.textContent = mins < 1 ? '🕐 Live data · updated just now'
                    : mins < 60 ? `🕐 Live data · updated ${mins} min ago`
                    : hrs < 24 ? `🕐 Live data · updated ${Math.round(hrs)}h ago`
                    : days < 30 ? `🕐 Live data · updated ${Math.round(days)}d ago`
                    : `🕐 Saved data · updated ${Math.max(1, Math.round(days / 30))} mo ago`;
                updatedEl.style.color = mins < 30 ? 'var(--text-muted)' : '#f59e0b';
            } else {
                updatedEl.textContent = '🕐 Live data';
                updatedEl.style.color = 'var(--text-muted)';
            }
        }

        const extEl = document.getElementById('profileExternal');
        if (extEl && p.externalUrl) {
            extEl.innerHTML = `<a href="#" style="color:var(--cyan);font-size:.82rem">${p.externalUrl}</a>`;
        }

        document.getElementById('verifiedBadge').style.display = p.isVerified ? 'inline-flex' : 'none';
        document.getElementById('privateBadge').style.display = p.isPrivate ? 'inline-flex' : 'none';

        const ratio = (p.followers && p.following && p.following > 0)
            ? (p.followers / p.following).toFixed(2) : '—';
        const totalLikes = posts.reduce((s, post) => s + (post.likes || 0), 0);
        const avgLikes = posts.length ? Math.round(totalLikes / posts.length) : null;
        const avgComments = posts.length
            ? Math.round(posts.reduce((s, p) => s + (p.comments || 0), 0) / posts.length) : null;
        const engRateNum = (p.followers && avgLikes)
            ? ((avgLikes + (avgComments || 0)) / p.followers * 100) : 0;
        const engRate = engRateNum ? engRateNum.toFixed(2) + '%' : '—';
        const likeRate = p.followers && avgLikes ? ((avgLikes / p.followers) * 100).toFixed(2) + '%' : '—';
        const commentRate = p.followers && avgComments ? ((avgComments / p.followers) * 100).toFixed(2) + '%' : '—';
        const estReach = p.followers && engRateNum ? Math.round(p.followers * (engRateNum / 100)) : null;
        const estImpressions = estReach ? Math.round(estReach * 1.5) : null;
        const analysis = this.computeAnalysis(p, posts);
        const photos = posts.filter(x => x.postType === 'photo').length;
        const videos = posts.filter(x => x.postType === 'video' || x.postType === 'reel').length;
        const carousels = posts.filter(x => x.postType === 'carousel').length;

        // Animate counters
        this.animateCounter('profileFollowers', p.followers);
        // The account's total post count can be unknown for anonymous scans;
        // fall back to the number of posts we actually hold and label it so a
        // partial scan is never mistaken for the full total.
        const totalPosts = (p.posts != null) ? p.posts : (posts.length || null);
        this.animateCounter('profilePosts', totalPosts);
        this.animateCounter('profileFollowing', p.following);
        const postsStatVal = document.getElementById('profilePosts');
        if (postsStatVal) {
            const stat = postsStatVal.closest('.profile-stat');
            const lbl = stat ? stat.querySelector('.profile-stat-lbl') : null;
            const known = p.posts != null;
            if (lbl) lbl.textContent = known ? 'Posts' : 'Posts (scanned)';
            if (stat) stat.setAttribute('data-tooltip', known
                ? 'Total posts uploaded by this account'
                : 'Exact total unavailable for this anonymous scan — showing how many posts were analysed. Log in via Settings for the account total.');
        }

        // Dashboard stats grid — unique metrics not in profile card
        set('statsEngRate', engRate);
        set('ffRatioDisplay', ratio);
        set('recentLikesDisplay', avgLikes !== null ? this.fmt(avgLikes) : '—');
        set('reachDisplay', estReach !== null ? this.fmt(estReach) : '—');

        // Metrics page — basic (fixed: now shows correct metrics, not placeholder values)
        set('mPostsScanned', posts.length || '—');
        set('mAvgLikes', avgLikes !== null ? this.fmt(avgLikes) : '—');
        set('mAvgComments', avgComments !== null ? this.fmt(avgComments) : '—');
        set('mEngRate', engRate);
        set('mLikeRate', likeRate);
        set('mCommentRate', commentRate);
        set('mFFRatio', ratio);
        set('mVideoPct', analysis.videoRatio ? analysis.videoRatio.toFixed(0) + '%' : '—');
        set('mEstReach', estReach !== null ? this.fmt(estReach) : '—');
        set('mEstImpressions', estImpressions !== null ? this.fmt(estImpressions) : '—');
        set('mProfileScore', analysis.profileScore ? analysis.profileScore + '/100' : '—');

        // Compute & render advanced metrics
        const advanced = this.computeAdvancedMetrics(p, posts, analysis);
        this.renderAdvancedMetricsCards(advanced);

        // Dashboard: advanced quick-stats
        set('dashHealthStatus', advanced.healthStatus);
        set('dashGrowthVel', advanced.followerGrowthVelocity);
        set('dashSendsPerReach', advanced.sendsPerReach);
        set('dashNonFollowerReach', advanced.nonFollowerReachPct);
        set('dashWatchTime', advanced.avgWatchTime);
        set('dashEngVelocity', advanced.engagementVelocity);
        set('dashSavesRatio', advanced.savesToReachRatio);
        set('dashSocialSearch', advanced.socialSearchVisibility);
        // Dashboard stats grid — unique metrics (advanced-dependent, no overlap with Account Pulse)
        set('statsErr', advanced.err);
        set('statsProfileCTR', advanced.profileActionCTR);
        // Metrics page — advanced-dependent values (must be after advanced computed)
        set('engagementRateReach', this.fmt(advanced.estSaves));
        set('sharesToReachRatio', advanced.sendsPerReach);
        set('reelsRetentionRate', advanced.reelsCompletionRate);
        set('skipRate', advanced.skipRate3s);

        // Health indicator color
        const healthEl = document.getElementById('dashHealthStatus');
        if (healthEl) healthEl.style.color = advanced.healthColor;

        this.renderMetricsTable(p, posts, analysis);
    }

P.animateCounter = function(id, target) {
        const el = document.getElementById(id);
        if (!el) return;
        // When the value is unknown, show an explicit placeholder. Returning
        // early here would leave the PREVIOUS profile's number on screen, so a
        // freshly scanned profile could display stale follower/following counts.
        if (target === null || target === undefined || target === '' || Number.isNaN(Number(target))) {
            el.textContent = '—';
            return;
        }
        // No GSAP, or the user prefers reduced motion → show the value immediately.
        if (typeof gsap === 'undefined' || (typeof this.prefersReducedMotion === 'function' && this.prefersReducedMotion())) {
            el.textContent = this.fmt(target);
            return;
        }
        // Stop any in-flight count-up for this element so rapid re-renders don't
        // leave two tweens fighting over the same text node.
        gsap.killTweensOf(el);
        const obj = { val: 0 };
        gsap.to(obj, {
            val: target, duration: 1.3, ease: 'power2.out', delay: .15,
            onUpdate: () => { el.textContent = this.fmt(Math.round(obj.val)); },
            onComplete: () => {
                // Subtle pop to draw the eye to the final figure.
                gsap.fromTo(el, { scale: 1.12 }, { scale: 1, duration: .35, ease: 'elastic.out(1,.6)' });
            }
        });
    }

P.renderMetricsTable = function(p, posts, analysis = null) {
        const tbody = document.getElementById('completeMetricsTableBody');
        if (!tbody) return;
        if (!analysis) analysis = this.computeAnalysis(p, posts);
        const advanced = this.computeAdvancedMetrics(p, posts, analysis);
        const totalLikes = posts.reduce((s, x) => s + (x.likes || 0), 0);
        const totalComments = posts.reduce((s, x) => s + (x.comments || 0), 0);
        const avgLikes = posts.length ? Math.round(totalLikes / posts.length) : null;
        const avgComments = posts.length
            ? Math.round(posts.reduce((s, x) => s + (x.comments || 0), 0) / posts.length) : null;
        const engRate = analysis.engRate ? analysis.engRate.toFixed(2) + '%' : '—';
        const ffRatio = p.followers && p.following ? (p.followers / p.following).toFixed(2) : '—';

        const rows = [
            // ── Core Profile ──
            ['Username', `@${p.username}`, 'public'],
            ['Full Name', p.fullName || '—', 'public'],
            ['Bio Length', (p.bio?.length || 0) + ' chars', 'public'],
            ['Followers', this.fmt(p.followers), 'public'],
            ['Following', this.fmt(p.following), 'public'],
            ['Posts (Total)', this.fmt(p.posts), 'public'],
            ['Verified', p.isVerified ? '✔ Yes' : 'No', 'public'],
            ['External URL', p.externalUrl || '—', 'public'],
            // ── Post Scan ──
            ['Posts Scanned', posts.length || '—', 'public'],
            ['Photos Scanned', analysis.photos ?? '—', 'public'],
            ['Videos / Reels', analysis.videos ?? '—', 'public'],
            ['Carousels', analysis.carousels ?? '—', 'public'],
            ['Total Likes (scan)', this.fmt(totalLikes) || '—', 'public'],
            ['Total Comments (scan)', this.fmt(totalComments) || '—', 'public'],
            ['Avg Likes / Post', avgLikes !== null ? this.fmt(avgLikes) : '—', 'public'],
            ['Avg Comments / Post', avgComments !== null ? this.fmt(avgComments) : '—', 'public'],
            // ── Engagement ──
            ['Engagement Rate', engRate, 'public'],
            ['Like Rate', analysis.likeRate ? analysis.likeRate.toFixed(2) + '%' : '—', 'public'],
            ['Comment Rate', analysis.cmntRate ? analysis.cmntRate.toFixed(2) + '%' : '—', 'public'],
            ['Follower/Following Ratio', ffRatio, 'public'],
            ['Video Content %', analysis.videoRatio ? analysis.videoRatio.toFixed(0) + '%' : '—', 'public'],
            ['Avg Caption Length', analysis.avgCaptionLen ? analysis.avgCaptionLen + ' chars' : '—', 'public'],
            ['Post Frequency', analysis.postsPerWeek ? analysis.postsPerWeek + '/wk' : '—', 'public'],
            ['Posts with Hashtags', analysis.hashtagPosts ?? '—', 'public'],
            ['Engagement Grade', analysis.grade || '—', 'public'],
            ['Audience Quality', analysis.aqLabel || '—', 'public'],
            // ── Estimates ──
            ['Est. Reach', analysis.estReach ? this.fmt(analysis.estReach) : '—', 'public'],
            ['Est. Impressions', analysis.estImpressions ? this.fmt(analysis.estImpressions) : '—', 'public'],
            ['Profile Health Score', analysis.profileScore ? analysis.profileScore + '/100' : '—', 'public'],
            ['Account Health Status', `${advanced.healthStatus} (${advanced.healthScore}/100)`, 'estimated'],
            // ── Advanced: Reach & Saves ──
            ['Sends Per Reach (DM Shares)', advanced.sendsPerReach, 'estimated'],
            ['Saves-to-Reach Ratio', advanced.savesToReachRatio, 'estimated'],
            ['3-Second Skip Rate', advanced.skipRate3s, 'estimated'],
            ['Average Watch Time', advanced.avgWatchTime, 'estimated'],
            ['Reels Completion Rate', advanced.reelsCompletionRate, 'estimated'],
            ['Replay/Rewatch Rate', advanced.replayRate, 'estimated'],
            ['3-Second View Retention Rate', advanced.retention3s, 'estimated'],
            ['Drop-Off Point Timestamp', advanced.dropOffPoint, 'estimated'],
            // ── Advanced: Growth & Discovery ──
            ['Engagement Velocity', advanced.engagementVelocity, 'estimated'],
            ['Follower Growth Velocity', advanced.followerGrowthVelocity, 'estimated'],
            ['Non-Follower Reach Percentage', advanced.nonFollowerReachPct, 'estimated'],
            ['Non-Follower Impressions Ratio', advanced.nonFollowerImpRatio, 'estimated'],
            ['Reach Rate', advanced.reachRate, 'estimated'],
            ['Engagement Rate by Reach (ERR)', advanced.err, 'estimated'],
            ['Profile Visit Conversion Rate', advanced.profileVisitRate, 'estimated'],
            ['Follow-Through Action Rate', advanced.followThroughRate, 'estimated'],
            ['Social Search Visibility', `${advanced.socialSearchVisibility} (${advanced.socialSearchScore}/100)`, 'estimated'],
            ['Explore Page Discovery Yield', advanced.exploreYield, 'estimated'],
            ['Hashtag Reach Contribution', advanced.hashtagReachPct, 'estimated'],
            // ── Advanced: Stories ──
            ['Story Completion Rate', advanced.storyCompletionRate, 'estimated'],
            ['Story Sticker Interaction Rate', advanced.storyStickerRate, 'estimated'],
            ['Story Tap-Forward Velocity', advanced.storyTapForward, 'estimated'],
            ['Story Back-Tap Rate', advanced.storyBackTap, 'estimated'],
            ['Story Exit Abandonment Rate', advanced.storyExitRate, 'estimated'],
            // ── Advanced: Live & Response ──
            ['Live Viewer Peak Retention', advanced.livePeakRetention, 'estimated'],
            ['Live Average Watch Duration', advanced.liveAvgWatch, 'estimated'],
            ['Inbox Response Velocity', advanced.inboxResponseVelocity, 'estimated'],
            ['DM Automation Open Rate', advanced.dmAutoOpenRate, 'estimated'],
            ['Notification-Driven Open Velocity', advanced.notifOpenRate, 'estimated'],
            // ── Advanced: Carousel & Audio ──
            ['Carousel Slide-Through Rate', advanced.carouselSlideThrough, 'estimated'],
            ['Carousel Slide-Three Drop-Off', advanced.carouselSlide3Dropoff, 'estimated'],
            ['Audio Attribution Velocity', advanced.audioAttribution, 'estimated'],
            ['Original Audio Reuse Frequency', advanced.audioReuseFreq, 'estimated'],
            // ── Advanced: CTA & Conversion ──
            ['Profile Action Click-Through Rate', advanced.profileActionCTR, 'estimated'],
            ['External Link Tap Velocity', advanced.linkTapVelocity, 'estimated'],
            ['Lead Magnet Form Conversion Rate', advanced.leadMagnetConv, 'estimated'],
            ['Comment Quality Index', advanced.commentQualityIndex, 'estimated'],
            ['Negative Signal Frequency (Hides/Mutes)', advanced.negativeSignalFreq, 'estimated'],
            ['Content-Specific Follower Attribution', `${advanced.bestAttributionType} (${advanced.bestAttributionCount})`, 'estimated'],
        ];
        tbody.innerHTML = rows.map(([label, val, src]) => {
            let srcLabel, className;
            if (src === 'api') { srcLabel = '🔒 API'; className = 'api-only'; }
            else if (src === 'estimated') { srcLabel = '📊 Est.'; className = 'src-estimated'; }
            else { srcLabel = '✅ Public'; className = 'src-public'; }
            return `<tr><td>${label}</td>
             <td><strong style="${src === 'api' ? 'color:var(--text-muted)' : ''}">${val}</strong></td>
             <td><span class="${className}">${srcLabel}</span></td></tr>`;
        }).join('');
    }

P.estimateFakeFollowers = function(followers, engRate, ffRatio = null, videoRatio = 0, platform = 'instagram') {
        if (!followers) return { fakeRatio: '0.0', fakeCount: 0, authentic: 0, expectedER: 0, confidence: 'low', signals: [], fakeList: [] };

        // Tier-based expected engagement rate (industry benchmarks)
        let expectedER;
        if (followers < 1000) expectedER = 8;
        else if (followers < 5000) expectedER = 6.5;
        else if (followers < 10000) expectedER = 5;
        else if (followers < 50000) expectedER = 3.5;
        else if (followers < 100000) expectedER = 2.5;
        else if (followers < 500000) expectedER = 2;
        else if (followers < 1000000) expectedER = 1.5;
        else expectedER = 1;

        const signals = [];
        let penaltyPct = 0;
        const erGap = Math.max(0, expectedER - engRate);

        // ── Deterministic multi-signal analysis (no Math.random) ──

        // Signal 1: ER Gap (primary, 0-50 pts)
        if (erGap > 0) {
            const erPenalty = Math.min(50, (erGap / Math.max(0.01, expectedER)) * 50);
            penaltyPct += erPenalty;
            const erSeverity = erGap > expectedER * 0.7 ? 'high' : erGap > expectedER * 0.4 ? 'medium' : 'low';
            signals.push({ icon: '📉', label: `ER ${engRate.toFixed(2)}% vs expected ${expectedER}%`, severity: erSeverity });
        }

        // Signal 2: F/F Ratio (0-20 pts)
        if (ffRatio !== null) {
            if (ffRatio < 0.3) {
                penaltyPct += 20;
                signals.push({ icon: '👥', label: `F/F ratio ${ffRatio.toFixed(1)}× — extreme follow-back pattern, audience likely mass-bought`, severity: 'high' });
            } else if (ffRatio < 0.6) {
                penaltyPct += 15;
                signals.push({ icon: '👥', label: `F/F ratio ${ffRatio.toFixed(1)}× — very low, suggests follow-for-follow`, severity: 'high' });
            } else if (ffRatio < 1) {
                penaltyPct += 8;
                signals.push({ icon: '👥', label: `F/F ratio ${ffRatio.toFixed(1)}× — below 1:1, follow-back strategy diluting audience`, severity: 'medium' });
            } else if (ffRatio < 2) {
                penaltyPct += 3;
                signals.push({ icon: '👥', label: `F/F ratio ${ffRatio.toFixed(1)}× — room for improvement, aiming for 3:1+`, severity: 'low' });
            } else {
                signals.push({ icon: '✅', label: `F/F ratio ${ffRatio.toFixed(1)}× — healthy organic ratio`, severity: 'good' });
            }
        }

        // Signal 3: Video/Reel Adoption (0-10 pts)
        // Low video adoption = potentially stale, less-recommended content
        if (videoRatio < 10 && videoRatio >= 0) {
            penaltyPct += 10;
            signals.push({ icon: '🎬', label: `Only ${videoRatio.toFixed(0)}% video content — missing Reels reach, algorithm favors video`, severity: 'high' });
        } else if (videoRatio < 25) {
            penaltyPct += 5;
            signals.push({ icon: '🎬', label: `${videoRatio.toFixed(0)}% video — below 30% benchmark for optimal discovery`, severity: 'medium' });
        } else {
            signals.push({ icon: '✅', label: `${videoRatio.toFixed(0)}% video — good Reels adoption for algorithmic reach`, severity: 'good' });
        }

        // Signal 4: Suspicious high-follower + zero-engagement (bot farm signal)
        if (followers > 5000 && engRate < 0.1) {
            penaltyPct += 15;
            signals.push({ icon: '🤖', label: `${this.fmt(followers)} followers with near-zero engagement — strong bot farm indicator`, severity: 'high' });
        } else if (followers > 10000 && engRate < 0.3) {
            penaltyPct += 8;
            signals.push({ icon: '🤖', label: `Large account (${this.fmt(followers)}) with ER ${engRate.toFixed(2)}% — suspiciously low`, severity: 'medium' });
        }

        // Positive signals (reduce penalty)
        const goodSignals = [];
        if (engRate > expectedER * 0.8) {
            goodSignals.push({ icon: '✅', label: `ER ${engRate.toFixed(2)}% is near benchmark — audience engages authentically`, severity: 'good' });
            penaltyPct = Math.max(0, penaltyPct - 8);
        }
        if (ffRatio !== null && ffRatio > 5) {
            goodSignals.push({ icon: '✅', label: `F/F ratio ${ffRatio.toFixed(1)}× — strong organic authority signal`, severity: 'good' });
            penaltyPct = Math.max(0, penaltyPct - 5);
        }
        if (videoRatio >= 40) {
            goodSignals.push({ icon: '✅', label: `${videoRatio.toFixed(0)}% video — high Reels adoption for growth`, severity: 'good' });
            penaltyPct = Math.max(0, penaltyPct - 3);
        }
        signals.push(...goodSignals);

        // Cap and compute
        const fakeRatio = Math.max(0, Math.min(90, penaltyPct));
        const fakeCount = Math.round(followers * fakeRatio / 100);
        const authentic = followers - fakeCount;
        const confidence = penaltyPct >= 30 ? 'high' : penaltyPct >= 10 ? 'medium' : 'low';

        // ── Follower quality breakdown ──
        // Distribute fake count into realistic categories
        const breakdown = this._computeFollowerBreakdown(followers, fakeCount, engRate, ffRatio);

        // Generate simulated fake follower profiles with reasons
        const fakeReasons = [
            { type: 'Ghost/Bot Account', icon: '👻', desc: 'Zero posts, no profile pic, no bio — automated or abandoned.', pct: breakdown.ghostPct },
            { type: 'Mass Follower Bot', icon: '🤖', desc: 'Follows 10,000+ accounts, 0 engagement — automated follow bot.', pct: breakdown.botPct },
            { type: 'Inactive/Dormant', icon: '💤', desc: 'No activity in 90+ days — was real, now dead weight.', pct: breakdown.dormantPct },
            { type: 'Suspicious/Spam', icon: '📢', desc: 'Spam bio/posts, link farms, no real engagement.', pct: breakdown.spamPct },
            { type: 'Low Quality', icon: '📉', desc: 'Very low engagement, likely bought or traded follows.', pct: breakdown.lowQualityPct },
        ];

        const fakeList = [];
        var totalPct = 0;
        for (var r = 0; r < fakeReasons.length; r++) {
            var reason = fakeReasons[r];
            var count = Math.max(1, Math.round(fakeCount * reason.pct / 100));
            if (count > 0 && totalPct < 95) {
                fakeList.push({
                    type: reason.type,
                    icon: reason.icon,
                    desc: reason.desc,
                    count: count,
                    pct: reason.pct
                });
                totalPct += reason.pct;
            }
        }

        return {
            fakeRatio: fakeRatio.toFixed(1),
            fakeCount,
            authentic,
            expectedER,
            confidence,
            signals,
            fakeList,
            // Follower quality breakdown
            audienceBreakdown: breakdown.audienceBreakdown
        };
    }

/**
 * _computeFollowerBreakdown — Deterministic follower quality segmentation
 * based on engagement patterns, follower/following ratio, and account signals.
 * No random values used.
 */
P._computeFollowerBreakdown = function(followers, fakeCount, engRate, ffRatio) {
        // Base percentages shift based on signals
        var ghostBase = 30, botBase = 20, dormantBase = 18, spamBase = 12, lowQualityBase = 12;
        var engagedBase = 40, casualBase = 35, superfanBase = 5;

        // Adjust based on engagement rate
        if (engRate < 0.3) {
            ghostBase += 10; botBase += 8; dormantBase += 5;
            engagedBase -= 15; casualBase -= 10;
        } else if (engRate < 1) {
            ghostBase += 3; botBase += 3;
            engagedBase -= 5;
        } else if (engRate > 3) {
            engagedBase += 10; superfanBase += 3;
            ghostBase -= 5; botBase -= 3;
        }

        // Adjust based on FF ratio
        if (ffRatio !== null) {
            if (ffRatio < 0.5) {
                botBase += 10; ghostBase += 5;
                engagedBase -= 8; superfanBase -= 2;
            } else if (ffRatio < 1) {
                botBase += 5;
                engagedBase -= 3;
            } else if (ffRatio > 5) {
                engagedBase += 5; superfanBase += 2;
                ghostBase -= 3; botBase -= 2;
            }
        }

        // Normalize positive breakdown
        ghostBase = Math.max(0, ghostBase);
        botBase = Math.max(0, botBase);
        dormantBase = Math.max(0, dormantBase);
        spamBase = Math.max(0, spamBase);
        lowQualityBase = Math.max(0, lowQualityBase);
        var totalBad = ghostBase + botBase + dormantBase + spamBase + lowQualityBase;
        if (totalBad > 0) {
            ghostBase = Math.round(ghostBase / totalBad * 100);
            botBase = Math.round(botBase / totalBad * 100);
            dormantBase = Math.round(dormantBase / totalBad * 100);
            spamBase = Math.round(spamBase / totalBad * 100);
            lowQualityBase = 100 - ghostBase - botBase - dormantBase - spamBase;
            if (lowQualityBase < 0) { lowQualityBase = 5; ghostBase -= 2; botBase -= 2; dormantBase -= 1; }
        }

        // Adjust positive breakdown
        engagedBase = Math.max(5, Math.min(60, engagedBase));
        casualBase = Math.max(10, Math.min(50, casualBase));
        superfanBase = Math.max(1, Math.min(15, superfanBase));
        var totalGood = engagedBase + casualBase + superfanBase;
        if (totalGood > 100) {
            engagedBase = Math.round(engagedBase / totalGood * 100);
            casualBase = Math.round(casualBase / totalGood * 100);
            superfanBase = 100 - engagedBase - casualBase;
        }
        if (totalGood < 100) {
            superfanBase = Math.min(15, superfanBase + (100 - totalGood));
        }

        var authenticCount = followers - fakeCount;
        var ghostPct = ghostBase;
        var botPct = botBase;
        var dormantPct = dormantBase;
        var spamPct = spamBase;
        var lowQualityPct = lowQualityBase;

        return {
            ghostPct: Math.max(5, ghostPct),
            botPct: Math.max(5, botPct),
            dormantPct: Math.max(5, dormantPct),
            spamPct: Math.max(5, spamPct),
            lowQualityPct: Math.max(5, lowQualityPct),
            audienceBreakdown: {
                superfans: Math.round(authenticCount * superfanBase / 100),
                engaged: Math.round(authenticCount * engagedBase / 100),
                casual: Math.round(authenticCount * casualBase / 100),
                dormant: Math.round(fakeCount * dormantPct / 100),
                suspicious: Math.round(fakeCount * (ghostPct + botPct + spamPct + lowQualityPct) / 100),
                _superfanPct: superfanBase,
                _engagedPct: engagedBase,
                _casualPct: casualBase
            }
        };
    }


P.renderFakeFollowerList = function(ff) {
        const container = document.getElementById('fakeFollowerList');
        if (!container) return;
        if (!ff || !ff.fakeList || !ff.fakeList.length) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">No suspicious accounts detected. ✅</p>';
            return;
        }

        // Render the signals list too if available
        var signalsHtml = '';
        if (ff.signals && ff.signals.length) {
            signalsHtml = '<div style="margin-top:12px">' +
                '<div style="font-size:.75rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">📊 Analysis Signals</div>' +
                ff.signals.map(function(s) {
                    var color = s.severity === 'high' ? '#ef4444' : s.severity === 'medium' ? '#f59e0b' : s.severity === 'low' ? '#94a3b8' : '#10b981';
                    return '<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:.8rem;color:var(--text-secondary);border-left:2px solid ' + color + ';margin-bottom:4px;background:rgba(0,0,0,.15);border-radius:4px">' +
                        '<span>' + s.icon + '</span>' +
                        '<span>' + s.label + '</span>' +
                        '</div>';
                }).join('') +
                '</div>';
        }

        // Follower quality breakdown
        var breakdownHtml = '';
        if (ff.audienceBreakdown) {
            var ab = ff.audienceBreakdown;
            breakdownHtml = '<div style="margin-top:12px">' +
                '<div style="font-size:.75rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">👥 Follower Quality Breakdown</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.8rem">' +
                '<div style="padding:6px 10px;background:rgba(16,185,129,.15);border-radius:6px;border-left:3px solid #10b981"><div style="font-weight:700;color:#10b981">Superfans</div><div style="color:var(--text-muted)">' + this.fmt(ab.superfans) + ' (' + ab._superfanPct + '%)</div></div>' +
                '<div style="padding:6px 10px;background:rgba(52,211,153,.15);border-radius:6px;border-left:3px solid #34d399"><div style="font-weight:700;color:#34d399">Engaged</div><div style="color:var(--text-muted)">' + this.fmt(ab.engaged) + ' (' + ab._engagedPct + '%)</div></div>' +
                '<div style="padding:6px 10px;background:rgba(148,163,184,.15);border-radius:6px;border-left:3px solid #94a3b8"><div style="font-weight:700;color:#94a3b8">Casual</div><div style="color:var(--text-muted)">' + this.fmt(ab.casual) + ' (' + ab._casualPct + '%)</div></div>' +
                '<div style="padding:6px 10px;background:rgba(239,68,68,.15);border-radius:6px;border-left:3px solid #ef4444"><div style="font-weight:700;color:#ef4444">Suspicious</div><div style="color:var(--text-muted)">' + this.fmt(ab.suspicious) + '</div></div>' +
                '</div></div>';
        }

        container.innerHTML = '<div class="fake-list-header">' +
            '<span>⚠️ Suspicious Account Types</span>' +
            '<span class="fake-list-count">' + ff.fakeList.length + ' categories</span>' +
            '</div>' +
            ff.fakeList.map(function(item) {
                return '<div class="fake-list-item">' +
                    '<span class="fake-list-icon">' + item.icon + '</span>' +
                    '<div class="fake-list-info">' +
                    '<div class="fake-list-reason">' + item.type + ' <span style="color:var(--text-muted);font-weight:400">~' + (item.count || 0) + ' followers</span></div>' +
                    '<div class="fake-list-detail">' + item.desc + '</div>' +
                    '</div></div>';
            }).join('') +
            signalsHtml +
            breakdownHtml;
    }

})();
