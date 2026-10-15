const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Add missing loadUnfollowHistory() method
// Find the pattern: loadErrorLog() method followed by saveErrorLog()
// and insert loadUnfollowHistory() between them

const loadErrorLogPattern = `    loadErrorLog() {
        try { const s = localStorage.getItem('swaErrorLog'); return s ? JSON.parse(s) : []; } catch { return []; }
    }
    saveErrorLog()`;

const loadErrorLogReplacement = `    loadErrorLog() {
        try { const s = localStorage.getItem('swaErrorLog'); return s ? JSON.parse(s) : []; } catch { return []; }
    }
    loadUnfollowHistory() {
        try { const s = localStorage.getItem('swaUnfollowHistory'); return s ? JSON.parse(s) : {}; } catch { return {}; }
    }
    saveErrorLog()`;

if (content.includes(loadErrorLogPattern)) {
    content = content.replace(loadErrorLogPattern, loadErrorLogReplacement);
    console.log('✓ Added loadUnfollowHistory() method');
} else {
    console.log('✗ Could not find loadErrorLog pattern - trying alternate approach');
}

// Fix 2: Update initIntro() to have a safety fallback timeout
const initIntroPattern = `    initIntro() {
        const intro = document.getElementById('intro');
        if (!intro) return;
        if (typeof gsap !== 'undefined') {
            const logo = intro.querySelector('.intro-logo-sphere');
            if (logo) {
                gsap.fromTo(logo, { scale: .3, opacity: 0, rotation: -15 }, { scale: 1, opacity: 1, rotation: 0, duration: .9, ease: 'back.out(1.7)' });
            }
            gsap.fromTo(intro.querySelector('.intro-brand'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: 'power2.out', delay: .5 });
            gsap.to(intro, {
                opacity: 0, scale: 1.04, duration: .6, ease: 'power2.in', delay: 2.6,
                onComplete: () => { intro.remove(); }
            });
        } else {
            setTimeout(() => intro.remove(), 2800);
        }
    }`;

const initIntroReplacement = `    initIntro() {
        const intro = document.getElementById('intro');
        if (!intro) return;
        // Safety fallback: remove intro after 8 seconds no matter what
        const fallbackTimer = setTimeout(() => { if (intro && intro.parentNode) try { intro.remove(); } catch {} }, 8000);
        if (typeof gsap !== 'undefined') {
            try {
                const logo = intro.querySelector('.intro-logo-sphere');
                if (logo) {
                    gsap.fromTo(logo, { scale: .3, opacity: 0, rotation: -15 }, { scale: 1, opacity: 1, rotation: 0, duration: .9, ease: 'back.out(1.7)' });
                }
                gsap.fromTo(intro.querySelector('.intro-brand'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: 'power2.out', delay: .5 });
                gsap.to(intro, {
                    opacity: 0, scale: 1.04, duration: .6, ease: 'power2.in', delay: 2.6,
                    onComplete: () => { clearTimeout(fallbackTimer); if (intro && intro.parentNode) intro.remove(); }
                });
            } catch (e) {
                // GSAP failed, fall through to timeout
            }
        }
        // Always schedule a remove; GSAP path above clears this if it succeeds
        setTimeout(() => { clearTimeout(fallbackTimer); if (intro && intro.parentNode) intro.remove(); }, 3000);
    }`;

if (content.includes(initIntroPattern)) {
    content = content.replace(initIntroPattern, initIntroReplacement);
    console.log('✓ Updated initIntro() with safety fallback');
} else {
    console.log('✗ Could not find initIntro pattern');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ File saved');
