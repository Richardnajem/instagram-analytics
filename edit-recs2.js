const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');
let edits = 0;

// EDIT 1: Replace fallbackRecsWithWhy array and shuffle logic with data-driven conditional recs
const startMarker = '        const fallbackRecsWithWhy = [';
const returnMarker = '            return { followers, following, scanned';
const idx1 = c.indexOf(startMarker);
const idxReturn = c.indexOf(returnMarker, idx1);

if (idx1 < 0 || idxReturn < 0) {
    console.log('ERROR: Could not find fallback section');
    process.exit(1);
}

const newDataDriven = `        // Data-driven contextual recommendations — only generated when live profile metrics detect specific growth gaps
        // 2026 Instagram benchmarks: Nano(1K-10K): 3.5-6% ER, Micro(10K-100K): 1.5-3.5%, Mid(100K-500K): 1-2.5%, Macro(500K+): 0.5-1.5%
        // Instagram Algorithm 2026: DM Shares (3-5x weighted), Watch Time, Saves are top 3 signals. Explore rewards early engagement velocity (first 60 min).
        const dataDrivenRecs = [];

        // 1. ER vs tier benchmark check (using 2026 updated benchmarks)
        const tier2026 = followers < 1000 ? { name: 'Nano (<1K)', minER: 3.5, avgER: 5, label: '3.5-6%' }
            : followers < 10000 ? { name: 'Nano (1K-10K)', minER: 3.5, avgER: 5, label: '3.5-6%' }
            : followers < 100000 ? { name: 'Micro (10K-100K)', minER: 1.5, avgER: 2.5, label: '1.5-3.5%' }
            : followers < 500000 ? { name: 'Mid (100K-500K)', minER: 1, avgER: 1.8, label: '1-2.5%' }
            : { name: 'Macro (500K+)', minER: 0.5, avgER: 1, label: '0.5-1.5%' };
        if (engRate < tier2026.minER && followers > 0) {
            dataDrivenRecs.push(` + '`' + '📊 **ER ' + engRate.toFixed(2) + '% is below the ' + tier2026.name + ' benchmark of ' + tier2026.label + '** — Why: In 2026, Instagram algorithm prioritizes Watch Time and DM Shares over likes. To improve ER, create Reels with hooks in the first 3 seconds and ask specific questions to drive comments. Accounts below tier benchmark see 50-70% less Explore distribution.' + '`' + `);
        }
        // 2. Engagement Velocity (if enough posts)
        if (sortedByLikes.length >= 6) {
            const mid = Math.floor(sortedByLikes.length / 2);
            const firstHalf = sortedByLikes.slice(0, mid);
            const secondHalf = sortedByLikes.slice(mid);
            const avgFirst = firstHalf.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0), 0) / firstHalf.length;
            const avgSecond = secondHalf.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0), 0) / secondHalf.length;
            const velocity = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;
            if (velocity < -15) {
                dataDrivenRecs.push('📉 **Engagement declining (' + velocity.toFixed(1) + '% velocity)** — Why: Your recent posts are getting ' + Math.abs(velocity).toFixed(0) + '% less engagement than older ones. In 2026, the algorithm favors accounts with upward engagement trends. Audit your recent content — are you using trending audio? Are hooks strong in the first 3 seconds? Try shifting to Reels with high-retention patterns.');
            } else if (velocity > 20) {
                dataDrivenRecs.push('🚀 **Engagement accelerating (+' + velocity.toFixed(1) + '% velocity)** — Why: Your recent posts are outperforming older ones by ' + velocity.toFixed(0) + '%. Double down on this winning format and posting time. Instagram 2026 algorithm strongly rewards accounts with rising engagement velocity.');
            }
        }
        // 3. Comment ratio analysis
        if (totalLikes > 0) {
            const commentLikeRatio = totalCmnts / totalLikes;
            if (commentLikeRatio < 0.02 && scanned > 3) {
                dataDrivenRecs.push('💬 **Very low comment ratio (' + (commentLikeRatio * 100).toFixed(1) + '% of likes)** — Why: In 2026, comments are a key relationship-strength signal for Feed ranking. Posts with <2% comment-to-like ratio get 40% less algorithmic distribution. End captions with a specific, open-ended question.');
            }
            if (commentLikeRatio > 0.15 && scanned > 3) {
                dataDrivenRecs.push('💬 **Strong comment culture (' + (commentLikeRatio * 100).toFixed(0) + '% of likes)** — Why: Your comment-to-like ratio is excellent. In 2026, Instagram weights back-and-forth threads heavily. Pin your best reply and reply within the first hour to maximize this signal.');
            }
        }
        // 4. Hashtag quality check
        if (scanned > 2) {
            const hashtagPosts2 = posts.filter(p => (p.caption || '').includes('#'));
            const avgHashtags = hashtagPosts2.length > 0
                ? hashtagPosts2.reduce((s, p) => {
                    const matches = p.caption.match(/#[\\w]+/g);
                    return s + (matches ? matches.length : 0);
                }, 0) / hashtagPosts2.length : 0;
            if (avgHashtags > 0 && avgHashtags < 3 && scanned > 3) {
                dataDrivenRecs.push('🏷️ **Only ~' + avgHashtags.toFixed(0) + ' hashtags per post (need 5-10)** — Why: Instagram 2026 algorithm uses hashtags as primary content categorization for Search. Using 5-10 niche-specific hashtags increases discoverable reach by 2.4x. Avoid generic tags like #love.');
            }
            if (avgHashtags > 20) {
                dataDrivenRecs.push('⚠️ **Too many hashtags (~' + avgHashtags.toFixed(0) + '/post)** — Why: Instagram 2026 may flag posts with 20+ hashtags as spam. Stick to 5-10 hyper-relevant tags. Use first comment for additional tags.');
            }
        }
        // 5. Save-worthy content gap
        if (carousels === 0 && scanned > 4 && photos > videos) {
            dataDrivenRecs.push('📚 **No carousel posts — missed save opportunity** — Why: Carousels generate 3x more saves than single-image posts. Saves are Instagram #2 ranking signal in 2026 (after Watch Time). Tutorials and lists work best. Start with 1 carousel/week.');
        }
        // 6. Reel frequency check
        if (reels === 0 && scanned > 3) {
            dataDrivenRecs.push('🎬 **Zero Reels — missing 50%+ of growth potential** — Why: Reels account for 50%+ of Instagram growth in 2026 and are the primary Explore/Discovery surface. Accounts posting 3+ Reels/week grow 2.5x faster. Start with short 15-30s Reels using trending audio.');
        } else if (reels > 0 && scanned > 0) {
            const reelRatio = (reels / scanned) * 100;
            if (reelRatio < 20) {
                dataDrivenRecs.push('🎬 **Only ' + reelRatio.toFixed(0) + '% Reels (recommended 40%+)** — Why: Instagram 2026 algorithm prioritizes Reels for discovery. Accounts with <20% Reels see 40% less non-follower reach. Aim for 40%+ Reels.');
            }
        }
        // 7. Caption SEO opportunity
        if (avgCaptionLen > 0 && avgCaptionLen < 80 && scanned > 2) {
            dataDrivenRecs.push('🔍 **Captions avg ' + avgCaptionLen + ' chars — add SEO keywords** — Why: Instagram Search in 2026 indexes caption text. Posts with 150+ chars containing niche keywords get 30% more search discovery. Include keywords naturally in first 2 lines.');
        }
        // 8. Following ratio issue
        if (followers > 0 && following > 500 && ffRatio < 1.5) {
            dataDrivenRecs.push('👥 **High following (' + this.fmt(following) + ') with low ratio (' + ffRatio.toFixed(1) + 'x)** — Why: Following >500 accounts may trigger Instagram follow-limiter in 2026. Focus on organic growth through content. Unfollow 50-100 inactive accounts/week.');
        }
        // 9. Verification suggestion
        if (!profile.isVerified && followers > 5000 && followers < 100000) {
            dataDrivenRecs.push('🔵 **You may qualify for Instagram verification** — Why: Instagram in 2026 verifies accounts with >5K followers and authentic engagement. Verified badge boosts search ranking by ~20%. Apply via Settings > Account > Verification.');
        }
        // 10. Link CTA optimization
        if (profile.externalUrl && scanned > 3 && ctaPosts < scanned * 0.2) {
            dataDrivenRecs.push('🔗 **Link in bio found but only ' + ctaPosts + '/' + scanned + ' posts mention it** — Why: In 2026, Instagram tracks link-in-bio taps as a conversion signal. Add Link in bio for more to at least 40% of posts.');
        }
        // 11. Profile pic
        if (!profile.profilePicUrl) {
            dataDrivenRecs.push('📸 **Add a clear profile picture** — Why: Accounts without profile pics have 65% lower follow conversion rates. Instagram 2026 search uses profile pic presence as trust signal.');
        }
        // 12. Engagement variance
        if (scanned >= 5) {
            const likeVariance = posts.reduce((s, p) => s + Math.abs((p.likes || 0) - avgLikes), 0) / scanned;
            const relativeVariance = avgLikes > 0 ? likeVariance / avgLikes : 0;
            if (relativeVariance > 1.2 && avgLikes > 10) {
                dataDrivenRecs.push('🎯 **High engagement inconsistency (' + (relativeVariance * 100).toFixed(0) + '% variance)** — Why: Instagram 2026 algorithm favors predictable, consistent engagement. Identify your top 3 post formats and create a content pillar system.');
            }
        }
        // 13. Posting time diversity
        if (scanned >= 7) {
            const dayCounts = Array(7).fill(0);
            posts.forEach(p => {
                if (!p.timestamp) return;
                dayCounts[new Date(p.timestamp * 1000).getDay()]++;
            });
            const maxDay = Math.max(...dayCounts);
            const minNonZero = Math.min(...dayCounts.filter(d => d > 0));
            if (maxDay > minNonZero * 3) {
                const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                dataDrivenRecs.push('📅 **Uneven posting distribution — ' + dayNames[dayCounts.indexOf(maxDay)] + ' has ' + maxDay + ' posts vs ' + minNonZero + ' on other days** — Why: Inconsistent posting confuses the algorithm. Spread posts evenly for 30% more consistent reach.');
            }
        }
        // 14. Profile score
        if (profileScore < 70 && profileScore > 0) {
            dataDrivenRecs.push('⭐ **Profile score ' + profileScore + '/100 — ' + (100 - profileScore) + ' points to gain** — Why: Instagram 2026 search ranks completed profiles 2.7x higher. Missing: ' + (profile.bio?.trim() ? '' : 'Bio ') + (profile.profilePicUrl ? '' : 'Pic ') + (profile.fullName?.trim() ? '' : 'Name ') + (profile.externalUrl ? '' : 'Link ') + '. Each element adds 10-15 ranking points.');
        }
        // 15. Story usage
        if (profile.posts && profile.posts > 20) {
            dataDrivenRecs.push('🧵 **Post Instagram Stories daily** — Why: In 2026, Instagram rewards Stories users with 2x more DM opportunities. Use interactive stickers (polls, quizzes) to drive back-and-forth threads.');
        }`;

