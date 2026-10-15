const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── Full-history pagination core ───────────────────────────────────────────
// Walks Instagram's feed cursors to the very first post the account ever
// published (no fixed page cap) and can resume a throttled scan from where it
// stopped. Unit tested in test_full_history.js.
const historyScan = require('./history-scan.js');

// ─── Live Reload in Dev Mode ────────────────────────────────────────────────
// When running via `electron .` (NOT from inside a packaged asar), enable
// electron-reload so any change to js/css/html instantly reloads the window.
if (!app.isPackaged) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit',
      watched: [
        path.join(__dirname, 'index.html'),
        path.join(__dirname, 'styles.css'),
        path.join(__dirname, 'package.json'),
        path.join(__dirname, 'app.js'),
        path.join(__dirname, 'utils.js'),
        path.join(__dirname, 'scraping.js'),
        path.join(__dirname, 'metrics.js'),
        path.join(__dirname, 'charts.js'),
        path.join(__dirname, 'ui.js'),
        path.join(__dirname, 'instagram-auth.js'),
        path.join(__dirname, 'storage.js'),
        path.join(__dirname, 'error-handling.js'),
        path.join(__dirname, 'animations.js'),
        path.join(__dirname, 'context-menu.js'),
      ]
    });
    console.log('[SWA] Live reload ENABLED — changes auto-apply instantly');
  } catch (e) {
    console.warn('[SWA] electron-reload not available:', e.message);
  }
}

/* ─── Resume cache ─────────────────────────────────────────────────────────────
   A full-history walk of a large account takes a long time and can be cut short
   (rate limit, network drop, the user closing the app). The cursor plus every
   post already collected is cached on disk so the NEXT run continues from where
   it stopped instead of re-walking from the newest post. `complete: false` means
   the account history is still only partially covered — never presented as done. */
function scanCacheDir() {
  try { return path.join(app.getPath('userData'), 'scan-cache'); }
  catch (e) { return path.join(__dirname, 'scan-cache'); }
}

function scanCachePath(username) {
  return path.join(scanCacheDir(), username.replace(/[^a-zA-Z0-9._-]/g, '_') + '.json');
}

function readScanCache(username) {
  try {
    const file = scanCachePath(username);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || !Array.isArray(data.posts)) return null;
    return data;
  } catch (e) {
    console.log('[SWA] ⚠️ Could not read scan cache: ' + e.message);
    return null;
  }
}

function writeScanCache(username, data) {
  try {
    const dir = scanCacheDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = scanCachePath(username);
    const tmp = file + '.tmp';
    // Atomic-ish: write then rename, so a crash mid-write can't corrupt a
    // resume point that took 20 minutes of scanning to build.
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
    return true;
  } catch (e) {
    console.log('[SWA] ⚠️ Could not write scan cache: ' + e.message);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   METHOD 1 — Rendered-DOM scrape

   Instagram answers no unauthenticated API request any more
   (web_profile_info → 401 require_login, ?__a=1 → empty, GraphQL → 401), but a
   real Chromium page still renders the profile header and the newest posts.
   This reads them out of the DOM, which is the only method that works without
   a sign-in.

   Instagram caps how much an anonymous visitor may page through, so the number
   of posts actually visible is measured and returned — it is never reported as
   the whole account.
   ══════════════════════════════════════════════════════════════════════════ */
const IG_DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Poll an expression inside the page until it is truthy (or we run out of time). */
async function waitInPage(win, expression, opts) {
  const timeoutMs = (opts && opts.timeoutMs) || 20000;
  const everyMs = (opts && opts.everyMs) || 400;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!win || win.isDestroyed()) return false;
    try {
      if (await win.webContents.executeJavaScript(expression, true)) return true;
    } catch (e) { /* page mid-navigation — keep polling */ }
    await new Promise(r => setTimeout(r, everyMs));
  }
  return false;
}

