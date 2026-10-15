/**
 * test_real_data_suggestions.js — Prove the advice is derived from real data.
 *
 * The old engine padded every post with 4-6 generic tips from a fixed pool
 * ("add alt text", "A/B test posting time", …). That reads as analysis while
 * being a template. This test asserts:
 *   • every tip carries the measured evidence it came from,
 *   • comparisons use the account's own median/percentile,
 *   • no generic pool advice ever appears,
 *   • nothing is invented when the data is missing — it says so instead,
 *   • the analysis page reports its own coverage.
 *
 * Usage: node test_real_data_suggestions.js
 */
'use strict';

global.InstagramAnalytics = function () { };
const P = InstagramAnalytics.prototype;

// Minimal stubs the modules expect from app.js
P.fmt = function (n) {
    if (n == null) return '—';
    const v = Number(n);
    if (!isFinite(v)) return '—';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return String(Math.round(v));
};
P.escHtml = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
P.getVersion = function () { return 'test'; };

require('./utils.js');
require('./metrics.js');

let failures = 0;
let checks = 0;
function check(name, cond, detail) {
    checks++;
    if (cond) console.log('  ✅ ' + name);
    else { failures++; console.error('  ❌ ' + name + (detail ? ' — ' + detail : '')); }
}

const app = new InstagramAnalytics();
app.currentPlatform = 'instagram';
app.history = [];

/** A realistic account: 30 posts, engagement declining slowly upwards. */
const account = Array.from({ length: 30 }, (_, i) => ({
    shortcode: 'A' + i,
    likes: 100 + i * 5,                 // 100 → 245, median ~172
    comments: 3 + (i % 5),
    caption: i % 3 === 0 ? 'A story about our work #charity #community link in bio' : 'Short note',
    isVideo: i % 5 === 0,
    postType: i % 5 === 0 ? 'reel' : i % 3 === 0 ? 'carousel' : 'photo',
    videoViews: i % 5 === 0 ? 4000 + i * 100 : null,
    timestamp: 1735689600 + i * 86400,
    location: i % 2 === 0 ? 'Dubai' : null,
    carouselCount: i % 3 === 0 ? 4 : 0,
    videoDuration: i % 5 === 0 ? 27 : null,
}));

const medianLikes = app._median(account.map(p => p.likes));

console.log('\n════════ EVIDENCE-BACKED SUGGESTIONS ════════\n');

/* ── 1. Every tip must carry its evidence ── */
console.log('1) Tips always cite the data behind them');
{
    const post = account[10];
    const tips = app.generatePostSuggestions(post, 170, 3435, 5, { posts: account, followers: 3435 });
    check('returns at least one tip', tips.length > 0);
    check('at most 5 tips (no padding)', tips.length <= 5, 'got ' + tips.length);
    check('every tip has non-empty evidence text',
        tips.every(t => t && typeof t.evidence === 'string' && t.evidence.trim().length > 0),
        JSON.stringify(tips.map(t => t && t.evidence)));
    check('every tip has a strength rating',
        tips.every(t => typeof t.strength === 'number' && t.strength >= 0 && t.strength <= 1));
    check('tips are ordered by confidence',
        tips.every((t, i) => i === 0 || tips[i - 1].strength >= t.strength),
        JSON.stringify(tips.map(t => t.strength)));
}

/* ── 2. Flop and hit are judged against this account's own numbers ── */
console.log('\n2) Compared against the account\'s own median, not a rule of thumb');
{
    const flop = Object.assign({}, account[10], { shortcode: 'FLOP', likes: Math.round(medianLikes * 0.3) });
    const hit = Object.assign({}, account[10], { shortcode: 'HIT', likes: Math.round(medianLikes * 2.5) });

    const flopTips = app.generatePostSuggestions(flop, 170, 3435, 5, { posts: account, followers: 3435 });
    const hitTips = app.generatePostSuggestions(hit, 170, 3435, 5, { posts: account, followers: 3435 });

    const flopTip = flopTips.find(t => /below your typical|Underperforming|📉/i.test(t.text));
    const hitTip = hitTips.find(t => /🏆|Reuse this exact format/i.test(t.text));

    check('flop gets a below-baseline tip', !!flopTip, JSON.stringify(flopTips.map(t => t.text.slice(0, 60))));
    check('the flop tip quotes the real like count', !!flopTip && flopTip.text.includes(String(flop.likes)),
        flopTip && flopTip.text);
    check('the flop tip quotes the account median', !!flopTip && flopTip.evidence.includes(String(Math.round(medianLikes))),
        flopTip && flopTip.evidence);
    check('hit gets a top-performer tip', !!hitTip, JSON.stringify(hitTips.map(t => t.text.slice(0, 60))));
    check('the hit tip states the multiplier', !!hitTip && /2\.\d×/.test(hitTip.text), hitTip && hitTip.text);
    check('different posts produce different advice',
        JSON.stringify(flopTips.map(t => t.text)) !== JSON.stringify(hitTips.map(t => t.text)));
}

