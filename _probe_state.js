'use strict';
// READ-ONLY probe: prints the app's persisted localStorage without writing anything.
// Usage: npx electron _probe_state.js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const ROOT = __dirname;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: { contextIsolation: false, nodeIntegration: true, sandbox: false },
  });
  const js = (c) => win.webContents.executeJavaScript(c, true);
  try {
    await win.loadFile(path.join(ROOT, 'index.html'));
    await new Promise((r) => setTimeout(r, 3500));
    const out = await js(`(() => {
      const r = { keys: [] };
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        r.keys.push([k, (localStorage.getItem(k) || '').length]);
      }
      try {
        const ls = JSON.parse(localStorage.getItem('swaLastSearch') || 'null');
        if (ls) r.lastSearch = {
          username: ls.profile && ls.profile.username,
          followers: ls.profile && ls.profile.followers,
          profilePosts: ls.profile && ls.profile.posts,
          postsScanned: ls.profile && ls.profile.postsScanned,
          savedPosts: (ls.posts || []).length,
          savedAt: ls.savedAt || ls.at || null,
        };
      } catch (e) { r.lastSearch = 'parse error: ' + e.message; }
      try {
        const h = JSON.parse(localStorage.getItem('swaHistory') || '[]');
        r.historyEntries = h.length;
        r.latestHistory = h.length ? { at: h[h.length - 1].timestamp, metrics: h[h.length - 1].metrics } : null;
      } catch (e) { r.historyEntries = 'parse error'; }
      return r;
    })()`);
    console.log(JSON.stringify(out, null, 2));
    app.exit(0);
  } catch (e) {
    console.error('PROBE FAILED:', e && e.stack ? e.stack : e);
    app.exit(1);
  }
});
