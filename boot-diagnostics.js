/**
 * boot-diagnostics.js — early error capture + boot self-check
 * ==========================================================
 * Loaded BEFORE app.js (first script in the page) for two reasons:
 *
 *  1. CAPTURE WHAT HAPPENS TOO EARLY TO LOG. Module parse errors, failures in
 *     the constructor and anything thrown while the page is still wiring up
 *     used to vanish: the app's own error handlers only exist after boot()
 *     runs. Here they are buffered and later drained into the Error Log.
 *
 *  2. PROVE THE APP BOOTED PROPERLY, EVERY LAUNCH. A module file that fails to
 *     load silently removes its methods from the prototype, which surfaces much
 *     later as a random "is not a function" error. This maps each module file to
 *     the methods it is responsible for, so a missing module is reported as a
 *     missing module at startup instead of as a mystery crash.
 */
(function () {
    'use strict';

    var R = window.__swaBoot = window.__swaBoot || {
        startedAt: Date.now(),
        errors: [],
        // A <link>/<img>/font that could not be fetched raises an error event with
        // NO message — it is a missing asset, not a broken app. Kept separately so
        // "did anything actually break?" stays a meaningful question.
        resourceErrors: [],
        marks: {},
        moduleReport: null,
    };
    R.resourceErrors = R.resourceErrors || [];

    function push(entry) {
        try {
            R.errors.push(entry);
            if (R.errors.length > 60) R.errors.shift();
        } catch (e) { /* never let diagnostics throw */ }
    }

    function pushResource(entry) {
        try {
            R.resourceErrors.push(entry);
            if (R.resourceErrors.length > 20) R.resourceErrors.shift();
        } catch (e) { /* never let diagnostics throw */ }
    }

    /* Capture phase: catches errors that never bubble (including errors thrown
       inside listeners added by other scripts). */
    window.addEventListener('error', function (e) {
        var isJsError = !!(e && (e.message || (e.error && e.error.message)));
        if (!isJsError) {
            pushResource({
                url: (e && (e.filename || (e.target && (e.target.src || e.target.href)))) || 'unknown',
                at: Date.now(),
            });
            return;
        }
        push({
            type: 'error',
            message: e.message || (e.error && e.error.message) || 'Unknown error',
            source: (e && e.filename) || '',
            line: e && e.lineno,
            stack: e && e.error && e.error.stack,
            at: Date.now(),
        });
    }, true);

    window.addEventListener('unhandledrejection', function (e) {
        var reason = (e && e.reason) || {};
        push({
            type: 'rejection',
            message: reason.message || String(reason) || 'Unhandled promise rejection',
            source: '(promise)',
            stack: reason.stack,
            at: Date.now(),
        });
    });

    /** Timeline mark, relative to page start — shows WHERE a slow boot spends time. */
    window.__swaBootMark = function (name) {
        try { R.marks[name] = Date.now() - R.startedAt; } catch (e) { }
    };

    /* Module file → the methods it must define on InstagramAnalytics.prototype.
       Keep this in sync when a module takes on new responsibilities. */
    var MODULES = {
        'app.js': ['loadSettings', 'boot', 'fetchProfile'],
        'post-analysis.js': ['analyzePostsComprehensive', 'generateSmartRecommendations'],
        'utils.js': ['generatePostSuggestions', 'escHtml', 'fmt', 'coverageLabel'],
        'scraping.js': ['scrapeProfile', 'scanPosts', 'scanFullHistory', 'scrapeViaIPC'],
        'metrics.js': ['computeAnalysis', 'computeAdvancedMetrics', 'displayProfile'],
        'charts.js': ['renderCharts'],
        'ui.js': ['setupEventListeners', 'navigateTo', 'renderPostGrid', '_renderPostsContent'],
        'project-inventory.js': ['renderProjectInventoryPage', 'exportProjectInventoryExcel'],
        'instagram-auth.js': ['isInstagramLoggedIn', 'saveInstagramSession'],
        'storage.js': ['saveLastSearch', 'loadLastSearch', 'saveErrorLog'],
        'error-handling.js': ['logError', 'detectKnownError', 'guardedMethod'],
        'animations.js': ['initIntro', 'initEntranceAnimations'],
        'context-menu.js': ['setupContextMenu'],
    };

    /**
     * Check every expected module actually landed on the prototype.
     * Returns { modulesChecked, missingModules, missingMethods, ok }.
     */
    window.__swaBootModuleReport = function () {
        var missingModules = [];
        var missingMethods = [];
        var proto = (typeof InstagramAnalytics !== 'undefined' && InstagramAnalytics && InstagramAnalytics.prototype) || null;

        if (!proto) {
            R.moduleReport = {
                modulesChecked: Object.keys(MODULES).length,
                missingModules: Object.keys(MODULES),
                missingMethods: ['InstagramAnalytics class not defined — app.js failed to load'],
                ok: false,
                checkedAt: new Date().toISOString(),
            };
            return R.moduleReport;
        }

        Object.keys(MODULES).forEach(function (file) {
            var missing = MODULES[file].filter(function (name) {
                return typeof proto[name] !== 'function';
            });
            if (missing.length) {
                missingModules.push(file);
                missing.forEach(function (name) { missingMethods.push(file + ' → ' + name + '()'); });
            }
        });

        R.moduleReport = {
            modulesChecked: Object.keys(MODULES).length,
            missingModules: missingModules,
            missingMethods: missingMethods,
            ok: missingModules.length === 0,
            checkedAt: new Date().toISOString(),
        };
        return R.moduleReport;
    };

    /**
     * Hand buffered pre-boot errors to the app's logger, then clear them.
     * Called once from boot() — nothing is lost, and nothing is logged twice.
     */
    window.__swaDrainBootErrors = function (app) {
        var drained = R.errors.slice();
        R.errors.length = 0;
        if (R.resourceErrors.length && app && typeof app.logBuildEvent === 'function') {
            try {
                app.logBuildEvent('assets', R.resourceErrors.length + ' asset(s) failed to load (e.g. ' +
                    String(R.resourceErrors[0].url).split('/').pop() + ')');
            } catch (e) { }
        }
        if (app && typeof app.logError === 'function') {
            drained.forEach(function (e) {
                try {
                    app.logError('[pre-boot] ' + e.message, e.source || 'boot', e.line || '', {
                        severity: 'critical',
                        stack: e.stack || null,
                    });
                } catch (err) { /* logging must never break boot */ }
            });
        }
        return drained;
    };

    /** Plain-text report used by the watchdog failure screen (no dependencies). */
    window.__swaBootErrorsText = function () {
        var lines = [];
        var moduleReport = R.moduleReport || (typeof window.__swaBootModuleReport === 'function' ? window.__swaBootModuleReport() : null);
        if (moduleReport && !moduleReport.ok) {
            lines.push('Modules not loaded: ' + (moduleReport.missingModules.join(', ') || 'none'));
            if (moduleReport.missingMethods && moduleReport.missingMethods.length) {
                lines.push('Missing methods: ' + moduleReport.missingMethods.slice(0, 8).join(', '));
            }
        }
        R.errors.slice(0, 5).forEach(function (e) {
            lines.push((e.type === 'rejection' ? 'Promise: ' : 'Error: ') + e.message +
                (e.source ? ' @ ' + String(e.source).split('/').pop() + (e.line ? ':' + e.line : '') : ''));
        });
        if (R.resourceErrors.length) {
            lines.push('Assets that failed to load: ' + R.resourceErrors.length +
                ' (e.g. ' + String(R.resourceErrors[0].url).split('/').pop() + ')');
        }
        return lines;
    };
})();