/* ── 3. The generic pool is gone for good ── */
console.log('\n3) No templated filler advice');
{
    const genericPhrases = [
        'Add alt text on upload',
        'A/B test posting time',
        'location tag to boost local discoverability by 30%',
        'Repurpose this post as a Story with a poll',
        'Use the same filter/preset for consistency',
        'Schedule this content type when your audience is most active',
        'Analyze this post\'s saves',
        'Share to your Story 24h after posting',
    ];
    let leaked = [];
    for (const post of account.slice(0, 12)) {
        const tips = app.generatePostSuggestions(post, 170, 3435, 5, { posts: account, followers: 3435 });
        tips.forEach(t => genericPhrases.forEach(g => { if (t.text.includes(g)) leaked.push(g); }));
    }
    check('no generic pool tip surfaced across 12 posts', leaked.length === 0, leaked.join(' | '));
}

/* ── 4. Real caption facts drive real tips ── */
console.log('\n4) Caption findings come from the actual caption');
{
    const noTags = Object.assign({}, account[1], { shortcode: 'NT', caption: 'Just a plain sentence with no tags' });
    const tips = app.generatePostSuggestions(noTags, 170, 3435, 5, { posts: account, followers: 3435 });
    const tagTip = tips.find(t => t.text.includes('hashtags'));
    check('flags the missing hashtags', !!tagTip, JSON.stringify(tips.map(t => t.text.slice(0, 50))));
    check('evidence states the measured count of 0', !!tagTip && tagTip.evidence.includes('0 hashtags'), tagTip && tagTip.evidence);
    const ctaTip = tips.find(t => /call to action/i.test(t.text));
    check('flags the missing CTA', !!ctaTip);
    check('CTA evidence names the check performed', !!ctaTip && /no CTA phrase matched/.test(ctaTip.evidence), ctaTip && ctaTip.evidence);
}

/* ── 5. Video advice uses real play counts when they exist ── */
console.log('\n5) Reel advice uses actual plays/likes');
{
    const reel = {
        shortcode: 'R1', postType: 'reel', isVideo: true, likes: 120, comments: 4,
        videoViews: 20000, videoDuration: 34, caption: 'Watch this #impact link in bio',
        timestamp: account[5].timestamp, thumbnail: '', location: 'Dubai', carouselCount: 0,
    };
    const tips = app.generatePostSuggestions(reel, 170, 3435, 5, { posts: account, followers: 3435 });
    const playTip = tips.find(t => /plays/i.test(t.text));
    check('play-count tip produced', !!playTip, JSON.stringify(tips.map(t => t.text.slice(0, 50))));
    check('play tip quotes real plays and likes', !!playTip && playTip.evidence.includes('20000') && playTip.evidence.includes('120'),
        playTip && playTip.evidence);
    check('computed like-per-play rate is correct (0.6%)', !!playTip && /0\.60%/.test(playTip.text), playTip && playTip.text);
}

