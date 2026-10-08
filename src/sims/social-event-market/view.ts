import { simulate, defaults, type Params, type Run, type SocialMode } from './engine';

/**
 * Mounts the social event market simulation into a prepared DOM subtree.
 * See SocialEventMarket.astro for the markup it expects.
 */
export function mount(root: HTMLElement) {
  const q = <T extends Element>(sel: string) => {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`sim: missing ${sel}`);
    return el;
  };
  const net = q<HTMLCanvasElement>('canvas.net');
  const chart = q<HTMLCanvasElement>('canvas.chart');
  const feed = q<HTMLOListElement>('.feed');
  const scrub = q<HTMLInputElement>('input.scrub');
  const playBtn = q<HTMLButtonElement>('button.play');
  const reseedBtn = q<HTMLButtonElement>('button.reseed');
  const stat = (name: string) => q<HTMLElement>(`[data-stat="${name}"]`);
  const sliders = {
    informedShare: q<HTMLInputElement>('input[name="informedShare"]'),
    bias: q<HTMLInputElement>('input[name="bias"]'),
    trust: q<HTMLInputElement>('input[name="trust"]'),
  };
  const socialBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-social]'));

  const params: Params = { ...defaults };
  let run: Run = simulate(params);
  let baseline: Run = simulate({ ...params, social: 'off' });
  let postCount: number[] = [];
  let t = 0;
  let playing = false;
  let raf = 0;
  let last = 0;
  const ticksPerSecond = 24;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function recompute(keepTick = true) {
    run = simulate(params);
    baseline = params.social === 'off' ? run : simulate({ ...params, social: 'off' });
    postCount = [];
    let c = 0;
    for (const tick of run.ticks) { c += tick.posts.length; postCount.push(c); }
    scrub.max = String(run.ticks.length - 1);
    t = keepTick ? Math.min(t, run.ticks.length - 1) : 0;
    draw();
  }

  // ---------- colors (read from CSS so the sim follows the page theme)
  function colors() {
    const cs = getComputedStyle(root);
    const v = (n: string) => cs.getPropertyValue(n).trim();
    return { yes: v('--yes'), no: v('--no'), ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), rule: v('--rule'), accent: v('--accent'), paper: v('--paper') };
  }
  function hexToRgb(h: string): [number, number, number] {
    const m = h.replace('#', '');
    const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a: [number, number, number], b: [number, number, number], k: number) {
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * k)).join(',')})`;
  }
  /** Belief 0..1 to a color: NO blue through neutral to YES orange. */
  function beliefColor(b: number, c: ReturnType<typeof colors>) {
    const neutral: [number, number, number] = hexToRgb(c.ink3);
    if (b < 0.5) return mix(hexToRgb(c.no), neutral, b / 0.5);
    return mix(neutral, hexToRgb(c.yes), (b - 0.5) / 0.5);
  }

  // ---------- canvas sizing
  function fit(canvas: HTMLCanvasElement, aspect: number) {
    const w = canvas.clientWidth || canvas.parentElement!.clientWidth;
    const h = Math.round(w * aspect);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.height = `${h}px`;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  // ---------- network panel
  function drawNet() {
    const narrow = root.clientWidth < 640;
    const { ctx, w, h } = fit(net, narrow ? 0.85 : 0.78);
    const c = colors();
    const tick = run.ticks[t];
    const n = run.params.agents;
    const r = Math.min(w, h) / 2 - 10;
    const cx = w / 2, cy = h / 2;
    const px = (i: number) => cx + (run.layout[i * 2] - 0.5) * 2 * r;
    const py = (i: number) => cy + (run.layout[i * 2 + 1] - 0.5) * 2 * r;

    ctx.clearRect(0, 0, w, h);

    if (run.params.social !== 'off') {
      ctx.strokeStyle = c.rule;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let i = 0; i < n; i++) for (const j of run.follows[i]) { ctx.moveTo(px(i), py(i)); ctx.lineTo(px(j), py(j)); }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Posts this tick travel from poster to followers
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      for (const post of tick.posts) {
        for (let i = 0; i < n; i++) {
          if (run.follows[i].includes(post.from)) { ctx.moveTo(px(post.from), py(post.from)); ctx.lineTo(px(i), py(i)); }
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const maxPos = 30;
    const base = narrow ? 3 : 3.6;
    for (let i = 0; i < n; i++) {
      const size = base + (Math.abs(tick.shares[i]) / maxPos) * (narrow ? 5 : 6.5);
      ctx.beginPath();
      ctx.arc(px(i), py(i), size, 0, Math.PI * 2);
      ctx.fillStyle = beliefColor(tick.beliefs[i], c);
      ctx.fill();
      if (run.informed[i]) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = c.ink;
        ctx.stroke();
      }
    }
    for (const post of tick.posts) {
      ctx.beginPath();
      ctx.arc(px(post.from), py(post.from), base + 9, 0, Math.PI * 2);
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // ---------- price chart
  function drawChart() {
    const narrow = root.clientWidth < 640;
    const { ctx, w, h } = fit(chart, narrow ? 0.55 : 0.62);
    const c = colors();
    const padL = 30, padR = 58, padT = 10, padB = 22;
    const iw = w - padL - padR, ih = h - padT - padB;
    const N = run.ticks.length;
    const X = (i: number) => padL + (i / (N - 1)) * iw;
    const Y = (p: number) => padT + (1 - p) * ih;
    ctx.clearRect(0, 0, w, h);

    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = c.ink3;
    ctx.strokeStyle = c.rule;
    ctx.lineWidth = 1;
    for (const g of [0, 0.25, 0.5, 0.75, 1]) {
      ctx.beginPath(); ctx.moveTo(padL, Y(g)); ctx.lineTo(w - padR, Y(g)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(g * 100)}%`, padL - 6, Y(g));
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('time', padL + iw / 2, h - padB + 8);

    const line = (series: (i: number) => number, upTo: number, style: string, dash: number[], width: number) => {
      ctx.beginPath();
      ctx.setLineDash(dash);
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      for (let i = 0; i <= upTo; i++) { const x = X(i), y = Y(series(i)); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const label = (text: string, p: number, style: string) => {
      ctx.fillStyle = style; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, w - padR + 6, Y(p));
    };

    // Truth
    line(() => run.truth, N - 1, c.ink2, [4, 4], 1);
    label(`truth ${Math.round(run.truth * 100)}%`, run.truth, c.ink2);

    // Market alone, for comparison
    if (run.params.social !== 'off') {
      line((i) => baseline.ticks[i].price, t, c.ink3, [1, 3], 1.25);
      const bp = baseline.ticks[t].price;
      if (Math.abs(bp - run.truth) > 0.04) label('market alone', bp, c.ink3);
    }

    // Price
    line((i) => run.ticks[i].price, t, c.accent, [], 2);
    const p = run.ticks[t].price;
    ctx.beginPath(); ctx.arc(X(t), Y(p), 3.5, 0, Math.PI * 2); ctx.fillStyle = c.accent; ctx.fill();
    if (Math.abs(p - run.truth) > 0.04) label(`price ${Math.round(p * 100)}%`, p, c.accent);

    // Cursor
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(t), padT); ctx.lineTo(X(t), padT + ih); ctx.stroke();
  }

  // ---------- feed and stats
  function drawFeed() {
    const items: string[] = [];
    for (let i = t; i >= 0 && items.length < 6; i--) {
      for (const post of [...run.ticks[i].posts].reverse()) {
        if (items.length >= 6) break;
        const who = run.informed[post.from] ? 'has data' : 'follows the crowd';
        const pos = Math.abs(post.shares) < 1 ? 'no position' : `holds ${Math.round(Math.abs(post.shares))} ${post.shares > 0 ? 'YES' : 'NO'}`;
        const age = t - i;
        items.push(`<li><span class="who">Agent ${post.from}</span> <span class="meta">${who} · ${pos}${age ? ` · ${age} ago` : ''}</span><span class="says">says ${Math.round(post.belief * 100)}%</span></li>`);
      }
    }
    feed.innerHTML = items.length ? items.join('') : `<li class="empty">${run.params.social === 'off' ? 'No social layer. Agents only trade.' : 'No posts yet.'}</li>`;
  }

  function drawStats() {
    const p = run.ticks[t].price;
    stat('price').textContent = `${Math.round(p * 100)}%`;
    stat('truth').textContent = `${Math.round(run.truth * 100)}%`;
    const err = Math.abs(p - run.truth);
    stat('error').textContent = `${(err * 100).toFixed(1)} pts`;
    const bErr = Math.abs(baseline.ticks[t].price - run.truth);
    const vs = stat('vs');
    if (run.params.social === 'off') vs.textContent = '';
    else {
      const d = (bErr - err) * 100;
      vs.textContent = d > 0.5 ? `${d.toFixed(1)} pts closer than the market alone` : d < -0.5 ? `${(-d).toFixed(1)} pts further than the market alone` : 'about the same as the market alone';
    }
    stat('posts').textContent = String(postCount[t] ?? 0);
    stat('tick').textContent = `${t + 1} / ${run.ticks.length}`;
    scrub.value = String(t);
  }

  function draw() {
    drawNet();
    drawChart();
    drawFeed();
    drawStats();
  }

  // ---------- playback
  function setPlaying(on: boolean) {
    playing = on;
    playBtn.textContent = on ? 'Pause' : t >= run.ticks.length - 1 ? 'Replay' : 'Play';
    playBtn.setAttribute('aria-pressed', String(on));
    if (on) {
      if (t >= run.ticks.length - 1) t = 0;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(step);
    } else cancelAnimationFrame(raf);
  }
  function step(now: number) {
    if (!playing) return;
    const dt = (now - last) / 1000;
    const advance = Math.floor(dt * ticksPerSecond);
    if (advance > 0) {
      last = now;
      t = Math.min(run.ticks.length - 1, t + advance);
      draw();
      if (t >= run.ticks.length - 1) { setPlaying(false); return; }
    }
    raf = requestAnimationFrame(step);
  }

  // ---------- controls
  playBtn.addEventListener('click', () => setPlaying(!playing));
  scrub.addEventListener('input', () => { setPlaying(false); t = Number(scrub.value); draw(); });
  reseedBtn.addEventListener('click', () => { params.seed = (params.seed * 1664525 + 1013904223) >>> 0; recompute(false); setPlaying(true); });

  const fmt = { informedShare: (v: number) => `${Math.round(v * 100)}%`, bias: (v: number) => `${Math.round(v * 100)} pts`, trust: (v: number) => `${Math.round(v * 100)}%` };
  for (const [name, input] of Object.entries(sliders) as [keyof typeof sliders, HTMLInputElement][]) {
    const out = root.querySelector<HTMLElement>(`[data-out="${name}"]`);
    const apply = () => {
      const v = Number(input.value);
      params[name] = v;
      if (out) out.textContent = fmt[name](v);
    };
    input.value = String(params[name]);
    apply();
    input.addEventListener('input', () => { apply(); recompute(); });
  }
  const setSocial = (mode: SocialMode) => {
    params.social = mode;
    socialBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.social === mode)));
    recompute();
  };
  socialBtns.forEach((b) => b.addEventListener('click', () => setSocial(b.dataset.social as SocialMode)));
  socialBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.social === params.social)));

  // ---------- lifecycle
  recompute(false);
  new ResizeObserver(() => draw()).observe(root);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
  if (!reduceMotion) {
    new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !playing && t < run.ticks.length - 1) setPlaying(true);
        else if (!e.isIntersecting && playing) setPlaying(false);
      }
    }, { threshold: 0.4 }).observe(root);
  }
  root.dataset.ready = 'true';
}
