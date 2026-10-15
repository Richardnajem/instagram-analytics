const https = require('https');
const zlib = require('zlib');
const http = require('http');
const fs = require('fs');
const username = 'smallworld_foundation';

function smartGet(hostname, path, headers, method = 'GET') {
  return new Promise((resolve, reject) => {
    const opts = { hostname, path, method, headers: { 'Accept-Encoding': 'gzip, deflate, br', ...headers }, timeout: 20000 };
    const req = https.get(opts, res => {
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
      stream.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString(), headers: res.headers }));
      stream.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    req.end();
  });
}

function smartPost(hostname, path, headers, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers: { 'Accept-Encoding': 'gzip, deflate, br', ...headers }, timeout: 20000 }, res => {
      const chunks = [];
      let stream = res;
      const enc = res.headers['content-encoding'];
      if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      stream.on('data', d => chunks.push(d));
      stream.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString(), headers: res.headers }));
      stream.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function printPost(i, n) {
  const cap = (n.edge_media_to_caption?.edges?.[0]?.node?.text || n.caption_text || '').substring(0, 300);
  console.log(`  [${i}] shortcode=${n.shortcode} type=${n.__typename || (n.is_video ? 'Video' : 'Image')} likes=${n.edge_media_preview_like?.count ?? n.like_count ?? '?'} comments=${n.edge_media_to_comment?.count ?? n.comment_count ?? '?'} ts=${n.taken_at_timestamp || '?'} video=${n.is_video || false}${n.video_view_count ? ' views=' + n.video_view_count : ''}${cap ? ' caption="' + cap.substring(0, 80) + '..."' : ''}`);
}

