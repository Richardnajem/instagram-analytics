const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

const TARGET = 'smallworld_foundation';
const USER_ID = '374059210';

// Known shortcodes from HTML extraction
const KNOWN_SHORTCODES = [
  'DaNO0WNSczV', 'DYzsuY3Ew-o', 'DX6MkA2DI0u', 'DXzU6G2DIeB',
  'DW9LUnQjPKe', 'DWrdWUZDC68', 'DWGoQX7jK_h', 'DVoTguSE8NJ',
  'DU5UbWlE2mf', 'DSqNSyIEbXm', 'DRePFUpgdWy', 'DRbjgFIgR9K',
];

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MOBILE_UA = 'Instagram 269.0.0.18.75 Android (29/10; 420dpi; 1080x1920; OnePlus; HD1900; OnePlus7T; qcom; en_US; 420108292)';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const APP_IDS = ['936619743392459', '567067343352427', '124024574287414'];

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

function httpsPost(hostname, path, headers, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers: { 'Accept-Encoding': 'gzip, deflate, br', ...headers }, timeout: 20000 }, res => {
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
    req.write(postData);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fmtPost(n) {
  const cap = (n.edge_media_to_caption?.edges?.[0]?.node?.text || n.caption_text || n.caption || '').substring(0, 200);
  const likes = n.edge_media_preview_like?.count ?? n.like_count ?? n.likes ?? '?';
  const comments = n.edge_media_to_comment?.count ?? n.comment_count ?? n.comments ?? '?';
  const type = n.typename || n.__typename || (n.is_video ? 'Video' : 'Image');
  const ts = n.taken_at_timestamp || n.timestamp;
  const dateStr = ts ? new Date(ts * 1000).toISOString().split('T')[0] : '?';
  const views = n.video_view_count || n.play_count || '';
  const loc = n.location?.name || n.location || '';
  return { shortcode: n.shortcode, type, likes, comments, date: dateStr, views, caption: cap, location: loc };
}

const posts = new Map();
function addPost(sc, data, source) {
  const existing = posts.get(sc) || {};
  posts.set(sc, { ...existing, ...data, shortcode: sc, _source: source });
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   COMPREHENSIVE SCAN: @' + TARGET + '                       ║');
  console.log('║   User ID: ' + USER_ID + '                                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // ═══════════════════════════════════════════════════════════
  // PHASE 1: GraphQL with userId
  // ═══════════════════════════════════════════════════════════
  console.log('\n━━ PHASE 1: GraphQL Posts (userId=' + USER_ID + ') ━━');

  const queryHashes = [
    '69cba40317214236af40e7efa697781d',
    '452a673636280e5504746f34533036a7',
    '8c2a52996976f1ecb4e20ae6cb1e8e5c',
    '42323d64886122307be10013ad2dcc44',
    'e769aa130647d2354c40ea6a439bfc08',
  ];
  const docIds = [
    '10015901848480474', '8845758582119845', '9310670392322965',
    '5587632691332174', '5443204686453520', '5006509564031732', '5015191076003067',
  ];

  let gqlFound = false;

  // query_hash GET
  for (const qh of queryHashes) {
    if (gqlFound) break;
    try {
      await sleep(600);
      const vars = JSON.stringify({ id: USER_ID, first: 50, after: null });
      const { status, body } = await httpsGet('www.instagram.com',
        `/graphql/query/?query_hash=${qh}&variables=${encodeURIComponent(vars)}`,
        {
          'User-Agent': DESKTOP_UA,
          'Accept': 'application/json',
          'Referer': `https://www.instagram.com/${TARGET}/`,
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://www.instagram.com',
          'X-ASBD-ID': '129477',
        }
      );
      if (status === 200) {
        try {
          const data = JSON.parse(body);
          const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges || [];
          const pageInfo = data?.data?.user?.edge_owner_to_timeline_media?.page_info;
          if (edges.length > 0) {
            console.log(`  ✅ query_hash ${qh.substring(0,8)}... => ${edges.length} posts (has_next: ${pageInfo?.has_next_page})`);
            edges.forEach(e => { const n = e.node; addPost(n.shortcode, n, 'gql_hash'); });
            gqlFound = true;

            // Pagination: fetch more pages if available
            if (pageInfo?.has_next_page && pageInfo?.end_cursor) {
              let cursor = pageInfo.end_cursor;
              let pageNum = 2;
              while (cursor && pageNum <= 5) {
                await sleep(800);
                try {
                  const vars2 = JSON.stringify({ id: USER_ID, first: 50, after: cursor });
                  const r2 = await httpsGet('www.instagram.com',
                    `/graphql/query/?query_hash=${qh}&variables=${encodeURIComponent(vars2)}`,
                    {
                      'User-Agent': DESKTOP_UA,
                      'Accept': 'application/json',
                      'Referer': `https://www.instagram.com/${TARGET}/`,
                      'X-IG-App-ID': '936619743392459',
                      'X-Requested-With': 'XMLHttpRequest',
                      'Origin': 'https://www.instagram.com',
                    }
                  );
                  const d2 = JSON.parse(r2.body);
                  const e2 = d2?.data?.user?.edge_owner_to_timeline_media?.edges || [];
                  const pi2 = d2?.data?.user?.edge_owner_to_timeline_media?.page_info;
                  if (e2.length > 0) {
                    console.log(`    Page ${pageNum}: ${e2.length} more posts`);
                    e2.forEach(e => { const n = e.node; addPost(n.shortcode, n, 'gql_hash_p' + pageNum); });
                    cursor = pi2?.has_next_page ? pi2.end_cursor : null;
                    pageNum++;
                  } else break;
                } catch { break; }
              }
            }
          }
        } catch (e) { console.log(`  query_hash parse error: ${e.message}`); }
      }
    } catch (e) { console.log(`  query_hash ${qh.substring(0,8)}: ${e.message}`); }
  }

  // doc_id POST
  if (!gqlFound) {
    for (const docId of docIds) {
      if (gqlFound) break;
      try {
        await sleep(600);
        const vars = JSON.stringify({ id: USER_ID, first: 50, after: null });
        const { status, body } = await httpsPost('www.instagram.com', '/graphql/query',
          {
            'User-Agent': DESKTOP_UA,
            'Accept': 'application/json',
            'Referer': `https://www.instagram.com/${TARGET}/`,
            'X-IG-App-ID': '936619743392459',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://www.instagram.com',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          `doc_id=${docId}&variables=${encodeURIComponent(vars)}`
        );
        if (status === 200) {
          try {
            const data = JSON.parse(body);
            const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges || [];
            if (edges.length > 0) {
              console.log(`  ✅ doc_id ${docId} => ${edges.length} posts!`);
              edges.forEach(e => { const n = e.node; addPost(n.shortcode, n, 'gql_doc'); });
              gqlFound = true;
              // Paginate
              const pageInfo = data?.data?.user?.edge_owner_to_timeline_media?.page_info;
              if (pageInfo?.has_next_page && pageInfo?.end_cursor) {
                let cursor = pageInfo.end_cursor;
                let pageNum = 2;
                while (cursor && pageNum <= 5) {
                  await sleep(800);
                  try {
                    const vars2 = JSON.stringify({ id: USER_ID, first: 50, after: cursor });
                    const r2 = await httpsPost('www.instagram.com', '/graphql/query',
                      {
                        'User-Agent': DESKTOP_UA, 'Accept': 'application/json',
                        'Referer': `https://www.instagram.com/${TARGET}/`,
                        'X-IG-App-ID': '936619743392459',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Origin': 'https://www.instagram.com',
                        'Content-Type': 'application/x-www-form-urlencoded',
                      },
                      `doc_id=${docId}&variables=${encodeURIComponent(vars2)}`
                    );
                    const d2 = JSON.parse(r2.body);
                    const e2 = d2?.data?.user?.edge_owner_to_timeline_media?.edges || [];
                    const pi2 = d2?.data?.user?.edge_owner_to_timeline_media?.page_info;
                    if (e2.length > 0) {
                      console.log(`    Page ${pageNum}: ${e2.length} more posts`);
                      e2.forEach(e => { const n = e.node; addPost(n.shortcode, n, 'gql_doc_p' + pageNum); });
                      cursor = pi2?.has_next_page ? pi2.end_cursor : null;
                      pageNum++;
                    } else break;
                  } catch { break; }
                }
              }
            }
          } catch (e) {}
        }
        if (!gqlFound) console.log(`  doc_id ${docId}: HTTP ${status}`);
      } catch (e) { console.log(`  doc_id ${docId}: ${e.message}`); }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 2: Fetch each individual post page for full details
  // ═══════════════════════════════════════════════════════════
  console.log('\n━━ PHASE 2: Individual Post Fetch (' + KNOWN_SHORTCODES.length + ' shortcodes) ━━');

  for (const sc of KNOWN_SHORTCODES) {
    if (posts.has(sc) && posts.get(sc).likes !== undefined && posts.get(sc).likes !== '?') continue; // already have data
    try {
      await sleep(500);
      const { status, body } = await httpsGet('www.instagram.com', `/p/${sc}/`, {
        'User-Agent': DESKTOP_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `https://www.instagram.com/${TARGET}/`,
        'Cache-Control': 'no-cache',
      });
      if (status === 200) {
        // Multiple extraction patterns
        let likes = body.match(/"edge_media_preview_like"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1];
        let comments = body.match(/"edge_media_to_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1];
        let caption = body.match(/"edge_media_to_caption"[^}]*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
        let timestamp = body.match(/"taken_at_timestamp"\s*:\s*(\d+)/)?.[1];
        let isVideo = body.match(/"is_video"\s*:\s*(true|false)/)?.[1] === 'true';
        let videoViews = body.match(/"video_view_count"\s*:\s*(\d+)/)?.[1] || body.match(/"play_count"\s*:\s*(\d+)/)?.[1];
        let location = body.match(/"location"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/)?.[1];
        let typename = body.match(/"__typename"\s*:\s*"(Graph\w+)"/)?.[1];
        let accessCaption = body.match(/"accessibility_caption"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
        let dimensions = body.match(/"dimensions"\s*:\s*\{[^}]*"width"\s*:\s*(\d+)[^}]*"height"\s*:\s*(\d+)/);
        // Alt likes pattern
        if (!likes) likes = body.match(/(\d[\d,]*)\s*like/i)?.[1]?.replace(/,/g, '');
        // Try __NEXT_DATA__ or embedded JSON for richer data
        const nextDataMatch = body.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (nextDataMatch) {
          try {
            const nd = JSON.parse(nextDataMatch[1]);
            const media = nd?.props?.pageProps?.media || nd?.props?.pageProps?.data?.shortcode_media;
            if (media) {
              likes = likes || String(media.edge_media_preview_like?.count ?? media.like_count ?? '');
              comments = comments || String(media.edge_media_to_comment?.count ?? media.comment_count ?? '');
              caption = caption || media.edge_media_to_caption?.edges?.[0]?.node?.text || media.caption_text || '';
              timestamp = timestamp || String(media.taken_at_timestamp || media.taken_at || '');
              isVideo = isVideo || media.is_video || false;
              videoViews = videoViews || String(media.video_view_count || media.play_count || '');
              typename = typename || media.__typename;
            }
          } catch {}
        }

        if (caption) caption = caption.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        if (typename && !posts.has(sc)) {
          addPost(sc, {
            shortcode: sc,
            typename,
            display_url: '',
          }, 'html_page');
        }
        if (posts.has(sc)) {
          const p = posts.get(sc);
          if (likes) p.likes = parseInt(likes) || likes;
          if (comments) p.comments = parseInt(comments) || comments;
          if (caption && (!p.caption || p.caption.length < caption.length)) p.caption = caption;
          if (timestamp) p.taken_at_timestamp = parseInt(timestamp);
          p.is_video = isVideo;
          if (videoViews) p.video_view_count = parseInt(videoViews);
          if (location) p.location = { name: location };
          if (typename) p.typename = typename;
          if (accessCaption) p.accessibility_caption = accessCaption;
          if (dimensions) p.dimensions = { width: parseInt(dimensions[1]), height: parseInt(dimensions[2]) };
          posts.set(sc, p);
        } else {
          addPost(sc, {
            shortcode: sc,
            typename: typename || (isVideo ? 'GraphVideo' : 'GraphImage'),
            likes: likes ? parseInt(likes) : null,
            comments: comments ? parseInt(comments) : null,
            caption,
            taken_at_timestamp: timestamp ? parseInt(timestamp) : null,
            is_video: isVideo,
            video_view_count: videoViews ? parseInt(videoViews) : null,
            location: location ? { name: location } : null,
            accessibility_caption: accessCaption || null,
            dimensions: dimensions ? { width: parseInt(dimensions[1]), height: parseInt(dimensions[2]) } : null,
            display_url: '',
          }, 'html_page');
        }
        const f = fmtPost(posts.get(sc));
        console.log(`  ✅ ${sc}: ${f.type} | 👍${f.likes} | 💬${f.comments} | ${f.date}${f.views ? ' | 👁' + f.views : ''}${f.location ? ' | 📍' + f.location : ''}`);
        if (f.caption) console.log(`     📝 ${f.caption.substring(0, 120)}`);
      } else {
        console.log(`  ${sc}: HTTP ${status}`);
      }
    } catch (e) {
      console.log(`  ${sc}: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 3: Individual post ?__a=1 endpoint
  // ═══════════════════════════════════════════════════════════
  console.log('\n━━ PHASE 3: Post JSON API (?__a=1) ━━');
  for (const sc of KNOWN_SHORTCODES) {
    try {
      await sleep(400);
      const { status, body } = await httpsGet('www.instagram.com', `/p/${sc}/?__a=1&__d=dis`, {
        'User-Agent': DESKTOP_UA,
        'Accept': 'application/json',
        'X-IG-App-ID': '936619743392459',
        'Referer': `https://www.instagram.com/p/${sc}/`,
        'X-ASBD-ID': '129477',
      });
      if (status === 200) {
        try {
          const data = JSON.parse(body);
          const media = data?.graphql?.shortcode_media || data?.items?.[0] || data?.data?.shortcode_media;
          if (media) {
            const p = posts.get(sc) || { shortcode: sc };
            p.likes = media.edge_media_preview_like?.count || media.like_count || p.likes;
            p.comments = media.edge_media_to_comment?.count || media.comment_count || p.comments;
            p.caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || media.caption || p.caption;
            p.taken_at_timestamp = media.taken_at_timestamp || p.taken_at_timestamp;
            p.is_video = media.is_video || p.is_video;
            p.video_view_count = media.video_view_count || media.play_count || p.video_view_count;
            p.location = media.location?.name || p.location;
            p.typename = media.__typename || p.typename;
            p.dimensions = media.dimensions || p.dimensions;
            p.owner = media.owner ? { username: media.owner.username, id: media.owner.id } : p.owner;
            posts.set(sc, p);
            console.log(`  ✅ ${sc}: 👍${p.likes} 💬${p.comments} ${p.typename}`);
          }
        } catch (e) {}
      } else if (status === 401 || status === 403) {
        // Auth required, skip silently
      } else {
        console.log(`  ${sc}: HTTP ${status}`);
      }
    } catch (e) {
      // Silence timeouts
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 4: Try more GraphQL doc_ids with pagination
  // ═══════════════════════════════════════════════════════════
  console.log('\n━━ PHASE 4: Additional GraphQL doc_ids (pagination) ━━');
  if (!gqlFound) {
    const extraDocIds = [
      '17888483320059182', '17888484550632342', '17888483641248599',
      '17888483042088986', '17888486351357536', '17888486789950799',
    ];
    for (const docId of extraDocIds) {
      try {
        await sleep(600);
        const vars = JSON.stringify({ id: USER_ID, first: 50, after: null });
        const { status, body } = await httpsPost('www.instagram.com', '/graphql/query',
          {
            'User-Agent': DESKTOP_UA,
            'Accept': 'application/json',
            'Referer': `https://www.instagram.com/${TARGET}/`,
            'X-IG-App-ID': '936619743392459',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://www.instagram.com',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          `doc_id=${docId}&variables=${encodeURIComponent(vars)}`
        );
        if (status === 200) {
          try {
            const data = JSON.parse(body);
            const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges ||
                          data?.data?.user?.edge_feed?.edges ||
                          data?.data?.xdt_api__v1__feed__user_timeline_graphql_connection?.edges || [];
            if (edges.length > 0) {
              console.log(`  ✅ extra doc_id ${docId} => ${edges.length} posts!`);
              edges.forEach(e => { const n = e.node; addPost(n.shortcode, n, 'gql_extra'); });
            }
          } catch {}
        }
      } catch {}
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 5: Additional shortcodes from reel patterns
  // ═══════════════════════════════════════════════════════════
  console.log('\n━━ PHASE 5: Try reel shortcodes ━━');
  // Try fetching /reel/ pages too (some posts may be reels)
  for (const sc of KNOWN_SHORTCODES.slice(0, 6)) {
    try {
      await sleep(400);
      const { status, body } = await httpsGet('www.instagram.com', `/reel/${sc}/`, {
        'User-Agent': DESKTOP_UA,
        'Accept': 'text/html,*/*',
        'Referer': `https://www.instagram.com/${TARGET}/`,
      });
      if (status === 200) {
        const typename = body.match(/"__typename"\s*:\s*"(Graph\w+)"/)?.[1];
        const isVideo = body.match(/"is_video"\s*:\s*true/) !== null;
        const videoViews = body.match(/"video_view_count"\s*:\s*(\d+)/)?.[1] || body.match(/"play_count"\s*:\s*(\d+)/)?.[1];
        if (typename === 'GraphVideo' || isVideo) {
          const p = posts.get(sc) || { shortcode: sc };
          p.typename = 'GraphVideo';
          p.is_video = true;
          if (videoViews) p.video_view_count = parseInt(videoViews);
          posts.set(sc, p);
          console.log(`  ✅ ${sc}: Reel confirmed! views=${videoViews || '?'}`);
        }
      }
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════
  // FINAL RESULTS
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('  FINAL SCAN RESULTS FOR @' + TARGET);
  console.log('═'.repeat(60));
  console.log(`  User ID: ${USER_ID}`);
  console.log(`  Full Name: (not fetched — anonymous post scan)`);
  console.log(`  Followers: (not fetched — anonymous post scan)`);
  console.log(`  Total Posts Found: ${posts.size}`);
  console.log(`  Fetched At: ${new Date().toISOString()}`);
  console.log('');

  let i = 1;
  for (const [sc, post] of posts) {
    const f = fmtPost(post);
    console.log(`  ${String(i).padStart(2)}. [${sc}]`);
    console.log(`      Type: ${f.type}  |  👍 ${f.likes}  |  💬 ${f.comments}  |  📅 ${f.date}`);
    if (f.views) console.log(`      👁 Views: ${f.views}`);
    if (f.location) console.log(`      📍 Location: ${f.location}`);
    if (post.dimensions) console.log(`      📐 Size: ${post.dimensions.width}x${post.dimensions.height}`);
    if (post.accessibility_caption) console.log(`      ♿ Alt: ${post.accessibility_caption.substring(0, 120)}`);
    if (f.caption) console.log(`      📝 ${f.caption.substring(0, 200)}`);
    console.log(`      🔗 https://www.instagram.com/p/${sc}/`);
    i++;
  }

  // Save JSON
  const output = {
    profile: {
      userId: USER_ID,
      username: TARGET,
      fullName: null,
      bio: null,
      followers: null,
      following: null,
      externalUrl: null,
      isVerified: false,
      fetchedAt: new Date().toISOString(),
    },
    fetchedAt: new Date().toISOString(),
    totalPosts: posts.size, // number of posts COLLECTED (account total unknown without a profile payload)
    postsScanned: posts.size,
    posts: [...posts.entries()].map(([sc, p]) => ({
      shortcode: sc,
      url: `https://www.instagram.com/p/${sc}/`,
      type: p.typename || (p.is_video ? 'GraphVideo' : 'GraphImage'),
      likes: p.likes ?? null,
      comments: p.comments ?? null,
      caption: (p.caption || '').substring(0, 500),
      timestamp: p.taken_at_timestamp || null,
      date: p.taken_at_timestamp ? new Date(p.taken_at_timestamp * 1000).toISOString() : null,
      isVideo: p.is_video || false,
      videoViewCount: p.video_view_count || null,
      thumbnail: (p.display_url || '').substring(0, 300),
      location: p.location?.name || p.location || null,
      dimensions: p.dimensions || null,
      accessibilityCaption: (p.accessibility_caption || '').substring(0, 300),
      carouselCount: p.edge_sidecar_to_children?.edges?.length || 0,
      source: p._source || 'unknown',
    })),
  };
  fs.writeFileSync('smallworld_scan_results.json', JSON.stringify(output, null, 2));
  console.log('\n✅ Results saved to smallworld_scan_results.json');
}

run().catch(e => console.error('FATAL:', e.message));
