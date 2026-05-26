/* ══════════════════════════════════════════════
   BEPO TRADES — Premium Animation Engine v2
   ══════════════════════════════════════════════ */

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const IS_MOBILE = window.innerWidth <= 600;

/* ── GLOBAL MOUSE ── */
let mouseX = -9999, mouseY = -9999;
document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; }, { passive: true });



/* ══ 1. CURSOR — delayed blue cube ══ */
(function initCursor() {
  const cube = document.getElementById('cCube');
  if (!cube) return;

  let cx = -200, cy = -200;
  let visible = false;

  document.addEventListener('mousemove', () => {
    if (!visible) { cube.style.opacity = '1'; visible = true; }
  });
  document.addEventListener('mouseleave', () => {
    cube.style.opacity = '0';
    visible = false;
  });

  (function tick() {
    /* delayed follow — trails ~8 frames behind the real cursor */
    cx += (mouseX - cx) * 0.12;
    cy += (mouseY - cy) * 0.12;
    cube.style.left = cx + 'px';
    cube.style.top  = cy + 'px';
    /* expose to ASCII canvas so the reaction follows the cube, not raw mouse */
    requestAnimationFrame(tick);
  })();
})();


/* ══ 3. LENIS SMOOTH SCROLL ══ */
const lenis = IS_MOBILE ? null : new Lenis({
  duration: 1.2,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  touchMultiplier: 2,
});
if (lenis) {
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ══ 4. SPOTS SYSTEM ══ */
let currentSpots = 30;

function updateAllSpots(val) {
  ['spotsNum','annSpots','finalSpots','finalSpots2','overlaySpots','overlaySpots2','currSpots','trSpotsNum'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
  const fill = document.getElementById('spotsFill');
  if (fill) fill.style.width = Math.max(((30 - val) / 30) * 100, 1) + '%';
  const fuFill = document.querySelector('.fu-fill');
  if (fuFill) fuFill.style.width = Math.max(((30 - val) / 30) * 100, 1) + '%';
}

/* tick down to 29 after 4s */
setTimeout(() => {
  currentSpots = 29;
  const n = document.getElementById('spotsNum');
  if (n) { n.style.transform = 'scale(1.3)'; n.style.color = '#ef4444'; }
  setTimeout(() => {
    if (n) { n.style.transform = ''; n.style.color = ''; }
    updateAllSpots(29);
  }, 300);
  updateAllSpots(29);
}, 4000);

function scheduleNextDrop() {
  setTimeout(() => {
    if (currentSpots > 22) { currentSpots--; updateAllSpots(currentSpots); }
    scheduleNextDrop();
  }, (8 + Math.random() * 7) * 60000);
}
scheduleNextDrop();

/* ══ 5. HERO ENTRANCE ══ */
(function initHeroEntrance() {
  const tl = gsap.timeline({ delay: 0.1 });
  tl
    .fromTo('.hero-label',  { opacity:0, y:20 }, { opacity:1, y:0, duration:0.6, ease:'power3.out' }, 0)
    .fromTo('.h1-line',     { opacity:0, y:50, filter:'blur(4px)' },
                            { opacity:1, y:0, filter:'blur(0px)', duration:0.8, ease:'power4.out', stagger:0.1 }, 0.1)
    .fromTo('.hero-sub',    { opacity:0, y:30 }, { opacity:1, y:0, duration:0.7, ease:'power3.out' }, 0.38)
    .fromTo('.price-block', { opacity:0, y:24, scale:0.97 }, { opacity:1, y:0, scale:1, duration:0.6, ease:'power3.out' }, 0.52)
    .fromTo('.spots-row',   { opacity:0, y:16 }, { opacity:1, y:0, duration:0.5, ease:'power3.out' }, 0.62)
    .fromTo('.hero-ctas',   { opacity:0, y:16 }, { opacity:1, y:0, duration:0.5, ease:'power3.out' }, 0.70)
    .fromTo('.hero-stats',  { opacity:0 },       { opacity:1, duration:0.6, ease:'power2.out' }, 0.82);
})();

/* ══ 6. SCROLL-DRIVEN SECTION EXPERIENCE ══ */
(function initScrollExperience() {
  if (IS_MOBILE) return;

  const VH     = window.innerHeight;
  const slides = [...document.querySelectorAll('.page-section')];

  /* ── section schedule: enter/exit ranges in pixels ── */
  const sched = [
    { el: slides[0], eS: -1,       eE: 0,        xS: VH*1.4,  xE: VH*1.65 }, // hero
    { el: slides[1], eS: VH*1.8,   eE: VH*2.1,   xS: VH*3.1,  xE: VH*3.35 }, // story
    { el: slides[2], eS: VH*3.55,  eE: VH*3.85,  xS: VH*9.0,  xE: VH*9.25 }, // curriculum
    { el: slides[3], eS: VH*9.45,  eE: VH*9.75,  xS: VH*13.0, xE: VH*13.25}, // transform
    { el: slides[4], eS: VH*13.45, eE: VH*13.75, xS: VH*16.4, xE: VH*16.65}, // testimonials
    { el: slides[5], eS: VH*16.85, eE: VH*17.15, xS: VH*19.1, xE: VH*20.0 }, // final
  ];

  /* total scroll height */
  document.body.style.height = VH * 20 + 'px';
  window.addEventListener('resize', () => {
    document.body.style.height = window.innerHeight * 20 + 'px';
  });

  /* ── progressive content reveals (curriculum handled separately) ── */
  const revealGroups = [
    { items: [...document.querySelectorAll('.tf-card')],    s: sched[3] },
    { items: [...document.querySelectorAll('.testi-card')], s: sched[4] },
  ];

  /* ── scroll-linked inner-list translate (heading stays fixed, content scrolls) ── */
  const scrollPanels = [
    { s: sched[3], el: slides[3].querySelector('.tf-grid') },
  ].filter(p => p.el);

  /* ── curriculum stage setup ── */
  const currStage   = slides[2].querySelector('.curr-stage');
  const modPairs    = currStage ? [...currStage.querySelectorAll('.mod-pair')] : [];
  const currFill    = slides[2].querySelector('.curr-progress-fill');
  const currDots    = [...slides[2].querySelectorAll('.curr-dot')];
  const currCounter = slides[2].querySelector('.curr-counter');
  let _currActive   = 0;
  let _currTL       = null;

  /* stack all pairs off-screen below, except pair 0 */
  modPairs.forEach((pair, i) => {
    gsap.set(pair, { yPercent: i === 0 ? 0 : 100, opacity: i === 0 ? 1 : 0, scale: 1 });
  });
  /* animate first pair's cards in immediately */
  modPairs[0]?.querySelectorAll('.mod-card').forEach((card, ci) => {
    gsap.fromTo(card,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', delay: 0.1 + ci * 0.1 }
    );
  });

  function _switchPair(toIdx) {
    if (toIdx === _currActive || !modPairs[toIdx]) return;
    const fromIdx = _currActive;
    _currActive   = toIdx;
    const dir     = toIdx > fromIdx ? 1 : -1; // 1 = forward, -1 = backward

    /* kill any running transition */
    _currTL?.kill();

    /* position incoming off-screen in the correct direction */
    gsap.set(modPairs[toIdx], { yPercent: dir * 100, opacity: 0, scale: 0.94 });

    _currTL = gsap.timeline();

    /* outgoing: slide away + fade + slight scale down */
    _currTL.to(modPairs[fromIdx], {
      yPercent: dir * -100,
      opacity: 0,
      scale:   0.94,
      duration: 0.5,
      ease: 'power2.inOut',
    }, 0);

    /* incoming: slide in + fade + scale up */
    _currTL.to(modPairs[toIdx], {
      yPercent: 0,
      opacity:  1,
      scale:    1,
      duration: 0.55,
      ease: 'power2.inOut',
    }, 0.08); /* slight overlap so it's not a hard cut */

    /* cards stagger in after the pair arrives */
    modPairs[toIdx].querySelectorAll('.mod-card').forEach((card, ci) => {
      gsap.fromTo(card,
        { y: 28, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(1.3)', delay: 0.28 + ci * 0.10 }
      );
    });
  }

  revealGroups.forEach(({ items, s }) => {
    const start = s.eE + VH * 0.05;
    /* cap reveals to finish 1.0 VH after entry — all cards appear quickly */
    const end   = Math.min(s.xS - VH * 0.05, s.eE + VH * 1.0);
    const step  = items.length > 1 ? (end - start) / (items.length - 1) : 0;
    items.forEach((item, i) => {
      item._shown    = false;
      item._revealAt = start + i * step;
      gsap.set(item, { opacity: 0, y: 24 });
    });
  });

  /* ── opacity calculator ── */
  function getOp(sy, s) {
    if (sy <= s.eS)  return s.eS < 0 ? 1 : 0;
    if (sy <= s.eE)  return (sy - s.eS) / (s.eE - s.eS);
    if (sy <= s.xS)  return 1;
    if (sy <= s.xE)  return 1 - (sy - s.xS) / (s.xE - s.xS);
    return 0;
  }

  /* ── main update ── */
  function update(sy) {
    sched.forEach(s => {
      const op = Math.max(0, Math.min(1, getOp(sy, s)));
      gsap.set(s.el, { opacity: op, pointerEvents: op > 0.05 ? 'auto' : 'none' });
    });

    revealGroups.forEach(({ items }) => {
      items.forEach(item => {
        if (sy >= item._revealAt && !item._shown) {
          item._shown = true;
          gsap.to(item, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
        } else if (sy < item._revealAt - 60 && item._shown) {
          item._shown = false;
          gsap.set(item, { opacity: 0, y: 24 });
        }
      });
    });

    /* ── curriculum stage: zone-based pair switching ── */
    if (modPairs.length) {
      const s       = sched[2];
      const rawProg = (sy - s.eE) / (s.xS - s.eE);
      const prog    = Math.max(0, Math.min(1, rawProg));
      const zone    = Math.min(Math.round(prog * (modPairs.length - 1)), modPairs.length - 1);

      /* progress bar & counter update continuously */
      if (currFill)    currFill.style.width = (prog * 100) + '%';
      if (currCounter) currCounter.textContent =
        (zone + 1) + ' / ' + modPairs.length;
      currDots.forEach((d, i) => d.classList.toggle('active', i === zone));

      /* trigger animated transition only when zone changes */
      if (zone !== _currActive) _switchPair(zone);
    }

    /* translate scroll-inner up inside scroll-window (heading stays anchored) */
    scrollPanels.forEach(({ s, el }) => {
      const windowH  = el.parentElement?.offsetHeight || 0;
      const overflow = Math.max(0, el.scrollHeight - windowH);
      if (overflow <= 0) { gsap.set(el, { y: 0 }); return; }
      const progress = Math.max(0, Math.min(1, (sy - s.eE) / (s.xS - s.eE)));
      gsap.set(el, { y: -Math.round(overflow * progress) });
    });
  }

  /* ── initialise ── */
  sched.forEach((s, i) => {
    gsap.set(s.el, { opacity: i === 0 ? 1 : 0, pointerEvents: i === 0 ? 'auto' : 'none' });
  });
  update(0);

  /* native scroll drives section updates */
  window.addEventListener('scroll', () => update(window.scrollY), { passive: true });

  /* lenis velocity drives particle boost */
  lenis.on('scroll', ({ velocity }) => {
    window._particleBoost = 1 + Math.min(Math.abs(velocity) * 0.4, 3.5);
  });
})();

/* ══ 12. FAQ ACCORDION ══ */
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item   = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(o => {
      o.classList.remove('open');
      o.querySelector('.faq-icon').textContent = '↓';
    });
    if (!isOpen) {
      item.classList.add('open');
      btn.querySelector('.faq-icon').textContent = '↑';
    }
  });
});

