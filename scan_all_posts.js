const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

// Dynamic shortcode discovery — scans profile page first, then follows pagination
const TARGET = 'smallworld_foundation';
let SHORTCODES = [];

// Step 1: Discover all shortcodes from profile page
async function discoverShortcodes() {
  console.log('🔎 Discovering shortcodes from profile page...');
  const { status, body } = await httpsGet('www.instagram.com', `/${TARGET}/`, {
    'User-Agent': UA,
    'Accept': 'text/html,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.instagram.com/',
    'Cache-Control': 'no-cache',
  });

  if (status !== 200) {
    console.log(`  ⚠️ Profile page returned HTTP ${status}`);
    return;
  }

  // Extract shortcodes from embedded JSON data
  const seen = new Set();

  // Pattern 1: edge_owner_to_timeline_media edges
  const edgesMatch = body.match(/"edge_owner_to_timeline_media":\s*\{\s*"edges":\s*(\[[\s\S]*?\])\s*,\s*"page_info"/);
  if (edgesMatch) {
    try {
      const edges = JSON.parse(edgesMatch[1]);
      for (const e of edges) {
        const sc = e.node?.shortcode;
        if (sc && !seen.has(sc)) { seen.add(sc); SHORTCODES.push(sc); }
      }
      console.log(`  📄 Found ${SHORTCODES.length} shortcodes from __NEXT_DATA__ edges`);
    } catch {}
  }

  // Pattern 2: href attributes (/p/ and /reel/)
  const hrefRegex = /href="[\/]*(?:p|reel)\/([A-Za-z0-9_-]+)"/g;
  let hrefMatch;
  while ((hrefMatch = hrefRegex.exec(body)) !== null) {
    if (!seen.has(hrefMatch[1])) {
      seen.add(hrefMatch[1]);
      SHORTCODES.push(hrefMatch[1]);
    }
  }
  // Pattern 3: JSON-encoded paths
  const jsonPathRegex = /\\\/(?:p|reel)\\\/([A-Za-z0-9_-]+)/g;
  while ((hrefMatch = jsonPathRegex.exec(body)) !== null) {
    if (!seen.has(hrefMatch[1])) {
      seen.add(hrefMatch[1]);
      SHORTCODES.push(hrefMatch[1]);
    }
  }

  console.log(`  ✅ Discovered ${SHORTCODES.length} unique shortcodes from profile page`);
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname, path, method: 'GET', headers: { 'Accept-Encoding': 'gzip, deflate, br', ...headers }, timeout: 20000 }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        return reject(new Error('Redirect'));
      }
      const chunks = [];
      let stream = res;
      const enc = res.headers['content-encoding'];
      if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      stream.on('data', d => chunks.push(d));
      stream.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
      stream.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function unescape(s) {
  if (!s) return '';
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    .replace(/\\u([\dA-Fa-f]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)));
}

