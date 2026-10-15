const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

// ══════════════════════════════════════════════════════════════════════════════
// ENHANCED INSTAGRAM SCANNER - Fetches ALL posts with comprehensive analysis
// Usage: node scan_all_posts_enhanced.js [username]
// ══════════════════════════════════════════════════════════════════════════════

// Accept username from command line or default
const TARGET = process.argv[2] || 'smallworld_foundation';
let USER_ID = null;

// User-Agent rotation
const DESKTOP_UAS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
];

const MOBILE_UAS = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.72 Mobile Safari/537.36',
    'Instagram 269.0.0.18.75 Android (29/10; 420dpi; 1080x1920; OnePlus; HD1900; OnePlus7T; qcom; en_US; 420108292)'
];

const APP_IDS = ['936619743392459', '567067343352427', '124024574287414', '121798164487962'];

function getRandomUA(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function decodeEntities(s) {
    if (!s) return '';
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

// ══════════════════════════════════════════════════════════════════════════════
// HTTP REQUEST HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function httpsGet(hostname, path, headers) {
    return new Promise((resolve, reject) => {
        const req = https.get({
            hostname,
            path,
            method: 'GET',
            headers: { 'Accept-Encoding': 'gzip, deflate, br', ...headers },
            timeout: 20000
        }, res => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
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
        const req = https.request({
            hostname,
            path,
            method: 'POST',
            headers: { 'Accept-Encoding': 'gzip, deflate, br', ...headers },
            timeout: 20000
        }, res => {
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

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1: DISCOVER USER ID AND PROFILE DATA
// ══════════════════════════════════════════════════════════════════════════════

async function discoverProfile() {
    console.log('\n━━ PHASE 1: Discovering Profile ━━');
    
    const strategies = [
        // Strategy 1: __NEXT_DATA__ from HTML
        async () => {
            const ua = getRandomUA(DESKTOP_UAS);
            const { status, body } = await httpsGet('www.instagram.com', `/${TARGET}/`, {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.instagram.com/',
                'Cache-Control': 'no-cache',
            });
            if (status !== 200) return null;
            
            const profile = {};
            
            // Try __NEXT_DATA__
            const nextMatch = body.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
            if (nextMatch) {
                try {
                    const data = JSON.parse(nextMatch[1]);
                    const user = data?.props?.pageProps?.user || data?.props?.pageProps?.data?.user;
                    if (user) {
                        profile.userId = user.id;
                        profile.username = user.username;
                        profile.fullName = user.full_name;
                        profile.bio = user.biography;
                        profile.followers = user.edge_followed_by?.count;
                        profile.following = user.edge_follow?.count;
                        profile.postsCount = user.edge_owner_to_timeline_media?.count;
                        profile.isVerified = user.is_verified;
                        profile.externalUrl = user.external_url;
                        profile.profilePic = user.profile_pic_url_hd || user.profile_pic_url;
                    }
                } catch (e) {
                    console.log(`  ⚠️ __NEXT_DATA__ parse error: ${e.message}`);
                }
            }
            
            // Try regex fallbacks
            if (!profile.userId) {
                const idMatch = body.match(/"profilePage_(\d+)"/) || body.match(/"id":"(\d+)","username":"smallworld_foundation"/);
                if (idMatch) profile.userId = idMatch[1];
            }
            
            // Extract additional profile data via regex
            if (!profile.followers) {
                const followersMatch = body.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
                if (followersMatch) profile.followers = parseInt(followersMatch[1]);
            }
            if (!profile.following) {
                const followingMatch = body.match(/"edge_follow"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
                if (followingMatch) profile.following = parseInt(followingMatch[1]);
            }
            if (!profile.postsCount) {
                const postsMatch = body.match(/"edge_owner_to_timeline_media"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
                if (postsMatch) profile.postsCount = parseInt(postsMatch[1]);
            }
            if (!profile.fullName) {
                const nameMatch = body.match(/"full_name"\s*:\s*"([^"]+)"/);
                if (nameMatch) profile.fullName = nameMatch[1];
            }
            if (!profile.bio) {
                const bioMatch = body.match(/"biography"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
                if (bioMatch)                        profile.bio = decodeEntities(bioMatch[1]);
            }
            
            return profile.userId ? profile : null;
        },
        
        // Strategy 2: REST API
        async () => {
            const mobileUA = getRandomUA(MOBILE_UAS);
            const appId = getRandomUA(APP_IDS);
            const { status, body } = await httpsGet('i.instagram.com',
                `/api/v1/users/web_profile_info/?username=${TARGET}`,
                {
                    'User-Agent': mobileUA,
                    'X-IG-App-ID': appId,
                    'Accept': 'application/json',
                    'Referer': 'https://www.instagram.com/',
                    'Origin': 'https://www.instagram.com',
                }
            );
            if (status === 200) {
                try {
                    const data = JSON.parse(body);
                    const user = data?.data?.user;
                    if (user) {
                        return {
                            userId: user.id,
                            username: user.username,
                            fullName: user.full_name,
                            bio: user.biography,
                            followers: user.edge_followed_by?.count,
                            following: user.edge_follow?.count,
                            postsCount: user.edge_owner_to_timeline_media?.count,
                            isVerified: user.is_verified,
                            externalUrl: user.external_url,
                            profilePic: user.profile_pic_url_hd || user.profile_pic_url
                        };
                    }
                } catch (e) {
                    console.log(`  ⚠️ REST API parse error: ${e.message}`);
                }
            }
            return null;
        }
    ];
    
    for (const strategy of strategies) {
        try {
            const profile = await strategy();
            if (profile && profile.userId) {
                USER_ID = profile.userId;
                console.log(`  ✅ Found profile: @${profile.username} (ID: ${USER_ID})`);
                if (profile.fullName) console.log(`     Name: ${profile.fullName}`);
                if (profile.bio) console.log(`     Bio: ${profile.bio.substring(0, 100)}...`);
                if (profile.followers) console.log(`     Followers: ${profile.followers.toLocaleString()}`);
                if (profile.following) console.log(`     Following: ${profile.following}`);
                if (profile.postsCount) console.log(`     Posts: ${profile.postsCount}`);
                return profile;
            }
        } catch (e) {
            console.log(`  ⚠️ Strategy failed: ${e.message}`);
        }
        await sleep(500);
    }
    
    return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2: FETCH ALL POSTS VIA GRAPHQL PAGINATION
// ══════════════════════════════════════════════════════════════════════════════

async function fetchAllPosts() {
    console.log('\n━━ PHASE 2: Fetching ALL Posts via GraphQL ━━');
    
    if (!USER_ID) {
        console.log('  ❌ No User ID available');
        return [];
    }
    
    const allPosts = new Map();
    let cursor = null;
    let pageNum = 1;
    const maxPages = 50;
    
    // GraphQL query hashes
    const queryHashes = [
        '69cba40317214236af40e7efa697781d',
        '452a673636280e5504746f34533036a7',
        '8c2a52996976f1ecb4e20ae6cb1e8e5c',
        '42323d64886122307be10013ad2dcc44',
        'e769aa130647d2354c40ea6a439bfc08',
    ];
    
    // GraphQL doc IDs
    const docIds = [
        '10015901848480474',
        '8845758582119845',
        '9310670392322965',
        '5587632691332174',
        '5443204686453520',
        '5006509564031732',
        '5015191076003067',
    ];
    
    let workingQueryHash = null;
    let workingDocId = null;
    
    // Helper function to fetch a page of posts
    async function fetchPage(queryHash, docId, cursor) {
        const vars = JSON.stringify({ id: USER_ID, first: 50, after: cursor });
        
        if (queryHash) {
            return await httpsGet('www.instagram.com',
                `/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(vars)}`,
                {
                    'User-Agent': getRandomUA(DESKTOP_UAS),
                    'Accept': 'application/json',
                    'Referer': `https://www.instagram.com/${TARGET}/`,
                    'X-IG-App-ID': getRandomUA(APP_IDS),
                    'X-Requested-With': 'XMLHttpRequest',
                    'Origin': 'https://www.instagram.com',
                }
            );
        } else if (docId) {
            return await httpsPost('www.instagram.com', '/graphql/query',
                {
                    'User-Agent': getRandomUA(DESKTOP_UAS),
                    'Accept': 'application/json',
                    'Referer': `https://www.instagram.com/${TARGET}/`,
                    'X-IG-App-ID': getRandomUA(APP_IDS),
                    'X-Requested-With': 'XMLHttpRequest',
                    'Origin': 'https://www.instagram.com',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                `doc_id=${docId}&variables=${encodeURIComponent(vars)}`
            );
        }
        return null;
    }
    
    // Helper to extract posts from response
    function extractPosts(body) {
        try {
            const data = JSON.parse(body);
            return {
                edges: data?.data?.user?.edge_owner_to_timeline_media?.edges || [],
                pageInfo: data?.data?.user?.edge_owner_to_timeline_media?.page_info || null
            };
        } catch (e) {
            console.log(`  ⚠️ JSON parse error: ${e.message}`);
            return { edges: [], pageInfo: null };
        }
    }
    
    // Try to find a working query_hash
    for (const qh of queryHashes) {
        try {
            await sleep(400);
            const response = await fetchPage(qh, null, null);
            if (response && response.status === 200) {
                const { edges, pageInfo } = extractPosts(response.body);
                if (edges.length > 0) {
                    workingQueryHash = qh;
                    console.log(`  ✅ Working query_hash found: ${qh.substring(0, 8)}...`);
                    
                    // Process first page
                    edges.forEach(e => {
                        const n = e.node;
                        if (n.shortcode) allPosts.set(n.shortcode, n);
                    });
                    console.log(`  📄 Page 1: ${edges.length} posts`);
                    
                    // Check for pagination
                    if (pageInfo?.has_next_page && pageInfo?.end_cursor) {
                        cursor = pageInfo.end_cursor;
                    }
                    break;
                }
            }
        } catch (e) {
            console.log(`  ⚠️ query_hash ${qh.substring(0, 8)} failed: ${e.message}`);
        }
    }
    
    // If no query_hash worked, try doc_ids
    if (!workingQueryHash) {
        for (const docId of docIds) {
            try {
                await sleep(400);
                const response = await fetchPage(null, docId, null);
                if (response && response.status === 200) {
                    const { edges, pageInfo } = extractPosts(response.body);
                    if (edges.length > 0) {
                        workingDocId = docId;
                        console.log(`  ✅ Working doc_id found: ${docId}`);
                        
                        edges.forEach(e => {
                            const n = e.node;
                            if (n.shortcode) allPosts.set(n.shortcode, n);
                        });
                        console.log(`  📄 Page 1: ${edges.length} posts`);
                        
                        if (pageInfo?.has_next_page && pageInfo?.end_cursor) {
                            cursor = pageInfo.end_cursor;
                        }
                        break;
                    }
                }
            } catch (e) {
                console.log(`  ⚠️ doc_id ${docId} failed: ${e.message}`);
            }
        }
    }
    
    // Paginate through all pages
    while (cursor && pageNum < maxPages) {
        pageNum++;
        await sleep(600 + Math.random() * 400);
        
        try {
            const response = await fetchPage(workingQueryHash, workingDocId, cursor);
            if (response && response.status === 200) {
                const { edges, pageInfo } = extractPosts(response.body);
                
                if (edges.length === 0) {
                    console.log(`  📄 Page ${pageNum}: 0 posts (end of feed)`);
                    break;
                }
                
                edges.forEach(e => {
                    const n = e.node;
                    if (n.shortcode) allPosts.set(n.shortcode, n);
                });
                
                console.log(`  📄 Page ${pageNum}: ${edges.length} posts (total: ${allPosts.size})`);
                
                if (pageInfo?.has_next_page && pageInfo?.end_cursor) {
                    cursor = pageInfo.end_cursor;
                } else {
                    cursor = null;
                }
            } else {
                console.log(`  ⚠️ Page ${pageNum}: HTTP ${response?.status || 'unknown'}`);
                break;
            }
        } catch (e) {
            console.log(`  ⚠️ Page ${pageNum} error: ${e.message}`);
            break;
        }
    }
    
    console.log(`\n  ✅ Total posts fetched: ${allPosts.size}`);
    return [...allPosts.values()];
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3: ENRICH POSTS WITH CAPTIONS & HASHTAGS (Individual Post Pages)
// ══════════════════════════════════════════════════════════════════════════════

async function enrichPostsWithCaptions(posts) {
    console.log('\n━━ PHASE 3: Enriching Posts with Captions & Hashtags ━━');
    
    const enrichedPosts = [];
    const total = posts.length;
    let enriched = 0;
    
    for (let i = 0; i < total; i++) {
        const post = posts[i];
        const sc = post.shortcode;
        
        if (!sc) {
            enrichedPosts.push(post);
            continue;
        }
        
        // Skip if we already have good caption data from GraphQL
        const existingCaption = post.edge_media_to_caption?.edges?.[0]?.node?.text || '';
        if (existingCaption.length > 50) {
            // Extract hashtags from existing caption
            const hashtags = existingCaption.match(/#[\w]+/g);
            post.hashtags = hashtags ? [...new Set(hashtags)] : [];
            enrichedPosts.push(post);
            enriched++;
            continue;
        }
        
        console.log(`[${i + 1}/${total}] Fetching caption for ${sc}...`);
        
        try {
            await sleep(500 + Math.random() * 300); // Rate limiting
            
            const { status, body } = await httpsGet('www.instagram.com', `/p/${sc}/`, {
                'User-Agent': getRandomUA(DESKTOP_UAS),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': `https://www.instagram.com/${TARGET}/`,
                'Cache-Control': 'no-cache',
            });
            
            if (status !== 200) {
                console.log(`  ⚠️ HTTP ${status}`);
                enrichedPosts.push(post);
                continue;
            }
            
            // Extract caption from HTML
            const capMatch = body.match(/"edge_media_to_caption"[^}]*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            const caption = capMatch ? capMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : existingCaption;
            
            // Extract hashtags from caption
            const hashtags = caption.match(/#[\w]+/g);
            post.hashtags = hashtags ? [...new Set(hashtags)] : [];
            post._captionEnriched = true;
            
            if (post.hashtags.length > 0) {
                console.log(`  ✅ Found ${post.hashtags.length} hashtags: ${post.hashtags.slice(0, 3).join(', ')}${post.hashtags.length > 3 ? '...' : ''}`);
            }
            
            enriched++;
        } catch (e) {
            console.log(`  ❌ Error: ${e.message}`);
        }
        
        enrichedPosts.push(post);
    }
    
    console.log(`\n  ✅ Enriched ${enriched}/${total} posts with captions/hashtags`);
    return enrichedPosts;
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4: COMPREHENSIVE TAG & DATA ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════

function analyzePostData(posts) {
    console.log('\n━━ PHASE 3: Comprehensive Tag & Data Analysis ━━');
    
    const analysis = {
        totalPosts: posts.length,
        hashtagAnalysis: {},
        engagementAnalysis: {},
        contentAnalysis: {},
        timeAnalysis: {},
        topPosts: [],
        insights: []
    };
    
    // ══════════════════════════════════════════════════════════════════════════════
    // HASHTAG ANALYSIS
    // ══════════════════════════════════════════════════════════════════════════════
    
    const allHashtags = {};
    const postsWithHashtags = posts.filter(p => p.hashtags && p.hashtags.length > 0);
    
    posts.forEach(post => {
        if (post.hashtags) {
            post.hashtags.forEach(tag => {
                if (!allHashtags[tag]) {
                    allHashtags[tag] = { count: 0, posts: [], totalLikes: 0, totalComments: 0 };
                }
                allHashtags[tag].count++;
                allHashtags[tag].posts.push(post.shortcode);
                const likes = post.like_count || post.likes || 0;
                const comments = post.comment_count || post.comments || 0;
                allHashtags[tag].totalLikes += likes;
                allHashtags[tag].totalComments += comments;
            });
        }
    });
    
    // Sort hashtags by frequency
    const sortedHashtags = Object.entries(allHashtags)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 50);
    
    analysis.hashtagAnalysis = {
        totalUniqueHashtags: Object.keys(allHashtags).length,
        postsWithHashtags: postsWithHashtags.length,
        topHashtags: sortedHashtags.map(([tag, data]) => ({
            tag,
            count: data.count,
            avgLikes: Math.round(data.totalLikes / data.count),
            avgComments: Math.round(data.totalComments / data.count)
        }))
    };
    
    console.log(`  📊 Found ${Object.keys(allHashtags).length} unique hashtags`);
    console.log(`  📊 ${postsWithHashtags.length} posts contain hashtags`);
    if (sortedHashtags.length > 0) {
        console.log(`  📊 Top hashtag: ${sortedHashtags[0][0]} (${sortedHashtags[0][1].count} posts)`);
    }
    
    // ══════════════════════════════════════════════════════════════════════════════
    // ENGAGEMENT ANALYSIS
    // ══════════════════════════════════════════════════════════════════════════════
    
    let totalLikes = 0;
    let totalComments = 0;
    let totalViews = 0;
    let postsWithLikes = 0;
    let postsWithComments = 0;
    let postsWithViews = 0;
    
    const engagementByType = {};
    
    posts.forEach(post => {
        const likes = post.like_count || post.likes || 0;
        const comments = post.comment_count || post.comments || 0;
        const views = post.video_view_count || 0;
        
        totalLikes += likes;
        totalComments += comments;
        totalViews += views;
        
        if (post.like_count || post.likes) postsWithLikes++;
        if (post.comment_count || post.comments) postsWithComments++;
        if (post.video_view_count) postsWithViews++;
        
        // Engagement by post type
        const type = post.__typename?.replace('Graph', '') || 'Unknown';
        if (!engagementByType[type]) {
            engagementByType[type] = { count: 0, totalLikes: 0, totalComments: 0, totalViews: 0 };
        }
        engagementByType[type].count++;
        engagementByType[type].totalLikes += likes;
        engagementByType[type].totalComments += comments;
        engagementByType[type].totalViews += views;
    });
    
    // Calculate engagement rate (likes + comments / followers * 100)
    const engagementRate = analysis.totalPosts > 0 ? 
        Math.round(((totalLikes + totalComments) / analysis.totalPosts) * 100) / 100 : 0;
    
    analysis.engagementAnalysis = {
        totalLikes,
        totalComments,
        totalViews,
        postsWithLikes,
        postsWithComments,
        postsWithViews,
        avgLikesPerPost: postsWithLikes > 0 ? Math.round(totalLikes / postsWithLikes) : 0,
        avgCommentsPerPost: postsWithComments > 0 ? Math.round(totalComments / postsWithComments) : 0,
        avgViewsPerPost: postsWithViews > 0 ? Math.round(totalViews / postsWithViews) : 0,
        engagementRate,
        engagementByType: Object.entries(engagementByType).map(([type, data]) => ({
            type,
            count: data.count,
            avgLikes: Math.round(data.totalLikes / data.count),
            avgComments: Math.round(data.totalComments / data.count),
            avgViews: Math.round(data.totalViews / data.count)
        }))
    };
    
    console.log(`  📊 Total Likes: ${totalLikes.toLocaleString()}`);
    console.log(`  📊 Total Comments: ${totalComments.toLocaleString()}`);
    console.log(`  📊 Total Views: ${totalViews.toLocaleString()}`);
    console.log(`  📊 Avg Likes/Post: ${analysis.engagementAnalysis.avgLikesPerPost.toLocaleString()}`);
    console.log(`  📊 Avg Comments/Post: ${analysis.engagementAnalysis.avgCommentsPerPost.toLocaleString()}`);
    console.log(`  📊 Engagement Rate: ${engagementRate}%`);
    
    // ══════════════════════════════════════════════════════════════════════════════
    // CONTENT ANALYSIS
    // ══════════════════════════════════════════════════════════════════════════════
    
    const contentTypes = {};
    const postsWithLocation = posts.filter(p => p.location);
    const postsWithAltText = posts.filter(p => p.accessibility_caption);
    const postsWithCarousel = posts.filter(p => p.edge_sidecar_to_children);
    
    posts.forEach(post => {
        const type = post.__typename?.replace('Graph', '') || 'Unknown';
        contentTypes[type] = (contentTypes[type] || 0) + 1;
    });
    
    analysis.contentAnalysis = {
        contentTypeDistribution: Object.entries(contentTypes).map(([type, count]) => ({
            type,
            count,
            percentage: Math.round((count / posts.length) * 100)
        })),
        postsWithLocation: postsWithLocation.length,
        postsWithAltText: postsWithAltText.length,
        postsWithCarousel: postsWithCarousel.length,
        locations: postsWithLocation.map(p => p.location?.name || p.location).filter(Boolean)
    };
    
    console.log(`  📊 Content Types: ${Object.entries(contentTypes).map(([t, c]) => `${t}(${c})`).join(', ')}`);
    console.log(`  📊 Posts with Location: ${postsWithLocation.length}`);
    console.log(`  📊 Posts with Alt Text: ${postsWithAltText.length}`);
    console.log(`  📊 Carousel Posts: ${postsWithCarousel.length}`);
    
    // ══════════════════════════════════════════════════════════════════════════════
    // TIME ANALYSIS
    // ══════════════════════════════════════════════════════════════════════════════
    
    const postsWithTimestamp = posts.filter(p => p.taken_at_timestamp);
    const timeAnalysis = {
        postsWithTimestamp: postsWithTimestamp.length,
        oldestPost: null,
        newestPost: null,
        avgDaysBetweenPosts: 0,
        postsByMonth: {},
        postsByDayOfWeek: {},
        postsByHour: {}
    };
    
    if (postsWithTimestamp.length > 0) {
        const timestamps = postsWithTimestamp.map(p => p.taken_at_timestamp).sort((a, b) => a - b);
        timeAnalysis.oldestPost = new Date(timestamps[0] * 1000).toISOString();
        timeAnalysis.newestPost = new Date(timestamps[timestamps.length - 1] * 1000).toISOString();
        
        // Calculate average days between posts
        if (timestamps.length > 1) {
            const totalDays = (timestamps[timestamps.length - 1] - timestamps[0]) / (24 * 60 * 60);
            timeAnalysis.avgDaysBetweenPosts = Math.round(totalDays / (timestamps.length - 1) * 10) / 10;
        }
        
        // Posts by month
        postsWithTimestamp.forEach(post => {
            const date = new Date(post.taken_at_timestamp * 1000);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            timeAnalysis.postsByMonth[monthKey] = (timeAnalysis.postsByMonth[monthKey] || 0) + 1;
        });
        
        // Posts by day of week
        postsWithTimestamp.forEach(post => {
            const date = new Date(post.taken_at_timestamp * 1000);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            timeAnalysis.postsByDayOfWeek[dayName] = (timeAnalysis.postsByDayOfWeek[dayName] || 0) + 1;
        });
        
        // Posts by hour
        postsWithTimestamp.forEach(post => {
            const date = new Date(post.taken_at_timestamp * 1000);
            const hour = date.getHours();
            timeAnalysis.postsByHour[hour] = (timeAnalysis.postsByHour[hour] || 0) + 1;
        });
    }
    
    analysis.timeAnalysis = timeAnalysis;
    
    if (timeAnalysis.oldestPost) {
        console.log(`  📊 Oldest Post: ${timeAnalysis.oldestPost.split('T')[0]}`);
        console.log(`  📊 Newest Post: ${timeAnalysis.newestPost.split('T')[0]}`);
        console.log(`  📊 Avg Days Between Posts: ${timeAnalysis.avgDaysBetweenPosts}`);
    }
    
    // ══════════════════════════════════════════════════════════════════════════════
    // TOP POSTS (by engagement)
    // ══════════════════════════════════════════════════════════════════════════════
    
    const postsWithEngagement = posts
        .filter(p => p.like_count || p.comment_count)
        .map(p => ({
            shortcode: p.shortcode,
            type: p.__typename?.replace('Graph', '') || 'Unknown',
            likes: p.like_count || 0,
            comments: p.comment_count || 0,
            videoViews: p.video_view_count || 0,
            caption: (p.edge_media_to_caption?.edges?.[0]?.node?.text || '').substring(0, 200),
            hashtags: p.hashtags || [],
            date: p.taken_at_timestamp ? new Date(p.taken_at_timestamp * 1000).toISOString() : null,
            engagement: (p.like_count || 0) + (p.comment_count || 0) * 2
        }))
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 10);
    
    analysis.topPosts = postsWithEngagement;
    
    if (postsWithEngagement.length > 0) {
        console.log(`  📊 Top post by engagement: ${postsWithEngagement[0].shortcode} (${postsWithEngagement[0].engagement} engagement)`);
    }
    
    // ══════════════════════════════════════════════════════════════════════════════
    // GENERATE INSIGHTS
    // ══════════════════════════════════════════════════════════════════════════════
    
    const insights = [];
    
    // Hashtag insights
    if (analysis.hashtagAnalysis.topHashtags.length > 0) {
        insights.push(`Most used hashtag is #${analysis.hashtagAnalysis.topHashtags[0].tag} (${analysis.hashtagAnalysis.topHashtags[0].count} posts)`);
    }
    
    // Engagement insights
    if (analysis.engagementAnalysis.avgLikesPerPost > 0) {
        insights.push(`Average engagement is ${analysis.engagementAnalysis.avgLikesPerPost} likes per post`);
    }
    
    // Content insights
    const topContentType = analysis.contentAnalysis.contentTypeDistribution.sort((a, b) => b.count - a.count)[0];
    if (topContentType) {
        insights.push(`Most common content type is ${topContentType.type} (${topContentType.percentage}% of posts)`);
    }
    
    // Time insights
    if (timeAnalysis.avgDaysBetweenPosts > 0) {
        insights.push(`Posts are published approximately every ${timeAnalysis.avgDaysBetweenPosts} days`);
    }
    
    // Engagement rate insights
    if (engagementRate > 0) {
        insights.push(`Overall engagement rate is ${engagementRate}%`);
    }
    
    analysis.insights = insights;
    
    return analysis;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ══════════════════════════════════════════════════════════════════════════════

async function run() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ENHANCED INSTAGRAM SCANNER - ALL POSTS ANALYSIS           ║');
    console.log('║  Target: @' + TARGET.padEnd(40) + '║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    
    // Phase 1: Discover profile
    const profile = await discoverProfile();
    if (!profile) {
        console.log('\n❌ Could not discover profile. Instagram may be blocking access.');
        return;
    }
    
    // Phase 2: Fetch all posts via GraphQL
    const allPosts = await fetchAllPosts();
    if (allPosts.length === 0) {
        console.log('\n❌ No posts fetched.');
        return;
    }
    
    // Phase 3: Enrich posts with captions & hashtags from individual pages
    const enrichedPosts = await enrichPostsWithCaptions(allPosts);
    
    // Phase 4: Comprehensive analysis
    const analysis = analyzePostData(enrichedPosts);
    
    // ══════════════════════════════════════════════════════════════════════════════
    // FINAL OUTPUT
    // ══════════════════════════════════════════════════════════════════════════════
    
    console.log('\n' + '═'.repeat(60));
    console.log('  COMPLETE SCAN RESULTS - @' + TARGET);
    console.log('═'.repeat(60));
    
    console.log('\n📊 SUMMARY:');
    console.log(`  Total Posts Scanned: ${analysis.totalPosts}`);
    console.log(`  Total Likes: ${analysis.engagementAnalysis.totalLikes.toLocaleString()}`);
    console.log(`  Total Comments: ${analysis.engagementAnalysis.totalComments.toLocaleString()}`);
    console.log(`  Total Views: ${analysis.engagementAnalysis.totalViews.toLocaleString()}`);
    console.log(`  Avg Likes/Post: ${analysis.engagementAnalysis.avgLikesPerPost.toLocaleString()}`);
    console.log(`  Avg Comments/Post: ${analysis.engagementAnalysis.avgCommentsPerPost.toLocaleString()}`);
    console.log(`  Engagement Rate: ${analysis.engagementAnalysis.engagementRate}%`);
    
    console.log('\n#️⃣ HASHTAG ANALYSIS:');
    console.log(`  Unique Hashtags: ${analysis.hashtagAnalysis.totalUniqueHashtags}`);
    console.log(`  Posts with Hashtags: ${analysis.hashtagAnalysis.postsWithHashtags}`);
    if (analysis.hashtagAnalysis.topHashtags.length > 0) {
        console.log('  Top 10 Hashtags:');
        analysis.hashtagAnalysis.topHashtags.slice(0, 10).forEach((h, i) => {
            console.log(`    ${i + 1}. ${h.tag} (${h.count} posts, avg ${h.avgLikes} likes)`);
        });
    }
    
    console.log('\n📝 CONTENT ANALYSIS:');
    analysis.contentAnalysis.contentTypeDistribution.forEach(t => {
        console.log(`  ${t.type}: ${t.count} posts (${t.percentage}%)`);
    });
    
    console.log('\n🏆 TOP 5 POSTS BY ENGAGEMENT:');
    analysis.topPosts.slice(0, 5).forEach((p, i) => {
        console.log(`  ${i + 1}. [${p.shortcode}] ${p.type} - 👍 ${p.likes.toLocaleString()} likes, 💬 ${p.comments.toLocaleString()} comments`);
        if (p.caption) console.log(`     📝 "${p.caption.substring(0, 100)}..."`);
    });
    
    console.log('\n💡 INSIGHTS:');
    analysis.insights.forEach(insight => {
        console.log(`  • ${insight}`);
    });
    
    console.log('═'.repeat(60));
    
    // Save results to JSON
    const output = {
        profile: {
            username: TARGET,
            userId: USER_ID,
            fullName: profile.fullName,
            bio: profile.bio,
            followers: profile.followers,
            following: profile.following,
            postsCount: profile.postsCount,
            isVerified: profile.isVerified,
            externalUrl: profile.externalUrl,
            fetchedAt: new Date().toISOString()
        },
        scanResults: {
            totalPosts: analysis.totalPosts,
            totalLikes: analysis.engagementAnalysis.totalLikes,
            totalComments: analysis.engagementAnalysis.totalComments,
            totalViews: analysis.engagementAnalysis.totalViews,
            avgLikesPerPost: analysis.engagementAnalysis.avgLikesPerPost,
            avgCommentsPerPost: analysis.engagementAnalysis.avgCommentsPerPost,
            avgViewsPerPost: analysis.engagementAnalysis.avgViewsPerPost,
            engagementRate: analysis.engagementAnalysis.engagementRate
        },
        hashtagAnalysis: analysis.hashtagAnalysis,
        engagementAnalysis: analysis.engagementAnalysis,
        contentAnalysis: analysis.contentAnalysis,
        timeAnalysis: analysis.timeAnalysis,
        topPosts: analysis.topPosts,
        insights: analysis.insights,
        posts: allPosts.map(p => ({
            shortcode: p.shortcode,
            url: `https://www.instagram.com/p/${p.shortcode}/`,
            type: p.__typename,
            likes: p.like_count,
            comments: p.comment_count,
            videoViews: p.video_view_count,
            caption: (p.edge_media_to_caption?.edges?.[0]?.node?.text || '').substring(0, 1000),
            hashtags: p.hashtags || [],
            timestamp: p.taken_at_timestamp,
            date: p.taken_at_timestamp ? new Date(p.taken_at_timestamp * 1000).toISOString() : null,
            location: p.location?.name || null,
            dimensions: p.dimensions,
            isCarousel: !!p.edge_sidecar_to_children,
            altText: (p.accessibility_caption || '').substring(0, 500)
        }))
    };
    
    const outputFile = `${TARGET}_complete_scan.json`;
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\n✅ Full results saved to ${outputFile}`);
}

run().catch(e => {
    console.error('FATAL:', e.message);
    process.exit(1);
});
