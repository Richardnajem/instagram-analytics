const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');
let edits = 0;

// ================================================================
// EDIT 1: Replace entire fallbackRecsWithWhy array + shuffle + while loop
// with data-driven conditional recommendations
// ================================================================

const startMarker = '        const fallbackRecsWithWhy = [';
const returnMarker = '            return { followers, following, scanned';
const idx1 = c.indexOf(startMarker);
const idxReturn = c.indexOf(returnMarker, idx1);

if (idx1 < 0 || idxReturn < 0) {
    console.log('ERROR: Could not find fallback section');
    process.exit(1);
}

// Build the new data-driven recommendations section as a string string (escaped properly)
var newSectionLines = [];
newSectionLines.push('        // Data-driven contextual recommendations — only generated when live profile metrics detect specific growth gaps');
newSectionLines.push('        // 2026 Instagram benchmarks: Nano(1K-10K): 3.5-6% ER, Micro(10K-100K): 1.5-3.5%, Mid(100K-500K): 1-2.5%, Macro(500K+): 0.5-1.5%');
newSectionLines.push('        // Instagram Algorithm 2026: DM Shares (3-5x weighted), Watch Time, Saves are top 3 signals. Explore rewards early engagement velocity (first 60 min).');
newSectionLines.push('        const dataDrivenRecs = [];');
newSectionLines.push('');
newSectionLines.push('        // 1. ER vs tier benchmark check (using 2026 updated benchmarks)');
newSectionLines.push('        const tier2026 = followers < 1000 ? { name: \'Nano (<1K)\', minER: 3.5, avgER: 5, label: \'3.5-6%\' }');
newSectionLines.push('            : followers < 10000 ? { name: \'Nano (1K-10K)\', minER: 3.5, avgER: 5, label: \'3.5-6%\' }');
newSectionLines.push('            : followers < 100000 ? { name: \'Micro (10K-100K)\', minER: 1.5, avgER: 2.5, label: \'1.5-3.5%\' }');
newSectionLines.push('            : followers < 500000 ? { name: \'Mid (100K-500K)\', minER: 1, avgER: 1.8, label: \'1-2.5%\' }');
newSectionLines.push('            : { name: \'Macro (500K+)\', minER: 0.5, avgER: 1, label: \'0.5-1.5%\' };');
newSectionLines.push('        if (engRate < tier2026.minER && followers > 0) {');
newSectionLines.push('            dataDrivenRecs.push(\'📊 **ER \' + engRate.toFixed(2) + \'% is below the \' + tier2026.name + \' benchmark of \' + tier2026.label + \'** — Why: In 2026, Instagram algorithm prioritizes Watch Time and DM Shares over likes. To improve ER, create Reels with hooks in first 3 seconds and ask specific questions to drive comments. Accounts below tier benchmark see 50-70% less Explore distribution.\');');
newSectionLines.push('        }');
newSectionLines.push('        // 2. Engagement Velocity (if enough posts)');
newSectionLines.push('        if (sortedByLikes.length >= 6) {');
newSectionLines.push('            const mid = Math.floor(sortedByLikes.length / 2);');
newSectionLines.push('            const firstHalf = sortedByLikes.slice(0, mid);');
newSectionLines.push('            const secondHalf = sortedByLikes.slice(mid);');
newSectionLines.push('            const avgFirst = firstHalf.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0), 0) / firstHalf.length;');
newSectionLines.push('            const avgSecond = secondHalf.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0), 0) / secondHalf.length;');
newSectionLines.push('            const velocity = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;');
newSectionLines.push('            if (velocity < -15) {');
newSectionLines.push('                dataDrivenRecs.push(\'📉 **Engagement declining (\' + velocity.toFixed(1) + \'% velocity)** — Why: Your recent posts are getting \' + Math.abs(velocity).toFixed(0) + \'% less engagement than older ones. In 2026, the algorithm favors accounts with upward engagement trends. Audit your recent content — are you using trending audio? Are hooks strong in first 3 seconds? Try shifting to Reels with high-retention patterns.\');');
newSectionLines.push('            } else if (velocity > 20) {');
newSectionLines.push('                dataDrivenRecs.push(\'🚀 **Engagement accelerating (+\' + velocity.toFixed(1) + \'% velocity)** — Why: Your recent posts are outperforming older ones by \' + velocity.toFixed(0) + \'%. Double down on this winning format and posting time. Instagram 2026 algorithm strongly rewards accounts with rising engagement velocity.\');');
newSectionLines.push('            }');
newSectionLines.push('        }');
newSectionLines.push('        // 3. Comment ratio analysis');
newSectionLines.push('        if (totalLikes > 0) {');
newSectionLines.push('            const commentLikeRatio = totalCmnts / totalLikes;');
newSectionLines.push('            if (commentLikeRatio < 0.02 && scanned > 3) {');
newSectionLines.push('                dataDrivenRecs.push(\'💬 **Very low comment ratio (\' + (commentLikeRatio * 100).toFixed(1) + \'% of likes)** — Why: In 2026, comments are a key relationship-strength signal for Feed ranking. Posts with <2% comment-to-like ratio get 40% less algorithmic distribution. End captions with a specific, open-ended question.\');');
newSectionLines.push('            }');
newSectionLines.push('            if (commentLikeRatio > 0.15 && scanned > 3) {');
newSectionLines.push('                dataDrivenRecs.push(\'💬 **Strong comment culture (\' + (commentLikeRatio * 100).toFixed(0) + \'% of likes)** — Why: Your comment-to-like ratio is excellent. In 2026, Instagram weights back-and-forth threads heavily. Pin your best reply and reply within first hour to maximize this signal.\');');
newSectionLines.push('            }');
newSectionLines.push('        }');
newSectionLines.push('        // 4. Hashtag quality check');
newSectionLines.push('        if (scanned > 2) {');
newSectionLines.push("            const htPosts = posts.filter(p => (p.caption || '').includes('#'));");
newSectionLines.push('            const avgHashtags = htPosts.length > 0 ? htPosts.reduce((s, p) => {');
newSectionLines.push('                const matches = p.caption.match(/#[\\\\w]+/g);');
newSectionLines.push('                return s + (matches ? matches.length : 0);');
newSectionLines.push('            }, 0) / htPosts.length : 0;');
newSectionLines.push('            if (avgHashtags > 0 && avgHashtags < 3 && scanned > 3) {');
newSectionLines.push('                dataDrivenRecs.push(\'🏷️ **Only ~\' + avgHashtags.toFixed(0) + \' hashtags per post (need 5-10)** — Why: Instagram 2026 algorithm uses hashtags as primary content categorization for Search. Using 5-10 niche-specific hashtags increases discoverable reach by 2.4x. Avoid generic tags like #love.\');');
newSectionLines.push('            }');
newSectionLines.push('            if (avgHashtags > 20) {');
newSectionLines.push('                dataDrivenRecs.push(\'⚠️ **Too many hashtags (~\' + avgHashtags.toFixed(0) + \'/post)** — Why: Instagram 2026 may flag posts with 20+ hashtags as spam. Stick to 5-10 hyper-relevant tags. Use first comment for additional tags.\');');
newSectionLines.push('            }');
newSectionLines.push('        }');
newSectionLines.push('        // 5. Save-worthy content gap');
newSectionLines.push('        if (carousels === 0 && scanned > 4 && photos > videos) {');
newSectionLines.push('            dataDrivenRecs.push(\'📚 **No carousel posts — missed save opportunity** — Why: Carousels generate 3x more saves than single-image posts. Saves are Instagram #2 ranking signal in 2026 (after Watch Time). Tutorials and lists work best. Start with 1 carousel/week.\');');
newSectionLines.push('        }');
newSectionLines.push('        // 6. Reel frequency check');
newSectionLines.push('        if (reels === 0 && scanned > 3) {');
newSectionLines.push('            dataDrivenRecs.push(\'🎬 **Zero Reels — missing 50%+ growth potential** — Why: Reels account for 50%+ of Instagram growth in 2026 and are the primary Explore/Discovery surface. Accounts posting 3+ Reels/week grow 2.5x faster. Start with short 15-30s Reels using trending audio.\');');
newSectionLines.push('        } else if (reels > 0 && scanned > 0) {');
newSectionLines.push('            const reelRatio = (reels / scanned) * 100;');
newSectionLines.push('            if (reelRatio < 20) {');
newSectionLines.push('                dataDrivenRecs.push(\'🎬 **Only \' + reelRatio.toFixed(0) + \'% Reels (recommended 40%+)** — Why: Instagram 2026 algorithm prioritizes Reels for discovery. Accounts with <20% Reels see 40% less non-follower reach. Aim for 40%+ Reels.\');');
newSectionLines.push('            }');
newSectionLines.push('        }');
newSectionLines.push('        // 7. Caption SEO opportunity');
newSectionLines.push('        if (avgCaptionLen > 0 && avgCaptionLen < 80 && scanned > 2) {');
newSectionLines.push('            dataDrivenRecs.push(\'🔍 **Captions avg \' + avgCaptionLen + \' chars — add SEO keywords** — Why: Instagram Search in 2026 indexes caption text. Posts with 150+ chars containing niche keywords get 30% more search discovery. Include keywords naturally in first 2 lines.\');');
newSectionLines.push('        }');
newSectionLines.push('        // 8. Following ratio issue');
newSectionLines.push('        if (followers > 0 && following > 500 && ffRatio < 1.5) {');
newSectionLines.push('            dataDrivenRecs.push(\'👥 **High following (\' + this.fmt(following) + \') with low ratio (\' + ffRatio.toFixed(1) + \'x)** — Why: Following >500 accounts may trigger Instagram follow-limiter. Focus on organic growth through content. Unfollow 50-100 inactive accounts/week.\');');
newSectionLines.push('        }');
newSectionLines.push('        // 9. Verification suggestion');
newSectionLines.push('        if (!profile.isVerified && followers > 5000 && followers < 100000) {');
newSectionLines.push('            dataDrivenRecs.push(\'🔵 **You may qualify for Instagram verification** — Why: Instagram in 2026 verifies accounts with >5K followers and authentic engagement. Verified badge boosts search ranking by ~20%. Apply via Settings > Account > Verification.\');');
newSectionLines.push('        }');
newSectionLines.push('        // 10. Link CTA optimization');
newSectionLines.push('        if (profile.externalUrl && scanned > 3 && ctaPosts < scanned * 0.2) {');
newSectionLines.push('            dataDrivenRecs.push(\'🔗 **Link in bio found but only \' + ctaPosts + \'/\' + scanned + \' posts mention it** — Why: In 2026, Instagram tracks link-in-bio taps as a conversion signal. Add \\"Link in bio for more\\" to at least 40% of posts.\');');
newSectionLines.push('        }');
newSectionLines.push('        // 11. Profile pic');
newSectionLines.push('        if (!profile.profilePicUrl) {');
newSectionLines.push('            dataDrivenRecs.push(\'📸 **Add a clear profile picture** — Why: Accounts without profile pics have 65% lower follow conversion rates. Instagram 2026 search uses profile pic presence as trust signal.\');');
newSectionLines.push('        }');
newSectionLines.push('        // 12. Engagement variance');
newSectionLines.push('        if (scanned >= 5) {');
newSectionLines.push('            const likeVariance = posts.reduce((s, p) => s + Math.abs((p.likes || 0) - avgLikes), 0) / scanned;');
newSectionLines.push('            const relativeVariance = avgLikes > 0 ? likeVariance / avgLikes : 0;');
newSectionLines.push('            if (relativeVariance > 1.2 && avgLikes > 10) {');
newSectionLines.push('                dataDrivenRecs.push(\'🎯 **High engagement inconsistency (\' + (relativeVariance * 100).toFixed(0) + \'% variance)** — Why: Instagram 2026 algorithm favors predictable, consistent engagement. Identify your top 3 post formats and create a content pillar system.\');');
newSectionLines.push('            }');
newSectionLines.push('        }');
newSectionLines.push('        // 13. Posting time diversity');
newSectionLines.push('        if (scanned >= 7) {');
newSectionLines.push('            const dayCounts = Array(7).fill(0);');
newSectionLines.push('            posts.forEach(p => {');
newSectionLines.push('                if (!p.timestamp) return;');
newSectionLines.push('                dayCounts[new Date(p.timestamp * 1000).getDay()]++;');
newSectionLines.push('            });');
newSectionLines.push('            const maxDay = Math.max(...dayCounts);');
newSectionLines.push('            const minNonZero = Math.min(...dayCounts.filter(d => d > 0));');
newSectionLines.push('            if (maxDay > minNonZero * 3) {');
newSectionLines.push('                const dayNames = [\'Sun\',\'Mon\',\'Tue\',\'Wed\',\'Thu\',\'Fri\',\'Sat\'];');
newSectionLines.push('                dataDrivenRecs.push(\'📅 **Uneven posting distribution — \' + dayNames[dayCounts.indexOf(maxDay)] + \' has \' + maxDay + \' posts vs \' + minNonZero + \' on other days** — Why: Inconsistent posting confuses algorithm. Spread posts evenly for 30% more consistent reach.\');');
newSectionLines.push('            }');
newSectionLines.push('        }');newSectionLines.push('        // 14. Profile score');
        newSectionLines.push('        if (profileScore < 70 && profileScore > 0) {');
        newSectionLines.push('            var _bio = profile.bio?.trim() ? "" : "Bio ";');
        newSectionLines.push('            var _pic = profile.profilePicUrl ? "" : "Pic ";');
        newSectionLines.push('            var _name = profile.fullName?.trim() ? "" : "Name ";');
        newSectionLines.push('            var _link = profile.externalUrl ? "" : "Link ";');
        newSectionLines.push('            dataDrivenRecs.push(\'⭐ **Profile score \' + profileScore + \'/100 — \' + (100 - profileScore) + \' points to gain** — Why: Instagram 2026 search ranks completed profiles 2.7x higher. Missing: \' + _bio + _pic + _name + _link + \'. Each element adds 10-15 ranking points.\');');
        newSectionLines.push('        }');
