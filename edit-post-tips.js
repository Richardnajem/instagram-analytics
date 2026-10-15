const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');
let count = 0;

// Replace the pool section in generatePostSuggestions
// Find the unique marker text and work from there
const marker1 = "        // Expanded pool ensures 4+ unique tips per post";
const marker2 = "            '🎨 Use the same filter/preset for consistency — recognizable aesthetics build brand loyalty.',\n        ];\n        const usedTips = new Set(tips);\n        for (const tip of pool) {\n            if (tips.length >= 6) break;\n            if (!usedTips.has(tip)) {\n                tips.push(tip);\n                usedTips.add(tip);\n            }\n        }\n        if (tips.length < 4) {\n            for (const tip of pool) {\n                if (tips.length >= 4) break;\n                if (!usedTips.has(tip)) {\n                    tips.push(tip);\n                    usedTips.add(tip);\n                }\n            }\n        }\n        return tips.slice(0, 6);\n    }";

const replacement = `        // Data-driven post-level tips based on actual post metrics (2026 Instagram algorithm signals)
        const dataDrivenTips = [];
        const estReach2 = followers > 0 ? followers * 0.15 : 100;
        const engScore2 = estReach2 > 0 ? ((likes + comments) / estReach2) * 100 : 0;

        // Caption length optimization
        if (caption.length > 2200) {
            dataDrivenTips.push(\'✂️ Caption at max length (\' + caption.length + \' chars) — Instagram truncates at ~2200 chars. Move key message + CTA above the fold (first 125 chars).\');
        } else if (caption.length > 0 && caption.length < 50) {
            dataDrivenTips.push(\'📝 Very short caption (\' + caption.length + \' chars) — 150-300 char captions with niche keywords get 22% more saves. Add a story, question, or value statement.\');
        }

        // Hashtag quality scoring
        if (caption) {
            const hashtags = caption.match(/#[\\\\w]+/gi) || [];
            const generic = [\'#love\', \'#instagood\', \'#fashion\', \'#photooftheday\', \'#beautiful\', \'#picoftheday\', \'#instagram\', \'#me\', \'#follow\', \'#like\'];
            const gc = hashtags.filter(t => generic.includes(t.toLowerCase())).length;
            if (gc > 2) dataDrivenTips.push(\'🚫 \' + gc + \' generic hashtags — Instagram 2026 penalizes overused tags. Replace with 5-10 niche-specific tags under 500K posts.\');
            if (hashtags.length === 0) dataDrivenTips.push(\'🏷️ No hashtags — add 5-10 niche hashtags in first comment. Instagram Search indexes hashtags as primary categorization signal.\');
            else if (hashtags.length < 3) dataDrivenTips.push(\'🏷️ Only \' + hashtags.length + \' hashtags — use 5-10 hyper-relevant tags for best Search discovery.\');
        }

        // CTA detection
        if (caption && !/\\\\b(link in bio|comment|dm|save|share|tag|shop|click|swipe|follow|visit)\\\\b/i.test(caption)) {
            dataDrivenTips.push(\'📣 Missing CTA — posts with clear CTAs get 3-5x more conversions. Try: \"Save this for later\" or \"Comment your take\".\');
        }

        // Post-type specific hooks
        if (type === \'reel\' && likes < avgLikes * 0.6) dataDrivenTips.push(\'🎬 Reel underperforming — 2026 algorithm prioritizes first-3-second retention. Add text overlay or pattern interrupt in opening frame.\');
        if (type === \'reel\' && likes > avgLikes * 1.5) dataDrivenTips.push(\'🎬 Top-performing Reel — recreate this hook and audio style. Instagram 2026 rewards original audio usage.\');
        if (type === \'carousel\' && likes > avgLikes * 1.3) dataDrivenTips.push(\'📸 Strong carousel — put 2nd strongest slide right after cover. Each swipe signals deeper engagement. Aim for 5-10 slides.\');
        if (type === \'carousel\' && likes < avgLikes * 0.5) dataDrivenTips.push(\'📸 Carousel underperforming — lead with most surprising slide first. Use numbered format to encourage swiping.\');
        if (type === \'photo\' && likes < avgLikes * 0.5) dataDrivenTips.push(\'🖼️ Photo underperforming — use faces and bold colors. Single images get least algorithmic distribution in 2026.\');

        // Engagement vs tier benchmark
        if (followers > 0) {
            const tierMin = followers < 10000 ? 3.5 : followers < 100000 ? 1.5 : followers < 500000 ? 1 : 0.5;
            const tierLabel = followers < 10000 ? \'3.5-6%\' : followers < 100000 ? \'1.5-3.5%\' : followers < 500000 ? \'1-2.5%\' : \'0.5-1.5%\';
            if (engScore2 > 0 && engScore2 < tierMin) dataDrivenTips.push(\'📊 ER \' + engScore2.toFixed(2) + \'% vs \' + tierLabel + \' benchmark — test different content pillar or posting time to improve.\');
        }

        // Comment ratio
        if (likes > 0) {
            const cr2 = comments / likes;
            if (cr2 < 0.02 && likes > 10) dataDrivenTips.push(\'💬 Low comment rate (\' + (cr2 * 100).toFixed(1) + \'% of likes) — end with specific question, not just \"thoughts?\".\');
            if (cr2 > 0.15) dataDrivenTips.push(\'💬 High comment rate (\' + (cr2 * 100).toFixed(0) + \'% of likes) — pin your best reply. Reply within first hour for algorithmic velocity bonus.\');
        }

        // Location tag
        if (caption && !caption.toLowerCase().includes(\'📍\') && !/location|\\\\bloc\\\\b/i.test(caption)) {
            dataDrivenTips.push(\'📍 Add a location tag — posts with location tags get 30%+ more local discoverability. Instagram Search indexes location as discovery signal.\');
        }

        // Add data-driven tips with dedup
        const usedTips = new Set(tips);
        for (const tip of dataDrivenTips) {
            if (tips.length >= 6) break;
            if (!usedTips.has(tip)) {
                tips.push(tip);
                usedTips.add(tip);
            }
        }

        // Format-specific fillers based on actual post type (not generic)
        if (tips.length < 4) {
            const formatFillers = [];
            if (type === \'reel\') {
                formatFillers.push(\'🎬 Reels with trending audio get 2.5x more reach in 2026 — check the Instagram music tab weekly for emerging tracks in your niche.\');
                formatFillers.push(\'💡 Add captions/subtitles — 85% of Reels viewers watch without sound in 2026. Burn captions into the video for accessibility + retention.\');
                formatFillers.push(\'🔄 Share this Reel to your Story 24h after posting for a second engagement wave.\');
            } else if (type === \'carousel\') {
                formatFillers.push(\'📸 Carousel tip — use strong CTA on last slide (\"Save this\"). The final slide drives the save action.\');
                formatFillers.push(\'📐 Keep carousel to 5-10 slides — Instagram supports up to 20 slides but engagement drops after slide 7.\');
            } else {
                formatFillers.push(\'🖼️ Photo tips: use high-contrast editing, faces in frame, and text overlays to stop the scroll.\');
                formatFillers.push(\'🔄 Repurpose this photo as a Reel with trending audio to reach non-followers.\');
            }
            for (const tip of formatFillers) {
                if (tips.length >= 4) break;
                if (!usedTips.has(tip)) {
                    tips.push(tip);
                    usedTips.add(tip);
                }
            }
        }
        return tips.slice(0, 6);
    }`;

if (!c.includes(marker1)) {
    console.log('ERROR: Marker1 not found!');
    process.exit(1);
}
if (!c.includes(marker2)) {
    console.log('ERROR: Marker2 not found!');
    process.exit(1);
}

// Find the section from marker1 to marker2's end
const startIdx = c.indexOf(marker1);
const endIdx = c.indexOf(marker2, startIdx) + marker2.length;

console.log('Found section from index', startIdx, 'to', endIdx);
const oldSection = c.substring(startIdx, endIdx);

c = c.replace(oldSection, replacement);
count++;

fs.writeFileSync('app.js', c, 'utf8');
console.log('Edit applied successfully! Edit count:', count);
