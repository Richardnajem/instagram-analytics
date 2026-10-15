// SWA - instagram-auth Module
// Extends InstagramAnalytics.prototype
// Auto-generated from app.js refactoring

(function() {
'use strict';
const P = InstagramAnalytics.prototype;

P.loginToInstagram = async function(username, password) {
        if (!username || !password) {
            showToast('Enter Instagram username and password', 'warning');
            return false;
        }
        showToast('Logging into Instagram...', 'info');
        try {
            const https = require('https');
            const crypto = require('crypto');

            // Step 1: Get CSRF token
            const csrfToken = await new Promise((resolve, reject) => {
                const reqOpts = {
                    hostname: 'i.instagram.com',
                    path: '/api/v1/si/fetch_headers/?challenge_type=login&guid=' + crypto.randomUUID(),
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*'
                    }
                };
                const req = https.get(reqOpts, res => {
                    let data = '';
                    res.on('data', d => data += d);
                    res.on('end', () => {
                        const setCookie = res.headers['set-cookie'] || [];
                        const csrfCookie = setCookie.find(c => c.startsWith('csrftoken'));
                        const csrf = csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : '';
                        resolve(csrf);
                    });
                });
                req.on('error', reject);
                req.end();
            });

            if (!csrfToken) {
                showToast('Failed to get CSRF token from Instagram', 'error');
                return false;
            }

            // Step 2: Login with credentials
            const encPwd = '#PWD_INSTAGRAM_BROWSER:0:&' + encodeURIComponent(password);
            const formFields = [
                'username=' + encodeURIComponent(username),
                'enc_password=' + encPwd,
                'queryParams={}',
                'device_id=' + crypto.randomUUID(),
                'guid=' + crypto.randomUUID()
            ];
            const formData = formFields.join('&');

            const loginResult = await new Promise((resolve, reject) => {
                const opts = {
                    hostname: 'i.instagram.com',
                    path: '/api/v1/web/accounts/login/ajax/',
                    method: 'POST',
                    headers: {
                        'User-Agent': 'Instagram 269.0.0.18.75 Android',
                        'X-CSRFToken': csrfToken,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Referer': 'https://www.instagram.com/',
                    }
                };
                const req = https.request(opts, res => {
                    let data = '';
                    res.on('data', d => data += d);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            const cookies = (res.headers['set-cookie'] || []).join('; ');
                            const sessionMatch = cookies.match(/sessionid=([^;]+)/);
                            const userIdMatch = cookies.match(/ds_user_id=([^;]+)/);
                            resolve({
                                success: json.authenticated,
                                sessionid: sessionMatch ? sessionMatch[1] : '',
                                userId: userIdMatch ? userIdMatch[1] : '',
                                csrftoken: csrfToken,
                                cookies: cookies,
                                message: json.message
                            });
                        } catch { resolve({ success: false, error: 'Parse error' }); }
                    });
                });
                req.write(formData);
                req.end();
            });

            if (loginResult.success) {
                this.saveInstagramSession({
                    sessionid: loginResult.sessionid,
                    csrftoken: loginResult.csrftoken,
                    userId: loginResult.userId,
                    cookies: loginResult.cookies,
                    username: username,
                    loggedInAt: new Date().toISOString()
                });
                showToast('Logged into Instagram successfully! ✅', 'success');
                return true;
            } else {
                showToast('Login failed: ' + (loginResult.message || loginResult.error || 'Check credentials'), 'error');
                return false;
            }
        } catch (err) {
            showToast('Login error: ' + (err.message || 'Connection failed'), 'error');
            return false;
        }
    }

P.logoutInstagram = function() {
        this.saveInstagramSession(null);
        showToast('Logged out of Instagram', 'info');
    }

/**
 * Unfollow "suspected fake" followers.
 *
 * HONESTY CONTRACT (never fabricate a result):
 *   The fake-follower list on the Analysis page is a *statistical estimate* —
 *   category counts derived from engagement signals. It contains NO real
 *   account identities, so there is nothing this app can truthfully unfollow.
 *   This method therefore never: simulates a success, moves the estimated
 *   numbers, or unfollows invented IDs. It acts only when the caller supplies
 *   a real, non-empty list of account IDs (`this.getUnfollowTargetIds`), and
 *   otherwise tells the user exactly what is needed.
 */