async function run() {
  const allPosts = new Map();
  let userId = null;
  let profileData = null;
  const methods = {};

  // ═══════════════════════════════════════════════════════
  // METHOD 1: Mobile API with different App IDs
  // ═══════════════════════════════════════════════════════
  console.log('\n══ METHOD 1: Mobile API (web_profile_info) ══');
  const appIds = ['936619743392459', '567067343352427', '124024574287414', '121798164487962'];
  const mobileUAs = [
    'Instagram 269.0.0.18.75 Android (29/10; 420dpi; 1080x1920; OnePlus; HD1900; OnePlus7T; qcom; en_US; 420108292)',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.72 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.72 Mobile Safari/537.36',
  ];
  for (let i = 0; i < appIds.length; i++) {
    try {
      await sleep(500);
      const { status, body } = await smartGet('i.instagram.com',
        `/api/v1/users/web_profile_info/?username=${username}`,
        {
          'User-Agent': mobileUAs[i % mobileUAs.length],
          'X-IG-App-ID': appIds[i],
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.instagram.com/',
          'Origin': 'https://www.instagram.com',
          'X-ASBD-ID': '129477',
          'X-IG-WWW-Claim': '0',
        }
      );
      console.log(`  AppID ${appIds[i]}: HTTP ${status}`);
      if (status === 200) {
        const j = JSON.parse(body);
        const u = j?.data?.user;
        if (u?.username) {
          userId = u.id;
          profileData = {
            username: u.username,
            fullName: u.full_name,
            bio: u.biography,
            followers: u.edge_followed_by?.count,
            following: u.edge_follow?.count,
            postsCount: u.edge_owner_to_timeline_media?.count,
            verified: u.is_verified,
            private: u.is_private,
            profilePic: u.profile_pic_url_hd || u.profile_pic_url,
            externalUrl: u.external_url,
          };
          console.log(`  ✅ SUCCESS! User ID: ${userId}`);
          console.log(`  Profile:`, JSON.stringify(profileData, null, 2));
          const edges = u.edge_owner_to_timeline_media?.edges || [];
          console.log(`  Posts: ${edges.length}`);
          edges.forEach((e, i) => { const n = e.node; printPost(i+1, n); if (n.shortcode) allPosts.set(n.shortcode, n); });
          methods.m1 = { success: true, appId: appIds[i], posts: edges.length };
          break;
        }
      } else {
        console.log(`  Response: ${body.substring(0, 150)}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  if (!methods.m1) methods.m1 = { success: false };

  // ═══════════════════════════════════════════════════════
  // METHOD 2: Alternative REST endpoints
  // ═══════════════════════════════════════════════════════
  console.log('\n══ METHOD 2: Alternative REST endpoints ══');
  const altEndpoints = [
    `/api/v1/users/web_profile_info/?username=${username}&access_token=`,
    `/api/v1/users/${username}/info/`,
    `/api/v1/users/${username}/full_detail_info/`,
  ];
  for (const ep of altEndpoints) {
    try {
      await sleep(500);
      const { status, body } = await smartGet('i.instagram.com', ep, {
        'User-Agent': mobileUAs[0],
        'X-IG-App-ID': appIds[0],
        'Accept': 'application/json',
        'Referer': 'https://www.instagram.com/',
        'X-ASBD-ID': '129477',
      });
      console.log(`  ${ep.split('?')[0]}: HTTP ${status}`);
      if (status === 200) {
        try {
          const j = JSON.parse(body);
          const u = j?.user || j?.data?.user;
          if (u?.username) {
            if (!userId) userId = u.pk || u.id;
            console.log(`  ✅ Got user data! ID: ${userId}`);
            console.log(`  Full Name: ${u.full_name}`);
            console.log(`  Followers: ${u.follower_count || u.edge_followed_by?.count}`);
            // Check for media
            const media = u.edge_owner_to_timeline_media || u.media;
            if (media?.edges) {
              console.log(`  Posts: ${media.edges.length}`);
              media.edges.forEach((e, i) => { const n = e.node || e; printPost(i+1, n); if (n.shortcode) allPosts.set(n.shortcode, n); });
            }
            methods.m2 = { success: true, endpoint: ep, posts: media?.edges?.length || 0 };
          } else {
            console.log(`  No user in response: ${body.substring(0, 200)}`);
          }
        } catch(e) {
          console.log(`  Parse error: ${e.message}. Body: ${body.substring(0, 200)}`);
        }
      } else {
        console.log(`  Response: ${body.substring(0, 150)}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  if (!methods.m2) methods.m2 = { success: false };

  // ═══════════════════════════════════════════════════════
  // METHOD 3: HTML deep extraction
  // ═══════════════════════════════════════════════════════
  console.log('\n══ METHOD 3: HTML Deep Extraction ══');
  try {
    const webUAs = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    ];
    for (let i = 0; i < webUAs.length; i++) {
      await sleep(300);
      const { status, body } = await smartGet('www.instagram.com', `/${username}/`, {
        'User-Agent': webUAs[i],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.instagram.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      });
      console.log(`  UA${i+1}: HTTP ${status}, length=${body.length}`);

      // Try all JSON extraction patterns
      // Pattern A: __NEXT_DATA__
      const nextMatch = body.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextMatch) {
        try {
          const data = JSON.parse(nextMatch[1]);
          const user = data?.props?.pageProps?.user || data?.props?.pageProps?.data?.user;
          if (user) {
            userId = userId || user.id;
            console.log(`  ✅ __NEXT_DATA__ found! User ID: ${user.id}`);
            profileData = profileData || { username: user.username, fullName: user.full_name, bio: user.biography, followers: user.edge_followed_by?.count };
            const edges = user.edge_owner_to_timeline_media?.edges || [];
            console.log(`  Posts: ${edges.length}`);
            edges.forEach((e, idx) => { const n = e.node; printPost(idx+1, n); if (n.shortcode) allPosts.set(n.shortcode, n); });
            methods.m3a = { success: true, posts: edges.length };
          }
        } catch(e) { console.log(`  __NEXT_DATA__ parse error: ${e.message}`); }
      }

      // Pattern B: Additional JSON in script tags
      const scriptMatches = body.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
      for (const script of scriptMatches) {
        // Look for embedded user data
        const userMatch = script.match(/"user"\s*:\s*\{[^}]*"username"\s*:\s*"smallworld_foundation"/);
        if (userMatch) {
          // Try to extract full user object
          const bigMatch = script.match(/"user"\s*:\s*(\{[\s\S]*?\})\s*[,}]/);
          if (bigMatch) {
            console.log(`  Found embedded user data in script tag`);
          }
        }
      }

      // Pattern C: Look for post shortcodes in HTML
      const shortcodes = new Set();
      const scRegex = /\/(?:p|reel)\/([A-Za-z0-9_-]{5,12})\//g;
      let scMatch;
      while ((scMatch = scRegex.exec(body)) !== null) {
        shortcodes.add(scMatch[1]);
      }
      // Also check for shortcode patterns in JSON
      const jsonScRegex = /\\\/(?:p|reel)\\\/([A-Za-z0-9_-]{5,12})\\\/|"(?:p|reel)\/([A-Za-z0-9_-]{5,12})"/g;
      while ((scMatch = jsonScRegex.exec(body)) !== null) {
        const sc = scMatch[1] || scMatch[2];
        if (sc) shortcodes.add(sc);
      }
      if (shortcodes.size > 0) {
        console.log(`  Found ${shortcodes.size} post shortcodes in HTML: ${[...shortcodes].join(', ')}`);
        // Add placeholder posts for dedup tracking
        for (const sc of shortcodes) {
          if (!allPosts.has(sc)) {
            allPosts.set(sc, { shortcode: sc, source: 'html_shortcode' });
          }
        }
      }

      // Pattern D: Regex extraction of profile data
      const followers = body.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1]
        || body.match(/"follower_count"\s*:\s*(\d+)/)?.[1]
        || body.match(/Followers[^0-9]*(\d[\d,.]*[KkMm]?)/i)?.[1];
      const following = body.match(/"edge_follow"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1]
        || body.match(/"following_count"\s*:\s*(\d+)/)?.[1];
      const postsCount = body.match(/"edge_owner_to_timeline_media"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1]
        || body.match(/"media_count"\s*:\s*(\d+)/)?.[1];
      const fullName = body.match(/"full_name"\s*:\s*"([^"]+)"/)?.[1];
      const bio = body.match(/"biography"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/)?.[1];
      const picUrl = body.match(/"profile_pic_url_hd"\s*:\s*"([^"]+)"/)?.[1]
        || body.match(/"profile_pic_url"\s*:\s*"([^"]+)"/)?.[1];
      const externalUrl = body.match(/"external_url"\s*:\s*"([^"]+)"/)?.[1];

      if (followers || following || postsCount) {
        console.log(`  Regex profile: followers=${followers} following=${following} posts=${postsCount} name=${fullName}`);
        if (!userId) {
          const idMatch = body.match(/"profilePage_(\d+)"/) || body.match(/"id"\s*:\s*"(\d+)"\s*,\s*"username"\s*:\s*"smallworld_foundation"/);
          if (idMatch) userId = idMatch[1];
        }
        if (!profileData && followers) {
          profileData = { username, fullName: fullName || '', bio: bio || '', followers: parseInt(followers), following: parseInt(following || '0'), postsCount: parseInt(postsCount || '0') };
        }
      }

      // Pattern E: Look for edge_owner_to_timeline_media
      const mediaMatch = body.match(/"edge_owner_to_timeline_media"\s*:\s*\{\s*"edges"\s*:\s*(\[[\s\S]*?\])\s*,\s*"page_info"/);
      if (mediaMatch) {
        try {
          const edges = JSON.parse(mediaMatch[1]);
          console.log(`  ✅ Found ${edges.length} posts in edge_owner_to_timeline_media!`);
          edges.forEach((n, idx) => {
            printPost(idx+1, n);
            if (n.shortcode) allPosts.set(n.shortcode, n);
          });
          methods.m3e = { success: true, posts: edges.length };
        } catch(e) { console.log(`  Parse error: ${e.message}`); }
      }

      if (methods.m3a || methods.m3e) break;
    }
    if (!methods.m3a && !methods.m3e) methods.m3 = { success: false };
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    methods.m3 = { success: false, error: e.message };
  }

  // ═══════════════════════════════════════════════════════
  // METHOD 4: GraphQL (if we have userId)
  // ═══════════════════════════════════════════════════════
  console.log('\n══ METHOD 4: GraphQL Queries ══');
  if (userId) {
    const queryHashes = [
      '69cba40317214236af40e7efa697781d',
      '452a673636280e5504746f34533036a7',
      '8c2a52996976f1ecb4e20ae6cb1e8e5c',
      '42323d64886122307be10013ad2dcc44',
      'e769aa130647d2354c40ea6a439bfc08',
    ];
    const docIds = [
      '10015901848480474',
      '8845758582119845',
      '9310670392322965',
      '5587632691332174',
      '5443204686453520',
      '5006509564031732',
      '5015191076003067',
    ];

    // Try query_hash (GET)
    for (const qh of queryHashes) {
      try {
        await sleep(400);
        const vars = JSON.stringify({ id: userId, first: 48, after: null });
        const { status, body } = await smartGet('www.instagram.com',
          `/graphql/query/?query_hash=${qh}&variables=${encodeURIComponent(vars)}`,
          {
            'User-Agent': webUAs[0],
            'Accept': 'application/json',
            'Referer': `https://www.instagram.com/${username}/`,
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
            if (edges.length > 0) {
              console.log(`  ✅ query_hash ${qh.substring(0,8)}... => ${edges.length} posts!`);
              edges.forEach((e, i) => { const n = e.node; printPost(i+1, n); if (n.shortcode) allPosts.set(n.shortcode, n); });
              methods.m4gql = { success: true, queryHash: qh, posts: edges.length };
              break;
            }
          } catch(e) {}
        }
        console.log(`  query_hash ${qh.substring(0,8)}...: HTTP ${status}, 0 posts`);
      } catch (e) {
        console.log(`  query_hash error: ${e.message}`);
      }
    }

    // Try doc_id (POST)
    for (const docId of docIds) {
      try {
        await sleep(400);
        const vars = JSON.stringify({ id: userId, first: 48, after: null });
        const { status, body } = await smartPost('www.instagram.com', '/graphql/query',
          {
            'User-Agent': webUAs[0],
            'Accept': 'application/json',
            'Referer': `https://www.instagram.com/${username}/`,
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
              edges.forEach((e, i) => { const n = e.node; printPost(i+1, n); if (n.shortcode) allPosts.set(n.shortcode, n); });
              methods.m4doc = { success: true, docId, posts: edges.length };
              break;
            }
          } catch(e) {}
        }
        const errMsg = body.substring(0, 100);
        console.log(`  doc_id ${docId}: HTTP ${status} - ${errMsg}`);
      } catch (e) {
        console.log(`  doc_id error: ${e.message}`);
      }
    }
  } else {
    console.log('  ⚠️ No userId — skipping GraphQL');
  }
  if (!methods.m4gql && !methods.m4doc) methods.m4 = { success: false, reason: !userId ? 'no userId' : 'all failed' };

  // ═══════════════════════════════════════════════════════
  // METHOD 5: Fetch individual posts by shortcode
  // ═══════════════════════════════════════════════════════
  console.log('\n══ METHOD 5: Individual Post Fetch ══');
  if (allPosts.size > 0) {
    let fetched = 0;
    for (const [sc, existing] of allPosts) {
      if (fetched >= 6) break;
      try {
        await sleep(300);
        const { status, body } = await smartGet('www.instagram.com', `/p/${sc}/?__a=1&__d=dis`, {
          'User-Agent': webUAs[0],
          'Accept': 'application/json',
          'X-IG-App-ID': '936619743392459',
          'Referer': `https://www.instagram.com/p/${sc}/`,
          'X-ASBD-ID': '129477',
        });
        if (status === 200) {
          try {
            const data = JSON.parse(body);
            const media = data?.graphql?.shortcode_media || data?.items?.[0];
            if (media) {
              fetched++;
              // Merge detailed data
              const merged = {
                ...existing,
                shortcode: sc,
                likes: media.edge_media_preview_like?.count || media.like_count || existing.edge_media_preview_like?.count,
                comments: media.edge_media_to_comment?.count || media.comment_count || existing.edge_media_to_comment?.count,
                caption: media.edge_media_to_caption?.edges?.[0]?.node?.text || media.caption || existing.edge_media_to_caption?.edges?.[0]?.node?.text || '',
                timestamp: media.taken_at_timestamp || media.taken_at || existing.taken_at_timestamp,
                is_video: media.is_video || existing.is_video,
                video_view_count: media.video_view_count || media.play_count,
                display_url: media.display_url || media.thumbnail_src || existing.display_url,
                location: media.location?.name || null,
                accessibility_caption: media.accessibility_caption || null,
                typename: media.__typename || existing.__typename,
                dimensions: media.dimensions || null,
              };
              allPosts.set(sc, merged);
              console.log(`  ✅ ${sc}: likes=${merged.likes} comments=${merged.comments} type=${merged.typename}${merged.location ? ' location=' + merged.location : ''}${merged.video_view_count ? ' views=' + merged.video_view_count : ''}`);
              console.log(`     caption: ${(merged.caption || '').substring(0, 120)}`);
            }
          } catch(e) { console.log(`  ${sc}: parse error`); }
        } else {
          console.log(`  ${sc}: HTTP ${status}`);
        }
      } catch (e) {
        console.log(`  ${sc}: ${e.message}`);
      }
    }
    methods.m5 = { success: fetched > 0, fetched };
  } else {
    console.log('  ⚠️ No shortcodes to fetch');
    methods.m5 = { success: false, reason: 'no shortcodes' };
  }

  // ═══════════════════════════════════════════════════════
  // METHOD 6: Try individual post page HTML
  // ═══════════════════════════════════════════════════════
  console.log('\n══ METHOD 6: Individual Post HTML ══');
  const shortcodesToTry = [...allPosts.keys()].slice(0, 4);
  for (const sc of shortcodesToTry) {
    try {
      await sleep(300);
      const { status, body } = await smartGet('www.instagram.com', `/p/${sc}/`, {
        'User-Agent': webUAs[0],
        'Accept': 'text/html,*/*',
        'Referer': 'https://www.instagram.com/',
      });
      if (status === 200) {
        // Extract post data from the HTML
        const likes = body.match(/"edge_media_preview_like"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1];
        const comments = body.match(/"edge_media_to_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1];
        const caption = body.match(/"edge_media_to_caption"[^}]*"text"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/)?.[1];
        const timestamp = body.match(/"taken_at_timestamp"\s*:\s*(\d+)/)?.[1];
        const isVideo = body.match(/"is_video"\s*:\s*(true|false)/)?.[1];
        const videoViews = body.match(/"video_view_count"\s*:\s*(\d+)/)?.[1] || body.match(/"play_count"\s*:\s*(\d+)/)?.[1];
        const location = body.match(/"location"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/)?.[1];
        const likesAlt = body.match(/(\d[\d,.]*)\s*likes?/i)?.[1];

        if (likes || comments || timestamp) {
          const existing = allPosts.get(sc) || { shortcode: sc };
          allPosts.set(sc, {
            ...existing,
            likes: parseInt(likes || existing.likes || likesAlt?.replace(/,/g, '') || '0') || existing.likes,
            comments: parseInt(comments || existing.comments || '0') || existing.comments,
            caption: caption ? caption.replace(/\\n/g, '\n').replace(/\\"/g, '"') : existing.caption,
            timestamp: parseInt(timestamp || '0') || existing.timestamp,
            is_video: isVideo === 'true' || existing.is_video,
            video_view_count: parseInt(videoViews || '0') || existing.video_view_count,
            location: location || existing.location,
          });
          console.log(`  ✅ ${sc}: likes=${likes || likesAlt} comments=${comments} ts=${timestamp} video=${isVideo}${videoViews ? ' views=' + videoViews : ''}${location ? ' location=' + location : ''}`);
          if (caption) console.log(`     caption: ${caption.substring(0, 120)}`);
        } else {
          console.log(`  ${sc}: HTTP ${status} but no data extracted`);
        }
      }
    } catch(e) {
      console.log(`  ${sc}: ${e.message}`);
    }
  }
  methods.m6 = { success: shortcodesToTry.length > 0 };

  // ═══════════════════════════════════════════════════════
  // FINAL OUTPUT
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('FINAL RESULTS FOR @' + username);
  console.log('═'.repeat(60));
  console.log(`User ID: ${userId}`);
  if (profileData) {
    console.log(`\nProfile:`);
    console.log(`  Full Name: ${profileData.fullName}`);
    console.log(`  Bio: ${profileData.bio}`);
    console.log(`  Followers: ${profileData.followers}`);
    console.log(`  Following: ${profileData.following}`);
    console.log(`  Posts: ${profileData.postsCount}`);
    console.log(`  Verified: ${profileData.verified}`);
    console.log(`  External URL: ${profileData.externalUrl}`);
  }
  console.log(`\nTotal unique posts found: ${allPosts.size}`);
  console.log(`\nMethods:`);
  for (const [k, v] of Object.entries(methods)) {
    console.log(`  ${k}: ${v.success ? '✅' : '❌'} ${JSON.stringify(v)}`);
  }

  if (allPosts.size > 0) {
    console.log(`\nAll Posts:`);
    let i = 1;
    for (const [sc, post] of allPosts) {
      const cap = (post.caption || '').substring(0, 150);
      console.log(`  ${i}. [${sc}] ${post.typename || post.__typename || (post.is_video ? 'Video' : 'Image')} | 👍${post.likes ?? post.edge_media_preview_like?.count ?? '?'} | 💬${post.comments ?? post.edge_media_to_comment?.count ?? '?'} | ${post.timestamp ? new Date(post.timestamp * 1000).toISOString().split('T')[0] : '?'}${post.video_view_count ? ' | 👁️' + post.video_view_count : ''}${post.location ? ' | 📍' + post.location : ''}`);
      if (cap) console.log(`     📝 ${cap}`);
      i++;
    }
  }

  // Save full results
  const output = {
    profile: profileData,
    userId,
    totalPosts: allPosts.size,
    methods,
    posts: [...allPosts.entries()].map(([sc, p]) => ({
      shortcode: sc,
      typename: p.typename || p.__typename || (p.is_video ? 'GraphVideo' : 'GraphImage'),
      likes: p.likes ?? p.edge_media_preview_like?.count ?? null,
      comments: p.comments ?? p.edge_media_to_comment?.count ?? null,
      caption: (p.caption || p.edge_media_to_caption?.edges?.[0]?.node?.text || '').substring(0, 500),
      timestamp: p.timestamp || p.taken_at_timestamp || null,
      is_video: p.is_video || false,
      video_view_count: p.video_view_count || null,
      thumbnail: (p.display_url || p.thumbnail_src || p.thumbnail || '').substring(0, 200),
      location: p.location || null,
      dimensions: p.dimensions || null,
      carouselCount: p.edge_sidecar_to_children?.edges?.length || p.carouselCount || 0,
    })),
  };
  fs.writeFileSync('smallworld_scan_results.json', JSON.stringify(output, null, 2));
  console.log('\n✅ Full results saved to smallworld_scan_results.json');
}

run().catch(e => console.error('FATAL:', e));
