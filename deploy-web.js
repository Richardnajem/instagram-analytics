/* deploy-web.js — build, publish, and PROVE the shareable online preview.

   One command for the whole "hand a link to testers" job:

     node deploy-web.js              # build → deploy → verify the live URL
     node deploy-web.js --no-verify  # skip the browser check (faster)
     node deploy-web.js --preview    # publish a preview deployment, not production

   The verify step is the point: it loads the deployed URL and compares it byte
   for byte with the build that was just uploaded, so a stale or half-uploaded
   deployment fails here rather than in front of the person you sent it to.

   Requires the Vercel CLI login (`npx vercel login` — a device URL you approve
   in the   browser once). Nothing is installed globally: the CLI runs through npx.
*/
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;

/* The stable public URL. `swa-preview.vercel.app` belongs to another Vercel
   account (it serves a different app), which is why ours carries the -one
   suffix Vercel assigned. Keep this in step with README §Online preview. */
const PREVIEW_URL = 'https://swa-preview-one.vercel.app';
const PROJECT = 'swa-preview';

const args = process.argv.slice(2);
const verify = !args.includes('--no-verify');
const preview = args.includes('--preview');

function step(label, file, fileArgs, opts) {
    console.log('\n▶ ' + label);
    const res = spawnSync(process.execPath, [file].concat(fileArgs || []), Object.assign({ stdio: 'inherit', cwd: ROOT }, opts));
    if (res.status !== 0) {
        console.error('\n❌ ' + label + ' failed (exit ' + res.status + ') — stopping.\n');
        process.exit(res.status || 1);
    }
}

function npx(label, npxArgs) {
    console.log('\n▶ ' + label);
    const res = spawnSync('npx', ['-y', 'vercel@latest'].concat(npxArgs),
        { stdio: 'inherit', cwd: ROOT, shell: process.platform === 'win32' });
    if (res.status !== 0) {
        console.error('\n❌ ' + label + ' failed (exit ' + res.status + ') — stopping.');
        console.error('   Not logged in? Run `npx vercel login` once, or check the project name.\n');
        process.exit(res.status || 1);
    }
}

step('Building web/ from the current sources', path.join(ROOT, 'build-web.js'));
npx('Publishing web/ to Vercel (' + PROJECT + ')',
    ['deploy', 'web', '--yes', '--project', PROJECT].concat(preview ? [] : ['--prod']));

if (verify) {
    step('Checking the live URL really serves this build',
        path.join(ROOT, 'test_web_smoke.js'), ['--url', PREVIEW_URL]);
}
console.log('\n✅ Shareable preview is live: ' + PREVIEW_URL);
console.log('   (Web-only: live scanning stays in the desktop app — see README §Online preview.)\n');