/* ══ 13. OVERLAY ══ */
const overlay      = document.getElementById('overlay');
const overlayClose = document.getElementById('overlayClose');
const overlayBack  = document.getElementById('overlayBackdrop');
const claimForm    = document.getElementById('claimForm');

function openOverlay()  { overlay.classList.add('active');    document.body.style.overflow = 'hidden'; }
function closeOverlay() { overlay.classList.remove('active'); document.body.style.overflow = ''; }

document.querySelectorAll('#btnClaim, #btnNavClaim, #btnCurrClaim, #btnFinalClaim, #annCta, #btnTrClaim').forEach(btn => {
  if (btn) btn.addEventListener('click', e => { e.preventDefault(); openOverlay(); });
});
overlayClose?.addEventListener('click', closeOverlay);
overlayBack?.addEventListener('click',  closeOverlay);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });

/* ══ 14. FORM SUBMIT ══ */
claimForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const name  = document.getElementById('claimName')?.value.trim();
  const email = document.getElementById('claimEmail')?.value.trim();
  const phone = document.getElementById('claimPhone')?.value.trim();
  if (!name || !email) return;

  const btnText = document.getElementById('btnSubmitText');
  const btn     = document.getElementById('btnSubmit');
  if (btnText) btnText.textContent = 'Getting your access...';
  if (btn) btn.disabled = true;

  localStorage.setItem('nt_name',  name);
  localStorage.setItem('nt_email', email);
  currentSpots = Math.max(currentSpots - 1, 0);
  updateAllSpots(currentSpots);

  /* send to GHL — fire and forget, never block the redirect */
  fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, phone }),
  }).catch(() => {});

  setTimeout(() => { window.location.href = 'course.html'; }, 900);
});

/* ══ 15. MOTION SPRING — spring physics on all interactive elements ══ */
if (window.Motion) {
  const { animate, hover, press, spring } = window.Motion;

  /* ══ HERO SECTION — full staggered entrance ══ */
  const heroLabel = document.querySelector('.hero-label');
  const h1Lines   = document.querySelectorAll('.h1-line');
  const heroSub   = document.querySelector('.hero-sub');
  const hoEl      = document.getElementById('heroOffer');
  const hoZero    = document.getElementById('hoZero');
  const heroStats = document.querySelector('.hero-stats');
  const statItems = document.querySelectorAll('.stat');

  /* set all invisible upfront */
  [heroLabel, heroSub, hoEl].forEach(el => { if (el) el.style.opacity = '0'; });
  h1Lines.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(28px)'; });
  if (heroStats) heroStats.style.opacity = '0';
  statItems.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; });

  /* 1 — label pill slides in */
  if (heroLabel) animate(heroLabel,
    { opacity: [0,1], y: [-12, 0] },
    { duration: 0.5, easing: [0.22,1,0.36,1], delay: 0.1 }
  );

  /* 2 — H1 lines reveal one by one */
  h1Lines.forEach((line, i) => {
    animate(line,
      { opacity: [0, 1], y: [28, 0] },
      { duration: 0.55, easing: [0.22,1,0.36,1], delay: 0.22 + i * 0.09 }
    );
  });

  /* 3 — subtitle fades in */
  if (heroSub) animate(heroSub,
    { opacity: [0, 1], y: [12, 0] },
    { duration: 0.45, easing: 'ease-out', delay: 0.52 }
  );

  /* 4 — price strip springs in */
  if (hoEl) animate(hoEl,
    { opacity: [0, 1], y: [16, 0] },
    { duration: 0.5, easing: [0.22,1,0.36,1], delay: 0.64 }
  );

  /* 5 — $0 springs in with overshoot */
  if (hoZero) animate(hoZero,
    { scale: [0.72, 1.06, 1] },
    { duration: 0.60, easing: [0.22, 1, 0.36, 1], delay: 0.72 }
  );

  /* 6 — stats stagger in */
  if (heroStats) setTimeout(() => { heroStats.style.opacity = '1'; }, 840);
  statItems.forEach((el, i) => {
    animate(el,
      { opacity: [0, 1], y: [10, 0] },
      { duration: 0.38, easing: [0.22,1,0.36,1], delay: 0.88 + i * 0.08 }
    );
  });

  /* 7 — stat number counters */
  const statData = [
    { el: statItems[0]?.querySelector('.stat-n'), from: 0, to: 4, suffix: '+' },
    { el: statItems[2]?.querySelector('.stat-n'), from: 0, to: 10, suffix: '' },
    { el: statItems[3]?.querySelector('.stat-n'), from: 0, to: 2, suffix: 'hrs' },
  ];
  statData.forEach(({ el, from, to, suffix }) => {
    if (!el) return;
    const original = el.textContent;
    setTimeout(() => {
      const start = performance.now();
      const dur = 900;
      (function tick(now) {
        const t = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(from + (to - from) * eased) + suffix;
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = original;
      })(start);
    }, 920);
  });


  /* buttons: scale up on hover, compress on press */
  document.querySelectorAll('.btn-primary').forEach(el => {
    hover(el, () => ({ scale: 1.04, transition: spring({ stiffness: 400, damping: 22 }) }));
    press(el, () => ({ scale: 0.97, transition: spring({ stiffness: 700, damping: 30 }) }));
  });

  /* cards: gentle lift with spring snap */
  document.querySelectorAll('.testi-card, .tf-card').forEach(el => {
    hover(el, () => ({ y: -6, transition: spring({ stiffness: 280, damping: 18 }) }));
  });

  /* module cards: slide right with spring */
  document.querySelectorAll('.mod-card').forEach(el => {
    hover(el, () => ({ x: 8, transition: spring({ stiffness: 350, damping: 22 }) }));
  });

  /* final card: subtle float */
  const finalCard = document.querySelector('.final-card');
  if (finalCard) {
    hover(finalCard, () => ({ y: -4, scale: 1.005, transition: spring({ stiffness: 200, damping: 16 }) }));
  }
}

