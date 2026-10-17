/* serve-web.js — serve the built online preview (web/) over plain HTTP.

   A browser will not load the preview's data from a file:// URL (fetch is blocked
   by the origin rules), so use this to check the build before uploading it, or to
   let someone on the same network test it without deploying.

     node build-web.js && node serve-web.js          # http://127.0.0.1:4173
     node serve-web.js --port 8080 --host 0.0.0.0    # reachable from the LAN

   Zero dependencies, read-only: it only ever serves files inside web/.
*/
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = parseInt(argOf('--port', process.env.PORT || '4173'), 10);
const HOST = argOf('--host', '127.0.0.1');
const ROOT = path.join(__dirname, 'web');

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
    console.error('\n❌ web/index.html not found — run `node build-web.js` first.\n');
    process.exit(1);
}

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
    let urlPath;
    try { urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch (e) { urlPath = '/'; }
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    // Resolve inside web/ only — never let a path escape the build output.
    const target = path.join(ROOT, path.normalize(urlPath).replace(/^([/\\])+/, ''));
    if (!target.startsWith(ROOT)) {
        res.writeHead(403).end('Forbidden');
        return;
    }
    fs.readFile(target, (err, buf) => {
        if (err) {
            console.log('  404 ' + urlPath);
            res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found: ' + urlPath);
            return;
        }
        res.writeHead(200, {
            'Content-Type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-cache',
        });
        res.end(buf);
    });
}).listen(PORT, HOST, () => {
    console.log('\n🌐 Serving the SWA online preview from ' + ROOT);
    console.log('   → http://' + (HOST === '0.0.0.0' ? '127.0.0.1' : HOST) + ':' + PORT + '\n');
    console.log('   Open the link, check the dashboard, then upload web/ to a host to share it.');
    console.log('   Ctrl+C to stop.\n');
});
