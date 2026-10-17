/* web-tools.js — the one thing `build-web.js` and `test_web_smoke.js` both need:
   a Chromium-based browser to render a page in. No dependencies. */

'use strict';

const fs = require('fs');
const path = require('path');

/** First installed Chrome / Edge / Chromium, or null when there is none. */
function findBrowser() {
    const win = [
        process.env.CHROME_PATH,
        path.join(process.env['PROGRAMFILES'] || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
        path.join(process.env['PROGRAMFILES'] || 'C:/Program Files', 'Microsoft/Edge/Application/msedge.exe'),
    ];
    const other = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    ];
    return win.concat(other).find(p => p && fs.existsSync(p)) || null;
}

module.exports = { findBrowser };