/* ══ 17. MODULE CANVAS ANIMATIONS ══ */
(function initModCanvases() {

  /* ── shared helpers ── */
  const ha = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`;
  };

  /* radial glow */
  const glow = (ctx, x, y, r, c, a) => {
    const g = ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0, c); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.save(); ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle=g; ctx.globalAlpha=a; ctx.fill(); ctx.restore();
  };

  /* neon bloom — draw same path 4x with decreasing width for luminous glow */
  const neonLine = (ctx, drawFn, c, baseW=1.5) => {
    [{w:baseW+10,a:0.025},{w:baseW+5,a:0.07},{w:baseW+2,a:0.18},{w:baseW,a:1}].forEach(({w,a}) => {
      ctx.save(); ctx.strokeStyle=c; ctx.lineWidth=w; ctx.globalAlpha=a;
      ctx.lineCap='round'; ctx.lineJoin='round'; drawFn(); ctx.stroke(); ctx.restore();
    });
  };

  /* glowing node with orbiting micro-particles */
  const node = (ctx, x, y, r, c, t, a=1) => {
    glow(ctx, x, y, r*7, c, (0.18+0.10*Math.sin(t*4))*a);
    ctx.save(); ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle=c; ctx.globalAlpha=a; ctx.fill(); ctx.restore();
    for(let i=0;i<4;i++) {
      const ang=t*2.2+i*Math.PI/2, px=x+Math.cos(ang)*r*4, py=y+Math.sin(ang)*r*4;
      ctx.save(); ctx.beginPath(); ctx.arc(px,py,0.85,0,Math.PI*2);
      ctx.fillStyle=c; ctx.globalAlpha=a*(0.30+0.22*Math.sin(t*3+i)); ctx.fill(); ctx.restore();
    }
  };

  /* subtle dot grid — matches site particle feel */
  const dotGrid = (ctx, W, H) => {
    ctx.save(); ctx.fillStyle='rgba(255,255,255,0.035)';
    const sp=22;
    for(let x=sp;x<W;x+=sp) for(let y=sp;y<H;y+=sp) {
      ctx.beginPath(); ctx.arc(x,y,0.55,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  };

  /* drifting ambient particles matching the site starfield */
  const ambient = (ctx, W, H, t, c, n=5) => {
    ctx.save();
    for(let i=0;i<n;i++) {
      const s=i*1.618, x=W*(0.08+0.84*((s*0.37+t*0.018)%1));
      const y=H*(0.12+0.76*Math.abs(Math.sin(s*5.3+t*0.28)));
      const a=0.12+0.09*Math.sin(t*1.4+s);
      ctx.beginPath(); ctx.arc(x,y,0.9,0,Math.PI*2);
      ctx.fillStyle=c; ctx.globalAlpha=a; ctx.fill();
    }
    ctx.restore();
  };

  const ANIM = {

    /* 01 — WHY MOST TRADERS STAY STUCK (green)
       Structure → false break above resistance → swept down → stuck red consolidation forever */
    surge(ctx, W, H, t, c) {
      const p = (t * 0.18) % 1;
      dotGrid(ctx, W, H); ambient(ctx, W, H, t, c);

      const WP = [
        [0.03, 0.66],  // 0: start
        [0.16, 0.38],  // 1: HH1
        [0.28, 0.54],  // 2: HL1
        [0.41, 0.32],  // 3: HH2 — approaching resistance
        [0.51, 0.16],  // 4: FALSE BREAK above resistance
        [0.62, 0.74],  // 5: SWEEP — stops wiped
        [0.72, 0.60],  // 6: partial bounce — still red, settling into range
      ].map(([xf, yf]) => ({ x: W*xf, y: H*yf }));
      const PR = [0.00, 0.14, 0.27, 0.40, 0.51, 0.62, 0.72];

      const at = (pp) => {
        const q = Math.max(0, Math.min(1, pp));
        for (let i = 0; i < WP.length-1; i++) {
          if (q >= PR[i] && q <= PR[i+1]) {
            const s = (q-PR[i])/(PR[i+1]-PR[i]);
            return { x: WP[i].x+s*(WP[i+1].x-WP[i].x), y: WP[i].y+s*(WP[i+1].y-WP[i].y) };
          }
        }
        return WP[WP.length-1];
      };

      const seg = (a, b) => {
        const end = Math.min(b, p);
        if (end <= a) return [];
        const pts = [at(a)];
        for (let i = 0; i < WP.length; i++) { if (PR[i] > a && PR[i] < end) pts.push(WP[i]); }
        pts.push(at(end));
        return pts;
      };

      const curve = (pts, col, w) => {
        if (pts.length < 2) return;
        neonLine(ctx, () => {
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            const mx = (pts[i-1].x+pts[i].x)/2;
            ctx.bezierCurveTo(mx, pts[i-1].y, mx, pts[i].y, pts[i].x, pts[i].y);
          }
        }, col, w);
      };

      // ── 1. Structure (green dim) ──
      curve(seg(0, PR[4]), ha(c, 0.78), 1.6);

      // ── 2. False break + sweep (red) ──
      if (p > PR[4]) curve(seg(PR[4], PR[6]), '#f87171', 1.8);

      // ── 3. Red consolidation — stuck, going nowhere ──
      if (p > PR[6]) {
        const cp   = Math.min(1, (p - PR[6]) / (1.0 - PR[6]));
        const x0   = WP[6].x, baseY = WP[6].y;
        const xSpan = W * 0.96 - x0;
        const steps = 90, drawn = Math.floor(steps * cp);
        if (drawn > 0) {
          neonLine(ctx, () => {
            ctx.beginPath(); ctx.moveTo(x0, baseY);
            for (let i = 1; i <= drawn; i++) {
              const pp = i / steps;
              const x  = x0 + pp * xSpan;
              // Small choppy oscillation — feels trapped, going nowhere
              const chop = H*0.062 * Math.sin(pp*14 + 2.0)
                         + H*0.028 * Math.sin(pp*7.8 + 0.5)
                         + H*0.016 * Math.sin(pp*22 + 1.4);
              ctx.lineTo(x, baseY + chop);
            }
          }, '#f87171', 1.5);
        }
      }


      // ── Node at tip ──
      let tip;
      if (p < PR[6]) {
        tip = at(p);
      } else {
        const cp = Math.min(1, (p - PR[6]) / (1.0 - PR[6]));
        const pp = Math.floor(90 * cp) / 90;
        const chop = H*0.062*Math.sin(pp*14+2.0) + H*0.028*Math.sin(pp*7.8+0.5) + H*0.016*Math.sin(pp*22+1.4);
        tip = { x: WP[6].x + pp*(W*0.96-WP[6].x), y: WP[6].y + chop };
      }
      node(ctx, tip.x, tip.y, 3, '#f87171', t);
    },

    /* 02 — MASTERING LIQUIDITY (blue)
       Market structure (HH/HL chain) → SSL level appears → sweep below → neon continuation */
    pool(ctx, W, H, t, c) {
      const p = (t * 0.18) % 1;
      dotGrid(ctx, W, H); ambient(ctx, W, H, t, c);

      // Waypoints [xFrac, yFrac] — lower y = higher price
      const WP = [
        [0.03, 0.58],  // 0 start
        [0.17, 0.22],  // 1 HH1
        [0.29, 0.42],  // 2 HL1
        [0.44, 0.14],  // 3 HH2
        [0.56, 0.36],  // 4 HL2 — key low (SSL)
        [0.67, 0.64],  // 5 SWEEP below SSL
        [0.74, 0.30],  // 6 reclaim above SSL
        [0.97, 0.05],  // 7 blast to new highs
      ].map(([xf, yf]) => ({ x: W*xf, y: H*yf }));
      const PR = [0.00, 0.13, 0.26, 0.40, 0.52, 0.63, 0.72, 1.00];

      // Interpolate along the path at a given progress value
      const at = (pp) => {
        const q = Math.max(0, Math.min(1, pp));
        for (let i = 0; i < WP.length-1; i++) {
          if (q >= PR[i] && q <= PR[i+1]) {
            const s = (q-PR[i])/(PR[i+1]-PR[i]);
            return { x: WP[i].x + s*(WP[i+1].x-WP[i].x), y: WP[i].y + s*(WP[i+1].y-WP[i].y) };
          }
        }
        return WP[WP.length-1];
      };

      // Build array of points between two progress values (capped to p)
      const seg = (a, b) => {
        const end = Math.min(b, p);
        if (end <= a) return [];
        const pts = [at(a)];
        for (let i = 0; i < WP.length; i++) { if (PR[i] > a && PR[i] < end) pts.push(WP[i]); }
        pts.push(at(end));
        return pts;
      };

      // Draw a bezier curve with neon bloom
      const curve = (pts, col, w) => {
        if (pts.length < 2) return;
        neonLine(ctx, () => {
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            const mx = (pts[i-1].x + pts[i].x) / 2;
            ctx.bezierCurveTo(mx, pts[i-1].y, mx, pts[i].y, pts[i].x, pts[i].y);
          }
        }, col, w);
      };

      // ── 1. Market structure (blue, dimmer) ──
      curve(seg(0, PR[4]), ha(c, 0.80), 1.6);

      // ── 2. Sweep (red) ──
      if (p > PR[4]) curve(seg(PR[4], PR[5]), '#f87171', 1.8);

      // ── 3. Continuation (full neon blue) ──
      if (p > PR[5]) curve(seg(PR[5], 1.0), c, 2.2);

      // ── SSL level line (appears when price forms HL1 — the previous low being swept) ──
      if (p > PR[2]) {
        const sslY = WP[2].y;
        const swP = Math.max(0, Math.min(1, (p - PR[4]) / (PR[5] - PR[4])));
        const flash = Math.sin(swP * Math.PI);            // peaks at mid-sweep
        const apIn = Math.max(0, Math.min(1, (p - PR[2]) / 0.06));
        ctx.save();
        ctx.setLineDash([4, 5]); ctx.lineCap = 'round'; ctx.lineWidth = 1; ctx.globalAlpha = apIn;
        ctx.strokeStyle = flash > 0.05 ? `rgba(248,113,113,${0.35 + flash*0.30})` : ha(c, 0.28);
        ctx.beginPath(); ctx.moveTo(WP[2].x - 4, sslY); ctx.lineTo(W*0.94, sslY); ctx.stroke();
        ctx.setLineDash([]);
        if (flash > 0.05) glow(ctx, W*0.67, sslY, 22, '#f87171', flash * 0.22);
        ctx.fillStyle = flash > 0.05 ? `rgba(248,113,113,0.68)` : ha(c, 0.40);
        ctx.font = 'bold 7px monospace'; ctx.textAlign = 'left';
        ctx.fillText('SSL', W*0.95, sslY + 4); ctx.restore();
      }

      // ── Glowing node at current tip ──
      const tip = at(p);
      const tipCol = p > PR[4] && p < PR[5] ? '#f87171' : c;
      node(ctx, tip.x, tip.y, 3, tipCol, t);
    },

    /* 03 — FAIR VALUE GAPS (blue)
       Structure up → big impulse creates FVG → red retrace into zone → neon bounce */
    gap(ctx, W, H, t, c) {
      const p = (t * 0.18) % 1;
      dotGrid(ctx, W, H); ambient(ctx, W, H, t, c);

      const WP = [
        [0.03, 0.76],  // 0 start
        [0.16, 0.44],  // 1 first push up
        [0.27, 0.58],  // 2 pullback — pre-impulse high (FVG bottom)
        [0.42, 0.11],  // 3 BIG impulse — creates the gap
        [0.53, 0.22],  // 4 slight continuation (FVG top)
        [0.64, 0.48],  // 5 retrace deep into FVG
        [0.73, 0.41],  // 6 FVG touch / bounce point
        [0.86, 0.13],  // 7 neon blast up
        [0.97, 0.05],  // 8 continuation to new highs
      ].map(([xf, yf]) => ({ x: W*xf, y: H*yf }));
      const PR = [0.00, 0.14, 0.25, 0.38, 0.48, 0.60, 0.68, 0.84, 1.00];

      const at = (pp) => {
        const q = Math.max(0, Math.min(1, pp));
        for (let i = 0; i < WP.length-1; i++) {
          if (q >= PR[i] && q <= PR[i+1]) {
            const s = (q-PR[i])/(PR[i+1]-PR[i]);
            return { x: WP[i].x + s*(WP[i+1].x-WP[i].x), y: WP[i].y + s*(WP[i+1].y-WP[i].y) };
          }
        }
        return WP[WP.length-1];
      };

      const seg = (a, b) => {
        const end = Math.min(b, p);
        if (end <= a) return [];
        const pts = [at(a)];
        for (let i = 0; i < WP.length; i++) { if (PR[i] > a && PR[i] < end) pts.push(WP[i]); }
        pts.push(at(end));
        return pts;
      };

      const curve = (pts, col, w) => {
        if (pts.length < 2) return;
        neonLine(ctx, () => {
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            const mx = (pts[i-1].x + pts[i].x) / 2;
            ctx.bezierCurveTo(mx, pts[i-1].y, mx, pts[i].y, pts[i].x, pts[i].y);
          }
        }, col, w);
      };

      // ── FVG zone: between WP[2].y (bottom) and WP[4].y (top) ──
      // Appears after the impulse (PR[3])
      const fvgT = WP[4].y, fvgB = WP[2].y;   // screen: top = lower y, bottom = higher y
      const fvgA = Math.max(0, Math.min(1, (p - PR[3]) / 0.06));
      if (fvgA > 0) {
        ctx.save();
        const zg = ctx.createLinearGradient(0, fvgT, 0, fvgB);
        zg.addColorStop(0, ha(c, 0.14 * fvgA));
        zg.addColorStop(1, ha(c, 0.04 * fvgA));
        ctx.globalAlpha = fvgA;
        ctx.fillStyle = zg;
        ctx.fillRect(WP[2].x, fvgT, W*0.97 - WP[2].x, fvgB - fvgT);
        // Boundary dashes
        ctx.strokeStyle = ha(c, 0.52);
        ctx.lineWidth = 0.8; ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(WP[2].x, fvgT); ctx.lineTo(W*0.97, fvgT);
        ctx.moveTo(WP[2].x, fvgB); ctx.lineTo(W*0.97, fvgB);
        ctx.stroke(); ctx.setLineDash([]);
        // Label
        ctx.fillStyle = ha(c, 0.78); ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('FVG', WP[2].x + 4, fvgT - 3);
        ctx.restore();
      }

      // ── 1. Structure + big impulse (dimmed accent) ──
      curve(seg(PR[0], PR[4]), ha(c, 0.80), 1.6);

      // ── 2. Retrace into FVG (red) ──
      if (p > PR[4]) curve(seg(PR[4], PR[6]), '#f87171', 1.8);

      // ── 3. Bounce + continuation (full neon) ──
      if (p > PR[6]) curve(seg(PR[6], 1.0), c, 2.2);

      // ── FVG touch flash (when retrace enters zone) ──
      if (p > PR[5]) {
        const touchA = Math.max(0, Math.min(1, (p - PR[5]) / 0.06));
        glow(ctx, WP[5].x, (fvgT + fvgB) / 2, 18, c, touchA * 0.20);
      }

      // ── Glowing node at current tip ──
      const tip = at(p);
      const tipCol = p > PR[4] && p < PR[6] ? '#f87171' : c;
      node(ctx, tip.x, tip.y, 3, tipCol, t);
    },

    /* 04 — DAILY BIAS & TOP DOWN ANALYSIS (yellow)
       4H | 1H | 15m — mechanical flip transition, simultaneous cross-flip, green celebration */
    bias(ctx, W, H, t, c) {
      const p  = (t * 0.13) % 1;
      dotGrid(ctx, W, H);
      const GREEN = '#4ade80', RED = '#f87171';
      const cl = (v, a, b) => Math.max(0, Math.min(1, (v-a)/(b-a)));

      /* flipVal: -1 = fully DOWN, 0 = mid-flip (flat), +1 = fully UP
         Sequence:
           0.00-0.12  4H↑  1H↓  15m↓
           0.12-0.26  4H↑  1H flips UP   15m↓
           0.26-0.40  4H↑  1H↑  15m↓    (hold)
           0.40-0.54  4H↑  1H flips DOWN + 15m flips UP  (simultaneous cross-flip)
           0.54-0.65  4H↑  1H↓  15m↑    (drama hold)
           0.65-0.78  4H↑  1H flips UP   15m↑   (final)
           0.78-1.00  ALL UP → celebration                 */
      const getFlip = (i) => {
        const intro = cl(p, 0, 0.07); // columns fade in at start
        if (i === 0) return { fv: 1, alpha: intro };
        if (i === 1) {
          let fv;
          if      (p < 0.12) fv = -1;
          else if (p < 0.26) fv = -1 + 2*cl(p, 0.12, 0.14); // ↓→↑
          else if (p < 0.40) fv =  1;
          else if (p < 0.54) fv =  1 - 2*cl(p, 0.40, 0.14); // ↑→↓ (simultaneous)
          else if (p < 0.65) fv = -1;
          else if (p < 0.78) fv = -1 + 2*cl(p, 0.65, 0.13); // ↓→↑ (final)
          else               fv =  1;
          return { fv, alpha: intro };
        }
        // 15m
        let fv;
        if      (p < 0.40) fv = -1;
        else if (p < 0.54) fv = -1 + 2*cl(p, 0.40, 0.14); // ↓→↑ (simultaneous)
        else               fv =  1;
        return { fv, alpha: intro };
      };

      const allAligned = p > 0.78;
      const alignA     = allAligned ? cl(p, 0.78, 0.09) : 0;

      /* Celebration bloom */
      if (alignA > 0) {
        ctx.save();
        [W*0.20, W*0.50, W*0.80].forEach((gx, gi) => {
          ctx.globalAlpha = alignA * 0.20 * (0.85 + 0.15*Math.sin(t*2.2 + gi));
          const rg = ctx.createRadialGradient(gx, H/2, 0, gx, H/2, H*1.1);
          rg.addColorStop(0, GREEN); rg.addColorStop(1, 'transparent');
          ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
        });
        ctx.restore();
      }

      /* Draw columns */
      [
        { lbl:'4H',  x: W*0.20 },
        { lbl:'1H',  x: W*0.50 },
        { lbl:'15m', x: W*0.80 },
      ].forEach((col, i) => {
        const { fv, alpha } = getFlip(i);
        const up    = fv >= 0;
        const col_c = up ? GREEN : RED;
        const isLit = allAligned && up;
        const scaleY = Math.abs(fv);               // 1=full, 0=flat mid-flip
        const ay    = H * 0.50;
        const sz    = isLit ? 11 + 1.6*Math.sin(t*2.6 + i*1.1) : 11;

        /* Panel */
        ctx.save();
        ctx.globalAlpha = alpha * (isLit ? 0.15 + 0.06*Math.sin(t*2.6+i) : 0.05);
        ctx.fillStyle   = col_c;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(col.x - W*0.12, H*0.08, W*0.24, H*0.84, 7);
        else ctx.rect(col.x - W*0.12, H*0.08, W*0.24, H*0.84);
        ctx.fill();
        ctx.restore();

        /* Label */
        ctx.save();
        ctx.globalAlpha = alpha * 0.80;
        ctx.fillStyle   = col_c;
        ctx.font        = 'bold 7px monospace';
        ctx.textAlign   = 'center';
        ctx.fillText(col.lbl, col.x, H*0.22);
        ctx.restore();

        /* Glow — scales with arrow openness */
        const glowR = isLit ? 26 + 5*Math.sin(t*2.6+i) : 14;
        const glowA = (isLit ? (0.30 + 0.12*Math.sin(t*2.2+i)) : 0.15) * alpha * scaleY;
        glow(ctx, col.x, ay, glowR, col_c, glowA);

        /* Arrow — mechanical flip via scaleY transform */
        ctx.save();
        ctx.translate(col.x, ay);
        ctx.scale(1, scaleY);          // compress to flat at mid-flip, expand in new direction
        ctx.globalAlpha = alpha * 0.93;
        ctx.fillStyle   = col_c;
        ctx.beginPath();
        if (up) {
          ctx.moveTo(0,          -sz);
          ctx.lineTo( sz,         sz*0.28);
          ctx.lineTo( sz*0.30,    sz*0.28);
          ctx.lineTo( sz*0.30,    sz);
          ctx.lineTo(-sz*0.30,    sz);
          ctx.lineTo(-sz*0.30,    sz*0.28);
          ctx.lineTo(-sz,         sz*0.28);
        } else {
          ctx.moveTo(0,           sz);
          ctx.lineTo( sz,        -sz*0.28);
          ctx.lineTo( sz*0.30,   -sz*0.28);
          ctx.lineTo( sz*0.30,   -sz);
          ctx.lineTo(-sz*0.30,   -sz);
          ctx.lineTo(-sz*0.30,   -sz*0.28);
          ctx.lineTo(-sz,        -sz*0.28);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();

        /* Bottom dot */
        ctx.save();
        ctx.globalAlpha = 0.58 * alpha * scaleY;
        ctx.fillStyle   = col_c;
        ctx.beginPath();
        ctx.arc(col.x, H*0.84, 2.5, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      });
    },

    /* 05 — THE EXACT ENTRY MODEL (yellow)
       Clean neon line: structure → entry level → pullback → entry fires → blast */
    check(ctx, W, H, t, c) {
      const p = (t * 0.13) % 1;
      dotGrid(ctx, W, H); ambient(ctx, W, H, t, c);
      const cl = (v, a, b) => Math.max(0, Math.min(1, (v-a)/(b-a)));
      const GREEN = '#4ade80';

      const WP = [
        [0.03, 0.76],
        [0.16, 0.34],
        [0.27, 0.54],
        [0.43, 0.14],
        [0.57, 0.40],
        [0.71, 0.19],
        [0.97, 0.04],
      ].map(([xf, yf]) => ({ x: W*xf, y: H*yf }));
      const PR = [0.00, 0.13, 0.24, 0.38, 0.50, 0.64, 1.00];

      const at = (pp) => {
        const q = Math.max(0, Math.min(1, pp));
        for (let i = 0; i < WP.length-1; i++) {
          if (q >= PR[i] && q <= PR[i+1]) {
            const s = (q-PR[i])/(PR[i+1]-PR[i]);
            return { x: WP[i].x + s*(WP[i+1].x-WP[i].x), y: WP[i].y + s*(WP[i+1].y-WP[i].y) };
          }
        }
        return WP[WP.length-1];
      };
      const seg = (a, b) => {
        const end = Math.min(b, p); if (end <= a) return [];
        const pts = [at(a)];
        for (let i = 0; i < WP.length; i++) { if (PR[i] > a && PR[i] < end) pts.push(WP[i]); }
        pts.push(at(end)); return pts;
      };
      const curve = (pts, col, w) => {
        if (pts.length < 2) return;
        neonLine(ctx, () => {
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            const mx = (pts[i-1].x + pts[i].x) / 2;
            ctx.bezierCurveTo(mx, pts[i-1].y, mx, pts[i].y, pts[i].x, pts[i].y);
          }
        }, col, w);
      };

      const entryY = WP[4].y;
      const fired  = p > PR[4];

      // ── 1. Structure ──
      curve(seg(PR[0], PR[4]), ha(c, 0.80), 1.6);

      // ── 2. Entry level line — anchored to last HH (WP[3]) ──
      if (p > 0.30) {
        const levA = cl(p, 0.30, 0.38);
        ctx.save();
        ctx.globalAlpha = levA * (fired ? 0.48 : 0.60);
        neonLine(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(WP[3].x, entryY);
          ctx.lineTo(W * 0.92, entryY);
        }, c, 0.8);
        ctx.fillStyle = ha(c, 0.72); ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'left'; ctx.globalAlpha = levA * (fired ? 0.36 : 0.55);
        ctx.fillText('ENTRY', W * 0.93, entryY + 3);
        ctx.restore();
      }

      // ── 3. Pullback ──
      if (p > PR[3]) curve(seg(PR[3], PR[4]), ha(c, 0.65), 1.4);

      // ── 4. Entry signal — upward triangle, tip on the line ──
      if (fired) {
        const arrA = cl(p, PR[4], PR[4] + 0.08);
        const ax = WP[4].x, ay = entryY;
        const aH = 14, aW = 9;   // height and half-width of triangle
        ctx.save();
        ctx.globalAlpha = arrA;
        // tip touches the entry line from below; base hangs below
        neonLine(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(ax,        ay);        // tip — on the line
          ctx.lineTo(ax - aW,   ay + aH);   // base left
          ctx.lineTo(ax + aW,   ay + aH);   // base right
          ctx.closePath();
        }, GREEN, 2);
        glow(ctx, ax, ay + aH * 0.4, 18, GREEN, arrA * 0.36);
        ctx.restore();
        // glowing dot where tip meets the line
        node(ctx, ax, ay, 3.5, GREEN, t, arrA);
      }

      // ── 5. Neon blast ──
      if (fired) curve(seg(PR[4], 1.0), c, 2.4);

      // ── Tip node — switches to GREEN deep in the blast ──
      const tip = at(p);
      const blastDepth = fired ? cl(p, PR[4] + 0.12, PR[4] + 0.22) : 0;
      const tipCol = blastDepth > 0.5 ? GREEN : (fired ? c : ha(c, 0.80));
      node(ctx, tip.x, tip.y, 3, tipCol, t);
    },

    /* 06 — PROP FIRMS & GETTING FUNDED (purple)
       Challenge → Funded → Payout — centred tight timeline, large readable text */
    count(ctx, W, H, t, c) {
      const p  = (t * 0.09) % 1;   // ~11 s cycle
      dotGrid(ctx, W, H); ambient(ctx, W, H, t, c);
      const cl = (v, a, b) => Math.max(0, Math.min(1, (v-a)/(b-a)));
      const GREEN = '#4ade80';

      // Tighter x positions — avoids the stretched edge-to-edge feel
      const stages = [
        { lbl: 'CHALLENGE', amt: '$100K', x: 0.24 },
        { lbl: 'FUNDED',    amt: '$100K', x: 0.50 },
        { lbl: 'PAYOUT',    amt: '$17K',  x: 0.76 },
      ];

      // Canvas is ~231×82px — nodes are ~61px apart, so text must be compact
      const lineY = H * 0.50;   // dead centre
      const x0    = stages[0].x * W;
      const x2    = stages[2].x * W;

      // ── Grey base track ──
      ctx.save();
      ctx.strokeStyle = ha(c, 0.13);
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(x0, lineY); ctx.lineTo(x2, lineY); ctx.stroke();
      ctx.restore();

      // ── Neon progress line sweeping left → right ──
      const prog = cl(p, 0, 0.72);
      if (prog > 0) {
        const progX = x0 + (x2 - x0) * prog;
        neonLine(ctx, () => {
          ctx.beginPath(); ctx.moveTo(x0, lineY); ctx.lineTo(progX, lineY);
        }, c, 1.8);
        if (prog < 0.98) node(ctx, progX, lineY, 3, c, t, 1);
      }

      // ── Stage nodes + labels + amounts ──
      stages.forEach((stage, i) => {
        const sDelay = i * 0.22;
        const sA     = cl(p, sDelay, sDelay + 0.14);
        if (sA <= 0) return;

        const sx     = stage.x * W;
        const isLast = i === 2;
        const stgC   = isLast ? GREEN : c;
        const isLit  = sA > 0.85;

        // Glow ring
        if (isLit) glow(ctx, sx, lineY, 22, stgC, 0.18 * sA);

        // Circle node — r=5 fits the compact canvas
        ctx.save();
        ctx.globalAlpha = sA;
        ctx.beginPath(); ctx.arc(sx, lineY, 5, 0, Math.PI * 2);
        ctx.fillStyle   = isLit ? stgC : ha(stgC, 0.28);
        ctx.fill();
        ctx.strokeStyle = ha(stgC, 0.70); ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Label above — 7px fits within the 61px column without crowding
        ctx.save();
        ctx.globalAlpha = sA * 0.85;
        ctx.fillStyle   = isLit ? stgC : ha(c, 0.65);
        ctx.font        = 'bold 7px "Inter", "Segoe UI", sans-serif';
        ctx.textAlign   = 'center';
        ctx.fillText(stage.lbl, sx, lineY - 11);
        ctx.restore();

        // Dollar amount below — 13px is the sweet spot: readable but fits
        if (sA > 0.30) {
          const amtA = cl(sA, 0.30, 0.90);
          ctx.save();
          ctx.globalAlpha = amtA;
          ctx.fillStyle   = isLit ? stgC : ha(c, 0.90);
          ctx.font        = 'bold 13px "Inter", "Segoe UI", sans-serif';
          ctx.textAlign   = 'center';
          ctx.fillText(stage.amt, sx, lineY + 19);
          if (isLast && isLit) glow(ctx, sx, lineY + 16, 22, GREEN, amtA * 0.26);
          ctx.restore();
        }
      });

      // ── PAYOUT celebration pulse ──
      if (p > 0.74) {
        const fa    = cl(p, 0.74, 0.88);
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
        glow(ctx, stages[2].x * W, lineY, 34 + 9 * pulse, GREEN, 0.16 * fa * (0.5 + 0.5 * pulse));
      }
    },

    /* 07 — RISK MANAGEMENT
       Left: volatile red line (huge spikes up/down, overall up)
       Right: smooth green line (steady small steps up, tiny pullbacks) */
    rr(ctx, W, H, t, c) {
      const p = (t * 0.14) % 1;
      dotGrid(ctx, W, H); ambient(ctx, W, H, t, c);
      const RED   = '#f87171';
      const GREEN = '#4ade80';

      // Subtle centre divider
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 0.5; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(W*0.50, H*0.04); ctx.lineTo(W*0.50, H*0.96);
      ctx.stroke(); ctx.setLineDash([]); ctx.restore();

      // Shared draw helper — both charts use same logic
      const drawChart = (wps, prs, col) => {
        const at = (pp) => {
          const q = Math.max(0, Math.min(1, pp));
          for (let i = 0; i < wps.length-1; i++) {
            if (q >= prs[i] && q <= prs[i+1]) {
              const s = (q-prs[i])/(prs[i+1]-prs[i]);
              return { x: wps[i].x + s*(wps[i+1].x-wps[i].x), y: wps[i].y + s*(wps[i+1].y-wps[i].y) };
            }
          }
          return wps[wps.length-1];
        };
        const end = Math.min(1, p);
        const pts = [wps[0]];
        for (let i = 1; i < wps.length; i++) { if (prs[i] <= end) pts.push(wps[i]); }
        pts.push(at(end));
        if (pts.length < 2) return;
        neonLine(ctx, () => {
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            const mx = (pts[i-1].x + pts[i].x) / 2;
            ctx.bezierCurveTo(mx, pts[i-1].y, mx, pts[i].y, pts[i].x, pts[i].y);
          }
        }, col, 1.8);
        const tip = at(end);
        node(ctx, tip.x, tip.y, 2.5, col, t);
      };

      // ── LEFT — volatile (red): massive swings, overall upward ──
      drawChart([
        { x: W*0.04, y: H*0.70 },
        { x: W*0.10, y: H*0.28 },   // big spike up
        { x: W*0.16, y: H*0.84 },   // crash
        { x: W*0.22, y: H*0.16 },   // huge spike
        { x: W*0.28, y: H*0.76 },   // crash
        { x: W*0.33, y: H*0.26 },   // spike
        { x: W*0.39, y: H*0.60 },   // dip
        { x: W*0.44, y: H*0.10 },   // final push
        { x: W*0.46, y: H*0.20 },   // tiny pullback
      ], [0.00, 0.10, 0.22, 0.33, 0.44, 0.56, 0.68, 0.84, 1.00], RED);

      // ── RIGHT — smooth (green): steady steps up, small pullbacks ──
      drawChart([
        { x: W*0.54, y: H*0.70 },
        { x: W*0.60, y: H*0.57 },   // gentle up
        { x: W*0.64, y: H*0.63 },   // small dip
        { x: W*0.70, y: H*0.48 },   // up
        { x: W*0.74, y: H*0.54 },   // small dip
        { x: W*0.80, y: H*0.36 },   // up
        { x: W*0.84, y: H*0.42 },   // tiny dip
        { x: W*0.90, y: H*0.24 },   // push
        { x: W*0.95, y: H*0.18 },   // final high
      ], [0.00, 0.12, 0.22, 0.34, 0.44, 0.58, 0.68, 0.84, 1.00], GREEN);
    },

    /* 08 — TRADING PSYCHOLOGY (green)
       PLAN → EXECUTION → RESULTS — dots glow as the line connects them */
    wave(ctx, W, H, t, c) {
      const p  = (t * 0.10) % 1;
      dotGrid(ctx, W, H); ambient(ctx, W, H, t, c);
      const cl = (v, a, b) => Math.max(0, Math.min(1, (v-a)/(b-a)));

      const steps = [
        { lbl: 'PLAN',      x: 0.22 },
        { lbl: 'EXECUTION', x: 0.50 },
        { lbl: 'RESULTS',   x: 0.78 },
      ];

      const lineY = H * 0.42;
      const x0    = steps[0].x * W;
      const x2    = steps[2].x * W;

      // p-values when the sweep line reaches each node
      const reachAt = [0.00, 0.36, 0.72];

      // ── Grey base track ──
      ctx.save();
      ctx.strokeStyle = ha(c, 0.13); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x0, lineY); ctx.lineTo(x2, lineY); ctx.stroke();
      ctx.restore();

      // ── Neon sweep line ──
      const prog = cl(p, 0, 0.72);
      if (prog > 0) {
        const progX = x0 + (x2 - x0) * prog;
        neonLine(ctx, () => {
          ctx.beginPath(); ctx.moveTo(x0, lineY); ctx.lineTo(progX, lineY);
        }, c, 2.0);
        if (prog < 0.98) node(ctx, progX, lineY, 3, c, t, 1);
      }

      // ── Nodes + labels — glow fires when sweep arrives ──
      steps.forEach((step, i) => {
        const sx      = step.x * W;
        const rp      = reachAt[i];
        const fadeA   = cl(p, Math.max(0, rp - 0.02), rp + 0.10); // node fades in just before line arrives
        if (fadeA <= 0) return;

        // Flash pulse when line connects
        const flashP  = cl(p, rp, rp + 0.08);
        const flash   = Math.sin(flashP * Math.PI);             // 0→1→0 burst
        const settled = cl(p, rp + 0.06, rp + 0.16);           // steady glow after flash

        const glowAmt = flash * 0.55 + settled * 0.22;
        const glowR   = 18 + flash * 14 + (i === 2 ? 6 : 0);
        glow(ctx, sx, lineY, glowR, c, glowAmt);

        // Node circle — fills solid on connect
        ctx.save(); ctx.globalAlpha = fadeA;
        ctx.beginPath(); ctx.arc(sx, lineY, 7, 0, Math.PI * 2);
        ctx.fillStyle   = settled > 0.5 ? c : ha(c, 0.20 + flash * 0.60);
        ctx.fill();
        ctx.strokeStyle = ha(c, 0.55 + flash * 0.45); ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();

        // Label below
        const lblA = cl(p, rp + 0.04, rp + 0.18);
        if (lblA > 0) {
          ctx.save();
          ctx.globalAlpha = lblA * (0.60 + settled * 0.35);
          ctx.fillStyle   = c;
          ctx.font        = 'bold 9px "Inter", "Segoe UI", sans-serif';
          ctx.textAlign   = 'center';
          ctx.fillText(step.lbl, sx, lineY + 20);
          ctx.restore();
        }
      });

      // ── RESULTS celebration pulse ──
      if (p > 0.74) {
        const fa    = cl(p, 0.74, 0.90);
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.8);
        glow(ctx, steps[2].x * W, lineY, 38 + 12 * pulse, c, 0.22 * fa * (0.5 + 0.5 * pulse));
      }
    },

    /* 09 — LIVE TRADE WALKTHROUGHS (yellow)
       Structure → sweep to downside → pump to the upside */
    candles(ctx, W, H, t, c) {
      const p = (t * 0.16) % 1;
      dotGrid(ctx, W, H); ambient(ctx, W, H, t, c);

      const WP = [
        [0.03, 0.42],  // 0 start
        [0.14, 0.34],  // 1 slight drift up
        [0.26, 0.38],  // 2 small pullback
        [0.38, 0.28],  // 3 build up
        [0.48, 0.92],  // 4 SWEEP — sharp spike to downside
        [0.58, 0.52],  // 5 immediate bounce
        [0.70, 0.28],  // 6 continuation up
        [0.84, 0.12],  // 7 strong pump
        [0.97, 0.05],  // 8 blast to new highs
      ].map(([xf, yf]) => ({ x: W*xf, y: H*yf }));
      const PR = [0.00, 0.12, 0.24, 0.36, 0.48, 0.58, 0.70, 0.84, 1.00];

      const at = (pp) => {
        const q = Math.max(0, Math.min(1, pp));
        for (let i = 0; i < WP.length-1; i++) {
          if (q >= PR[i] && q <= PR[i+1]) {
            const s = (q-PR[i])/(PR[i+1]-PR[i]);
            return { x: WP[i].x+s*(WP[i+1].x-WP[i].x), y: WP[i].y+s*(WP[i+1].y-WP[i].y) };
          }
        }
        return WP[WP.length-1];
      };
      const seg = (a, b) => {
        const end = Math.min(b, p); if (end <= a) return [];
        const pts = [at(a)];
        for (let i = 0; i < WP.length; i++) { if (PR[i] > a && PR[i] < end) pts.push(WP[i]); }
        pts.push(at(end)); return pts;
      };
      const curve = (pts, col, w) => {
        if (pts.length < 2) return;
        neonLine(ctx, () => {
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            const mx = (pts[i-1].x+pts[i].x)/2;
            ctx.bezierCurveTo(mx, pts[i-1].y, mx, pts[i].y, pts[i].x, pts[i].y);
          }
        }, col, w);
      };

      // 1. Structure (dimmed yellow)
      curve(seg(PR[0], PR[4]), ha(c, 0.78), 1.6);

      // 2. Sweep down (red)
      if (p > PR[4]) curve(seg(PR[4], PR[5]), '#f87171', 2.0);

      // 3. Pump to the upside (full neon yellow)
      if (p > PR[5]) curve(seg(PR[5], 1.0), c, 2.2);

      // Tip node
      const tip = at(p);
      const inSweep = p > PR[4] && p <= PR[5];
      node(ctx, tip.x, tip.y, 3, inSweep ? '#f87171' : c, t);
    },

    /* 10 — YOUR FIRST 90 DAYS (purple)
       S-curve builds with neon bloom + gradient fill, milestones light up with sparks */
    path(ctx, W, H, t, c) {
      const p=(t*0.28)%1;
      dotGrid(ctx,W,H); ambient(ctx,W,H,t,c);
      const ms=[{x:W*0.10,lbl:'Day 1'},{x:W*0.50,lbl:'Day 30'},{x:W*0.90,lbl:'Day 90'}];
      const sY=H*0.82,eY=H*0.12,totalX=W*0.80;
      const yCurve=pp=>sY+(eY-sY)*Math.pow(pp,0.70);
      const tipX=W*0.10+p*totalX,tipY=yCurve(p);
      if(p>0){
        // Neon curve
        const cFn=()=>{
          ctx.beginPath();
          for(let i=0;i<=60;i++){const pp=i/60*p,x=W*0.10+pp*totalX,y=yCurve(pp);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
        };
        neonLine(ctx,cFn,c,2.2);
        // Gradient fill under curve
        ctx.save();
        ctx.beginPath();
        for(let i=0;i<=60;i++){const pp=i/60*p,x=W*0.10+pp*totalX,y=yCurve(pp);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
        ctx.lineTo(tipX,H*0.88); ctx.lineTo(W*0.10,H*0.88); ctx.closePath();
        const fillG=ctx.createLinearGradient(0,eY,0,sY);
        fillG.addColorStop(0,ha(c,0.14)); fillG.addColorStop(1,ha(c,0.02));
        ctx.fillStyle=fillG; ctx.globalAlpha=1; ctx.fill(); ctx.restore();
        node(ctx,tipX,tipY,3.5,c,t);
      }
      // Milestones
      ms.forEach((m,i)=>{
        const mY=yCurve(Math.max(0,(m.x-W*0.10)/totalX));
        const reached=m.x<=tipX+4,al=reached?1:0.18;
        ctx.save(); ctx.globalAlpha=al;
        if(reached) glow(ctx,m.x,mY,13,c,0.18+0.08*Math.sin(t*2+i));
        ctx.beginPath(); ctx.arc(m.x,mY,reached?4.5:2.5,0,Math.PI*2);
        ctx.fillStyle=reached?c:'transparent'; ctx.strokeStyle=ha(c,al); ctx.lineWidth=1.5; ctx.fill(); ctx.stroke();
        ctx.fillStyle=ha(c,al*0.65); ctx.font='7px monospace'; ctx.textAlign='center';
        ctx.fillText(m.lbl,m.x,mY+(mY>H*0.50?14:-8)); ctx.restore();
      });
    },
  };

  /* ── single RAF loop drives all 10 canvases ── */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const entries=[], DPR=Math.min(window.devicePixelRatio||1,2);
    document.querySelectorAll('.mod-canvas').forEach(cv => {
      const fn=ANIM[cv.dataset.anim], color=cv.dataset.color||'#60a5fa';
      if (!fn) return;
      const W=cv.offsetWidth||240, H=cv.offsetHeight||85;
      cv.width=W*DPR; cv.height=H*DPR;
      const ctx=cv.getContext('2d'); ctx.scale(DPR,DPR);
      entries.push({ctx,fn,color,W,H,t:Math.random()*8}); // staggered starts
    });
    if (!entries.length) return;
    (function loop() {
      entries.forEach(e=>{
        e.ctx.clearRect(0,0,e.W,e.H);
        e.ctx.save(); e.fn(e.ctx,e.W,e.H,e.t,e.color); e.ctx.restore();
        e.t+=1/60;
      });
      requestAnimationFrame(loop);
    })();
  }));
})();

/* ══ 16. SMOOTH ANCHOR SCROLL ══ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); if (lenis) lenis.scrollTo(target, { offset: -80, duration: 1.4 }); else target.scrollIntoView({ behavior: 'smooth' }); }
  });
});

/* ══ 17. STORY CARD MOUSE TILT ══ */
(function() {
  const TILT  = 10;   // max degrees of rotation
  const LIFT  = 16;   // px translateZ on hover
  const GLARE = 0.18; // max glare opacity

  document.querySelectorAll('.sc-col, .guarantee-banner').forEach(card => {
    // inject glare layer
    const glare = document.createElement('div');
    glare.className = 'sc-glare';
    card.appendChild(glare);

    let raf = null;
    let inside = false;

    function applyTilt(e) {
      const r   = card.getBoundingClientRect();
      const cx  = r.left + r.width  / 2;
      const cy  = r.top  + r.height / 2;
      const dx  = (e.clientX - cx) / (r.width  / 2); // -1 → 1
      const dy  = (e.clientY - cy) / (r.height / 2); // -1 → 1
      const rotY =  dx * TILT;
      const rotX = -dy * TILT;

      card.style.transform =
        `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(${LIFT}px)`;

      // glare follows mouse highlight
      const glareX = (dx + 1) / 2 * 100;
      const glareY = (dy + 1) / 2 * 100;
      glare.style.opacity = GLARE.toString();
      glare.style.background =
        `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.18) 0%, transparent 65%)`;
    }

    card.addEventListener('mouseenter', () => {
      inside = true;
      card.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';
      glare.style.transition = 'opacity 0.15s ease';
    });

    card.addEventListener('mousemove', e => {
      if (!inside) return;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => applyTilt(e));
    });

    card.addEventListener('mouseleave', () => {
      inside = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      card.style.transition = 'transform 0.55s cubic-bezier(0.23,1,0.32,1), box-shadow 0.55s ease';
      glare.style.transition = 'opacity 0.55s ease';
      card.style.transform   = 'perspective(700px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
      glare.style.opacity    = '0';
    });
  });
})();

/* ══ MOBILE · TESTIMONIALS AUTO-SCROLL CAROUSEL ══ */
if (IS_MOBILE) {
  const scroller = document.querySelector('.sec-testimonials .scroll-window');
  if (scroller) {
    const CARD_COUNT = scroller.querySelectorAll('.testi-card').length;
    let paused = false;
    let resumeTimer = null;

    /* — dots — */
    const dotsEl = document.createElement('div');
    dotsEl.className = 'testi-dots';
    const dots = Array.from({ length: CARD_COUNT }, (_, i) => {
      const d = document.createElement('div');
      d.className = 'testi-dot' + (i === 0 ? ' active' : '');
      dotsEl.appendChild(d);
      return d;
    });
    scroller.insertAdjacentElement('afterend', dotsEl);

    function updateDots() {
      const max = scroller.scrollWidth - scroller.clientWidth;
      if (max <= 0) return;
      const active = Math.round((scroller.scrollLeft / max) * (CARD_COUNT - 1));
      dots.forEach((d, i) => d.classList.toggle('active', i === active));
    }
    scroller.addEventListener('scroll', updateDots, { passive: true });

    /* — auto-scroll — */
    function tickCarousel() {
      if (!paused) {
        scroller.scrollLeft += 1.2;
        if (scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 1) {
          scroller.scrollLeft = 0;
        }
      }
      requestAnimationFrame(tickCarousel);
    }

    scroller.addEventListener('touchstart', () => {
      paused = true;
      if (resumeTimer) clearTimeout(resumeTimer);
    }, { passive: true });

    scroller.addEventListener('touchend', () => {
      resumeTimer = setTimeout(() => { paused = false; }, 2000);
    }, { passive: true });

    requestAnimationFrame(tickCarousel);
  }
}

/* ══ MOBILE · CURRICULUM SWIPE CAROUSEL ══ */
if (IS_MOBILE) {
  const currScroller = document.querySelector('.curr-stage');
  if (currScroller) {
    const cards = [...currScroller.querySelectorAll('.mod-card')];
    const CARD_COUNT = cards.length;
    let paused = false;
    let resumeTimer = null;

    /* — build dots — */
    const dotsWrap = document.querySelector('.curr-dots');
    let dots = [];
    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      dots = Array.from({ length: CARD_COUNT }, (_, i) => {
        const d = document.createElement('div');
        d.className = 'curr-dot' + (i === 0 ? ' active' : '');
        dotsWrap.appendChild(d);
        return d;
      });
    }

    function updateCurrDots() {
      const max = currScroller.scrollWidth - currScroller.clientWidth;
      if (max <= 0 || dots.length === 0) return;
      const active = Math.round((currScroller.scrollLeft / max) * (CARD_COUNT - 1));
      dots.forEach((d, i) => d.classList.toggle('active', i === active));
    }
    currScroller.addEventListener('scroll', updateCurrDots, { passive: true });

    /* — auto-scroll — */
    function tickCurr() {
      if (!paused) {
        currScroller.scrollLeft += 0.8;
        if (currScroller.scrollLeft >= currScroller.scrollWidth - currScroller.clientWidth - 1) {
          currScroller.scrollLeft = 0;
        }
      }
      requestAnimationFrame(tickCurr);
    }

    currScroller.addEventListener('touchstart', () => {
      paused = true;
      if (resumeTimer) clearTimeout(resumeTimer);
    }, { passive: true });

    currScroller.addEventListener('touchend', () => {
      resumeTimer = setTimeout(() => { paused = false; }, 2500);
    }, { passive: true });

    requestAnimationFrame(tickCurr);
  }
}
