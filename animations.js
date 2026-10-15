// SWA - animations Module
// Extends InstagramAnalytics.prototype
// Auto-generated from app.js refactoring

(function() {
'use strict';
const P = InstagramAnalytics.prototype;

/* True when the user has asked the OS to reduce motion. */
function reduced() {
    try {
        return typeof window !== 'undefined' && window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { return false; }
}

/* ── Intro splash ──────────────────────────────────────
   A single GSAP timeline drives the whole sequence (logo pop → orbit rings →
   staggered brand → loader → progress → fade-out) so the pieces stay in sync
   instead of racing independent setTimeouts. Particles are generated once for
   a livelier backdrop. A hard fallback timer guarantees the splash is always
   removed, and motion-sensitive users get a fast, static pass. */
P.initIntro = function() {
    const intro = document.getElementById('intro');
    if (!intro) return;

    const removeIntro = () => { try { if (intro && intro.parentNode) intro.remove(); } catch {} };
    const fallbackTimer = setTimeout(removeIntro, 6000);
    const finish = () => { clearTimeout(fallbackTimer); removeIntro(); };

    const bar = document.getElementById('introProgressBar');
    const loading = document.getElementById('introLoadingText');

    // ── Reduced-motion fast path: no movement, just a beat then dismiss ──
    if (reduced()) {
        if (bar) bar.style.width = '100%';
        if (loading) loading.textContent = 'Ready';
        setTimeout(finish, 700);
        return;
    }

    // ── Generate floating particle dots (once) ──
    try {
        const pc = document.getElementById('introParticles');
        if (pc && !pc.dataset.filled) {
            pc.dataset.filled = '1';
            const frag = document.createDocumentFragment();
            for (let i = 0; i < 26; i++) {
                const dot = document.createElement('span');
                dot.className = 'intro-dot';
                const size = 2 + Math.random() * 3;
                dot.style.left = (Math.random() * 100).toFixed(2) + '%';
                dot.style.top = (Math.random() * 100).toFixed(2) + '%';
                dot.style.width = size.toFixed(1) + 'px';
                dot.style.height = size.toFixed(1) + 'px';
                dot.style.opacity = (0.2 + Math.random() * 0.5).toFixed(2);
                dot.style.animationDelay = (-Math.random() * 9).toFixed(2) + 's';
                dot.style.animationDuration = (7 + Math.random() * 9).toFixed(2) + 's';
                frag.appendChild(dot);
            }
            pc.appendChild(frag);
        }
    } catch { /* particles are decorative — never let them break boot */ }

    const gsapOK = typeof gsap !== 'undefined' && typeof gsap.timeline === 'function';
    if (!gsapOK) {
        // No GSAP: animate the bar with CSS transitions and dismiss quickly.
        if (bar) {
            bar.style.width = '45%';
            setTimeout(() => { bar.style.width = '100%'; }, 500);
        }
        setTimeout(finish, 1600);
        return;
    }

    const tl = gsap.timeline({ onComplete: finish });

    const logo = intro.querySelector('.intro-logo-sphere');
    const glow = intro.querySelector('.intro-logo-glow');
    const rings = intro.querySelectorAll('.intro-orbit-ring');
    const name = intro.querySelector('.intro-brand-name');
    const sub = intro.querySelector('.intro-brand-sub');
    const tagline = intro.querySelector('.intro-tagline');
    const loader = intro.querySelector('.intro-loader');

    if (logo) tl.fromTo(logo, { scale: .3, opacity: 0, rotation: -18 },
        { scale: 1, opacity: 1, rotation: 0, duration: .9, ease: 'back.out(1.7)' }, 0);
    if (glow) tl.fromTo(glow, { scale: .4, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1, ease: 'power2.out' }, .1);
    if (rings.length) tl.fromTo(rings, { scale: .5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1.1, stagger: .12, ease: 'power3.out' }, .15);

    if (name) tl.fromTo(name, { y: 24, opacity: 0, letterSpacing: '.35em' },
        { y: 0, opacity: 1, letterSpacing: '-.02em', duration: .8, ease: 'power3.out' }, .35);
    if (sub) tl.fromTo(sub, { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: .6, ease: 'power2.out' }, .55);
    if (tagline) tl.fromTo(tagline, { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: .6, ease: 'power2.out' }, .68);
    if (loader) tl.fromTo(loader, { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: .5, ease: 'power2.out' }, .8);

    if (bar) tl.fromTo(bar, { width: '0%' }, { width: '100%', duration: 1.9, ease: 'power1.inOut' }, .5);

    // Cycle the loading caption so the splash feels alive.
    const msgs = ['Initializing modules...', 'Loading analytics engine...', 'Applying insights...', 'Ready'];
    if (loading) {
        msgs.forEach((m, i) => {
            const at = .9 + i * .45;
            tl.to(loading, { opacity: 0, duration: .18, onComplete: () => { loading.textContent = m; } }, at)
              .to(loading, { opacity: 1, duration: .18 }, at + .18);
        });
    }

    // Fade the whole splash out, then remove it.
    tl.to(intro, { opacity: 0, scale: 1.04, duration: .6, ease: 'power2.in' }, '+=0.12');
}

/* ── Entrance choreography ─────────────────────────────
   Sidebar, header, search bar, nav items and dashboard cards animate in on a
   gentle stagger. Skipped entirely for reduced-motion users. */
P.initEntranceAnimations = function() {
    if (typeof gsap === 'undefined') return;
    if (reduced()) return;
    gsap.fromTo('#sidebar', { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: .7, ease: 'power3.out', delay: .1 });
    gsap.fromTo('.page-header', { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'power2.out', delay: .3 });
    gsap.fromTo('#dashboard .card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .6, stagger: .08, ease: 'back.out(1.4)', delay: .4 });
    gsap.fromTo('.search-bar-wrap', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'power2.out', delay: .3 });
    const navs = document.querySelectorAll('.nav-item');
    if (navs.length) gsap.fromTo(navs, { x: -22, opacity: 0 }, { x: 0, opacity: 1, duration: .45, stagger: .05, ease: 'power2.out', delay: .35 });
}

/* ── Magnetic / tilt cards ─────────────────────────────
   Pointer-driven parallax tilt on cards, plus a lift + glow on hover. Only
   attached on fine-pointer devices and never for reduced-motion users. */
P.initMagneticCards = function() {
    if (typeof gsap === 'undefined') return;
    if (reduced()) return;
    const finePointer = (() => { try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return true; } })();
    if (!finePointer) return;

    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mousemove', e => {
            const r = card.getBoundingClientRect();
            const rx = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * -5;
            const ry = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 5;
            gsap.to(card, { rotateX: rx, rotateY: ry, duration: .3, ease: 'power2.out', transformPerspective: 800 });
        });
        card.addEventListener('mouseleave', () => gsap.to(card, { rotateX: 0, rotateY: 0, scale: 1, duration: .5, ease: 'elastic.out(1,.5)' }));
        card.addEventListener('mouseenter', () => gsap.to(card, { scale: 1.02, duration: .25, ease: 'power2.out' }));
    });
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => gsap.to(btn, { scale: 1.06, duration: .2 }));
        btn.addEventListener('mouseleave', () => gsap.to(btn, { scale: 1, duration: .2 }));
    });
}

/* ── Scroll reveal ─────────────────────────────────────
   Sections fade/slide in as they enter the viewport. Skipped for
   reduced-motion users (content is shown immediately). */
P.initScrollReveal = function() {
    if (typeof gsap === 'undefined') return;
    if (reduced()) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
            gsap.fromTo(entry.target, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .55, ease: 'power2.out' });
            observer.unobserve(entry.target);
        }
    }), { threshold: 0.12 });
    document.querySelectorAll('.section-title, .data-table, .history-item').forEach(el => observer.observe(el));
}


})();
