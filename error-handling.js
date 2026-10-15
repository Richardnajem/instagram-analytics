// SWA - error-handling Module
// Extends InstagramAnalytics.prototype
// Auto-generated from app.js refactoring

(function() {
'use strict';
const P = InstagramAnalytics.prototype;

/* Messages that carry no diagnostic value for this app. Everything else is
   KEPT — including "Failed to load", "Request timed out", "NetworkError" and
   "404 Not found", which the previous filter silently discarded even though
   they are exactly the failures a user needs to see. */
P._noiseMessages = [
        'ResizeObserver loop',
        'Script error.',
        'ERR_BLOCKED_BY_CLIENT',
        'Loading CSS chunk',
        'ChunkLoadError: Loading chunk',
];

P._isNoiseMessage = function(msg) {
        if (!msg) return true;
        for (var i = 0; i < this._noiseMessages.length; i++) {
            if (msg.indexOf(this._noiseMessages[i]) !== -1) return true;
        }
        return false;
    }

/* Severity from the message + origin. Drives the colour and the ordering of
   the Error Log page so the 200-entry cap holds the problems that matter. */
P._severityFor = function(msg, source) {
        var m = String(msg || '');
        var s = String(source || '');
        if (/^\[boot/i.test(s) || /boot/i.test(s)) return 'critical';
        if (/rate limit|429|private|not found|404|blocked|login wall/i.test(m)) return 'warning';
        if (/is not a function|is not defined|Cannot read|Cannot set|Missing method|TypeError|ReferenceError/i.test(m)) return 'critical';
        if (/timeout|timed out|network|ECONN|ENOTFOUND|ETIMEDOUT|Failed to load|HTTP 5\d\d/i.test(m)) return 'error';
        if (/Test/i.test(m)) return 'test';
        return 'error';
    }

P.logError = function(message, source = '', line = '', extra = {}) {
        try {
            var safeMsg = typeof message === 'string' ? message : this._safeStringify(message);
            if (!safeMsg) safeMsg = 'Unknown error';
            var src = source || '';
            var lineStr = String(line == null ? '' : line);

            // Noise is SUPPRESSED but never silently: the counter is shown on the
            // Error Log page, so "nothing logged" can't disguise a real failure.
            if (this._isNoiseMessage(safeMsg)) {
                this._noiseSuppressed = (this._noiseSuppressed || 0) + 1;
                this._updateErrorPageStats();
                return;
            }

            if (!this.errorLog) this.errorLog = [];

            // De-duplication: a broken render loop can emit the same error
            // hundreds of times per second. Repeats within the window increment a
            // counter on the existing entry instead of pushing 200 copies of one
            // message, so the log keeps 200 DISTINCT problems.
            var DEDUPE_MS = 60000;
            var head = this.errorLog[0];
            if (head && head.message === safeMsg && head.source === src &&
                String(head.line || '') === lineStr &&
                (Date.now() - new Date(head.timestamp).getTime()) < DEDUPE_MS) {
                head.count = (head.count || 1) + 1;
                head.lastSeen = new Date().toISOString();
                this.saveErrorLog();
                this._updateErrorBadge();
                this._updateErrorPageStats();
                this._renderErrorLogList();
                return;
            }

            var stack = extra && extra.stack ? extra.stack : null;
            if (!stack) {
                try {
                    var probe = new Error(safeMsg);
                    stack = probe.stack ? String(probe.stack).split('\n').slice(0, 6).join('\n') : null;
                } catch (e) { stack = null; }
            }

            this.errorLog.unshift({
                message: safeMsg,
                source: src,
                line: lineStr,
                severity: (extra && extra.severity) || this._severityFor(safeMsg, src),
                count: 1,
                stack: stack,
                context: (extra && extra.context) || null,
                version: this.getVersion(),
                timestamp: new Date().toISOString(),
            });
            if (this.errorLog.length > 200) this.errorLog = this.errorLog.slice(0, 200);
            this.saveErrorLog();
            // Update the error badge in the sidebar
            this._updateErrorBadge();
            // Update error log page stats and render errors in-page (not as toasts)
            this._updateErrorPageStats();
            this._renderErrorLogList();
        } catch (e) {
            // Last resort: log to native console if our error logging fails
            try { console.error('[SWA] logError failed:', e, 'original:', message); } catch {}
        }
    }

P._safeStringify = function(obj) {
        try {
            var seen = new WeakSet();
            return JSON.stringify(obj, function(key, val) {
                if (typeof val === 'object' && val !== null) {
                    if (seen.has(val)) return '[Circular]';
                    seen.add(val);
                }
                return val;
            });
        } catch {
            return String(obj);
        }
    }

P._updateErrorBadge = function() {
        try {
            const badge = document.getElementById('errorNavBadge');
            if (!badge) return;
            const count = this.errorLog ? this.errorLog.length : 0;
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        } catch {}
    }

P.renderErrorLog = function() {
        this._updateErrorPageStats();
        this._renderErrorLogList();
    }

P._updateErrorPageStats = function() {
        try {
            var totalCount = document.getElementById('errTotalCount');
            var versionEl = document.getElementById('errVersionDisplay');
            var lastTimeEl = document.getElementById('errLastTime');
            var bootEl = document.getElementById('errBootStatus');
            var summaryEl = document.getElementById('errSummary');
            var count = this.errorLog ? this.errorLog.length : 0;
            if (totalCount) totalCount.textContent = count;
            if (versionEl) versionEl.textContent = 'v' + (this.getVersion ? this.getVersion() : '1.1.6');
            if (lastTimeEl) {
                if (count > 0 && this.errorLog[0].timestamp) {
                    lastTimeEl.textContent = new Date(this.errorLog[0].timestamp).toLocaleString();
                    lastTimeEl.style.color = 'var(--danger)';
                } else {
                    lastTimeEl.textContent = '--';
                    lastTimeEl.style.color = 'var(--text-muted)';
                }
            }

            // ── Boot status ──
            // "Boots properly every launch" is only verifiable if it is visible.
            var boot = this.bootReport || null;
            if (bootEl) {
                if (!boot) {
                    bootEl.textContent = '--';
                    bootEl.style.color = 'var(--text-muted)';
                } else {
                    var ok = boot.ok;
                    bootEl.textContent = (ok ? '✅ OK' : '⚠️ ' + (boot.failures || []).length + ' issue(s)') +
                        ' · ' + (boot.durationMs != null ? boot.durationMs + 'ms' : '') +
                        (boot.modulesMissing && boot.modulesMissing.length ? ' · missing: ' + boot.modulesMissing.join(', ') : '');
                    bootEl.style.color = ok ? 'var(--success)' : 'var(--warning)';
                }
            }

            // ── Severity breakdown + suppressed noise ──
            if (summaryEl) {
                var counts = { critical: 0, error: 0, warning: 0, test: 0 };
                var repeats = 0;
                (this.errorLog || []).forEach(function(e) {
                    var sev = e.severity || 'error';
                    if (counts[sev] == null) counts[sev] = 0;
                    counts[sev]++;
                    repeats += Math.max(0, (e.count || 1) - 1);
                });
                var parts = [];
                if (counts.critical) parts.push('🔴 ' + counts.critical + ' critical');
                if (counts.error) parts.push('🟠 ' + counts.error + ' error');
                if (counts.warning) parts.push('🟡 ' + counts.warning + ' warning');
                if (counts.test) parts.push('🧪 ' + counts.test + ' test');
                if (repeats) parts.push('🔁 ' + repeats + ' repeated occurrence(s) collapsed');
                if (this._noiseSuppressed) parts.push('🔇 ' + this._noiseSuppressed + ' known-noise message(s) suppressed');
                if (!parts.length) parts.push('No problems recorded — boot and runtime are clean.');
                summaryEl.innerHTML = parts.map(function(p) { return '<span>' + p + '</span>'; }).join('');
            }
        } catch (e) { /* ignore stat update errors */ }
    }

P._renderErrorLogList = function() {
        try {
            var listContainer = document.getElementById('errListContainer');
            var emptyState = document.getElementById('errEmptyState');
            if (!listContainer) return;
            if (!this.errorLog || !this.errorLog.length) {
                listContainer.innerHTML = '';
                if (emptyState) emptyState.style.display = 'flex';
                return;
            }
            if (emptyState) emptyState.style.display = 'none';
            var self = this;
            var sevStyle = {
                critical: { color: 'var(--danger)', icon: '🔴' },
                error: { color: 'var(--danger)', icon: '⚠️' },
                warning: { color: 'var(--warning)', icon: '🟡' },
                test: { color: 'var(--success)', icon: '🧪' },
            };
            listContainer.innerHTML = this.errorLog.slice(0, 50).map(function(e) {
                var rawMsg = e.message || 'Unknown error';
                var msg = self.escHtml ? self.escHtml(rawMsg) : rawMsg;
                var sev = sevStyle[e.severity] || sevStyle.error;
                var meta = new Date(e.timestamp).toLocaleString();
                var sourceInfo = e.source ? self.escHtml(String(e.source).substring(0, 60)) + (e.line ? ':' + e.line : '') : '';
                var repeat = (e.count || 1) > 1 ? '<span style="color:var(--warning);font-weight:700">🔁 ×' + e.count + '</span>' : '';
                var hint = self.detectKnownError ? self.detectKnownError(rawMsg) : null;
                // The stack is what makes an error fixable — show the first frames
                // (trimmed) instead of making the user reproduce it in DevTools.
                var stack = e.stack ? String(e.stack).split('\n').slice(1, 4).map(function(l) { return self.escHtml ? self.escHtml(l.trim()) : l.trim(); }).join('<br>') : '';
                return '<div class="err-item" style="border-left-color:' + sev.color + '">' +
                    '<span class="err-icon">' + sev.icon + '</span>' +
                    '<div class="err-content">' +
                        '<div class="err-msg">' + msg.substring(0, 200) + (msg.length > 200 ? '…' : '') + ' ' + repeat + '</div>' +
                        (hint ? '<div class="err-hint" style="font-size:.75rem;color:var(--warning);margin-top:2px">' + hint + '</div>' : '') +
                        (stack ? '<div class="err-stack" style="font-size:.7rem;color:var(--text-muted);font-family:JetBrains Mono,monospace;margin-top:3px;white-space:pre-wrap;opacity:.75">' + stack + '</div>' : '') +
                        '<div class="err-meta">' +
                            '<span>🕐 ' + meta + '</span>' +
                            (sourceInfo ? '<span class="err-source">📍 ' + sourceInfo + '</span>' : '') +
                            '<span>' + sev.icon + ' ' + (e.severity || 'error') + '</span>' +
                            (e.version ? '<span>v' + e.version + '</span>' : '') +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        } catch (e) { /* ignore render errors */ }
    }

P.clearErrorLog = function() {
        this.errorLog = [];
        this.saveErrorLog();
        this._updateErrorBadge();
        this._updateErrorPageStats();
        this._renderErrorLogList();
        var emptyState = document.getElementById('errEmptyState');
        if (emptyState) emptyState.style.display = 'flex';
        var listContainer = document.getElementById('errListContainer');
        if (listContainer) listContainer.innerHTML = '';
    }

/* ═══════════════════════════════════════════════
   ENHANCED ERROR DETECTION & GUARD SYSTEM
═══════════════════════════════════════════════ */

/**
 * guardedMethod(fn, section) — wraps any method with try/catch
 * so errors are logged with source context instead of crashing silently.
 * Usage: this.renderCharts = this.guardedMethod(function(posts) { ... }, 'Charts');
 */
P.guardedMethod = function(fn, section) {
        var self = this;
        return function() {
            try {
                return fn.apply(self, arguments);
            } catch (err) {
                var ctx = self.extractErrorContext ? self.extractErrorContext(err, 2) : {};
                var msg = '[' + section + '] ' + (err.message || err);
                // Run through detectKnownError for a human-readable hint
                var hint = self.detectKnownError ? self.detectKnownError(err.message || '') : null;
                if (hint) msg += ' ' + hint;
                self.logError(msg, ctx.source || section, ctx.line || '');
                return null;
            }
        };
    }

/**
 * extractErrorContext(err, depth) — parses Error.stack to extract
 * caller function name, file path, and line number.
 */
P.extractErrorContext = function(err, depth) {
        if (!err || !err.stack) return { source: '', line: '' };
        try {
            var lines = err.stack.split('\n');
            // Skip the first line 'Error: message' and look at caller frames
            for (var i = 1; i < Math.min(lines.length, 8); i++) {
                var line = lines[i];
                var m = line.match(/at\s+(?:new\s+)?(?:InstagramAnalytics\.)?(\w+)\s+\(?(.+?):(\d+):(\d+)\)?/);
                if (m) {
                    return { source: (m[2] || '').split('/').pop() + ':' + m[3], line: m[3] };
                }
            }
            return { source: 'unknown', line: '' };
        } catch { return { source: '', line: '' }; }
    }

/**
 * detectKnownError(message) — maps common error messages to
 * human-readable explanations and suggested fixes.
 */
P.detectKnownError = function(message) {
        if (!message) return null;
        var msg = String(message);
        var patterns = [
            // ── Existing core patterns ──
            { match: /platform is not defined/, hint: 'Reference to [platform] without this.currentPlatform. Check computeAdvancedMetrics().', fix: 'Change [platform] to [this.currentPlatform]' },
            { match: /is not a function/, hint: 'A method was called that doesn\'t exist on the prototype.', fix: 'Check module files — the method may not have been exported.' },
            { match: /Cannot read properties? of undefined/, hint: 'Tried to access a property on undefined. Likely an API response field missing.', fix: 'Add optional chaining (?.) or null checks.' },
            { match: /Cannot read property/, hint: 'Tried to read a property on undefined or null — usually a missing API field, or a DOM element not found.', fix: 'Check if the object exists: obj?.prop. For DOM: document.getElementById(\"id\")?.prop.' },
            { match: /chart|canvas/i, hint: 'Chart.js error: canvas may have been destroyed or is in a bad state.', fix: 'Check destroyCharts() calls before re-rendering.' },
            { match: /network|fetch|ECONN|ETIMEOUT|ENOTFOUND/, hint: 'Network request failed. Instagram may be blocking or rate-limiting.', fix: 'Check internet connection. Wait before retrying.' },
            { match: /timeout|timed?out/i, hint: 'The request exceeded the timeout limit.', fix: 'Increase timeout in Settings or check network speed.' },
            { match: /unhandled rejection/i, hint: 'A Promise was rejected without a .catch() handler.', fix: 'Add .catch() to the promise chain.' },
            { match: /ResizeObserver/i, hint: 'ResizeObserver loop limit. Non-critical.', fix: 'Generally harmless — can be ignored.' },
            { match: /private/i, hint: 'The account is private. Public scraping cannot access private profiles.', fix: 'Only public profiles can be scanned.' },
            { match: /not found|404/, hint: 'The profile was not found on the platform.', fix: 'Check the username spelling and platform selection.' },
            { match: /rate limit|429/, hint: 'Rate limited by the platform.', fix: 'Wait a moment before trying again.' },

            // ── JSON / parse errors ──
            { match: /JSON\.parse|Unexpected token|Unexpected end of JSON/, hint: 'The server returned malformed or empty JSON.', fix: 'Check the API response format. Add try/catch around JSON.parse().' },
            { match: /JSON\.stringify|Converting circular structure|circular/i, hint: 'Object contains circular references that cannot be serialized.', fix: 'Use a replacer function or remove circular references before JSON.stringify().' },
            { match: /Invalid array length/, hint: 'An array was created with an invalid length (negative, NaN, or too large).', fix: 'Validate array lengths before creating arrays.' },

            // ── Reference / scope errors ──
            { match: /is not defined/, hint: 'A variable or function was referenced but not declared in the current scope.', fix: 'Check for typos or missing imports. Variables need const/let/var declaration.' },
            { match: /Cannot set properties? of undefined/, hint: 'Tried to assign a property on an undefined value (e.g. obj.prop = val where obj is undefined).', fix: 'Ensure the parent object exists before assigning nested properties.' },

            // ── Stack / recursion errors ──
            { match: /Maximum call stack|stack size exceeded/i, hint: 'Infinite recursion or excessively deep call stack. A function is calling itself without termination.', fix: 'Add a base case to recursive functions. Check for accidental circular method calls.' },

            // ── Type / coercion errors ──
            // Note: "is not a function" type mismatches are caught by the general pattern above.
            // These patterns target different error classes that the general pattern doesn't cover:
            { match: /toFixed\(\) digits argument/, hint: 'Number.toFixed() was called with an invalid argument (out of 0-100 range).', fix: 'Ensure toFixed() argument is an integer between 0 and 100.' },
            { match: /Invalid Date|NaN.*date/i, hint: 'A date string or timestamp could not be parsed into a valid Date object.', fix: 'Validate date strings with Date.parse() before creating new Date().' },

            // ── Electron / environment errors ──
            { match: /ipcRenderer|remote is not defined|require is not defined/i, hint: 'Electron API was called outside of the Electron renderer process.', fix: 'Wrap Electron-specific calls in try/catch. Check that nodeIntegration is enabled.' },
            { match: /Failed to load resource|net::|ERR_FILE_NOT_FOUND/i, hint: 'A resource (script, image, stylesheet) failed to load.', fix: 'Check file paths for typos. Ensure the file exists in the expected location.' },
            { match: /localStorage|QuotaExceededError|storage/i, hint: 'localStorage is full or unavailable (private browsing may block it).', fix: 'Clear localStorage data. Reduce stored data size. Wrap localStorage calls in try/catch.' },

            // ── DOM / rendering errors ──
            // Note: "Cannot read property" null/undefined errors are caught by the general pattern above.
            { match: /GSAP|gsap/i, hint: 'GSAP animation library error. Possible invalid target or conflicting animations.', fix: 'Check that GSAP is loaded and the target element exists before animating.' },
            { match: /Failed to execute 'drawImage'|canvas.*taint/i, hint: 'A canvas tainted by cross-origin images — security error when calling toDataURL().', fix: 'Set crossOrigin=\"anonymous\" on images, or serve images from the same origin.' },
        ];
        for (var i = 0; i < patterns.length; i++) {
            if (patterns[i].match.test(msg)) {
                return '🔍 ' + patterns[i].hint + ' — Fix: ' + patterns[i].fix;
            }
        }
        return null;
    }

/**
 * initGuardedMethods() — wraps critical methods with guardedMethod
 * so their errors are caught and logged with context.
 */
P.initGuardedMethods = function() {
        var self = this;
        var wrappers = [
            { name: 'displayProfile', section: 'Display Profile' },
            { name: 'renderMarketingAnalysis', section: 'Marketing Analysis' },
            { name: 'renderPostGrid', section: 'Post Grid' },
            { name: 'renderCharts', section: 'Charts' },
            { name: 'loadProfileImages', section: 'Image Loading' },
            { name: 'switchPlatform', section: 'Platform Switch' },
        ];
        wrappers.forEach(function(w) {
            if (typeof self[w.name] === 'function') {
                var orig = self[w.name];
                self[w.name] = self.guardedMethod(orig, w.section);
            }
        });
    }

/**
 * setupEnhancedErrorHandling() — patches window-level error handlers
 * to route through our logging system with stack trace parsing.
 * Call once during boot().
 */
/**
 * testErrorDetection() — throws several error types to verify
 * guardedMethod, detectKnownError, and the error logging pipeline.
 * Click the 🧪 button in the Error Log page to trigger.
 */
P.testErrorDetection = function() {
        var self = this;
        // 1. Test guardedMethod catches errors in wrapped methods
        try {
            var testFn = self.guardedMethod(function() {
                throw new Error('Test error from guardedMethod — platform is not defined');
            }, 'Test Guard');
            testFn();
        } catch (e) { /* guardedMethod already catches it */ }

        // 2. Test detectKnownError categorizes a common error pattern
        try {
            var testFn2 = self.guardedMethod(function() {
                var x = undefined;
                return x.property; // throws 'Cannot read properties of undefined'
            }, 'Test detectKnownError');
            testFn2();
        } catch (e) { /* guardedMethod already catches it */ }

        // 3. Test logError directly with a known pattern
        self.logError('Cannot read property \'likes\' of undefined — API response missing field', 'test-manual', '1');

        // 4. Test unhandledrejection capture (fires async)
        Promise.reject(new Error('Test unhandled rejection — network timeout'));

        // 5. Test JSON parse error detection
        try {
            JSON.parse('{invalid json}');
        } catch (e) {
            self.logError(e.message, 'test-json', '0');
        }

        // 6. Test circular reference detection (if supported)
        try {
            var a = {}; a.self = a;
            JSON.stringify(a);
        } catch (e) {
            self.logError(e.message, 'test-circular', '0');
        }

        // 7. Test null property access detection
        try {
            var el = null;
            el.textContent = 'test'; // 'Cannot set properties of null'
        } catch (e) {
            self.logError(e.message, 'test-null-set', '0');
        }

        // 8. Test type mismatch detection (string method on number)
        try {
            var num = 42;
            num.replace('2', '3'); // '.replace is not a function'
        } catch (e) {
            self.logError(e.message, 'test-typemismatch', '0');
        }

        // 9. Test invalid array length
        try {
            new Array(-1);
        } catch (e) {
            self.logError(e.message, 'test-arraylen', '0');
        }

        // 10. Test localStorage quota detection
        self.logError('Failed to execute \'setItem\' on \'Storage\': Setting the value of \'swaTest\' exceeded the quota.', 'test-storage', '0');

        // Errors are now logged directly to the Error Log page
        this._updateErrorPageStats();
        this._renderErrorLogList();
    }

P.setupEnhancedErrorHandling = function() {
        var self = this;
        // Enhance unhandledrejection with stack trace (single listener, replaces basic one)
        window.addEventListener('unhandledrejection', function(e) {
            try {
                var reason = e.reason || {};
                var msg = reason.message || 'Unhandled promise rejection';
                var ctx = self.extractErrorContext ? self.extractErrorContext(reason, 1) : {};
                self.logError(msg, ctx.source || '(promise)', ctx.line || '');
            } catch (e2) {
                try { console.error('[SWA] unhandledrejection handler failed:', e2); } catch {}
            }
        });
        // Patch console.error with a reentry guard to avoid infinite loops
        var _consoleErrorInProgress = false;
        var origConsoleError = console.error;
        console.error = function() {
            if (_consoleErrorInProgress) {
                origConsoleError.apply(console, arguments);
                return;
            }
            _consoleErrorInProgress = true;
            try {
                var args = Array.prototype.slice.call(arguments);
                var msg = '';
                for (var i = 0; i < args.length; i++) {
                    var a = args[i];
                    if (typeof a === 'string') {
                        msg += a + ' ';
                    } else if (a instanceof Error) {
                        msg += (a.message || a.code || '') + ' ';
                    }
                }
                msg = msg.trim();
                // Only log meaningful app errors, not library noise
                if (msg && self.logError && msg.indexOf('SWA') !== -1) {
                    self.logError(msg, 'console.error');
                }
                origConsoleError.apply(console, args);
            } catch (e) {
                // Don't let the patcher itself break console.error
                try { origConsoleError.apply(console, ['[SWA] console.error patch failed:', e]); } catch {}
            } finally {
                _consoleErrorInProgress = false;
            }
        };
    }

})();
