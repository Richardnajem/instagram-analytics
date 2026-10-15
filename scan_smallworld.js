const https = require('https');
const zlib = require('zlib');
const username = 'smallworld_foundation';
const fs = require('fs');

function nodeGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname, path, method: 'GET', headers: { 'Accept-Encoding': 'gzip, deflate, br', ...headers }, timeout: 20000 }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        return reject(new Error('Redirect: ' + res.headers.location));
      }
      const chunks = [];
      let stream = res;
      if (res.headers['content-encoding'] === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (res.headers['content-encoding'] === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (res.headers['content-encoding'] === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      stream.on('data', d => chunks.push(d));
      stream.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
      stream.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    req.end();
  });
}

function nodePost(hostname, path, headers, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers: { 'Accept-Encoding': 'gzip, deflate, br', ...headers }, timeout: 20000 }, res => {
      const chunks = [];
      let stream = res;
      if (res.headers['content-encoding'] === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (res.headers['content-encoding'] === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (res.headers['content-encoding'] === 'br') stream = res.pipe(zlib.createBrotliDecompress());
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

function printPost(i, n) {
  console.log(`--- POST ${i} ---`);
  console.log(`  shortcode: ${n.shortcode}`);
  console.log(`  type: ${n.__typename || (n.is_video ? 'GraphVideo' : 'GraphImage')}`);
  console.log(`  likes: ${n.edge_media_preview_like?.count ?? n.like_count ?? 'N/A'}`);
  console.log(`  comments: ${n.edge_media_to_comment?.count ?? n.comment_count ?? 'N/A'}`);
  const cap = (n.edge_media_to_caption?.edges?.[0]?.node?.text || n.caption_text || '').substring(0, 300);
  console.log(`  caption: ${cap}`);
  console.log(`  timestamp: ${n.taken_at_timestamp || 'N/A'}`);
  console.log(`  is_video: ${n.is_video || false}`);
  if (n.video_view_count) console.log(`  views: ${n.video_view_count}`);
  console.log(`  thumbnail: ${(n.display_url || n.thumbnail_src || '').substring(0, 120)}`);
  if (n.edge_sidecar_to_children?.edges) {
    console.log(`  carousel_items: ${n.edge_sidecar_to_children.edges.length}`);
  }
}

async function run() {
  const allResults = {};
  const allPosts = new Map(); // shortcode -> post data (dedup)

  // ═══════════════════════════════════════════════════════
  // METHOD 1: HTML Page Scrape (__NEXT_DATA__)
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('METHOD 1: HTML Page Scrape (__NEXT_DATA__)');
  console.log('='.repeat(60));
  let userId = null;
  try {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    const { status, body } = await nodeGet('www.instagram.com', '/' + username + '/', {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.instagram.com/',
      'Cache-Control': 'no-cache',
    });
    console.log(`  HTTP Status: ${status}`);

    // Extract OG meta
    const ogTitle = body.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] || '';
    const ogDesc = body.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] || '';
    const ogImage = body.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] || '';
    console.log(`  OG Title: ${ogTitle}`);
    console.log(`  OG Description: ${ogDesc}`);
    console.log(`  OG Image: ${ogImage.substring(0, 100)}`);

    // __NEXT_DATA__
    const nextMatch = body.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextMatch) {
      const data = JSON.parse(nextMatch[1]);
      const user = data?.props?.pageProps?.user || data?.props?.pageProps?.data?.user;
      if (user) {
        userId = user.id;
        console.log(`  ✅ User ID: ${user.id}`);
        console.log(`  Username: ${user.username}`);
        console.log(`  Full Name: ${user.full_name}`);
        console.log(`  Bio: ${user.biography}`);
        console.log(`  Followers: ${user.edge_followed_by?.count}`);
        console.log(`  Following: ${user.edge_follow?.count}`);
        console.log(`  Posts Count: ${user.edge_owner_to_timeline_media?.count}`);
        console.log(`  Verified: ${user.is_verified}`);
        console.log(`  Profile Pic: ${(user.profile_pic_url_hd || user.profile_pic_url || '').substring(0, 120)}`);
        const edges = user.edge_owner_to_timeline_media?.edges || [];
        console.log(`  Posts in response: ${edges.length}`);
        edges.forEach((e, i) => {
          const n = e.node || e;
          printPost(i + 1, n);
          if (n.shortcode) allPosts.set(n.shortcode, { source: 'html_nextdata', ...n });
        });
        allResults.method1 = { success: true, posts: edges.length, userId };
      }
    } else {
      console.log('  No __NEXT_DATA__ found');
      // Try _sharedData
      const shared = body.match(/window\._sharedData\s*=\s*(\{.+?\});\s*<\/script>/);
      if (shared) {
        const data = JSON.parse(shared[1]);
        const user = data?.entry_data?.ProfilePage?.[0]?.graphql?.user;
        if (user) {
          userId = user.id;
          console.log(`  ✅ User ID from _sharedData: ${user.id}`);
          const edges = user.edge_owner_to_timeline_media?.edges || [];
          edges.forEach((e, i) => {
            const n = e.node || e;
            printPost(i + 1, n);
            if (n.shortcode) allPosts.set(n.shortcode, { source: 'html_shareddata', ...n });
          });
          allResults.method1 = { success: true, posts: edges.length, userId };
        }
      }
      // Try regex fallback
      if (!userId) {
        const idMatch = body.match(/"profilePage_(\d+)"/) || body.match(/"id":"(\d+)","username":"smallworld_foundation"/);
        if (idMatch) {
          userId = idMatch[1];
          console.log(`  ✅ User ID from regex: ${userId}`);
        }
      }
    }
    allResults.method1 = allResults.method1 || { success: false, userId };
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    allResults.method1 = { success: false, error: e.message };
  }

  // ═══════════════════════════════════════════════════════
  // METHOD 2: REST API (i.instagram.com)
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('METHOD 2: REST API (i.instagram.com)');
  console.log('='.repeat(60));
  try {
    const mobileUA = 'Instagram 269.0.0.18.75 Android (29/10; 420dpi; 1080x1920; OnePlus; HD1900; OnePlus7T; qcom; en_US; 420108292)';
    const { status, body } = await nodeGet('i.instagram.com',
      `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      {
        'User-Agent': mobileUA,
        'X-IG-App-ID': '936619743392459',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.instagram.com/',
        'Origin': 'https://www.instagram.com',
      }
    );
    console.log(`  HTTP Status: ${status}`);
    if (status === 200) {
      const j = JSON.parse(body);
      const u = j?.data?.user;
      if (u) {
        if (!userId) userId = u.id;
        console.log(`  ✅ User ID: ${u.id}`);
        console.log(`  Username: ${u.username}`);
        console.log(`  Full Name: ${u.full_name}`);
        console.log(`  Bio: ${u.biography}`);
        console.log(`  Followers: ${u.edge_followed_by?.count}`);
        console.log(`  Following: ${u.edge_follow?.count}`);
        console.log(`  Posts Count: ${u.edge_owner_to_timeline_media?.count}`);
        console.log(`  Verified: ${u.is_verified}`);
        const edges = u.edge_owner_to_timeline_media?.edges || [];
        console.log(`  Posts in response: ${edges.length}`);
        edges.forEach((e, i) => {
          const n = e.node || e;
          printPost(i + 1, n);
          if (n.shortcode) allPosts.set(n.shortcode, { source: 'rest_api', ...n });
        });
        allResults.method2 = { success: true, posts: edges.length };
      }
    } else {
      const msg = body.substring(0, 200);
      console.log(`  Response: ${msg}`);
      allResults.method2 = { success: false, status, body: msg };
    }
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    allResults.method2 = { success: false, error: e.message };
  }

  // ═══════════════════════════════════════════════════════
  // METHOD 3: GraphQL with query_hash
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('METHOD 3: GraphQL query_hash');
  console.log('='.repeat(60));
  if (userId) {
    const queryHashes = [
      '69cba40317214236af40e7efa697781d',
      '452a673636280e5504746f34533036a7',
      '8c2a52996976f1ecb4e20ae6cb1e8e5c',
      '42323d64886122307be10013ad2dcc44',
      'e769aa130647d2354c40ea6a439bfc08',
    ];
    for (const qh of queryHashes) {
      try {
        const vars = JSON.stringify({ id: userId, first: 48, after: null });
        const { status, body } = await nodeGet('www.instagram.com',
          `/graphql/query/?query_hash=${qh}&variables=${encodeURIComponent(vars)}`,
          {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': `https://www.instagram.com/${username}/`,
            'X-IG-App-ID': '936619743392459',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://www.instagram.com',
          }
        );
        const data = JSON.parse(body);
        const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges || [];
        if (edges.length > 0) {
          console.log(`  ✅ query_hash ${qh} => ${edges.length} posts!`);
          edges.forEach((e, i) => {
            const n = e.node || e;
            printPost(i + 1, n);
            if (n.shortcode) allPosts.set(n.shortcode, { source: 'graphql_hash_' + qh.substring(0, 8), ...n });
          });
          allResults.method3 = { success: true, posts: edges.length, queryHash: qh };
          break;
        } else {
          console.log(`  query_hash ${qh} => 0 posts`);
        }
      } catch (e) {
        console.log(`  query_hash failed: ${qh.substring(0, 8)}... - ${e.message}`);
      }
    }
    if (!allResults.method3) allResults.method3 = { success: false };
  } else {
    console.log('  ⚠️ No userId available, skipping');
    allResults.method3 = { success: false, error: 'no userId' };
  }

  // ═══════════════════════════════════════════════════════
  // METHOD 4: GraphQL with doc_id (POST)
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('METHOD 4: GraphQL doc_id (POST)');
  console.log('='.repeat(60));
  if (userId) {
    const docIds = [
      '10015901848480474',
      '8845758582119845',
      '9310670392322965',
      '5587632691332174',
      '5443204686453520',
      '5006509564031732',
      '5015191076003067',
    ];
    for (const docId of docIds) {
      try {
        const vars = JSON.stringify({ id: userId, first: 48, after: null });
        const postData = `doc_id=${docId}&variables=${encodeURIComponent(vars)}`;
        const { status, body } = await nodePost('www.instagram.com', '/graphql/query',
          {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': `https://www.instagram.com/${username}/`,
            'X-IG-App-ID': '936619743392459',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://www.instagram.com',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          postData
        );
        const data = JSON.parse(body);
        const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges || [];
        if (edges.length > 0) {
          console.log(`  ✅ doc_id ${docId} => ${edges.length} posts!`);
          edges.forEach((e, i) => {
            const n = e.node || e;
            printPost(i + 1, n);
            if (n.shortcode) allPosts.set(n.shortcode, { source: 'graphql_doc_' + docId.substring(0, 8), ...n });
          });
          allResults.method4 = { success: true, posts: edges.length, docId };
          break;
        } else {
          const errMsg = data?.message || data?.errors?.[0]?.message || '';
          if (errMsg) console.log(`  doc_id ${docId}: ${errMsg.substring(0, 100)}`);
          else console.log(`  doc_id ${docId} => 0 posts`);
        }
      } catch (e) {
        console.log(`  doc_id failed: ${e.substring(0, 8)}... - ${e.message}`);
      }
    }
    if (!allResults.method4) allResults.method4 = { success: false };
  } else {
    console.log('  ⚠️ No userId available, skipping');
    allResults.method4 = { success: false, error: 'no userId' };
  }

  // ═══════════════════════════════════════════════════════
  // METHOD 5: Individual Post Shortcode Fetch
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('METHOD 5: Individual Post Shortcode Fetch (if shortcodes found)');
  console.log('='.repeat(60));
  if (allPosts.size > 0) {
    const shortcodes = [...allPosts.keys()].slice(0, 5);
    for (const sc of shortcodes) {
      try {
        const { status, body } = await nodeGet('www.instagram.com', `/p/${sc}/?__a=1&__d=dis`, {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'X-IG-App-ID': '936619743392459',
          'Referer': `https://www.instagram.com/p/${sc}/`,
        });
        if (status === 200) {
          const data = JSON.parse(body);
          const media = data?.graphql?.shortcode_media || data?.items?.[0];
          if (media) {
            console.log(`  ✅ Post ${sc}: likes=${media.edge_media_preview_like?.count || media.like_count}, comments=${media.edge_media_to_comment?.count || media.comment_count}`);
          }
        } else {
          console.log(`  Post ${sc}: HTTP ${status}`);
        }
      } catch (e) {
        console.log(`  Post ${sc}: ${e.message}`);
      }
    }
    allResults.method5 = { success: true, note: 'Tried individual shortcode fetch' };
  } else {
    console.log('  ⚠️ No shortcodes available to try');
    allResults.method5 = { success: false, error: 'no shortcodes' };
  }

  // ═══════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`User ID: ${userId}`);
  console.log(`Total unique posts found: ${allPosts.size}`);
  console.log('Methods tried:', JSON.stringify(allResults, null, 2));

  // Save full results to file
  const output = {
    username,
    userId,
    totalUniquePosts: allPosts.size,
    methods: allResults,
    posts: [...allPosts.values()].map(p => ({
      shortcode: p.shortcode,
      type: p.__typename || (p.is_video ? 'GraphVideo' : 'GraphImage'),
      likes: p.edge_media_preview_like?.count ?? p.like_count ?? null,
      comments: p.edge_media_to_comment?.count ?? p.comment_count ?? null,
      caption: (p.edge_media_to_caption?.edges?.[0]?.node?.text || p.caption_text || '').substring(0, 500),
      timestamp: p.taken_at_timestamp || null,
      isVideo: p.is_video || false,
      videoViewCount: p.video_view_count || null,
      thumbnail: p.display_url || p.thumbnail_src || '',
      carouselCount: p.edge_sidecar_to_children?.edges?.length || 0,
      source: p.source,
    })),
  };

  fs.writeFileSync('smallworld_scan_results.json', JSON.stringify(output, null, 2));
  console.log('\n✅ Full results saved to smallworld_scan_results.json');
}

run().catch(e => console.error('FATAL:', e.message));