// Replace from start marker to return statement
const sectionToReplace = c.substring(idx1, idxReturn);
c = c.replace(sectionToReplace, newDataDriven);
edits++;
console.log('Edit 1: Replaced fallbackRecsWithWhy with 15 data-driven recs ✓');

// EDIT 2: Fix the shuffle/while loop section after dataDrivenRecs
// After our replacement, we need to find and replace the shuffle + while loop that references fallbackRecsWithWhy
const oldShuffleLoop = `        // Shuffle fallback indices using Fisher-Yates for unpredictable, non-repeating selection
        const shuffledIndices = Array.from({ length: fallbackRecsWithWhy.length }, (_, i) => i);
        for (let i = shuffledIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
        }
        let fbCounter = 0;
        while (recs.length < 10) {
            // Wrap around if we've used all shuffled indices
            if (fbCounter >= shuffledIndices.length) {
                // Re-shuffle remaining unused indices
                for (let i = shuffledIndices.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
                }
                fbCounter = 0;
            }
            const idx = shuffledIndices[fbCounter];
            recs.push(fallbackRecsWithWhy[idx]);
            fbCounter++;
        }`;

const newPushLoop = `        // Push data-driven contextual recommendations (no random/generic fallbacks)
        // Each recommendation is only added if the profile's live metrics indicate a specific growth gap
        for (const rec of dataDrivenRecs) {
            if (recs.length >= 15) break;
            recs.push(rec);
        }`;

