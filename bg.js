/* ═══════════════════════════════════════════════════════
   NICO TRADES — Fixed Background Canvas
   Constellation particle network — stays fixed behind the
   whole page. Speeds up on scroll to transition sections.
═══════════════════════════════════════════════════════ */
(function initHeroBg() {
  const canvas = document.getElementById('heroBgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ── Particle factory ── */
  const N = 130;
  function makeParticle() {
    return {
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r:  0.7 + Math.random() * 1.6,
      baseAlpha: 0.25 + Math.random() * 0.65,
      phase: Math.random() * Math.PI * 2,
      speed: 0.006 + Math.random() * 0.010,
    };
  }

  const pts = Array.from({ length: N }, makeParticle);
  const MAX_DIST = 155;

  /* ── Scroll speed boost — controlled externally via window._particleBoost ── */
  let _scrollBoost = 1.0;
  window._particleBoost = 1.0;

  /* ── Color palette — electric blue / cyan / indigo ── */
  const COLORS = [
    [96,  165, 250],  /* blue-400  */
    [147, 197, 253],  /* blue-300  */
    [129, 140, 248],  /* indigo-400*/
    [167, 199, 255],  /* pale blue */
  ];

  function rgba([r, g, b], a) {
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  }

  function tick() {
    /* lerp boost toward global target — smooth ease in and out */
    _scrollBoost += (window._particleBoost - _scrollBoost) * 0.07;

    ctx.clearRect(0, 0, W, H);

    /* ── Connection lines ── */
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d > MAX_DIST) continue;

        const t = 1 - d / MAX_DIST;
        const a = t * t * 0.18;

        const grad = ctx.createLinearGradient(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
        grad.addColorStop(0, rgba(COLORS[i % COLORS.length], a));
        grad.addColorStop(1, rgba(COLORS[j % COLORS.length], a));

        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }

    /* ── Dots ── */
    for (const p of pts) {
      p.phase += p.speed;
      p.x += p.vx * _scrollBoost;
      p.y += p.vy * _scrollBoost;

      /* wrap */
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;

      const pulse = 0.55 + 0.45 * Math.sin(p.phase);
      const a     = p.baseAlpha * pulse;
      const col   = COLORS[Math.floor(p.baseAlpha * COLORS.length) % COLORS.length];

      /* outer glow halo */
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
      halo.addColorStop(0, rgba(col, a * 0.55));
      halo.addColorStop(1, rgba(col, 0));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();

      /* bright core */
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = rgba([220, 235, 255], a * 0.9);
      ctx.fill();
    }

    requestAnimationFrame(tick);
  }

  setTimeout(tick, 80);
})();
