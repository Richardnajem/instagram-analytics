/**
 * test_metrics_determinism.js — Verify computeAdvancedMetrics produces
 * IDENTICAL output across repeated runs (proves no Math.random remains).
 *
 * Usage: node test_metrics_determinism.js
 */
'use strict';

// Minimal stub so metrics.js can attach to the prototype
global.InstagramAnalytics = function() {};
InstagramAnalytics.prototype.fmt = function(n) {
    if (n == null) return '—';
    if (typeof n === 'number') {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(Math.round(n));
    }
    return String(n);
};

require('./metrics.js');

// Real-ish scanned data (shares shape with smallworld_scan_results.json)
const profile = {
    username: 'smallworld_foundation',
    fullName: 'Small World Foundation',
    bio: 'Building a better world one step at a time. 🌍',
    followers: 3435,
    following: 6,
    posts: 12,
    isVerified: false,
    isPrivate: false,
    profilePicUrl: 'https://scontent.example.com/pic.jpg',
    externalUrl: 'https://smallworld.example.com',
};

const timestamps = [
    1735689600, 1736294400, 1736899200, 1737504000, 1738108800,
    1738713600, 1739318400, 1739923200, 1740528000, 1741132800,
    1741737600, 1742342400,
];

const posts = timestamps.map((ts, i) => ({
    shortcode: 'post' + i,
    likes: 10 + i * 5,
    comments: 2 + i,
    caption: i % 3 === 0 ? '#charity #help #follow' : 'Some caption with a ' + (i % 2 ? 'link in bio' : 'question'),
    isVideo: i % 4 === 0,
    postType: i % 4 === 0 ? 'reel' : i % 4 === 2 ? 'carousel' : 'photo',
    timestamp: ts,
}));

const app = new InstagramAnalytics();
app.currentPlatform = 'instagram';
app.history = [];

const analysis = app.computeAnalysis(profile, posts);

// Run twice — outputs must be byte-identical
const run1 = app.computeAdvancedMetrics(profile, posts, analysis);
const run2 = app.computeAdvancedMetrics(profile, posts, analysis);
const run3 = app.computeAdvancedMetrics(profile, posts, analysis);

const s1 = JSON.stringify(run1);
const s2 = JSON.stringify(run2);
const s3 = JSON.stringify(run3);

let failures = 0;
if (s1 !== s2) { console.error('❌ RUN 1 ≠ RUN 2 — non-deterministic!'); failures++; }
if (s2 !== s3) { console.error('❌ RUN 2 ≠ RUN 3 — non-deterministic!'); failures++; }

// Also verify each previously-random metric is a sane finite number
const randomChecks = ['sendsPerReach', 'savesToReachRatio', 'nonFollowerReachPct', 'profileVisitRate',
    'followerGrowthVelocity', 'inboxResponseVelocity', 'dropOffPoint', 'storyTapForward',
    'storyBackTap', 'carouselSlide3Dropoff', 'negativeSignalFreq', 'audioReuseFreq'];
for (const key of randomChecks) {
    const v = run1[key];
    const num = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    if (!isFinite(num)) { console.error(`❌ ${key} is not a finite number: ${v}`); failures++; }
}

// Confirm source has no remaining Math.random in computeAdvancedMetrics
const src = require('fs').readFileSync(require('path').join(__dirname, 'metrics.js'), 'utf8');
const funcStart = src.indexOf('P.computeAdvancedMetrics');
const funcEnd = src.indexOf('P.renderAdvancedMetricsCards');
const funcSrc = src.slice(funcStart, funcEnd);
if (/Math\.random\s*\(/.test(funcSrc)) {
    console.error('❌ Math.random still present inside computeAdvancedMetrics!');
    failures++;
} else {
    console.log('✅ No Math.random in computeAdvancedMetrics');
}

if (failures === 0) {
    console.log('✅ DETERMINISTIC — all 3 runs identical');
    console.log('   Sample: sendsPerReach=' + run1.sendsPerReach + ' nonFollowerReachPct=' + run1.nonFollowerReachPct +
        ' fgv=' + run1.followerGrowthVelocity + ' negativeSignalFreq=' + run1.negativeSignalFreq +
        ' audioReuseFreq=' + run1.audioReuseFreq);
    console.log('   estDmShares=' + run1.estDmShares + ' estSaves=' + run1.estSaves +
        ' dropOffPoint=' + run1.dropOffPoint + ' storyTapForward=' + run1.storyTapForward);
    process.exit(0);
} else {
    console.error(`❌ ${failures} failure(s)`);
    process.exit(1);
}