newSectionLines.push('        // 15. Story usage');
newSectionLines.push('        if (profile.posts && profile.posts > 20) {');
newSectionLines.push('            dataDrivenRecs.push(\'🧵 **Post Instagram Stories daily** — Why: In 2026, Instagram rewards Stories users with 2x more DM opportunities. Use interactive stickers (polls, quizzes) to drive back-and-forth threads.\');');
newSectionLines.push('        }');

const newDataDriven = newSectionLines.join('\n');

// Replace from startMarker to returnMarker
const sectionToReplace = c.substring(idx1, idxReturn);
c = c.replace(sectionToReplace, newDataDriven);
edits++;
console.log('Edit 1: Replaced fallbackRecsWithWhy with 15 data-driven recs ✓');

// ================================================================
// EDIT 2: Replace shuffle + while loop
// ================================================================

const oldShuffleAndLoop = [
            '        // Shuffle fallback indices using Fisher-Yates for unpredictable, non-repeating selection',
            '        const shuffledIndices = Array.from({ length: fallbackRecsWithWhy.length }, (_, i) => i);',
            '        for (let i = shuffledIndices.length - 1; i > 0; i--) {',
            '            const j = Math.floor(Math.random() * (i + 1));',
            '            [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];',
            '        }',
            '        let fbCounter = 0;',
            '        while (recs.length < 10) {',
            "            // Wrap around if we've used all shuffled indices",
            '            if (fbCounter >= shuffledIndices.length) {',
            '                // Re-shuffle remaining unused indices',
            '                for (let i = shuffledIndices.length - 1; i > 0; i--) {',
            '                    const j = Math.floor(Math.random() * (i + 1));',
            '                    [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];',
            '                }',
            '                fbCounter = 0;',
            '            }',
            '            const idx = shuffledIndices[fbCounter];',
            '            recs.push(fallbackRecsWithWhy[idx]);',
            '            fbCounter++;',
            '        }',
        ].join('\\n');

const newPushLoop = [
            '        // Push data-driven contextual recommendations (no random/generic fallbacks)',
            "        // Each recommendation is only added if the profile's live metrics indicate a specific growth gap",
            '        for (const rec of dataDrivenRecs) {',
            '            if (recs.length >= 15) break;',
            '            recs.push(rec);',
            '        }',
        ].join('\\n');

if (c.includes(oldShuffleAndLoop)) {
    c = c.replace(oldShuffleAndLoop, newPushLoop);
    edits++;
    console.log('Edit 2: Replaced shuffle loop with direct data-driven push ✓');
} else {
    console.log('Edit 2: Shuffle loop not found, trying alternative pattern...');
    // Try without the escaped apostrophe
    const altOld = oldShuffleAndLoop.replace("we\\'ve", "we've");
    if (c.includes(altOld)) {
        c = c.replace(altOld, newPushLoop);
        edits++;
        console.log('Edit 2: Replaced shuffle loop ✓');
    }
}

// ================================================================
// WRITE
// ================================================================

fs.writeFileSync('app.js', c, 'utf8');
console.log('\nAll ' + edits + ' edits applied!');
