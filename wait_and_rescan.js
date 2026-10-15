/**
 * wait_and_rescan.js — Watch for the app's exported Instagram session
 * (ig_session.json, written after the user logs in via Settings > Instagram
 * Login in the app), then automatically run rescan_live.js to pull brand-new
 * posts with up-to-date like/comment counts.
 *
 * Usage: node wait_and_rescan.js [--timeout=360]
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, 'ig_session.json');
const RESCAN_SCRIPT = path.join(__dirname, 'rescan_live.js');

const argTimeout = process.argv.find(a => a.startsWith('--timeout=') || a === '--timeout');
let MAX_WAIT_SEC = 360;
if (argTimeout) {
    const raw = argTimeout.includes('=') ? argTimeout.split('=')[1] : process.argv[process.argv.indexOf(argTimeout) + 1];
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n > 0) MAX_WAIT_SEC = n;
}

let waited = 0;

function checkAndRun() {
    if (fs.existsSync(SESSION_FILE)) {
        console.log(`✅ Session file detected after ~${waited}s — starting live rescan...\n`);
        const child = spawn(process.execPath, [RESCAN_SCRIPT], {
            stdio: 'inherit',
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        child.on('error', err => {
            console.error(`❌ Could not start rescan_live.js: ${err.message}`);
            process.exit(1);
        });
        child.on('exit', code => {
            console.log(`\n🔚 rescan_live.js finished (exit ${code}).`);
            process.exit(code == null ? 1 : code);
        });
        return;
    }
    if (waited >= MAX_WAIT_SEC) {
        console.log(`⏱️  Waited ${MAX_WAIT_SEC}s and ig_session.json has not appeared yet.`);
        console.log('Make sure the app is running with the updated code and you logged in via Settings > Instagram Login.');
        console.log('When ready, re-run: node wait_and_rescan.js');
        process.exit(1);
    }
    waited += 5;
    setTimeout(checkAndRun, 5000);
}

console.log('👀 Watching for ig_session.json...');
console.log('   (Log in via Settings > Instagram Login in the app — restart the app first so it loads the updated code.)\n');
setTimeout(checkAndRun, 5000);
