const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

const TARGET = 'smallworld_foundation';
let USER_ID = null; // Will be dynamically discovered from profile page
// Dynamic shortcode discovery — scans profile page first, then fetches all posts
let SHORTCODES = [];

// Step 1: Discover all shortcodes from profile page
async function discoverShortcodes() {
  console.log('🔎 Discovering shortcodes from profile page...');
  try {
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
        console.log(`  📄 Found ${SHORTCODES.length} shortcodes from embedded data`);
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

    console.log(`  ✅ Discovered ${SHORTCODES.length} unique shortcodes`);
  } catch (e) {
    console.log(`  ⚠️ Discovery error: ${e.message}`);
  }
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname, path, method: 'GET', headers: { 'Accept-Encoding': 'gzip, deflate, br', ...headers }, timeout: 20000 }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        return reject(new Error('Redirect: ' + res.headers.location));
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

function parseOGDescription(desc) {
  // OG descriptions for Instagram posts look like:
  // "X likes, Y comments - Author (@username): \"Caption text...\""
  // or "X likes - Author (@username): \"Caption text...\""
  // or "Photo by @username on Date. Caption text..."
  const result = { likes: null, comments: null, caption: '', date: '', author: '' };

  // Extract likes
  const likesMatch = desc.match(/([\d,]+[KkMm]?)\s*like/i);
  if (likesMatch) {
    let n = likesMatch[1].replace(/,/g, '');
    if (n.endsWith('K') || n.endsWith('k')) n = Math.round(parseFloat(n) * 1000);
    else if (n.endsWith('M') || n.endsWith('m')) n = Math.round(parseFloat(n) * 1000000);
    result.likes = parseInt(n);
  }

  // Extract comments
  const commentsMatch = desc.match(/([\d,]+[KkMm]?)\s*comment/i);
  if (commentsMatch) {
    let n = commentsMatch[1].replace(/,/g, '');
    if (n.endsWith('K') || n.endsWith('k')) n = Math.round(parseFloat(n) * 1000);
    else if (n.endsWith('M') || n.endsWith('m')) n = Math.round(parseFloat(n) * 1000000);
    result.comments = parseInt(n);
  }

  // Extract caption (usually in quotes after the username)
  const captionMatch = desc.match(/["""]([^"""]+)["""]/) || desc.match(/:\s*"([^"]+)"/);
  if (captionMatch) {
    result.caption = unescape(captionMatch[1]);
  }

  // Extract author
  const authorMatch = desc.match(/-?\s*(.+?)\s*\(@(\w+)\)/);
  if (authorMatch) {
    result.author = authorMatch[1].trim();
    result.authorUsername = authorMatch[2];
  }

  // Extract date from og:description or og:title
  // Instagram post descriptions sometimes include dates like "March 15" or full dates
  const datePatterns = [
    /on\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/i,
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4}/i,
  ];
  for (const dp of datePatterns) {
    const dm = desc.match(dp);
    if (dm) {
      result.date = dm[0];
      break;
    }
  }

  return result;
}

function parseTimestamp(body) {
  // Try multiple patterns for timestamp
  const ts = body.match(/"taken_at_timestamp"\s*:\s*(\d+)/)?.[1]
    || body.match(/"taken_at"\s*:\s*(\d+)/)?.[1]
    || body.match(/"timestamp"\s*:\s*(\d{10})/)?.[1];
  return ts ? parseInt(ts) : null;
}

function parseLikes(body) {
  return body.match(/"edge_media_preview_like"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1]
    || body.match(/"like_count"\s*:\s*(\d+)/)?.[1]
    || body.match(/(\d[\d,]*)\s*like/i)?.[1]?.replace(/,/g, '');
}

function parseComments(body) {
  return body.match(/"edge_media_to_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1]
    || body.match(/"comment_count"\s*:\s*(\d+)/)?.[1];
}

function parseCaption(body) {
  return body.match(/"edge_media_to_caption"[^}]*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]
    || body.match(/"caption"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]
    || body.match(/"caption_text"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
}

function parseType(body) {
  const t = body.match(/"__typename"\s*:\s*"(Graph\w+)"/)?.[1];
  if (t) return t;
  if (body.match(/"is_video"\s*:\s*true/) || body.match(/"product_type"\s*:\s*"clips"/)) return 'GraphVideo';
  if (body.match(/"is_video"\s*:\s*false/)) return 'GraphImage';
  return 'GraphImage';
}

function parseVideoViews(body) {
  return body.match(/"video_view_count"\s*:\s*(\d+)/)?.[1]
    || body.match(/"play_count"\s*:\s*(\d+)/)?.[1];
}

function parseLocation(body) {
  return body.match(/"location"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/)?.[1];
}

function parseDimensions(body) {
  const m = body.match(/"dimensions"\s*:\s*\{[^}]*"width"\s*:\s*(\d+)[^}]*"height"\s*:\s*(\d+)/);
  return m ? { width: parseInt(m[1]), height: parseInt(m[2]) } : null;
}

async function fetchPost(sc) {
  const result = {
    shortcode: sc,
    url: `https://www.instagram.com/p/${sc}/`,
    type: 'GraphImage',
    likes: null,
    comments: null,
    caption: '',
    timestamp: null,
    date: null,
    isVideo: false,
    videoViewCount: null,
    thumbnail: '',
    location: null,
    dimensions: null,
    accessibilityCaption: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
  };

  // Fetch the post page
  const { status, body } = await httpsGet('www.instagram.com', `/p/${sc}/`, {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': `https://www.instagram.com/${TARGET}/`,
    'Cache-Control': 'no-cache',
  });

  if (status !== 200) return { ...result, error: `HTTP ${status}` };

  // OG tags
  result.ogTitle = body.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] || '';
  result.ogDescription = body.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] || '';
  result.ogImage = body.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] || '';

  // Parse OG description for likes/comments/caption
  const og = parseOGDescription(result.ogDescription);
  result.likes = og.likes;
  result.comments = og.comments;
  if (og.caption) result.caption = og.caption;

  // Parse HTML embedded data
  const ts = parseTimestamp(body);
  if (ts) {
    result.timestamp = ts;
    result.date = new Date(ts * 1000).toISOString();
  }

  const likes = parseLikes(body);
  if (likes) result.likes = parseInt(likes);

  const comments = parseComments(body);
  if (comments) result.comments = parseInt(comments);

  const caption = parseCaption(body);
  if (caption) result.caption = unescape(caption);

  result.type = parseType(body);
  result.isVideo = result.type === 'GraphVideo';

  const views = parseVideoViews(body);
  if (views) result.videoViewCount = parseInt(views);

  const loc = parseLocation(body);
  if (loc) result.location = loc;

  result.dimensions = parseDimensions(body);

  const acc = body.match(/"accessibility_caption"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
  if (acc) result.accessibilityCaption = unescape(acc);

  // Extract thumbnail from og:image if available
  if (result.ogImage && !result.thumbnail) result.thumbnail = result.ogImage;

  // Also try __NEXT_DATA__ for richer data
  const nextMatch = body.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextMatch) {
    try {
      const data = JSON.parse(nextMatch[1]);
      const media = data?.props?.pageProps?.media || data?.props?.pageProps?.data?.shortcode_media;
      if (media) {
        if (!result.likes) result.likes = media.edge_media_preview_like?.count || media.like_count || null;
        if (!result.comments) result.comments = media.edge_media_to_comment?.count || media.comment_count || null;
        if (!result.caption || result.caption.length < 5) {
          result.caption = unescape(media.edge_media_to_caption?.edges?.[0]?.node?.text || media.caption_text || '');
        }
        if (!result.timestamp) {
          result.timestamp = media.taken_at_timestamp || media.taken_at || null;
          if (result.timestamp) result.date = new Date(result.timestamp * 1000).toISOString();
        }
        if (!result.location && media.location?.name) result.location = media.location.name;
        if (!result.dimensions && media.dimensions) result.dimensions = media.dimensions;
        result.type = media.__typename || result.type;
        result.isVideo = media.is_video || result.isVideo;
        if (!result.videoViewCount && (media.video_view_count || media.play_count)) {
          result.videoViewCount = media.video_view_count || media.play_count;
        }
      }
    } catch {}
  }

  // Try _sharedData too
  const sharedMatch = body.match(/window\._sharedData\s*=\s*(\{.+?\});\s*<\/script>/);
  if (sharedMatch) {
    try {
      const data = JSON.parse(sharedMatch[1]);
      const media = data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
      if (media) {
        if (!result.likes) result.likes = media.edge_media_preview_like?.count || null;
        if (!result.comments) result.comments = media.edge_media_to_comment?.count || null;
        if (!result.caption || result.caption.length < 5) {
          result.caption = unescape(media.edge_media_to_caption?.edges?.[0]?.node?.text || '');
        }
        if (!result.timestamp && media.taken_at_timestamp) {
          result.timestamp = media.taken_at_timestamp;
          result.date = new Date(media.taken_at_timestamp * 1000).toISOString();
        }
      }
    } catch {}
  }

  // Also try __additionalDataLoaded
  const addMatch = body.match(/window\.__additionalDataLoaded\([^,]+,(\{.+?\})\);/);
  if (addMatch) {
    try {
      const data = JSON.parse(addMatch[1]);
      const media = data?.graphql?.shortcode_media;
      if (media) {
        if (!result.likes) result.likes = media.edge_media_preview_like?.count || null;
        if (!result.comments) result.comments = media.edge_media_to_comment?.count || null;
        if (!result.caption || result.caption.length < 5) {
          result.caption = unescape(media.edge_media_to_caption?.edges?.[0]?.node?.text || '');
        }
      }
    } catch {}
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
  console.log('║  COMPREHENSIVE POST SCAN: @' + TARGET + '                    ║');
  console.log('║  Fetching ALL ' + SHORTCODES.length + ' posts with full details        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // First, get the profile page for overall stats
  console.log('━━ Profile Page ━━');
  // Hoisted to run() scope so real fetched values can be used in the final summary/output
  let followers = null, following = null, bio = null, fullName = null, extUrl = null, verified = false;
  try {
    const { body } = await httpsGet('www.instagram.com', `/${TARGET}/`, {
      'User-Agent': UA,
      'Accept': 'text/html,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.instagram.com/',
      'Cache-Control': 'no-cache',
    });
    followers = body.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1]
      || body.match(/"follower_count"\s*:\s*(\d+)/)?.[1];
    following = body.match(/"edge_follow"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1]
      || body.match(/"following_count"\s*:\s*(\d+)/)?.[1];
    const postsCount = body.match(/"edge_owner_to_timeline_media"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1]
      || body.match(/"media_count"\s*:\s*(\d+)/)?.[1];
    bio = body.match(/"biography"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/)?.[1];
    fullName = body.match(/"full_name"\s*:\s*"([^"]+)"/)?.[1];
    const profilePic = body.match(/"profile_pic_url_hd"\s*:\s*"([^"]+)"/)?.[1]
      || body.match(/"profile_pic_url"\s*:\s*"([^"]+)"/)?.[1];
    extUrl = body.match(/"external_url"\s*:\s*"([^"]+)"/)?.[1];
    verified = body.match(/"is_verified"\s*:\s*(true|false)/)?.[1] === 'true';

    console.log(`  Username: ${TARGET}`);
    console.log(`  Full Name: ${fullName || '(not fetched)'}`);
    console.log(`  Bio: ${unescape(bio || '(not fetched)')}`);
    console.log(`  Followers: ${followers || '(not fetched)'}`);
    console.log(`  Following: ${following || '(not fetched)'}`);
    console.log(`  Posts: ${postsCount || '(not fetched)'}`);
    console.log(`  External URL: ${extUrl || '(not fetched)'}`);
    console.log(`  Verified: ${verified}`);
  } catch (e) {
    console.log(`  Profile fetch error: ${e.message}`);
  }

  // Fetch each post
  console.log('\n━━ Fetching Individual Posts ━━\n');
  const allPosts = [];
  for (let i = 0; i < SHORTCODES.length; i++) {
    const sc = SHORTCODES[i];
    console.log(`[${i + 1}/${SHORTCODES.length}] Fetching ${sc}...`);
    try {
      await sleep(600); // Rate limit
      const post = await fetchPost(sc);
      allPosts.push(post);

      const dateStr = post.date ? post.date.split('T')[0] : 'unknown';
      const likesStr = post.likes !== null ? post.likes.toLocaleString() : '?';
      const commentsStr = post.comments !== null ? post.comments.toLocaleString() : '?';
      const typeStr = post.type.replace('Graph', '');

      console.log(`  ✅ ${typeStr} | 👍 ${likesStr} likes | 💬 ${commentsStr} comments | 📅 ${dateStr}`);
      if (post.location) console.log(`     📍 ${post.location}`);
      if (post.videoViewCount) console.log(`     👁 ${post.videoViewCount.toLocaleString()} views`);
      if (post.dimensions) console.log(`     📐 ${post.dimensions.width}x${post.dimensions.height}`);
      if (post.caption) {
        const cap = post.caption.substring(0, 200);
        console.log(`     📝 "${cap}${post.caption.length > 200 ? '...' : ''}"`);
      }
      if (post.accessibilityCaption) {
        console.log(`     ♿ ${post.accessibilityCaption.substring(0, 150)}`);
      }
      console.log(`     🔗 ${post.url}`);
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      allPosts.push({ shortcode: sc, url: `https://www.instagram.com/p/${sc}/`, error: e.message });
    }
    console.log('');
  }

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('  COMPLETE SCAN RESULTS');
  console.log('═'.repeat(60));
  console.log(`  Profile: @${TARGET} (ID: ${USER_ID})`);
  console.log(`  Name: ${fullName || '(not fetched)'} | Followers: ${followers || '(not fetched)'} | Following: ${following || '(not fetched)'}`);
  console.log(`  Posts Scanned: ${allPosts.length}`);
  console.log('─'.repeat(60));

  let totalLikes = 0;
  let totalComments = 0;
  let totalViews = 0;
  let postsWithData = 0;

  allPosts.forEach((p, i) => {
    if (p.likes) { totalLikes += p.likes; postsWithData++; }
    if (p.comments) totalComments += p.comments;
    if (p.videoViewCount) totalViews += p.videoViewCount;

    const dateStr = p.date ? p.date.split('T')[0] : 'unknown';
    console.log(`\n  ${i + 1}. [${p.shortcode}] ${p.type?.replace('Graph', '') || 'Unknown'}`);
    console.log(`     👍 Likes: ${p.likes !== null ? p.likes.toLocaleString() : 'N/A'}`);
    console.log(`     💬 Comments: ${p.comments !== null ? p.comments.toLocaleString() : 'N/A'}`);
    console.log(`     📅 Date: ${dateStr}`);
    if (p.videoViewCount) console.log(`     👁 Views: ${p.videoViewCount.toLocaleString()}`);
    if (p.location) console.log(`     📍 Location: ${p.location}`);
    if (p.dimensions) console.log(`     📐 Dimensions: ${p.dimensions.width}x${p.dimensions.height}`);
    if (p.caption) console.log(`     📝 Caption: ${p.caption.substring(0, 300)}`);
    if (p.accessibilityCaption) console.log(`     ♿ Alt Text: ${p.accessibilityCaption.substring(0, 200)}`);
    console.log(`     🔗 URL: ${p.url}`);
  });

  console.log('\n' + '─'.repeat(60));
  console.log('  ENGAGEMENT SUMMARY');
  console.log('─'.repeat(60));
  console.log(`  Total Posts: ${allPosts.length}`);
  console.log(`  Total Likes: ${totalLikes.toLocaleString()}`);
  console.log(`  Total Comments: ${totalComments.toLocaleString()}`);
  if (totalViews > 0) console.log(`  Total Views: ${totalViews.toLocaleString()}`);
  console.log(`  Avg Likes/Post: ${postsWithData > 0 ? Math.round(totalLikes / postsWithData).toLocaleString() : 'N/A'}`);
  console.log(`  Avg Comments/Post: ${postsWithData > 0 ? Math.round(totalComments / postsWithData).toLocaleString() : 'N/A'}`);
  console.log('═'.repeat(60));

  // Save results
  const output = {
    profile: {
      userId: USER_ID,
      username: TARGET,
      fullName: fullName || null,
      bio: bio ? unescape(bio) : null,
      followers: followers ? parseInt(followers) : null,
      following: following ? parseInt(following) : null,
      externalUrl: extUrl || null,
      isVerified: verified === true,
      fetchedAt: new Date().toISOString(),
    },
    fetchedAt: new Date().toISOString(),
    totalPosts: allPosts.length,
    engagement: { totalLikes, totalComments, totalViews, avgLikesPerPost: postsWithData > 0 ? Math.round(totalLikes / postsWithData) : 0, avgCommentsPerPost: postsWithData > 0 ? Math.round(totalComments / postsWithData) : 0 },
    posts: allPosts.map(p => ({
      shortcode: p.shortcode,
      url: p.url,
      type: p.type,
      likes: p.likes,
      comments: p.comments,
      caption: (p.caption || '').substring(0, 500),
      timestamp: p.timestamp,
      date: p.date,
      isVideo: p.isVideo,
      videoViewCount: p.videoViewCount,
      thumbnail: (p.thumbnail || '').substring(0, 300),
      location: p.location,
      dimensions: p.dimensions,
      accessibilityCaption: (p.accessibilityCaption || '').substring(0, 300),
      ogTitle: p.ogTitle || '',
      ogDescription: p.ogDescription || '',
    })),
  };
  fs.writeFileSync('smallworld_scan_results.json', JSON.stringify(output, null, 2));
  console.log('\n✅ Full results saved to smallworld_scan_results.json');
}

run().catch(e => console.error('FATAL:', e.message));