/** "1.2K" / "3,429" → number. Used for the counts Instagram prints as text. */
function compactCount(str) {
  if (str == null) return null;
  const s = String(str).replace(/,/g, '').trim();
  const m = s.match(/^([\d.]+)\s*([KkMm])?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (isNaN(n)) return null;
  if (m[2] === 'K' || m[2] === 'k') return Math.round(n * 1000);
  if (m[2] === 'M' || m[2] === 'm') return Math.round(n * 1000000);
  return Math.round(n);
}

/**
 * Read the profile header and the visible post list out of a rendered page.
 * Returns { meta, header, userId, posts, rounds } — every field either holds a
 * real value read from the page or null/'' when Instagram did not expose it.
 */
async function scrapeProfileViaRenderedDom(win, username, sendProgress) {
  const cleanUser = String(username || '').replace(/[^A-Za-z0-9._]/g, '').toLowerCase();
  if (!win || win.isDestroyed()) return null;

  // Deliberately small and defensive: every lookup is optional, and the whole
  // read is wrapped so a missing selector can never abort the scan. Parsing of
  // the raw strings happens in Node, where it can be unit-tested.
  const headerCode = `(() => {
    const out = { description: '', title: '', image: '', followers: null, following: null, bio: '', externalUrl: '', userId: null, hasLoginForm: false, postLinkCount: 0 };
    try {
      const metaContent = (sel) => { const el = document.querySelector(sel); return el && el.content ? el.content : ''; };
      const og = metaContent('meta[property="og:description"]');
      const named = metaContent('meta[name="description"]');
      out.title = metaContent('meta[property="og:title"]') || document.title || '';
      out.image = metaContent('meta[property="og:image"]');
      out.description = /on Instagram:/i.test(named) ? named : (/on Instagram:/i.test(og) ? og : (named || og));
      const body = document.body ? (document.body.innerText || '') : '';
      const f1 = body.match(/([0-9,.]+[KkMm]?)\s*followers/i);
      const f2 = body.match(/([0-9,.]+[KkMm]?)\s*following/i);
      if (f1) out.followers = f1[1];
      if (f2) out.following = f2[1];
      const links = Array.prototype.map.call(document.querySelectorAll('a[href]'), a => a.getAttribute('href') || '');
      for (const h of links) {
        const m = h.match(/[?&]u=([^&]+)/);
        if (m && h.indexOf('instagram.com') !== -1) {
          try { out.externalUrl = decodeURIComponent(m[1]); } catch (e) { out.externalUrl = h; }
          break;
        }
      }
      if (!out.externalUrl) {
        for (const h of links) {
          if (/^https?:[/][/]/.test(h) && h.indexOf('instagram.com') === -1) { out.externalUrl = h; break; }
        }
      }
      const bm = out.description.match(/on Instagram:\s*"([\s\S]*)"\s*\.?\s*$/);
      if (bm) out.bio = bm[1];
      const pm = document.documentElement.innerHTML.match(/"profilePage_([0-9]+)"/);
      if (pm) out.userId = pm[1];
      out.hasLoginForm = !!document.querySelector('input[name="username"]');
      out.postLinkCount = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]').length;
    } catch (e) { out.__error = String((e && e.message) || e); }
    return out;
  })()`;

  const postsCode = `(() => {
    const seen = new Set(); const out = [];
    document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]').forEach(link => {
      const href = link.getAttribute('href') || '';
      const m = href.match(/\\/(?:p|reel|tv)\\/([A-Za-z0-9_-]+)/);
      if (!m) return;
      const code = m[1];
      if (seen.has(code)) return;
      seen.add(code);
      const img = link.querySelector('img');
      const isReel = href.includes('/reel/');
      out.push({
        shortcode: code,
        thumbnail: img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '',
        alt: img ? (img.getAttribute('alt') || '') : '',
        isVideo: isReel,
        postType: isReel ? 'reel' : 'photo',
        source: 'rendered_dom',
      });
    });
    return out;
  })()`;

  // Wait for the page to actually render (a fixed sleep races the hydration), or
  // for a login wall to appear — whichever comes first.
  await waitInPage(win, `(() => document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').length > 0 || !!document.querySelector('input[name="username"]'))()`, { timeoutMs: 25000, everyMs: 500 });

  let header = {};
  try { header = await win.webContents.executeJavaScript(headerCode, true); }
  catch (e) { header = {}; console.log('[SWA] ⚠️ Rendered header read failed: ' + (e && e.message ? e.message : e)); }
  if (header && header.__error) { console.log('[SWA] ⚠️ Rendered header read error: ' + header.__error); header = {}; }

  // Click "Show more posts" and scroll until Instagram stops handing out more,
  // or until the count stops growing (the anonymous cap).
  const byCode = new Map();
  let rounds = 0;
  for (let i = 0; i < 12; i++) {
    rounds = i + 1;
    try {
      await win.webContents.executeJavaScript(`(() => {
        const btns = [...document.querySelectorAll('button, div[role="button"], a')];
        const b = btns.find(x => /show more posts/i.test((x.innerText || '').trim()));
        if (b) { b.click(); return true; }
        window.scrollTo(0, document.body.scrollHeight);
        return false;
      })()`, true);
    } catch (e) { /* keep going */ }
    await new Promise(r => setTimeout(r, 2500));

    let batch = [];
    try { batch = await win.webContents.executeJavaScript(postsCode, true) || []; } catch (e) { batch = []; }
    const before = byCode.size;
    for (const p of batch) if (p && p.shortcode && !byCode.has(p.shortcode)) byCode.set(p.shortcode, p);
    if (sendProgress) sendProgress({ phase: 'profile', username: cleanUser, round: rounds, posts: byCode.size });
    // Nothing new for two consecutive rounds → the cap is reached.
    if (byCode.size === before && i >= 2) break;
  }

  // Read the header once more now the page has fully hydrated: the website link
  // and the bio can arrive after the grid does, and the early read misses them.
  let lateHeader = {};
  try { lateHeader = await win.webContents.executeJavaScript(headerCode, true); }
  catch (e) { lateHeader = {}; console.log('[SWA] ⚠️ Late header read failed: ' + (e && e.message ? e.message : e)); }
  if (lateHeader && lateHeader.__error) { console.log('[SWA] ⚠️ Late header read error: ' + lateHeader.__error); lateHeader = {}; }
  const merged = Object.assign({}, header);
  for (const k of Object.keys(lateHeader)) {
    if (lateHeader[k] && !merged[k]) merged[k] = lateHeader[k];
  }

  return {
    meta: { title: merged.title || '', description: merged.description || '', image: merged.image || '' },
    header: merged,
    userId: merged.userId || null,
    posts: [...byCode.values()],
    rounds,
  };
}

/**
 * METHOD 2 — Post-page enrichment.
 * A post page renders server-side-ish metadata that is unavailable anywhere
 * else anonymously: exact likes, comments, date, caption, hashtags and place.
 * It has to be a real navigation (a plain HTML fetch returns the JS shell), so
 * it is capped and announced — never silently truncated.
 */
async function enrichPostsFromPostPages(win, posts, sendProgress, opts) {
  const cap = (opts && opts.cap) || 40;
  const cleanUser = (opts && opts.username) || '';
  const needs = posts.filter(p => p && p.shortcode && (p.likes == null || !p.caption || !p.timestamp));
  const targets = needs.slice(0, cap);
  if (!targets.length) return { enriched: 0, attempted: 0, capped: false };

  const readCode = `(() => {
    const pick = (n) => { const el = document.querySelector('meta[property="og:' + n + '"]'); return el ? el.content : ''; };
    const t = document.querySelector('time');
    const body = (document.body && document.body.innerText) || '';
    const locLine = (body.match(/(?:^|\\n)([A-Z][^\\n]{2,38},\\s*[A-Z][^\\n]{2,38})(?:\\n|$)/) || [])[1] || '';
    return { ogTitle: pick('title'), ogDescription: pick('description'), ogImage: pick('image'), datetime: t ? (t.getAttribute('datetime') || '') : '', location: /instagram/i.test(locLine) ? '' : locLine, loginWall: !!document.querySelector('input[name="username"]') };
  })()`;

  const results = {};
  let ok = 0;
  for (let i = 0; i < targets.length; i++) {
    const sc = targets[i].shortcode;
    try {
      await win.loadURL('https://www.instagram.com/p/' + encodeURIComponent(sc) + '/', { userAgent: IG_DESKTOP_UA });
      await waitInPage(win, `(() => { const el = document.querySelector('meta[property="og:title"]'); return !!(el && el.content && el.content.indexOf('Instagram') !== 0); })()`, { timeoutMs: 12000, everyMs: 400 });
      const data = await win.webContents.executeJavaScript(readCode, true);
      if (data && data.ogTitle) { results[sc] = data; ok++; }
    } catch (e) { /* one post failing must not abort the batch */ }
    if (sendProgress) sendProgress({ phase: 'enrich', username: cleanUser, done: i + 1, total: targets.length, enriched: ok });
  }
  return { results, enriched: ok, attempted: targets.length, capped: needs.length > targets.length };
}

/** Parse the likes/comments/date/caption that Instagram prints into og:description. */
function parseInstagramOg(desc, ogTitle) {
  const out = { likes: null, comments: null, caption: null, date: null, hashtags: [], mentions: [] };
  if (!desc) return out;
  const likes = desc.match(/([\d.,]+\s*[KMkm]?)\s*likes?/i);
  const comments = desc.match(/([\d.,]+\s*[KMkm]?)\s*comments?/i);
  if (likes) out.likes = compactCount(likes[1]);
  if (comments) out.comments = compactCount(comments[1]);
  const date = desc.match(/on\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4})/i);
  if (date) out.date = date[1];
  let caption = null;
  if (ogTitle) {
    const m = ogTitle.match(/on Instagram:\s*"([\s\S]*)"\s*$/);
    if (m) caption = m[1];
  }
  if (!caption) {
    const m = desc.match(/:\s*"([\s\S]*)"\s*\.?\s*$/);
    if (m) caption = m[1];
  }
  if (caption) {
    caption = caption.replace(/\\n/g, '\n');
    out.caption = caption;
    const tags = caption.match(/#[\w\u00c0-\u024f]+/g);
    if (tags) out.hashtags = [...new Set(tags)];
    const mentions = caption.match(/@[\w.]+/g);
    if (mentions) out.mentions = [...new Set(mentions)];
  }
  return out;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    frame: false,                // Custom frameless window
    transparent: false,
    backgroundColor: '#070b18',  // Match deep-space navy
    icon: path.join(__dirname, 'assets', 'swa_logo.png'),
    show: false,
    webPreferences: {
      nodeIntegration: true,     // Required for Node.js https scraper + IPC
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false         // Allow cross-origin requests for Instagram scraping
    }
  });

  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());

  // Window control IPC
  ipcMain.removeAllListeners('window-minimize');
  ipcMain.removeAllListeners('window-maximize');
  ipcMain.removeAllListeners('window-close');
  ipcMain.removeAllListeners('scrape-instagram-profile');
  ipcMain.removeAllListeners('get-saved-scan');
  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
  ipcMain.on('window-close', () => win.close());

  /* ── The last scan this machine collected, for any account ──────────────
     A scan is written to disk (scan-cache/<username>.json) as it walks, and
     again when it ends. That means the most recent results survive a crash,
     a closed window, a cleared localStorage or a reinstall. The renderer asks
     for them here so it can show real data immediately while a fresh, slower
     scan runs — instead of an empty dashboard.
     Reports exactly what is on disk: posts, whether the walk reached the end
     (`complete`), how many pages it covered, and when it was written. */
  ipcMain.on('get-saved-scan', (event, payload) => {
    const reply = (data) => {
      try {
        if (event.sender && !event.sender.isDestroyed()) event.sender.send('saved-scan-result', data);
      } catch (e) { /* window closed mid-call — harmless */ }
    };
    try {
      const wantUser = String((payload && payload.username) || '').replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
      let found = wantUser ? readScanCache(wantUser) : null;
      let source = found ? 'requested' : null;

      if (!found) {
        // Nothing for that handle: fall back to the newest cache on disk.
        const dir = scanCacheDir();
        let best = null;
        let bestFile = null;
        if (fs.existsSync(dir)) {
          fs.readdirSync(dir).filter(f => f.endsWith('.json')).forEach(f => {
            try {
              const file = path.join(dir, f);
              const stat = fs.statSync(file);
              const data = JSON.parse(fs.readFileSync(file, 'utf8'));
              if (!data || !Array.isArray(data.posts) || !data.posts.length) return;
              if (!best || stat.mtimeMs > best.mtimeMs) { best = { data, mtimeMs: stat.mtimeMs }; bestFile = f; }
            } catch (e) { /* skip unreadable cache file */ }
          });
        }
        if (best) { found = best.data; source = 'newest:' + bestFile; }
      }

      if (!found || !Array.isArray(found.posts) || !found.posts.length) return reply(null);
      reply({
        username: found.username || wantUser || null,
        profile: found.profile || null,
        posts: found.posts,
        complete: found.complete === true,
        pages: found.pages || null,
        lastCursor: found.lastCursor || null,
        stoppedReason: found.stoppedReason || null,
        scanReport: found.scanReport || null,
        methods: found.methods || [],
        updatedAt: found.updatedAt || null,
        userId: found.userId || null,
        source: source,
      });
    } catch (e) {
      console.log('[SWA] ⚠️ get-saved-scan failed: ' + e.message);
      reply(null);
    }
  });

  // ─── Instagram Browser-Based Scraper IPC ────────────────────────────────
  // Uses a real Chromium browser instance to bypass TLS fingerprint blocking
  // This is the most reliable scraping method since Instagram sees real Chrome traffic
  const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  ];

  ipcMain.on('scrape-instagram-profile', async (event, payload) => {
    // Support both old format (string username) and new format (object with username + session)
    const username = typeof payload === 'string' ? payload : payload.username;
    const session = typeof payload === 'object' ? (payload.session || {}) : {};
    const opts = (payload && typeof payload === 'object') ? payload : {};
    // Full-history is the DEFAULT: analytics are only as good as the slice of
    // the account they were computed on, so a scan walks the feed until the
    // account's very first post. Pass { fullHistory: false } for a quick peek.
    const fullHistory = opts.fullHistory !== false;
    const resumeEnabled = opts.resume !== false;
    const cleanUser = username.replace(/[^a-zA-Z0-9._]/g, '').toLowerCase();
    if (!cleanUser) {
      event.reply('scrape-instagram-result', { error: 'Invalid username' });
      return;
    }

    // Progress stream — the renderer shows pages/posts collected while a long
    // history is walked, so a multi-minute scan is visible instead of silent.
    const sendProgress = (p) => {
      try {
        if (event.sender && !event.sender.isDestroyed()) event.sender.send('scrape-progress', p);
      } catch (e) { /* window closed mid-scan — harmless */ }
    };

    // Resume an interrupted full-history walk instead of restarting it.
    const cachedScan = resumeEnabled ? readScanCache(cleanUser) : null;
    let startCursor = opts.startCursor || null;
    if (!startCursor && cachedScan && cachedScan.complete === false && cachedScan.lastCursor) {
      startCursor = cachedScan.lastCursor;
    }
    // Set by the feed walk below; every exit path reports status honestly.
    let scanReport = null;
    // Which scraping methods ran, and what each one produced. A scan that only
    // got the anonymous slice must be able to say so instead of looking complete.
    const methods = [];
    const recordMethod = (name, status, detail) => {
      methods.push({ name, status, detail: detail == null ? '' : String(detail) });
      console.log(`[SWA] 🧪 method ${name}: ${status}${detail ? ' — ' + detail : ''}`);
    };

    let browserWin = null;
    try {
      // Pick a random UA for this session
      const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

      browserWin = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false,
        paintWhenInitiallyHidden: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false,
          // Share the main window's session for cookie persistence
          session: win.webContents.session
        }
      });

      // Set the user agent on the session
      await browserWin.webContents.session.setUserAgent(ua);

      // Inject Instagram session cookies if user is logged in
      if (session.cookies) {
        try {
          const cookiesToSet = session.cookies.split(';').filter(Boolean);
          for (const cookieStr of cookiesToSet) {
            const [name, ...valParts] = cookieStr.trim().split('=');
            const value = valParts.join('=');
            if (name && value) {
              const cookie = {
                url: 'https://www.instagram.com',
                name: name.trim(),
                value: value.trim(),
                domain: '.instagram.com',
                secure: true,
                httpOnly: false
              };
              try { await browserWin.webContents.session.cookies.set(cookie); } catch (e) { }
            }
          }
          console.log('[SWA] ✅ Injected Instagram session cookies into browser window');
        } catch (e) {
          console.log('[SWA] ⚠️ Failed to inject cookies:', e.message);
        }
      } else if (session.loggedIn && session.sessionid) {
        // If we have individual session fields, build the cookie
        try {
          const cookieVal = `sessionid=${session.sessionid}; csrftoken=${session.csrftoken || ''};`;
          await browserWin.webContents.session.cookies.set({
            url: 'https://www.instagram.com',
            name: 'sessionid',
            value: session.sessionid,
            domain: '.instagram.com',
            secure: true,
            httpOnly: true
          });
          if (session.csrftoken) {
            await browserWin.webContents.session.cookies.set({
              url: 'https://www.instagram.com',
              name: 'csrftoken',
              value: session.csrftoken,
              domain: '.instagram.com',
              secure: true,
              httpOnly: false
            });
          }
          console.log('[SWA] ✅ Injected Instagram session via individual cookies');
        } catch (e) {
          console.log('[SWA] ⚠️ Failed to inject session cookies:', e.message);
        }
      }

      // Visit Instagram homepage first to set additional cookies
      try {
        await browserWin.loadURL('https://www.instagram.com/', {
          userAgent: ua,
          extraHeaders: 'Accept-Language: en-US,en;q=0.9\r\n'
        });
        // Brief pause for cookies to be set
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) { /* Homepage load may redirect, that's OK */ }

      // Now navigate to the profile page
      let pageLoaded = false;
      let pageError = null;
      const navTimeout = setTimeout(() => {
        if (!pageLoaded && browserWin && !browserWin.isDestroyed()) {
          pageError = 'Navigation timed out';
          try { browserWin.destroy(); } catch (e) { }
        }
      }, 30000);

      try {
        await browserWin.loadURL(`https://www.instagram.com/${encodeURIComponent(cleanUser)}/`, {
          userAgent: ua,
          extraHeaders: 'Accept-Language: en-US,en;q=0.9\r\n'
        });
        pageLoaded = true;
      } catch (e) {
        clearTimeout(navTimeout);
        pageError = e.message;
      }
      clearTimeout(navTimeout);

      if (pageError && !pageLoaded) {
        throw new Error(pageError);
      }

      // Wait for the page to settle (JS execution, lazy content)
      await new Promise(r => setTimeout(r, 4000));

      /* ─── METHOD 1: Rendered DOM (works without a sign-in) ─────────────
         Runs first on purpose: every API endpoint requires a session, while the
         rendered page still exposes the header and the newest posts. */
      let domResult = null;
      try {
        domResult = await scrapeProfileViaRenderedDom(browserWin, cleanUser, sendProgress);
        if (domResult && domResult.posts && domResult.posts.length) {
          const h = domResult.header || {};
          recordMethod('rendered-dom', 'ok', domResult.posts.length + ' posts visible on the profile page — header: ' +
            'bio=' + (h.bio ? h.bio.length + ' chars' : 'none') +
            ', website=' + (h.externalUrl || 'none') +
            ', userId=' + (h.userId || 'none') +
            ', followersText=' + (h.followers || 'none'));
        } else if (domResult && domResult.header && domResult.header.hasLoginForm) {
          recordMethod('rendered-dom', 'login-wall', 'Instagram served a sign-in page instead of the profile');
        } else {
          recordMethod('rendered-dom', 'empty', 'the profile page rendered but exposed no post links');
        }
      } catch (e) {
        recordMethod('rendered-dom', 'failed', e.message);
      }

      //── Extract Data ──────────────────────────────────────────────────
      // Run comprehensive extraction in the browser context
      const extractionCode = `
        (() => {
          const result = { type: null, data: null, meta: {} };
          const cleanUser = '${cleanUser}';

          // ── 1. Extract OG meta tags (always available, no JS needed) ──
          const ogTitle = document.querySelector('meta[property="og:title"]');
          const ogDesc = document.querySelector('meta[property="og:description"]');
          const ogImage = document.querySelector('meta[property="og:image"]');
          const ogUrl = document.querySelector('meta[property="og:url"]');
          // meta[name="description"] is the one that quotes the bio; og:description
          // is counts-only. Prefer whichever actually carries the profile text.
          const nameDesc = document.querySelector('meta[name="description"]');
          const descLong = [ogDesc?.content || '', nameDesc?.content || ''];
          result.meta = {
            title: ogTitle?.content || document.title || '',
            description: descLong.find(d => /on Instagram:/i.test(d)) || descLong.find(Boolean) || '',
            image: ogImage?.content || '',
            url: ogUrl?.content || ''
          };

          // ── 2. Extract __NEXT_DATA__ (most reliable data source) ──
          try {
            const nextEl = document.getElementById('__NEXT_DATA__');
            if (nextEl && nextEl.textContent) {
              const parsed = JSON.parse(nextEl.textContent);
              // Try all known paths for user data
              const user = parsed?.props?.pageProps?.user ||
                          parsed?.props?.pageProps?.data?.user ||
                          parsed?.entry_data?.ProfilePage?.[0]?.graphql?.user;
              if (user && (user.username || user.id)) {
                result.type = '__NEXT_DATA__';
                result.data = parsed;
                result.user = user;
              }
            }
          } catch(e) {}

          // ── 3. If no data yet, try to extract from rendered JSON scripts ──
          if (!result.user) {
            try {
              const scripts = document.querySelectorAll('script[type="application/json"]');
              for (const s of scripts) {
                try {
                  const d = JSON.parse(s.textContent);
                  if (d && (d.username === cleanUser || (d.user && d.user.username === cleanUser))) {
                    result.type = 'json_script';
                    result.user = d.user || d;
                    break;
                  }
                } catch(e) {}
              }
            } catch(e) {}
          }

          // ── 4. Try window globals ──
          if (!result.user) {
            try {
              if (window.__INITIAL_STATE__) {
                result.type = '__INITIAL_STATE__';
                result.data = window.__INITIAL_STATE__;
                const pathKey = Object.keys(window.__INITIAL_STATE__).find(k => k.includes('ProfilePage'));
                if (pathKey) result.user = window.__INITIAL_STATE__[pathKey]?.user;
              }
            } catch(e) {}
          }
          if (!result.user) {
            try {
              if (window.__additionalDataLoaded) {
                const addl = window.__additionalDataLoaded;
                result.type = 'additionalData';
                result.data = addl;
                result.user = addl?.graphql?.user || addl?.data?.user;
              }
            } catch(e) {}
          }

          // ── 5. Check if we're behind a login wall ──
          if (!result.user) {
            const bodyText = document.body?.innerText || '';
            const isLoginPage = bodyText.includes('Log in') || bodyText.includes('password') ||
                                bodyText.includes('Sign up') || document.querySelector('form[action*="login"]');
            if (isLoginPage) {
              result.type = 'login_required';
            } else if (result.meta.title || result.meta.description) {
              // Only meta data available
              result.type = 'meta_only';
            }
          }

          return result;
        })()
      `;

      let result = await browserWin.webContents.executeJavaScript(extractionCode);

      // The rendered-DOM header is richer than the embedded page state (which
      // Instagram no longer ships), so prefer it when it has real values.
      if (domResult && domResult.meta) {
        // Both the early header read and the later page read may hold the bio;
        // take whichever one actually quotes the profile text.
        const descCandidates = [domResult.meta.description, result.meta.description].filter(Boolean);
        result.meta = {
          title: domResult.meta.title || result.meta.title,
          description: descCandidates.find(d => /on Instagram:/i.test(d)) || descCandidates[0] || '',
          image: domResult.meta.image || result.meta.image,
          url: result.meta.url,
        };
        if (!result.type || result.type === 'meta_only' || result.type === 'login_required') {
          result.type = 'meta_only';
        }
        result.dom = {
          bio: (domResult.header && domResult.header.bio) || '',
          externalUrl: (domResult.header && domResult.header.externalUrl) || '',
          followersText: (domResult.header && domResult.header.followers) || null,
          followingText: (domResult.header && domResult.header.following) || null,
        };
      }
      if (domResult && domResult.userId && !result._userId) {
        result._userId = String(domResult.userId);
        console.log(`[SWA] ✅ Resolved userId=${result._userId} from the rendered profile page`);
      }

      // ─── Extract any posts embedded in __NEXT_DATA__ (rare, but possible) ───
      let postData = [];

      // Seed with the posts the rendered page exposed (METHOD 1).
      if (domResult && domResult.posts && domResult.posts.length) {
        postData = historyScan.mergePosts(postData, domResult.posts);
        console.log(`[SWA] ✅ Rendered DOM exposed ${postData.length} posts for @${cleanUser} (rounds: ${domResult.rounds})`);
      }

      // ─── Resume: seed with posts collected by an earlier interrupted walk ───
      // A throttled or closed app leaves a cache behind; starting from it means
      // repeated scans ACCUMULATE the whole account instead of re-fetching the
      // same newest posts and never reaching the older ones.
      if (cachedScan && Array.isArray(cachedScan.posts) && cachedScan.posts.length) {
        postData = historyScan.mergePosts(postData, cachedScan.posts);
        console.log(`[SWA] ♻️ Resumed cached scan — ${cachedScan.posts.length} posts already collected (cursor ${cachedScan.lastCursor || 'none'})`);
      }

      if (result.user) {
        try {
          const user = result.user;
          const edges = user.edge_owner_to_timeline_media?.edges || [];
          for (const e of edges) {
            const n = e.node || e;
            if (n.shortcode) {
              const postType = n.__typename === 'GraphSidecar' ? 'carousel' :
                (n.is_video || n.__typename === 'GraphVideo' ? (n.product_type === 'clips' ? 'reel' : 'video') : 'photo');
              const caption = n.edge_media_to_caption?.edges?.[0]?.node?.text || '';
              let hashtags = [], mentions = [];
              if (caption) {
                const htm = caption.match(/#[\w]+/g);
                if (htm) hashtags = [...new Set(htm)];
                const mnm = caption.match(/@[\w.]+/g);
                if (mnm) mentions = [...new Set(mnm)];
              }
              let locName = '';
              try { if (n.location) locName = typeof n.location === 'string' ? n.location : (n.location.name || ''); } catch {}
              postData.push({
                shortcode: n.shortcode,
                thumbnail: n.display_url || n.thumbnail_src || '',
                likes: n.edge_media_preview_like?.count ?? n.like_count ?? null,
                comments: n.edge_media_to_comment?.count ?? n.comment_count ?? null,
                caption: caption,
                hashtags: hashtags,
                mentions: mentions,
                isVideo: !!n.is_video || n.__typename === 'GraphVideo',
                postType,
                carouselCount: n.edge_sidecar_to_children?.edges?.length || 0,
                videoViews: n.video_view_count || null,
                videoUrl: n.video_url || null,
                videoDuration: n.video_duration != null ? Math.round(n.video_duration) : null,
                location: locName,
                timestamp: n.taken_at_timestamp ?? n.taken_at ?? null,
              });
            }
          }
          if (postData.length > 0) {
            console.log(`[SWA] ✅ Got ${postData.length} posts from __NEXT_DATA__ for @${cleanUser}`);
          }
        } catch (e) { }
      }

      {
        const embedded = postData.length - ((domResult && domResult.posts) ? domResult.posts.length : 0);
        if (embedded > 0) recordMethod('embedded-page-state', 'ok', embedded + ' posts');
        else recordMethod('embedded-page-state', 'empty', 'Instagram no longer ships post data in the page state');
      }

      // ─── Read REAL session cookies from Electron's browser session ─────────
      // The homepage visit above (instagram.com/) sets csrftoken + mid + ig_did
      // If user saved their session in settings, sessionid is already in the Electron session
      let liveCookies = {};
      try {
        const allCookies = await browserWin.webContents.session.cookies.get({ domain: '.instagram.com' });
        for (const c of allCookies) {
          liveCookies[c.name] = c.value;
        }
        console.log('[SWA] 🍪 Live IG cookies: ' + Object.keys(liveCookies).join(', '));
      } catch (e) {
        console.log('[SWA] ⚠️ Could not read live cookies: ' + e.message);
      }

      const cookieHeader = Object.entries(liveCookies).map(([k, v]) => `${k}=${v}`).join('; ');
      const csrfToken = liveCookies['csrftoken'] || '';
      const sessionId = liveCookies['sessionid'] || session.sessionid || '';

      // ─── STRATEGY 1: Instagram Mobile API v1 (most reliable, full data) ────
      // Uses i.instagram.com/api/v1/  — same API the Instagram iOS app uses
      // Works for public profiles without login; works with sessionid for private
      // Always run this to get ALL posts via pagination, even if we got some from __NEXT_DATA__
      if (fullHistory || postData.length < 50) {
        try {
          const https = require('https');
          const makeRequest = (hostname, path, headers) => new Promise((resolve, reject) => {
            const req = https.get({ hostname, path, headers }, res => {
              let data = '';
              res.on('data', d => data += d);
              res.on('end', () => resolve({ status: res.statusCode, body: data }));
            });
            req.on('error', reject);
            // 25s: a 50-post feed page on a slow link can take a while.
            req.setTimeout(25000, () => { req.destroy(); reject(new Error('timeout')); });
          });

          const mobileHeaders = {
            'User-Agent': 'Instagram 317.0.0.0.35 Android (30/11; 420dpi; 1080x2187; OnePlus; 6T; OnePlus6T; qcom; en_US; 474786801)',
            'Accept': '*/*',
            'Accept-Language': 'en-US',
            'X-IG-App-ID': '567067343352427',
            'X-IG-Capabilities': '3brTvw==',
            'X-IG-Connection-Type': 'WIFI',
            'Cookie': cookieHeader,
          };
          if (csrfToken) mobileHeaders['X-CSRFToken'] = csrfToken;

          // Step A: Resolve userId via web_profile_info API
          let userId = result.user?.id || result._userId || null;
          if (!userId) {
            try {
              const profileResp = await makeRequest('i.instagram.com',
                `/api/v1/users/web_profile_info/?username=${encodeURIComponent(cleanUser)}`,
                { ...mobileHeaders, 'Referer': `https://www.instagram.com/${cleanUser}/` }
              );
              if (profileResp.status === 200) {
                const profileData = JSON.parse(profileResp.body);
                userId = profileData?.data?.user?.id ||
                  profileData?.user?.id ||
                  profileData?.graphql?.user?.id;
                if (userId) console.log(`[SWA] ✅ Resolved userId=${userId} for @${cleanUser} via web_profile_info`);
                // Also extract profile data if we don't have it yet
                if (!result.user && profileData?.data?.user) {
                  result.user = profileData.data.user;
                  result.type = 'mobile_api_v1';
                }
              }
            } catch (e) {
              console.log('[SWA] ⚠️ web_profile_info failed: ' + e.message);
            }
          }

          // Step A2: The web_profile_info lookup is frequently rate-limited/blocked
          // for anonymous requests. The profile page itself is already loaded in
          // the browser window, so read the numeric user id straight out of it —
          // without an id the feed walk below cannot run at all, and the scan
          // would silently fall back to the newest handful of posts.
          if (!userId && browserWin && !browserWin.isDestroyed()) {
            try {
              const domUserId = await browserWin.webContents.executeJavaScript(`
                (() => {
                  try {
                    const nextEl = document.getElementById('__NEXT_DATA__');
                    if (nextEl) {
                      const d = JSON.parse(nextEl.textContent);
                      const u = (d && d.props && d.props.pageProps && (d.props.pageProps.user || (d.props.pageProps.data && d.props.pageProps.data.user))) || null;
                      if (u && u.id) return String(u.id);
                    }
                  } catch (e) {}
                  try {
                    const html = document.documentElement.innerHTML;
                    const m = html.match(/"profilePage_(\\d+)"/) || html.match(/"pk":"?(\\d{6,})/);
                    return m ? String(m[1]) : null;
                  } catch (e) { return null; }
                })()
              `);
              if (domUserId) {
                userId = domUserId;
                if (result && !result._userId) result._userId = domUserId;
                console.log(`[SWA] ✅ Resolved userId=${userId} from the profile page DOM`);
              }
            } catch (e) {
              console.log('[SWA] ⚠️ Could not read userId from the page: ' + e.message);
            }
          }

          // Step B: Walk the user feed until the account's very FIRST post.
          // There is no fixed page cap: the cursor loop ends only when
          // Instagram reports nothing left, so the scan covers the full
          // account history instead of the newest few hundred posts.
          if (userId) {
            const pageSize = fullHistory ? 50 : 24;
            const maxPages = fullHistory
              ? historyScan.SAFETY_MAX_PAGES
              : (sessionId ? 20 : 10); // quick mode: ~480 authenticated, ~240 anonymous
            console.log(`[SWA] 🌐 ${fullHistory ? 'Walking FULL HISTORY' : 'Fetching newest ' + maxPages + ' page(s)'} for userId=${userId} (page size ${pageSize})${startCursor ? ', resuming at cursor ' + String(startCursor).slice(0, 24) : ''}...`);

            const scan = await historyScan.paginateAll({
              startCursor,
              maxPages,
              minDelayMs: fullHistory ? 1200 : 800,
              maxRetries: 4,
              retryBaseMs: 3000,
              shouldStop: () => !!(browserWin && browserWin.isDestroyed()),
              fetchPage: async (cursor) => {
                const feedPath = `/api/v1/feed/user/${userId}/?count=${pageSize}${cursor ? '&max_id=' + encodeURIComponent(cursor) : ''}`;
                const feedResp = await makeRequest('i.instagram.com', feedPath, mobileHeaders);
                if (feedResp.status !== 200) {
                  const body = String(feedResp.body || '').slice(0, 160).replace(/\s+/g, ' ');
                  throw new Error(`Feed API HTTP ${feedResp.status}${body ? ' — ' + body : ''}`);
                }
                const feedData = JSON.parse(feedResp.body);
                const items = feedData?.items || [];
                return {
                  items,
                  nextCursor: feedData?.next_max_id || null,
                  moreAvailable: !!(feedData?.more_available && feedData?.next_max_id),
                };
              },
              onPage: (p) => {
                console.log(`[SWA] 📄 Feed page ${p.page}: +${p.added} posts (total ${p.posts}, more=${p.moreAvailable})`);
                sendProgress({ phase: 'page', username: cleanUser, page: p.page, posts: p.posts, added: p.added, moreAvailable: p.moreAvailable });
                // Checkpoint every 5 pages so a crash or a closed window never
                // throws away the part of the history already walked.
                if (p.page % 5 === 0) {
                  writeScanCache(cleanUser, {
                    username: cleanUser, userId, posts: postData,
                    lastCursor: p.cursor, complete: false, pages: p.page,
                    updatedAt: new Date().toISOString(),
                  });
                }
              },
              onProgress: (p) => {
                if (p.phase === 'retry') {
                  console.log(`[SWA] ↻ Feed retry ${p.attempt}/${p.maxRetries} in ${p.waitMs}ms — ${p.error}`);
                }
                sendProgress({ ...p, username: cleanUser });
              },
            });

            const mapped = scan.items.map(item => historyScan.mapMobileFeedItem(item)).filter(Boolean);
            postData = historyScan.mergePosts(postData, mapped);

            const spans = historyScan.coverage(postData, null);
            scanReport = {
              username: cleanUser,
              fullHistory,
              pages: scan.pages,
              fetchedThisRun: mapped.length,
              posts: postData.length,
              complete: scan.complete,
              stoppedReason: scan.stoppedReason,
              error: scan.error ? String(scan.error.message || scan.error) : null,
              lastCursor: scan.lastCursor,
              resumedFromCursor: startCursor || null,
              scannedAt: new Date().toISOString(),
              oldest: spans.oldest,
              newest: spans.newest,
              withEngagement: spans.withEngagement,
            };
            console.log(`[SWA] ${scan.complete ? '✅' : '⚠️'} Feed walk finished — ${postData.length} posts from ${scan.pages} page(s), complete=${scan.complete} (${scan.stoppedReason})`);

            writeScanCache(cleanUser, {
              username: cleanUser, userId, posts: postData,
              lastCursor: scan.lastCursor, complete: scan.complete,
              pages: scan.pages, stoppedReason: scan.stoppedReason,
              updatedAt: new Date().toISOString(),
            });
            recordMethod('mobile-api-v1', mapped.length ? 'ok' : 'empty',
              mapped.length + ' posts from ' + scan.pages + ' page(s), complete=' + scan.complete);
          } else {
            recordMethod('mobile-api-v1', 'skipped',
              'needs the numeric user id; Instagram returns it only to a signed-in session');
          }
        } catch (e) {
          console.log('[SWA] ⚠️ Mobile API v1 strategy failed: ' + e.message);
          recordMethod('mobile-api-v1', 'failed', e.message);
          scanReport = {
            username: cleanUser, fullHistory, posts: postData.length,
            complete: false, stoppedReason: 'error',
            error: String(e.message || e), scannedAt: new Date().toISOString(),
          };
        }
      }

      // ─── STRATEGY 2: In-browser GraphQL (uses live cookies from real session) ───
      // Only needed when the feed walk could NOT cover the account (blocked or
      // throttled) — a completed full-history walk already has every post.
      if (!(scanReport && scanReport.complete) && postData.length < 36) {
        try {
          console.log('[SWA] ℹ️ Trying in-browser GraphQL for @' + cleanUser);
          const gqlResult = await browserWin.webContents.executeJavaScript(`
            (async () => {
              const delay = ms => new Promise(r => setTimeout(r, ms));
              let userId = null;

              // Try to resolve userId from page data
              try {
                const nextEl = document.getElementById('__NEXT_DATA__');
                if (nextEl) {
                  const d = JSON.parse(nextEl.textContent);
                  userId = d?.props?.pageProps?.user?.id ||
                           d?.props?.pageProps?.data?.user?.id ||
                           d?.entry_data?.ProfilePage?.[0]?.graphql?.user?.id ||
                           d?.props?.pageProps?.profile?.id;
                }
              } catch(e) {}
              if (!userId) {
                try {
                  const scripts = document.querySelectorAll('script[type="application/json"]');
                  for (const s of scripts) {
                    try {
                      const d = JSON.parse(s.textContent);
                      const uid = d?.user?.id || d?.data?.user?.id || d?.props?.pageProps?.user?.id;
                      if (uid) { userId = uid; break; }
                    } catch(e) {}
                  }
                } catch(e) {}
              }
              if (!userId) {
                try {
                  const m2 = document.documentElement.innerHTML.match(/"pk":"?(\\d{6,})/);
                  if (m2) userId = m2[1];
                } catch(e) {}
              }
              if (!userId) return { posts: [], userId: null };

              const mapPost = (e) => {
                const n = e.node || e.media || e;
                const postType = n.__typename === 'GraphSidecar' ? 'carousel' :
                  (n.is_video || n.__typename === 'GraphVideo' ? (n.product_type === 'clips' ? 'reel' : 'video') : 'photo');
                const caption = n.edge_media_to_caption?.edges?.[0]?.node?.text || n.caption?.text || '';
                let hashtags = [], mentions = [];
                if (caption) {
                  const htm = caption.match(/#[\w]+/g);
                  if (htm) hashtags = [...new Set(htm)];
                  const mnm = caption.match(/@[\w.]+/g);
                  if (mnm) mentions = [...new Set(mnm)];
                }
                let locName = '';
                try { if (n.location) locName = typeof n.location === 'string' ? n.location : (n.location.name || ''); } catch {}
                return {
                  shortcode: n.shortcode || n.code || '',
                  thumbnail: n.display_url || n.thumbnail_src || n.image_versions2?.candidates?.[0]?.url || '',
                  likes: n.edge_media_preview_like?.count ?? n.like_count ?? null,
                  comments: n.edge_media_to_comment?.count ?? n.comment_count ?? null,
                  caption: caption,
                  hashtags: hashtags,
                  mentions: mentions,
                  isVideo: n.is_video || n.__typename === 'GraphVideo' || postType === 'reel',
                  postType,
                  carouselCount: n.edge_sidecar_to_children?.edges?.length || n.carousel_media_count || 0,
                  videoViews: n.video_view_count ?? n.play_count ?? null,
                  videoUrl: n.video_url || null,
                  videoDuration: n.video_duration != null ? Math.round(n.video_duration) : null,
                  location: locName,
                  timestamp: n.taken_at_timestamp ?? n.taken_at ?? null,
                };
              };

              // Grab cookies from the real browser session
              const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
              const lsd = document.querySelector('[name="lsd"]')?.value || '';
              const docIds = ['10015901848480474','8845758582119845','9310670392322965','17888483320059182','5587632691332174','5443204686453520'];
              for (const docId of docIds) {
                try {
                  const allPosts = [];
                  let cursor = null;
                  for (let page = 0; page < 60; page++) {
                    const variables = {id: userId, first: 50, after: cursor};
                    const resp = await fetch('/graphql/query/', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-CSRFToken': csrf,
                        'X-IG-App-ID': '936619743392459',
                        'X-ASBD-ID': '129477',
                        'X-FB-LSD': lsd,
                        'Sec-Fetch-Site': 'same-origin'
                      },
                      body: 'doc_id=' + docId + '&variables=' + encodeURIComponent(JSON.stringify(variables))
                    });
                    if (!resp.ok) break;
                    const data = await resp.json();
                    const timeline = data?.data?.user?.edge_owner_to_timeline_media ||
                                     data?.data?.xdt_api__v1__feed__user_timeline_graphql_connection;
                    const edges = timeline?.edges || [];
                    if (edges.length === 0) break;
                    edges.forEach(e => allPosts.push(mapPost(e)));
                    const pageInfo = timeline?.page_info;
                    if (pageInfo?.has_next_page && pageInfo?.end_cursor) {
                      cursor = pageInfo.end_cursor;
                      await delay(600);
                    } else break;
                  }
                  if (allPosts.length > 0) return { userId, posts: allPosts };
                } catch(e) {}
              }

              // Try GET query_hash approach
              const queryHashes = ['69cba40317214236af40e7efa697781d','452a673636280e5504746f34533036a7','8c2a52996976f1ecb4e20ae6cb1e8e5c','42323d64886122307be10013ad2dcc44'];
              for (const qh of queryHashes) {
                try {
                  const allPosts = [];
                  let cursor = null;
                  for (let page = 0; page < 60; page++) {
                    const variables = JSON.stringify({id: userId, first: 50, after: cursor});
                    const resp = await fetch('/graphql/query/?query_hash=' + qh + '&variables=' + encodeURIComponent(variables), {
                      headers: { 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrf }
                    });
                    if (!resp.ok) break;
                    const data = await resp.json();
                    const timeline = data?.data?.user?.edge_owner_to_timeline_media ||
                                     data?.data?.xdt_api__v1__feed__user_timeline_graphql_connection;
                    const edges = timeline?.edges || [];
                    if (edges.length === 0) break;
                    edges.forEach(e => allPosts.push(mapPost(e)));
                    const pageInfo = timeline?.page_info;
                    if (pageInfo?.has_next_page && pageInfo?.end_cursor) {
                      cursor = pageInfo.end_cursor;
                      await delay(600);
                    } else break;
                  }
                  if (allPosts.length > 0) return { userId, posts: allPosts };
                } catch(e) {}
              }

              return { posts: [], userId };
            })()
          `);
          if (gqlResult?.posts?.length > 0) {
            // MERGE GraphQL posts with existing posts (don't replace)
            // Prefer posts with more complete engagement data (non-null likes/comments)
            const merged = new Map();
            postData.forEach(p => { if (p.shortcode) merged.set(p.shortcode, p); });
            gqlResult.posts.forEach(p => {
              if (p.shortcode) {
                const existing = merged.get(p.shortcode);
                if (!existing) {
                  merged.set(p.shortcode, p);
                } else if ((p.likes != null && existing.likes == null) || (p.comments != null && existing.comments == null)) {
                  // GraphQL post has engagement data, prefer it over __NEXT_DATA__ post with nulls
                  merged.set(p.shortcode, p);
                }
              }
            });
            postData = [...merged.values()];
            if (gqlResult.userId) result._userId = gqlResult.userId;
            console.log('[SWA] ✅ In-browser GraphQL fetched ' + gqlResult.posts.length + ' posts, total now ' + postData.length + ' for @' + cleanUser);
            recordMethod('in-browser-graphql', 'ok', gqlResult.posts.length + ' posts');
          } else {
            recordMethod('in-browser-graphql', 'empty', 'Instagram answered the GraphQL call without post data');
          }
        } catch (e) {
          console.log('[SWA] ⚠️ In-browser GraphQL failed: ' + e.message);
          recordMethod('in-browser-graphql', 'failed', e.message);
        }
      }

      // ─── STRATEGY 3: OG Tag Enrichment (add richer data to posts we have) ───
      // Batch processing: fetch multiple posts in parallel for speed
      if (postData.length > 0) {
        try {
          // OG enrichment is a per-post page fetch. Every post already carries
          // real API fields (likes/comments/views/date) from the feed walk, so
          // this only upgrades formatting on the newest handful — capping it
          // keeps a 900-post full-history scan from turning into an hour of
          // page fetches. Never silent: the cap is logged.
          const ogLimit = fullHistory ? 120 : 400;
          const allShortcodes = postData.filter(p => p.shortcode).map(p => p.shortcode);
          const shortcodes = allShortcodes.slice(0, ogLimit);
          console.log('[SWA] 🔍 Enriching ' + shortcodes.length + '/' + postData.length + ' posts via OG tag extraction (batch mode)...' + (allShortcodes.length > shortcodes.length ? ' [newest ' + ogLimit + ' only]' : ''));
          const enrichedPosts = await browserWin.webContents.executeJavaScript(`
            (async () => {
              const shortcodes = ${JSON.stringify(shortcodes)};
              const delay = ms => new Promise(r => setTimeout(r, ms));
              const results = {};
              const BATCH_SIZE = 5;  // Process 5 posts in parallel per batch (safe for Instagram rate limits)
              const BATCH_DELAY = 500;  // 500ms between batches (safe: ~10 requests/second)
              let processed = 0;
              let failed = 0;

              // Helper: fetch and parse a single post's OG tags
              const fetchPostOG = async (sc) => {
                try {
                  const resp = await fetch('/p/' + sc + '/', {
                    headers: { 'Accept': 'text/html', 'Accept-Language': 'en-US' }
                  });
                  if (!resp.ok) return null;
                  const html = await resp.text();

                  const og = {};
                  const ogDescM = html.match(/<meta\\s+property=["']og:description["']\\s+content=["']([^"']+)["']/i)
                    || html.match(/<meta\\s+content=["']([^"']+)["']\\s+property=["']og:description["']/i);
                  const ogImageM = html.match(/<meta\\s+property=["']og:image["']\\s+content=["']([^"']+)["']/i)
                    || html.match(/<meta\\s+content=["']([^"']+)["']\\s+property=["']og:image["']/i);

                  // Meta attributes HTML-escape their quotes, so "&quot;" has to be
                  // turned back into a real quote before the caption can be read.
                  const codepoint = (n) => {
                    try { return (n >= 0 && n <= 0x10FFFF) ? String.fromCodePoint(n) : ''; } catch (e) { return ''; }
                  };
                  const deEntity = (s) => String(s || '')
                    .replace(/&#x([0-9a-f]+);/gi, (m, h) => codepoint(parseInt(h, 16)))
                    .replace(/&#(\d+);/g, (m, d) => codepoint(parseInt(d, 10)))
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'")
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&');
                  const ogTitleM = html.match(/<meta\\s+property=["']og:title["']\\s+content=["']([^"']+)["']/i)
                    || html.match(/<meta\\s+content=["']([^"']+)["']\\s+property=["']og:title["']/i);
                  og.description = deEntity(ogDescM?.[1] || '');
                  og.image = ogImageM?.[1] || '';
                  og.title = deEntity(ogTitleM?.[1] || '');

                  const desc = og.description;
                  if (desc) {
                    const parseCompactNum = (s) => {
                      if (!s) return null;
                      s = s.replace(/,/g, '');
                      if (/[Kk]$/.test(s)) return Math.round(parseFloat(s) * 1000);
                      if (/[Mm]$/.test(s)) return Math.round(parseFloat(s) * 1000000);
                      return parseInt(s) || null;
                    };
                    const likesMatch = desc.match(/([\\d,]+[KkMm]?)\\s*like/i);
                    const commentsMatch = desc.match(/([\\d,]+[KkMm]?)\\s*comment/i);
                    // The caption is quoted in both meta fields; accept either source.
                    const captionMatch = desc.match(/["\\u201c]([^"\\u201d]{5,})["\\u201d]/) ||
                      (og.title ? og.title.match(/on Instagram:\\s*["\\u201c]([\\s\\S]{5,})["\\u201d]\\s*$/) : null);
                    const dateMatch = desc.match(/((?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},?\\s*\\d{4})/i)
                      || desc.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2},?\\s*\\d{4})/i);
                    const hashtagMatch = desc.match(/#[\\w]+/g);
                    og.likes = parseCompactNum(likesMatch?.[1]);
                    og.comments = parseCompactNum(commentsMatch?.[1]);
                    og.caption = captionMatch ? captionMatch[1] : null;
                    og.date = dateMatch ? dateMatch[1] : null;
                    og.hashtags = hashtagMatch ? [...new Set(hashtagMatch)] : [];
                  }

                  const likesHtml = html.match(/"edge_media_preview_like"\\s*:\\s*\\{\\s*"count"\\s*:\\s*(\\d+)/)?.[1];
                  const commentsHtml = html.match(/"edge_media_to_comment"\\s*:\\s*\\{\\s*"count"\\s*:\\s*(\\d+)/)?.[1];
                  const tsHtml = html.match(/"taken_at_timestamp"\\s*:\\s*(\\d+)/)?.[1];
                  const viewsHtml = html.match(/"video_view_count"\\s*:\\s*(\\d+)/)?.[1] || html.match(/"play_count"\\s*:\\s*(\\d+)/)?.[1];

                  return {
                    ogLikes: (og.likes != null && !isNaN(og.likes)) ? og.likes : null,
                    ogComments: (og.comments != null && !isNaN(og.comments)) ? og.comments : null,
                    ogCaption: og.caption || null,
                    ogDate: og.date || null,
                    ogHashtags: og.hashtags || [],
                    ogImage: og.image || null,
                    htmlLikes: likesHtml ? parseInt(likesHtml) : null,
                    htmlComments: commentsHtml ? parseInt(commentsHtml) : null,
                    timestamp: tsHtml ? parseInt(tsHtml) : null,
                    videoViews: viewsHtml ? parseInt(viewsHtml) : null,
                  };
                } catch(e) {
                  console.log('[SWA] ⚠️ OG fetch failed for ' + sc + ': ' + e.message);
                  return null;
                }
              };

              // Process in batches of BATCH_SIZE posts in parallel
              for (let i = 0; i < shortcodes.length; i += BATCH_SIZE) {
                const batch = shortcodes.slice(i, i + BATCH_SIZE);
                const batchResults = await Promise.all(batch.map(sc => fetchPostOG(sc)));
                batch.forEach((sc, idx) => {
                  if (batchResults[idx]) results[sc] = batchResults[idx];
                  else failed++;
                });
                processed += batch.length;
                const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(shortcodes.length / BATCH_SIZE);
                console.log('[SWA] 📦 OG batch ' + batchNum + '/' + totalBatches + ': processed ' + processed + '/' + shortcodes.length + ' posts (' + failed + ' failed)');
                if (i + BATCH_SIZE < shortcodes.length) await delay(BATCH_DELAY);
              }
              return results;
            })()
          `);

          // Count a post as enriched only when a value was actually applied. A
          // matched-but-empty response must not be logged as enrichment, or the
          // log claims data the grid does not have.
          let enrichedCount = 0;
          for (const post of postData) {
            const enriched = enrichedPosts[post.shortcode];
            if (!enriched) continue;
            let applied = false;
            if (enriched.htmlLikes != null) { post.likes = enriched.htmlLikes; applied = true; }
            else if (enriched.ogLikes != null && post.likes == null) { post.likes = enriched.ogLikes; applied = true; }
            if (enriched.htmlComments != null) { post.comments = enriched.htmlComments; applied = true; }
            else if (enriched.ogComments != null && post.comments == null) { post.comments = enriched.ogComments; applied = true; }
            if (enriched.timestamp && !post.timestamp) { post.timestamp = enriched.timestamp; applied = true; }
            if (enriched.ogCaption && (!post.caption || post.caption.length < enriched.ogCaption.length)) { post.caption = enriched.ogCaption; applied = true; }
            if (enriched.ogDate) post.ogDate = enriched.ogDate;
            if (enriched.ogHashtags?.length) { post.hashtags = enriched.ogHashtags; applied = true; }
            if (enriched.videoViews) { post.videoViews = enriched.videoViews; applied = true; }
            if (enriched.ogImage && !post.thumbnail) { post.thumbnail = enriched.ogImage; applied = true; }
            if (applied) enrichedCount++;
          }
          console.log('[SWA] ✅ OG enrichment: ' + enrichedCount + '/' + postData.length + ' posts actually gained data for @' + cleanUser);
          recordMethod('in-page-og', enrichedCount ? 'ok' : 'empty',
            enrichedCount + '/' + postData.length + ' posts gained real values');
        } catch (e) {
          console.log('[SWA] ⚠️ OG enrichment failed: ' + e.message);
        }
      }

      // ─── STRATEGY 4: Scroll + DOM extraction (backstop) ───────────────────
      // METHOD 1 already walks the grid, so this only runs when the page gave us
      // nothing at all (e.g. the grid had not rendered when METHOD 1 looked).
      if (postData.length === 0) {
        try {
          console.log('[SWA] ℹ️ Trying DOM scroll extraction for @' + cleanUser);
          const scrollExtractCode = `
            (() => {
              return (async () => {
                const posts = [];
                const seen = new Set();
                const delay = ms => new Promise(r => setTimeout(r, ms));

                // Scroll to trigger lazy loading
                for (let i = 0; i < 10; i++) {
                  window.scrollBy(0, 900);
                  await delay(600);
                }
                await delay(1500);

                const getImgSrc = (el) => el ? (el.getAttribute('src') || el.getAttribute('data-src') || el.srcset?.split(' ')[0] || '') : '';
                const allLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
                allLinks.forEach(link => {
                  const href = link.getAttribute('href') || '';
                  const m = href.match(/\\/(?:p|reel)\\/([^\\/]+)/);
                  if (m && !seen.has(m[1])) {
                    seen.add(m[1]);
                    const img = link.querySelector('img');
                    const isReel = href.includes('/reel/');
                    posts.push({
                      shortcode: m[1],
                      thumbnail: getImgSrc(img),
                      isVideo: isReel,
                      postType: isReel ? 'reel' : 'photo',
                      source: 'dom_scroll'
                    });
                  }
                });

                return posts.slice(0, 200);
              })();
            })()
          `;
          const domPosts = await browserWin.webContents.executeJavaScript(scrollExtractCode);
          if (domPosts && domPosts.length > 0) {
            recordMethod('dom-scroll-backstop', 'ok', domPosts.length + ' posts');
            // MERGE DOM posts with existing posts (don't replace)
            const merged = new Map();
            postData.forEach(p => { if (p.shortcode) merged.set(p.shortcode, p); });
            domPosts.forEach(p => { if (p.shortcode && !merged.has(p.shortcode)) merged.set(p.shortcode, p); });
            postData = [...merged.values()];
            console.log('[SWA] ✅ DOM extraction found ' + domPosts.length + ' posts, total now ' + postData.length + ' for @' + cleanUser);
          }
        } catch (e) {
          console.log('[SWA] ⚠️ DOM extraction failed: ' + e.message);
        }
      }

      /* ─── METHOD 2: Post-page enrichment (real navigation) ───────────────
         Nothing else exposes likes, comments, date, caption and place
         anonymously, and a plain HTML fetch returns the JS shell — so each post
         is opened in the window. The number opened is capped AND announced; a
         cap is never applied silently. */
      // Captions and exact timestamps matter most to the analysis (hashtags,
      // mentions, posting times), so a post counts as "needs a look" when any of
      // likes, caption or timestamp is still missing.
      const missingEngagement = postData.filter(p => p.likes == null || !p.caption || !p.timestamp).length;
      if (postData.length > 0 && missingEngagement > 0) {
        const enrichCap = fullHistory ? 40 : 60;
        sendProgress({ phase: 'enrich', username: cleanUser, done: 0, total: Math.min(enrichCap, missingEngagement), enriched: 0 });
        console.log(`[SWA] 🧪 Opening up to ${enrichCap} post page(s) for real likes/comments/date/caption (${missingEngagement} post(s) lack engagement data)...`);
        try {
          const enrich = await enrichPostsFromPostPages(browserWin, postData, sendProgress, { cap: enrichCap, username: cleanUser });
          let applied = 0;
          for (const post of postData) {
            const d = enrich.results && enrich.results[post.shortcode];
            if (!d) continue;
            const parsed = parseInstagramOg(d.ogDescription, d.ogTitle);
            if (parsed.likes != null) post.likes = parsed.likes;
            if (parsed.comments != null) post.comments = parsed.comments;
            if (parsed.caption && (!post.caption || parsed.caption.length > post.caption.length)) post.caption = parsed.caption;
            if (parsed.hashtags.length) post.hashtags = parsed.hashtags;
            if (parsed.mentions.length) post.mentions = parsed.mentions;
            if (parsed.date) post.ogDate = parsed.date;
            if (d.datetime) { const ts = Date.parse(d.datetime); if (!isNaN(ts)) post.timestamp = Math.floor(ts / 1000); }
            if (d.location && !post.location) post.location = d.location;
            if (d.ogImage && !post.thumbnail) post.thumbnail = d.ogImage;
            applied++;
          }
          postData = historyScan.sortNewestFirst(postData);
          recordMethod('post-page-enrichment', applied ? 'ok' : 'empty',
            applied + '/' + enrich.attempted + ' post page(s) returned real likes, comments, date and caption' +
            (enrich.capped ? ' — capped, so some posts were left unenriched' : ''));
        } catch (e) {
          recordMethod('post-page-enrichment', 'failed', e.message);
        }
      } else if (postData.length > 0) {
        recordMethod('post-page-enrichment', 'skipped', 'every post already carried engagement data');
      }

      // Every scan states which methods ran and how far it actually got.
      if (!scanReport) {
        scanReport = {
          username: cleanUser, fullHistory, posts: postData.length,
          complete: false, stoppedReason: 'no-feed-walk',
          scannedAt: new Date().toISOString(),
        };
      }
      scanReport.methods = methods;
      scanReport.signedIn = !!sessionId;
      if (!scanReport.complete && postData.length > 0 && !sessionId) {
        scanReport.note = postData.length + ' posts are all Instagram exposes without a sign-in. ' +
          'Signing in (Settings → Instagram Login) unlocks the full history.';
      }
      console.log('[SWA] 📋 Scan methods: ' + methods.map(m => m.name + '=' + m.status).join(', '));

      // Final write of the last results for this account, together with the
      // profile header and the scan report. This file is what the renderer can
      // reload later (or after a crash) so the newest scan is always available,
      // labelled with how complete it really was.
      writeScanCache(cleanUser, {
        username: cleanUser,
        userId: (result && result._userId) || userId || null,
        // The header is assembled from whichever reads actually produced a
        // value — the rendered page's own text first, then anything the page
        // state exposed. A count that was never seen stays null ("—" on screen),
        // never a guess.
        profile: (function () {
          const h = (domResult && domResult.header) || {};
          const d = result.dom || {};
          const followers = compactCount(h.followers || d.followersText) ?? (typeof result.followers === 'number' ? result.followers : null);
          const following = compactCount(h.following || d.followingText) ?? (typeof result.following === 'number' ? result.following : null);
          return {
            username: cleanUser,
            fullName: (result.title || '').replace(/\s*•\s*Instagram.*$/i, '').replace(/\s*\(@.*\)$/i, '').trim() || cleanUser,
            bio: h.bio || d.bio || (result.meta && result.meta.description) || '',
            profilePicUrl: h.image || (result.meta && result.meta.image) || '',
            followers: followers,
            following: following,
            posts: null,
            externalUrl: h.externalUrl || d.externalUrl || '',
            isVerified: /verified/i.test(h.title || '') || false,
            fetchedAt: new Date().toISOString(),
          };
        })(),
        posts: postData,
        complete: scanReport.complete === true,
        pages: scanReport.pages || null,
        lastCursor: scanReport.lastCursor || null,
        stoppedReason: scanReport.stoppedReason || null,
        scanReport,
        methods,
        updatedAt: new Date().toISOString(),
      });

      event.reply('scrape-instagram-result', { success: true, result, posts: postData, scanReport });
    } catch (err) {
      // The walk may have collected posts before failing. They were checkpointed
      // to disk already; tell the renderer a partial result exists so it can
      // still show the newest data instead of nothing.
      const partial = readScanCache(cleanUser);
      event.reply('scrape-instagram-result', {
        error: err.message || 'Browser scrape failed',
        partial: partial && partial.posts ? {
          posts: partial.posts,
          profile: partial.profile || null,
          complete: partial.complete === true,
          updatedAt: partial.updatedAt || null,
        } : null,
      });
    } finally {
      if (browserWin && !browserWin.isDestroyed()) {
        try { browserWin.destroy(); } catch (e) { }
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