/* ── 6. Missing data produces honesty, not invention ── */
console.log('\n6) No engagement data → says so instead of inventing a verdict');
{
    const empty = { shortcode: 'E1', likes: null, comments: null, caption: '', postType: 'photo' };
    const tips = app.generatePostSuggestions(empty, null, null, null, null);
    const gapTip = tips.find(t => /Cannot judge how this post performed/i.test(t.text));
    check('it states performance cannot be judged', !!gapTip, JSON.stringify(tips.map(t => t.text.slice(0, 60))));
    check('it lists exactly what is missing', !!gapTip && /missing: like count, comment count, follower count/.test(gapTip.text), gapTip && gapTip.text);
    check('it makes no numeric performance claim', !tips.some(t => /\d+%|\d+ likes/.test(t.text)), JSON.stringify(tips.map(t => t.text)));
    check('the no-confidence note is ranked last (strength 0)',
        tips[tips.length - 1].strength === 0 && !tips.slice(0, -1).some(t => t.strength === 0));

    // A post with nothing at all to say still gets one honest line, not a template.
    const nothing = app.generatePostSuggestions(null);
    check('no post at all → empty list, never invented advice', Array.isArray(nothing) && nothing.length === 0);
}

/* ── 7. Analysis reports its own coverage instead of padding to 6 ── */
console.log('\n7) Profile analysis reports what it is based on');
{
    const profile = {
        username: 'acct', fullName: 'Real Account', bio: 'Real bio',
        followers: 3435, following: 6, posts: 912,
        profilePicUrl: 'pic.jpg', externalUrl: 'https://example.com', isVerified: false,
    };
    const analysis = app.computeAnalysis(profile, account);
    check('dataQuality is reported', !!analysis.dataQuality);
    check('scanned count is real', analysis.dataQuality.postsScanned === 30);
    check('account total is real', analysis.dataQuality.accountPosts === 912, String(analysis.dataQuality.accountPosts));
    check('coverage % is computed', analysis.dataQuality.percentOfAccount === 3.3, String(analysis.dataQuality.percentOfAccount));
    check('counts posts carrying like data', analysis.dataQuality.withLikes === 30, String(analysis.dataQuality.withLikes));
    check('a partial account scan is flagged as such in the advice',
        analysis.recs.some(r => /Analysis based on 30 of 912 posts \(3\.3% of the account\)/.test(r)),
        JSON.stringify(analysis.recs.map(r => r.slice(0, 60))));
    check('the disclosure lists the posts left out',
        analysis.recs.some(r => /the remaining 882 post\(s\) of this account/.test(r)),
        JSON.stringify(analysis.recs.map(r => r.slice(0, 60))));
    check('no recommendation is printed twice',
        new Set(analysis.recs).size === analysis.recs.length,
        JSON.stringify(analysis.recs.map(r => r.slice(0, 40))));
    check('no generic padded filler in the recommendations',
        !analysis.recs.some(r => /Post consistently \(3-5×\/week\)|Track analytics weekly|Cross-promote on other platforms/.test(r)),
        JSON.stringify(analysis.recs.map(r => r.slice(0, 40))));

    // Every remaining recommendation must cite a measured value or a real gap.
    const generic = analysis.recs.filter(r => !/\d|missing|bio|link|name|photo/i.test(r));
    check('every recommendation cites numbers or a concrete missing field', generic.length === 0, JSON.stringify(generic));

    const banner = app.renderDataQualityBanner(analysis);
    check('banner shows scanned/total and coverage', /30 \/ 912 \(3\.3%\)/.test(banner), banner.slice(0, 120));
    check('banner counts measured engagement data', /30 with like counts/.test(banner), banner.slice(0, 160));
}

/* ── 8. Coverage label never invents a total ── */
console.log('\n8) Coverage label honesty');
{
    app.currentProfile = { posts: null };
    check('unknown total → plain count', app.coverageLabel(account) === '30', app.coverageLabel(account));
    app.currentProfile = { posts: 912 };
    check('known total → scanned / total (%)', app.coverageLabel(account) === '30 / 912 (3.3%)', app.coverageLabel(account));
    app.currentProfile = { posts: 20 };
    check('more scanned than the reported total → plain count', app.coverageLabel(account) === '30', app.coverageLabel(account));
}

console.log('\n─────────────────────────────────────────');
if (failures === 0) {
    console.log('✅ REAL-DATA ADVICE — ' + checks + '/' + checks + ' checks passed');
    process.exit(0);
}
console.error('❌ ' + failures + ' of ' + checks + ' checks failed');
process.exit(1);