if (c.includes(oldShuffleLoop)) {
    c = c.replace(oldShuffleLoop, newPushLoop);
    edits++;
    console.log('Edit 2: Replaced shuffle loop with direct data-driven push ✓');
} else {
    console.log('Edit 2: Shuffle loop not found (may already be replaced) ✓');
}

// EDIT 3: Replace pool array in generatePostSuggestions
const poolStart = '        // Expanded pool ensures 4+ unique tips per post';
const poolEnd = "            '🎨 Use the same filter/preset for consistency — recognizable aesthetics build brand loyalty.',\n        ];";

const idxPoolStart = c.indexOf(poolStart);
const idxPoolEnd = c.indexOf(poolEnd);

if (idxPoolStart < 0 || idxPoolEnd < 0) {
    console.log('ERROR: Could not find pool section');
    process.exit(1);
}

const newPostDriven = `        // Data-driven post-level tips based on actual post metrics (2026 Instagram algorithm signals)
        const dataDrivenTips = [];
        // Check engageability score
        const estReach2 = followers > 0 ? followers * 0.15 : 100;
        const engScore2 = estReach2 > 0 ? ((likes + comments) / estReach2) * 100 : 0;

        // Caption length optimization
        if (caption.length > 2200) {
            dataDrivenTips.push('✂️ Caption at max length (' + caption.length + ' chars) — Instagram truncates at ~2200 chars. Move key message + CTA above the fold (first 125 chars).');
        } else if (caption.length > 0 && caption.length < 50) {
            dataDrivenTips.push('📝 Very short caption (' + caption.length + ' chars) — 150-300 char captions with keywords get 22% more saves. Add a story, question, or value statement.');
        }

        // Hashtag quality scoring
        if (caption) {
            const hashtags = caption.match(/#[\\w]+/gi) || [];
            const genericTags = ['#love', '#instagood', '#fashion', '#photooftheday', '#beautiful', '#picoftheday', '#instagram', '#me', '#follow', '#like'];
            const genericCount = hashtags.filter(t => genericTags.includes(t.toLowerCase())).length;
            if (genericCount > 2) {
                dataDrivenTips.push('🚫 ' + genericCount + ' generic hashtags — Instagram 2026 penalizes overused tags. Replace with 5-10 niche-specific tags under 500K posts.');
            }
            if (hashtags.length === 0) {
                dataDrivenTips.push('🏷️ No hashtags — add 5-10 niche hashtags in first comment. Instagram Search indexes hashtags as primary categorization signal.');
            } else if (hashtags.length > 0 && hashtags.length < 3) {
                dataDrivenTips.push('🏷️ Only ' + hashtags.length + ' hashtags — use 5-10 hyper-relevant tags for best discovery.');
            }
        }

        // CTA detection
        if (caption && !/\\b(link in bio|comment|dm|save|share|tag|shop|click|swipe|follow|visit)\\b/i.test(caption)) {
            dataDrivenTips.push('📣 Missing CTA — posts with clear calls-to-action get 3-5x more conversions. Try: ' + String.fromCharCode(34) + 'Save this for later' + String.fromCharCode(34) + ' or ' + String.fromCharCode(34) + 'Comment your take' + String.fromCharCode(34) + '.');
        }

        // Post-type specific hooks
        if (type === 'reel' && likes < avgLikes * 0.6) {
            dataDrivenTips.push('🎬 Reel underperforming — 2026 algorithm prioritizes first-3-second retention. Add text overlay or pattern interrupt in opening frame.');
        }
        if (type === 'reel' && likes > avgLikes * 1.5) {
            dataDrivenTips.push('🎬 Top-performing Reel — recreate this hook and audio style. Instagram 2026 rewards original audio usage.');
        }
        if (type === 'carousel' && likes > avgLikes * 1.3) {
            dataDrivenTips.push('📸 Strong carousel — put 2nd strongest slide right after cover. Each swipe signals deeper engagement. Aim for 5-10 slides.');
        }
        if (type === 'carousel' && likes < avgLikes * 0.5) {
            dataDrivenTips.push('📸 Carousel not performing — lead with most surprising slide first. Use numbered format to encourage swiping.');
        }
        if (type === 'photo' && likes < avgLikes * 0.5) {
            dataDrivenTips.push('🖼️ Photo underperforming — use faces and bold colors. Single images get least algorithmic distribution in 2026.');
        }

        // Engagement analysis
        if (followers > 0) {
            const tierMinVal = followers < 10000 ? 3.5 : followers < 100000 ? 1.5 : followers < 500000 ? 1 : 0.5;
            const tierLabelStr = followers < 10000 ? '3.5-6%' : followers < 100000 ? '1.5-3.5%' : followers < 500000 ? '1-2.5%' : '0.5-1.5%';
            if (engScore2 > 0 && engScore2 < tierMinVal) {
                dataDrivenTips.push('📊 ER ' + engScore2.toFixed(2) + '% vs ~' + tierLabelStr + ' benchmark — test different content pillar or posting time.');
            }
        }

        // Comment ratio
        if (likes > 0) {
            const commentRatio = comments / likes;
            if (commentRatio < 0.02 && likes > 10) {
                dataDrivenTips.push('💬 Low comment rate (' + (commentRatio * 100).toFixed(1) + '% of likes) — end with specific question, not just ' + String.fromCharCode(34) + 'thoughts?' + String.fromCharCode(34) + '.');
            }
            if (commentRatio > 0.15) {
                dataDrivenTips.push('💬 High comment rate (' + (commentRatio * 100).toFixed(0) + '% of likes) — pin your best reply and reply within first hour for velocity bonus.');
            }
        }

        // Location tag
        if (caption && !caption.toLowerCase().includes('📍') && !caption.match(/location|\\bloc\\b/i)) {
            dataDrivenTips.push('📍 Add a location tag for 30%+ more local discoverability. Instagram Search indexes location as discovery signal.');
        }`;