P.performUnfollow = async function(category, count, btn) {
        if (!btn) return;

        const auth = this.isInstagramLoggedIn();
        const canRealUnfollow = auth.loggedIn && (auth.hasSession || auth.hasApiToken);
        // Real account IDs to act on — an empty list means we must not pretend.
        const targetIds = (typeof this.getUnfollowTargetIds === 'function')
            ? (this.getUnfollowTargetIds(category) || [])
            : [];

        if (!canRealUnfollow || targetIds.length === 0) {
            btn.disabled = false;
            showToast(
                '⚠️ Nothing unfollowed — this needs real account IDs, not an estimate.<br>' +
                (!canRealUnfollow
                    ? 'Steps: open Settings → connect Instagram (login, or add an access token), then scan the profile.'
                    : 'This account has no stored list of suspected accounts to unfollow; the Analysis list shows estimated categories only.'),
                'warning'
            );
            return;
        }

        btn.disabled = true;
        btn.textContent = '⏳ Working...';
        btn.style.opacity = '0.6';
        try {
            const unfollowed = await this.unfollowViaInstagramAPI(targetIds, auth);
            if (unfollowed > 0) {
                // Only a real, counted result is recorded — and we still do NOT
                // touch the estimated follower numbers, which unfollowing cannot change.
                this._unfollowedFakeCounts[category] = (this._unfollowedFakeCounts[category] || 0) + unfollowed;
                this.saveUnfollowHistory();
                btn.textContent = '✅ Unfollowed (' + unfollowed + ')';
                btn.style.background = 'rgba(16,185,129,.2)';
                btn.style.borderColor = '#10b981';
                btn.style.color = '#10b981';
                this._updateUnfollowUI();
                showToast('✅ Unfollowed ' + this.fmt(unfollowed) + ' account(s) via Instagram API', 'success');
            } else {
                btn.disabled = false;
                btn.textContent = '🚫 Unfollow';
                btn.style.opacity = '1';
                showToast('Instagram API unfollowed 0 accounts — the request was rejected (check the session/token).', 'warning');
            }
        } catch (err) {
            btn.disabled = false;
            btn.textContent = '🚫 Unfollow';
            btn.style.opacity = '1';
            showToast('API unfollow failed: ' + (err.message || 'Error'), 'error');
        }
    }

/**
 * Refresh the "unfollowed" total only. Deliberately does NOT move the
 * estimated fake/authentic follower counts: unfollowing accounts you follow
 * cannot change how many followers you have, and those figures are estimates
 * from the analysis — editing them by hand would fake the data.
 */
P._updateUnfollowUI = function() {
        const totalEl = document.getElementById('totalUnfollowedCount');
        if (totalEl) {
            const total = Object.values(this._unfollowedFakeCounts).reduce((a, b) => a + b, 0);
            totalEl.textContent = this.fmt(total);
        }
    }

/**
 * Destroy a list of REAL follower relationships over the Instagram private API.
 *
 * @param {string[]} userIds  real account IDs to unfollow (never generated here)
 * @param {object} auth       { session }
 * @returns {Promise<number>} how many the API actually confirmed
 *
 * Previously this invented ten random IDs and unfollowed whatever they landed
 * on — a real chance of unfollowing genuine followers — then reported success.
 * It now refuses an empty list and only returns the count the API confirmed.
 */
P.unfollowViaInstagramAPI = async function(userIds, auth) {
        if (!Array.isArray(userIds) || userIds.length === 0) {
            throw new Error('No real account IDs supplied to unfollow');
        }
        try {
            const https = require('https');
            const session = auth && auth.session;

            // Build cookie header
            const cookieHeader = (session && session.cookies)
                ? session.cookies
                : 'sessionid=' + (session ? session.sessionid : '') + '; csrftoken=' + (session ? session.csrftoken : '');

            let successCount = 0;
            for (const userId of userIds) {
                try {
                    await new Promise((resolve, reject) => {
                        const opts = {
                            hostname: 'i.instagram.com',
                            path: '/api/v1/friendships/destroy/' + userId + '/',
                            method: 'POST',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'X-CSRFToken': session ? session.csrftoken || '' : '',
                                'Cookie': cookieHeader,
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'Content-Length': '0',
                                'Referer': 'https://www.instagram.com/',
                            }
                        };
                        const req = https.request(opts, res => {
                            let data = '';
                            res.on('data', d => data += d);
                            res.on('end', () => {
                                try {
                                    const json = JSON.parse(data);
                                    if (json.status === 'ok') successCount++;
                                } catch {}
                                resolve();
                            });
                        });
                        req.on('error', reject);
                        req.end();
                    });
                } catch {}
            }

            return successCount;
        } catch (err) {
            console.warn('Unfollow API error:', err.message);
            return 0;
        }
    }


P.saveInstagramSession = function(session) {
        if (session) {
            localStorage.setItem('swaIgSession', JSON.stringify(session));
            // Also export the session to ig_session.json in the app folder so CLI
            // scan tools (rescan_live.js) can reuse it to bypass Instagram's
            // anonymous access rate limits when pulling fresh data.
            try {
                const fs = require('fs');
                const path = require('path');
                fs.writeFileSync(path.join(__dirname, 'ig_session.json'), JSON.stringify(session, null, 2));
            } catch (e) {
                console.warn('[SWA] Could not export IG session to file:', e.message);
            }
        } else {
            localStorage.removeItem('swaIgSession');
            // Remove the exported session file on logout
            try {
                const fs = require('fs');
                const path = require('path');
                const f = path.join(__dirname, 'ig_session.json');
                if (fs.existsSync(f)) fs.unlinkSync(f);
            } catch (e) { }
        }
    }

P.isInstagramLoggedIn = function() {
        try {
            const s = localStorage.getItem('swaIgSession');
            if (!s) return { loggedIn: false, hasSession: false, hasApiToken: false };
            const data = JSON.parse(s);
            const hasSession = !!(data.sessionid || data.cookies);
            const hasApiToken = !!(this.settings?.accessToken);
            return {
                loggedIn: hasSession || hasApiToken,
                hasSession,
                hasApiToken,
                sessionid: data.sessionid || '',
                csrftoken: data.csrftoken || '',
                userId: data.userId || '',
                username: data.username || '',
                cookies: data.cookies || ''
            };
        } catch {
            return { loggedIn: false, hasSession: false, hasApiToken: false };
        }
    }

})();
