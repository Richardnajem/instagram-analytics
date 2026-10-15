const https = require('https');
const zlib = require('zlib');

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

async function run() {
  // First check profile page raw HTML to understand format
  console.log('=== PROFILE PAGE ANALYSIS ===');
  try {
    const { status, body } = await httpsGet('www.instagram.com', '/smallworld_foundation/', {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.instagram.com/',
      'Cache-Control': 'no-cache',
    });
    console.log('Status:', status, 'Length:', body.length);
    
    // Check for login wall
    const hasLogin = body.includes('login') || body.includes('Log in') || body.includes('Sign up');
    console.log('Has login prompt:', hasLogin);
    
    // Check what data structures exist
    console.log('Has __NEXT_DATA__:', body.includes('__NEXT_DATA__'));
    console.log('Has _sharedData:', body.includes('_sharedData'));
    console.log('Has __additionalDataLoaded:', body.includes('__additionalDataLoaded'));
    console.log('Has edge_owner_to_timeline_media:', body.includes('edge_owner_to_timeline_media'));
    console.log('Has full_name:', body.includes('full_name'));
    console.log('Has biography:', body.includes('biography'));
    console.log('Has follower_count:', body.includes('follower_count'));
    console.log('Has edge_followed_by:', body.includes('edge_followed_by'));
    
    // Extract a sample of the actual content
    const nextMatch = body.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextMatch) {
      console.log('\n__NEXT_DATA__ found, length:', nextMatch[1].length);
      const data = JSON.parse(nextMatch[1]);
      const user = data?.props?.pageProps?.user || data?.props?.pageProps?.data?.user;
      if (user) {
        console.log('User found in __NEXT_DATA__!');
        console.log('  username:', user.username);
        console.log('  full_name:', user.full_name);
        console.log('  id:', user.id);
        console.log('  followers:', user.edge_followed_by?.count);
        console.log('  following:', user.edge_follow?.count);
        console.log('  posts count:', user.edge_owner_to_timeline_media?.count);
        const edges = user.edge_owner_to_timeline_media?.edges || [];
        console.log('  posts in data:', edges.length);
        if (edges.length > 0) {
          console.log('  Sample post:', JSON.stringify(edges[0].node, null, 2).substring(0, 500));
        }
      } else {
        console.log('No user in __NEXT_DATA__, keys:', Object.keys(data?.props?.pageProps || {}));
      }
    } else {
      console.log('No __NEXT_DATA__ found');
      // Look for any JSON data
      const scriptTags = body.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g) || [];
      console.log('Application/json script tags:', scriptTags.length);
    }
    
    // Look for meta tags
    const ogTitle = body.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1];
    const ogDesc = body.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1];
    const ogImage = body.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1];
    console.log('\nOG Title:', ogTitle);
    console.log('OG Description:', ogDesc);
    console.log('OG Image:', ogImage?.substring(0, 100));
    
    // Extract profile data from any format
    const bio = body.match(/"biography"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/)?.[1];
    const fullName = body.match(/"full_name"\s*:\s*"([^"]+)"/)?.[1];
    const followers = body.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1];
    const following = body.match(/"edge_follow"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1];
    const postsCount = body.match(/"edge_owner_to_timeline_media"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)?.[1];
    const profilePic = body.match(/"profile_pic_url_hd"\s*:\s*"([^"]+)"/)?.[1];
    const userId = body.match(/"profilePage_(\d+)"/)?.[1] || body.match(/"id"\s*:\s*"(\d+)"\s*,\s*"username"/)?.[1];
    
    console.log('\nRegex extracted:');
    console.log('  userId:', userId);
    console.log('  fullName:', fullName);
    console.log('  bio:', bio?.substring(0, 100));
    console.log('  followers:', followers);
    console.log('  following:', following);
    console.log('  postsCount:', postsCount);
    console.log('  profilePic:', profilePic?.substring(0, 80));
    
  } catch (e) {
    console.log('Profile error:', e.message);
  }

  // Now check individual post page
  console.log('\n\n=== INDIVIDUAL POST PAGE ANALYSIS ===');
  try {
    const { status, body } = await httpsGet('www.instagram.com', '/p/DaNO0WNSczV/', {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.instagram.com/smallworld_foundation/',
      'Cache-Control': 'no-cache',
    });
    console.log('Status:', status, 'Length:', body.length);
    
    // Check all data sources
    console.log('Has __NEXT_DATA__:', body.includes('__NEXT_DATA__'));
    console.log('Has _sharedData:', body.includes('_sharedData'));
    console.log('Has __additionalDataLoaded:', body.includes('__additionalDataLoaded'));
    console.log('Has edge_media_preview_like:', body.includes('edge_media_preview_like'));
    console.log('Has like_count:', body.includes('like_count'));
    console.log('Has edge_media_to_comment:', body.includes('edge_media_to_comment'));
    console.log('Has comment_count:', body.includes('comment_count'));
    console.log('Has edge_media_to_caption:', body.includes('edge_media_to_caption'));
    console.log('Has caption:', body.includes('"caption"'));
    console.log('Has taken_at_timestamp:', body.includes('taken_at_timestamp'));
    console.log('Has is_video:', body.includes('is_video'));
    console.log('Has video_view_count:', body.includes('video_view_count'));
    
    // Check for login wall
    const hasLogin = body.includes('login') || body.includes('Log in to Instagram');
    console.log('Has login prompt:', hasLogin);
    
    // OG tags
    const ogTitle = body.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1];
    const ogDesc = body.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1];
    const ogImage = body.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1];
    console.log('\nOG Title:', ogTitle);
    console.log('OG Description:', ogDesc);
    console.log('OG Image:', ogImage?.substring(0, 100));
    
    // Extract from __NEXT_DATA__ if present
    const nextMatch = body.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextMatch) {
      const data = JSON.parse(nextMatch[1]);
      console.log('\n__NEXT_DATA__ keys:', Object.keys(data?.props?.pageProps || {}));
      const media = data?.props?.pageProps?.media || data?.props?.pageProps?.data?.shortcode_media;
      if (media) {
        console.log('Media found!');
        console.log('  shortcode:', media.shortcode);
        console.log('  typename:', media.__typename);
        console.log('  likes:', media.edge_media_preview_like?.count);
        console.log('  comments:', media.edge_media_to_comment?.count);
        console.log('  caption:', media.edge_media_to_caption?.edges?.[0]?.node?.text?.substring(0, 100));
        console.log('  timestamp:', media.taken_at_timestamp);
        console.log('  is_video:', media.is_video);
      }
    }
    
    // Try to extract from _sharedData
    const sharedMatch = body.match(/window\._sharedData\s*=\s*(\{.+?\});\s*<\/script>/);
    if (sharedMatch) {
      const data = JSON.parse(sharedMatch[1]);
      console.log('\n_sharedData found, keys:', Object.keys(data));
      const media = data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
      if (media) {
        console.log('Media from _sharedData!');
        console.log('  likes:', media.edge_media_preview_like?.count);
        console.log('  comments:', media.edge_media_to_comment?.count);
        console.log('  caption:', media.edge_media_to_caption?.edges?.[0]?.node?.text?.substring(0, 100));
      }
    }
    
    // Print a section of the raw HTML around any data
    const likeIdx = body.indexOf('edge_media_preview_like');
    if (likeIdx > -1) {
      console.log('\nRaw context around edge_media_preview_like:');
      console.log(body.substring(Math.max(0, likeIdx - 50), likeIdx + 200));
    } else {
      const likeCountIdx = body.indexOf('like_count');
      if (likeCountIdx > -1) {
        console.log('\nRaw context around like_count:');
        console.log(body.substring(Math.max(0, likeCountIdx - 50), likeCountIdx + 200));
      }
    }
    
    // Check for login-required indicators
    if (body.includes('loginRequired') || body.includes('require_login') || body.includes('"login"')) {
      console.log('\n⚠️ LOGIN REQUIRED - Instagram is blocking anonymous access');
    }
    
    // Print first 2000 chars of body for analysis
    console.log('\n\nFirst 2000 chars of body:');
    console.log(body.substring(0, 2000));
    
  } catch (e) {
    console.log('Post error:', e.message);
  }
}

run().catch(e => console.error('FATAL:', e.message));
