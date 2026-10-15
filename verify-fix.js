const fs = require('fs');
const c = fs.readFileSync('app.js', 'utf8');
const checks = [
    ['No viewsDisplay animateCounter', !c.includes("animateCounter('viewsDisplay")],
    ['No watchTimeDisplay animateCounter', !c.includes("animateCounter('watchTimeDisplay")],
    ['No rewatchRateDisplay animateCounter', !c.includes("animateCounter('rewatchRateDisplay")],
    ['Has statsEngRate set', c.includes("set('statsEngRate'")],
    ['Has statsWatchTime set', c.includes("set('statsWatchTime'")],
    ['Has statsNonFollowerReach set', c.includes("set('statsNonFollowerReach'")],
    ['statsEngRate only once', c.split("set('statsEngRate'").length - 1 === 1],
    ['statsWatchTime only once', c.split("set('statsWatchTime'").length - 1 === 1],
    ['engagementRateReach no longer followers', !c.includes("set('engagementRateReach', this.fmt(p.followers")],
    ['sharesToReachRatio no longer following', !c.includes("set('sharesToReachRatio', this.fmt(p.following")],
    ['reelsRetentionRate no longer posts', !c.includes("set('reelsRetentionRate', this.fmt(p.posts")],
    ['skipRate no longer isVerified', !c.includes("set('skipRate', p.isVerified")],
    ['HTML has statsEngRate id', fs.readFileSync('index.html','utf8').includes('id=\"statsEngRate\"')],
    ['HTML has statsWatchTime id', fs.readFileSync('index.html','utf8').includes('id=\"statsWatchTime\"')],
    ['HTML has statsNonFollowerReach id', fs.readFileSync('index.html','utf8').includes('id=\"statsNonFollowerReach\"')],
    ['HTML no viewsDisplay id', !fs.readFileSync('index.html','utf8').includes('id=\"viewsDisplay\"')],
    ['HTML no watchTimeDisplay id', !fs.readFileSync('index.html','utf8').includes('id=\"watchTimeDisplay\"')],
    ['HTML no rewatchRateDisplay id', !fs.readFileSync('index.html','utf8').includes('id=\"rewatchRateDisplay\"')],
];
let ok = true;
for (const [label, pass] of checks) {
    console.log(pass ? '✅' : '❌', label);
    if (!pass) ok = false;
}
console.log(ok ? '\nAll checks passed!' : '\nSome checks failed!');
process.exit(ok ? 0 : 1);