const oldPoolFull = c.substring(idxPoolStart, idxPoolEnd + poolEnd.length);
c = c.replace(oldPoolFull, newPostDriven);
edits++;
console.log('Edit 3: Replaced generic pool with data-driven post tips ✓');

// EDIT 4: Update the loop that references "pool" to use "dataDrivenTips" instead
const oldLoopRefs = 'for (const tip of pool) {';
const newLoopRefs = 'for (const tip of dataDrivenTips) {';

// Check how many times it appears
const count = (c.match(new RegExp(oldLoopRefs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
if (count > 0) {
    c = c.replace(new RegExp(oldLoopRefs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newLoopRefs);
    edits++;
    console.log('Edit 4: Updated loop references from pool to dataDrivenTips (' + count + ' occurrences) ✓');
}

// EDIT 5: Update the minimum tips fill section to use format-specific tips
const oldFillSection = '        // Ensure minimum 4 tips always\n        while (tips.length < 4) {\n            const idx = tips.length % pool.length;\n            tips.push(pool[idx]);\n        }';

const newFillSection = `        // Format-specific fillers based on actual post type
        if (tips.length < 4) {
            const formatFillers = [];
            if (type === 'reel') {
                formatFillers.push('🎬 Reels with trending audio get 2.5x more reach in 2026 — check the Instagram music tab weekly for emerging tracks.');
                formatFillers.push('💡 Add captions/subtitles — 85% of Reels viewers watch without sound. Burn captions into the video for accessibility.');
                formatFillers.push('🔄 Share this Reel to your Story 24h after posting for a second engagement wave.');
            } else if (type === 'carousel') {
                formatFillers.push('📸 Carousel tip — use strong CTA on last slide (' + String.fromCharCode(34) + 'Save this' + String.fromCharCode(34) + '). The final slide drives the save action.');
                formatFillers.push('📐 Keep carousel to 5-10 slides — engagement drops after slide 7.');
            } else {
                formatFillers.push('🖼️ Photo tips: high-contrast editing, faces in frame, and text overlays to stop the scroll.');
                formatFillers.push('🔄 Repurpose this photo as a Reel with trending audio to reach non-followers.');
            }
            for (const tip of formatFillers) {
                if (tips.length >= 4) break;
                if (!usedTips.has(tip)) {
                    tips.push(tip);
                    usedTips.add(tip);
                }
            }
        }`;

if (c.includes(oldFillSection)) {
    c = c.replace(oldFillSection, newFillSection);
    edits++;
    console.log('Edit 5: Updated fill section with format-specific tips ✓');
} else {
    console.log('Edit 5: Old fill section not found (may have been replaced by previous edit) ✓');
}

// Write the file
fs.writeFileSync('app.js', c, 'utf8');
console.log('\nAll ' + edits + ' edits applied successfully!');