async function fetchPostPage(sc) {
  const result = { shortcode: sc, url: `https://www.instagram.com/p/${sc}/` };

  try {
    const { status, body } = await httpsGet('www.instagram.com', `/p/${sc}/`, {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.instagram.com/smallworld_foundation/',
      'Cache-Control': 'no-cache',
    });
    result.httpStatus = status;

    if (status !== 200) return result;

    // OG tags
    result.ogTitle = (body.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) || [])[1] || '';
    result.ogDescription = (body.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) || [])[1] || '';
    result.ogImage = (body.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) || [])[1] || '';
    result.ogType = (body.match(/<meta\s+property=["']og:type["']\s+content=["']([^"']+)["']/i) || [])[1] || '';

    // Parse OG description for likes/comments/caption
    // Format: "X likes, Y comments - Author (@username): \"Caption...\""
    const ogDesc = result.ogDescription;
    if (ogDesc) {
      const likesMatch = ogDesc.match(/([\d,]+[KkMm]?)\s*like/i);
      if (likesMatch) {
        let n = likesMatch[1].replace(/,/g, '');
        if (n.match(/[Kk]$/)) n = Math.round(parseFloat(n) * 1000);
        else if (n.match(/[Mm]$/)) n = Math.round(parseFloat(n) * 1000000);
        result.likes = parseInt(n);
      }
      const commentsMatch = ogDesc.match(/([\d,]+[KkMm]?)\s*comment/i);
      if (commentsMatch) {
        let n = commentsMatch[1].replace(/,/g, '');
        if (n.match(/[Kk]$/)) n = Math.round(parseFloat(n) * 1000);
        else if (n.match(/[Mm]$/)) n = Math.round(parseFloat(n) * 1000000);
        result.comments = parseInt(n);
      }
      // Caption in quotes
      const captionMatch = ogDesc.match(/["""]([^"""]{5,})["""]/) || ogDesc.match(/:\s*"([^"]{5,})"/);
      if (captionMatch) result.caption = unescape(captionMatch[1]);
    }

    // HTML embedded data patterns
    result.likes = result.likes || parseInt(body.match(/"edge_media_preview_like"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1] || '0') || null;
    result.comments = result.comments || parseInt(body.match(/"edge_media_to_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1] || '0') || null;
    if (!result.caption) {
      const capMatch = body.match(/"edge_media_to_caption"[^}]*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (capMatch) result.caption = unescape(capMatch[1]);
    }
    if (!result.caption) {
      const capMatch2 = body.match(/"caption"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (capMatch2) result.caption = unescape(capMatch2[1]);
    }

    // Timestamp
    const ts = body.match(/"taken_at_timestamp"\s*:\s*(\d+)/)?.[1] || body.match(/"taken_at"\s*:\s*(\d+)/)?.[1];
    if (ts) {
      result.timestamp = parseInt(ts);
      result.date = new Date(result.timestamp * 1000).toISOString();
      result.dateStr = new Date(result.timestamp * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Post type
    const typename = body.match(/"__typename"\s*:\s*"(Graph\w+)"/)?.[1];
    if (typename) result.type = typename;
    else if (body.match(/"is_video"\s*:\s*true/)) result.type = 'GraphVideo';
    else if (body.match(/"product_type"\s*:\s*"clips"/)) result.type = 'GraphVideo';
    else result.type = 'GraphImage';

    // Video views
    const views = body.match(/"video_view_count"\s*:\s*(\d+)/)?.[1] || body.match(/"play_count"\s*:\s*(\d+)/)?.[1];
    if (views) result.videoViews = parseInt(views);

    // Location
    const loc = body.match(/"location"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/)?.[1];
    if (loc) result.location = loc;

    // Dimensions
    const dim = body.match(/"dimensions"\s*:\s*\{[^}]*"width"\s*:\s*(\d+)[^}]*"height"\s*:\s*(\d+)/);
    if (dim) result.dimensions = { width: parseInt(dim[1]), height: parseInt(dim[2]) };

    // Alt text
    const alt = body.match(/"accessibility_caption"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
    if (alt) result.altText = unescape(alt);

    // Carousel items
    const carousel = body.match(/"edge_sidecar_to_children"\s*:\s*\{\s*"edges"\s*:\s*\[/);
    if (carousel) {
      const carouselCount = (body.match(/"shortcode"/g) || []).length > 1;
      result.isCarousel = true;
    }

    // Extract hashtags from caption
    if (result.caption) {
      const hashtags = result.caption.match(/#[\w]+/g);
      if (hashtags) result.hashtags = [...new Set(hashtags)];
    }

    // Extract post date from caption if available (e.g. "June 30" pattern)
    if (!result.dateStr && result.caption) {
      const datePatterns = [
        /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/i,
        /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4}/i,
      ];
      for (const dp of datePatterns) {
        const dm = result.caption.match(dp);
        if (dm) { result.captionDate = dm[0]; break; }
      }
    }

  } catch (e) {
    result.error = e.message;
  }

  return result;
}

async function run() {
  // Step 1: Discover all shortcodes dynamically
  await discoverShortcodes();

  if (SHORTCODES.length === 0) {
    console.log('❌ No shortcodes discovered — Instagram may be blocking anonymous access');
    return;
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SCRAPING ALL POSTS FROM @' + TARGET + '                  ║');
  console.log('║  Fetching ' + SHORTCODES.length + ' posts via individual post pages       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const allPosts = [];
  let totalLikes = 0;
  let totalComments = 0;
  let totalViews = 0;

  for (let i = 0; i < SHORTCODES.length; i++) {
    const sc = SHORTCODES[i];
    console.log(`[${i + 1}/${SHORTCODES.length}] Fetching ${sc}...`);

    await sleep(800); // Rate limit
    const post = await fetchPostPage(sc);
    allPosts.push(post);

    // Print results
    const typeStr = post.type?.replace('Graph', '') || 'Unknown';
    const likesStr = post.likes !== null && post.likes !== 0 ? post.likes.toLocaleString() : 'N/A';
    const commentsStr = post.comments !== null && post.comments !== 0 ? post.comments.toLocaleString() : 'N/A';
    const dateStr = post.dateStr || 'Unknown date';

    if (post.likes) totalLikes += post.likes;
    if (post.comments) totalComments += post.comments;
    if (post.videoViews) totalViews += post.videoViews;

    console.log(`  ✅ ${typeStr} | 👍 ${likesStr} likes | 💬 ${commentsStr} comments | 📅 ${dateStr}`);
    if (post.videoViews) console.log(`     👁 ${post.videoViews.toLocaleString()} views`);
    if (post.location) console.log(`     📍 ${post.location}`);
    if (post.dimensions) console.log(`     📐 ${post.dimensions.width}x${post.dimensions.height}`);
    if (post.hashtags) console.log(`     #️⃣ ${post.hashtags.join(', ')}`);
    if (post.caption) {
      const cap = post.caption.substring(0, 250);
      console.log(`     📝 "${cap}${post.caption.length > 250 ? '...' : ''}"`);
    }
    if (post.altText) console.log(`     ♿ ${post.altText.substring(0, 150)}`);
    console.log(`     🔗 ${post.url}`);
    console.log('');
  }

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('  COMPLETE SCAN RESULTS — @smallworld_foundation');
  console.log('═'.repeat(60));
  console.log(`  Total Posts Scanned: ${allPosts.length}`);
  console.log(`  Total Likes: ${totalLikes.toLocaleString()}`);
  console.log(`  Total Comments: ${totalComments.toLocaleString()}`);
  if (totalViews > 0) console.log(`  Total Views: ${totalViews.toLocaleString()}`);
  console.log(`  Avg Likes/Post: ${Math.round(totalLikes / allPosts.length).toLocaleString()}`);
  console.log(`  Avg Comments/Post: ${Math.round(totalComments / allPosts.length).toLocaleString()}`);
  console.log('─'.repeat(60));

  allPosts.forEach((p, i) => {
    const dateStr = p.dateStr || 'Unknown';
    const likesStr = p.likes ? p.likes.toLocaleString() : '?';
    const commentsStr = p.comments ? p.comments.toLocaleString() : '?';
    console.log(`\n  ${i + 1}. [${p.shortcode}] ${p.type?.replace('Graph', '') || '?'}`);
    console.log(`     👍 Likes: ${likesStr} | 💬 Comments: ${commentsStr} | 📅 ${dateStr}`);
    if (p.videoViews) console.log(`     👁 Views: ${p.videoViews.toLocaleString()}`);
    if (p.location) console.log(`     📍 Location: ${p.location}`);
    if (p.hashtags) console.log(`     #️⃣ Hashtags: ${p.hashtags.join(', ')}`);
    if (p.caption) console.log(`     📝 Caption: ${p.caption.substring(0, 300)}`);
    console.log(`     🔗 ${p.url}`);
  });

  console.log('\n' + '═'.repeat(60));

  // Save results
  const output = {
    profile: {
      username: TARGET,
      fullName: null,
      bio: null,
      followers: null,
      following: null,
      externalUrl: null,
      fetchedAt: new Date().toISOString(),
    },
    fetchedAt: new Date().toISOString(),
    totalPosts: allPosts.length,
    engagement: {
      totalLikes,
      totalComments,
      totalViews,
      avgLikesPerPost: Math.round(totalLikes / allPosts.length),
      avgCommentsPerPost: Math.round(totalComments / allPosts.length),
    },
    posts: allPosts.map(p => ({
      shortcode: p.shortcode,
      url: p.url,
      type: p.type,
      likes: p.likes || null,
      comments: p.comments || null,
      caption: (p.caption || '').substring(0, 500),
      timestamp: p.timestamp || null,
      date: p.date || null,
      dateStr: p.dateStr || null,
      videoViews: p.videoViews || null,
      location: p.location || null,
      dimensions: p.dimensions || null,
      hashtags: p.hashtags || [],
      altText: (p.altText || '').substring(0, 300),
      ogTitle: p.ogTitle || '',
      ogDescription: p.ogDescription || '',
      ogImage: (p.ogImage || '').substring(0, 300),
    })),
  };
  fs.writeFileSync('smallworld_full_scan.json', JSON.stringify(output, null, 2));
  console.log('\n✅ Full results saved to smallworld_full_scan.json');
}

run().catch(e => console.error('FATAL:', e.message));
