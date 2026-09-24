// Hero: a procedural die that zooms through the three representations the real
// viewer uses - far density blocks, one outline per cell, full cell internals.
// Canvas 2D and illustrative only; nothing here is the real renderer.

const COL = {
  bg: '#0b0d0c',
  cell: '#5785bd',
  cellEdge: '#1c2a3d',
  filler: '#2e2d33',
  macro: '#66607f',
  macroEdge: '#8d86ab',
  power: '#d15742',
  poly: '#b04a4a',
  metal1: '#3d70b8',
  contact: '#d9d9d9',
  pin: '#cfcf61',
  nwell: '#1d2a22',
};

// World: rows of height 1, cells on segments of SEG units.
const W = 1200, H = 900, SEG = 8;
const MACROS = [
  [120, 110, 180, 140], [860, 90, 220, 170], [520, 600, 150, 190],
  [90, 640, 130, 120], [960, 620, 140, 160],
];
const STRAP = 60; // power strap pitch

function hash(a, b) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
}
function rng(seed) {
  let s = seed || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

function density(x, y) {
  const u = x / W, v = y / H;
  let d = 0.55
    + 0.25 * Math.sin(u * 7.1 + v * 2.3) * Math.cos(v * 5.7 - u * 1.3)
    + 0.18 * Math.exp(-((u - 0.62) ** 2 + (v - 0.35) ** 2) / 0.02)
    - 0.22 * Math.exp(-((u - 0.3) ** 2 + (v - 0.55) ** 2) / 0.015);
  return Math.max(0.05, Math.min(1, d));
}

function inMacro(x0, y0, x1, y1) {
  for (const [mx, my, mw, mh] of MACROS) {
    if (x1 > mx && x0 < mx + mw && y1 > my && y0 < my + mh) return true;
  }
  return false;
}

// Cells of one segment in one row, deterministic.
const segCache = new Map();
function segment(r, s) {
  const key = r * 4096 + s;
  let cells = segCache.get(key);
  if (cells) return cells;
  cells = [];
  const x0 = s * SEG;
  if (!inMacro(x0, r, x0 + SEG, r + 1)) {
    const rand = rng(hash(r, s));
    const d = density(x0 + SEG / 2, r);
    const widths = [1, 1.5, 2, 2, 2.5, 3, 4];
    let x = 0;
    while (x < SEG) {
      let w = widths[(rand() * widths.length) | 0];
      if (x + w > SEG) w = SEG - x;
      const filler = rand() > d;
      cells.push({ x: x0 + x, w, filler, seed: hash(key, (x * 2) | 0) });
      x += w;
    }
  }
  if (segCache.size > 60000) segCache.clear();
  segCache.set(key, cells);
  return cells;
}

// Far level, pre-rendered once: one pixel per SEG x SEG block.
function buildFar() {
  const gw = W / SEG, gh = Math.ceil(H / SEG);
  const c = document.createElement('canvas');
  c.width = gw; c.height = gh;
  const g = c.getContext('2d');
  const img = g.createImageData(gw, gh);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const d = density(i * SEG + SEG / 2, j * SEG + SEG / 2);
      // hue ramp: sparse = deep teal, dense = the cell blue brightening to pale
      const t = d;
      const r = 18 + t * 80, gg = 40 + t * 110, b = 60 + t * 150;
      const o = (j * gw + i) * 4;
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function startHero() {
  const canvas = document.getElementById('chip');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  const far = buildFar();
  const hudLevel = document.getElementById('hud-level');
  const hudRep = document.getElementById('hud-rep');
  const hudRects = document.getElementById('hud-rects');
  const hudScale = document.getElementById('hud-scale');

  let cw = 0, ch = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = canvas.clientWidth; ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  // Camera tour: fit -> dive into a point -> fit -> another point.
  const fit = () => Math.max(cw / W, ch / H) * 1.02;
  const TOUR = [
    { x: 740, y: 330 }, { x: 430, y: 470 }, { x: 250, y: 200 }, { x: 690, y: 760 },
  ];
  const DEEP = 70; // px per row at the bottom of a dive
  const T_ZOOM = 7.5, T_HOLD = 2.2;
  const cycle = 2 * (T_ZOOM + T_HOLD);

  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function camera(time) {
    const k = Math.floor(time / cycle);
    const t = time - k * cycle;
    const target = TOUR[k % TOUR.length];
    const s0 = fit(), s1 = DEEP;
    const c0 = { x: W / 2, y: H / 2 };
    let f; // 0 = fit, 1 = deep
    if (t < T_HOLD) f = 0;
    else if (t < T_HOLD + T_ZOOM) f = ease((t - T_HOLD) / T_ZOOM);
    else if (t < 2 * T_HOLD + T_ZOOM) f = 1;
    else f = 1 - ease((t - 2 * T_HOLD - T_ZOOM) / T_ZOOM);
    const s = Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * f);
    // zoom about a fixed point: centre moves so the target stays put on screen
    const g = (1 / s0 - 1 / s) / (1 / s0 - 1 / s1);
    return { x: c0.x + (target.x - c0.x) * g, y: c0.y + (target.y - c0.y) * g, s };
  }

  function draw(cam) {
    const s = cam.s * dpr;
    const vw = canvas.width, vh = canvas.height;
    const wx0 = cam.x - vw / 2 / s, wy0 = cam.y - vh / 2 / s;
    const wx1 = cam.x + vw / 2 / s, wy1 = cam.y + vh / 2 / s;
    const X = x => (x - wx0) * s, Y = y => (y - wy0) * s;
    let rects = 0;

    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, vw, vh);

    const rowPx = cam.s;
    const level = rowPx < 5 ? 'far' : rowPx < 26 ? 'mid' : 'deep';

    if (level === 'far') {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(far, X(0), Y(0), W * s, Math.ceil(H / SEG) * SEG * s);
      rects += (W / SEG) * Math.ceil(H / SEG);
    } else {
      const r0 = Math.max(0, Math.floor(wy0)), r1 = Math.min(H, Math.ceil(wy1));
      const s0 = Math.max(0, Math.floor(wx0 / SEG)), s1 = Math.min(W / SEG, Math.ceil(wx1 / SEG));
      const gap = Math.max(0.5, Math.min(1.5, rowPx * 0.04));
      for (let r = r0; r < r1; r++) {
        const y = Y(r);
        const flip = r & 1;
        for (let sg = s0; sg < s1; sg++) {
          for (const c of segment(r, sg)) {
            const x = X(c.x), w = c.w * s;
            if (level === 'mid') {
              ctx.fillStyle = c.filler ? COL.filler : COL.cell;
              ctx.fillRect(x + gap / 2, y + gap / 2, w - gap, s - gap);
              rects++;
            } else {
              rects += drawCell(c, x, y, w, s, flip);
            }
          }
        }
      }
    }

    // macros and power straps sit on top at every level
    for (const [mx, my, mw, mh] of MACROS) {
      const x = X(mx), y = Y(my), w = mw * s, h = mh * s;
      if (x > vw || y > vh || x + w < 0 || y + h < 0) continue;
      ctx.fillStyle = COL.macro; ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COL.macroEdge; ctx.lineWidth = Math.max(1, dpr);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      if (level === 'deep') {
        // OBS stripes inside the macro when you are close enough to see them
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        for (let yy = Math.max(my, Math.floor(wy0)); yy < Math.min(my + mh, wy1); yy += 2) {
          ctx.fillRect(Math.max(0, x), Y(yy), Math.min(w, vw), s * 0.6);
        }
      }
      rects++;
    }
    const sw = Math.max(1 * dpr, 0.9 * s);
    ctx.fillStyle = COL.power; ctx.globalAlpha = level === 'deep' ? 0.55 : 0.75;
    for (let px = STRAP / 2; px < W; px += STRAP) {
      const x = X(px);
      if (x < -sw || x > vw) continue;
      ctx.fillRect(x - sw / 2, Math.max(0, Y(0)), sw, Math.min(vh, Y(H)) - Math.max(0, Y(0)));
      rects++;
    }
    ctx.globalAlpha = 1;

    const REP = { far: 'density blocks', mid: 'cell outlines', deep: 'cell internals' };
    hudLevel.textContent = level;
    hudRep.textContent = REP[level];
    hudRects.textContent = rects.toLocaleString('en-US');
    // world row height ~ 1.6 µm; report the view width
    const um = (vw / s) * 1.6;
    hudScale.textContent = um >= 1000 ? (um / 1000).toFixed(2) + ' mm' : um.toFixed(0) + ' µm';
  }

  // Deep representation: rails, poly fingers, contacts and a pin or two.
  function drawCell(c, x, y, w, h, flip) {
    let n = 0;
    ctx.fillStyle = COL.nwell;
    ctx.fillRect(x, y + (flip ? h * 0.5 : 0), w, h * 0.5); n++;
    if (c.filler) {
      ctx.strokeStyle = '#3a3942'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); n++;
    } else {
      const rand = rng(c.seed);
      const fingers = Math.max(1, Math.round(c.w * 2));
      const pitch = w / (fingers + 1);
      const pw = Math.max(1, pitch * 0.22);
      ctx.fillStyle = COL.poly;
      for (let i = 1; i <= fingers; i++) {
        ctx.fillRect(x + i * pitch - pw / 2, y + h * 0.16, pw, h * 0.68); n++;
      }
      ctx.fillStyle = COL.contact;
      const cs = Math.max(1, h * 0.05);
      for (let i = 0; i <= fingers; i++) {
        const cx = x + (i + 0.5) * pitch;
        ctx.fillRect(cx - cs / 2, y + h * 0.28, cs, cs);
        ctx.fillRect(cx - cs / 2, y + h * 0.68, cs, cs);
        n += 2;
      }
      ctx.fillStyle = COL.metal1; ctx.globalAlpha = 0.85;
      const pins = 1 + ((rand() * Math.min(3, fingers)) | 0);
      for (let i = 0; i < pins; i++) {
        const px = x + (0.15 + rand() * 0.7) * w;
        ctx.fillRect(px - pw, y + h * 0.3, pw * 2, h * 0.4); n++;
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = COL.pin;
      ctx.fillRect(x + w * 0.1, y + h * 0.46, Math.max(1, w * 0.12), h * 0.08); n++;
      ctx.strokeStyle = COL.cellEdge; ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); n++;
    }
    // shared power rails straddle the row boundary, like real cells
    ctx.fillStyle = COL.metal1;
    ctx.fillRect(x, y - h * 0.05, w, h * 0.1);
    ctx.fillRect(x, y + h * 0.95, w, h * 0.1);
    return n + 2;
  }

  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  const t0 = performance.now();
  function frame(now) {
    if (visible) draw(camera((now - t0) / 1000));
    if (!still.matches) requestAnimationFrame(frame);
  }
  // ?t=<seconds> freezes the tour at that moment, for screenshots
  const frozen = parseFloat(new URLSearchParams(location.search).get('t'));
  if (still.matches || Number.isFinite(frozen)) {
    const at = Number.isFinite(frozen) ? frozen : T_HOLD + T_ZOOM * 0.55;
    draw(camera(at));
    window.addEventListener('resize', () => draw(camera(at)));
  } else {
    requestAnimationFrame(frame);
  }
}

// Small static SVGs for the three representation cards.
function svgArt() {
  const NS = 'http://www.w3.org/2000/svg';
  const rect = (g, x, y, w, h, fill, extra = {}) => {
    const r = document.createElementNS(NS, 'rect');
    Object.entries({ x, y, width: w, height: h, fill, ...extra }).forEach(([k, v]) => r.setAttribute(k, v));
    g.appendChild(r);
  };
  const farG = document.getElementById('far-art');
  if (farG) {
    for (let j = 0; j < 10; j++) for (let i = 0; i < 15; i++) {
      const d = density(i * 80 + 40, j * 90 + 45);
      rect(farG, i * 8, j * 8, 8, 8, `rgb(${18 + d * 80},${40 + d * 110},${60 + d * 150})`);
    }
    rect(farG, 12, 10, 18, 15, COL.macro); rect(farG, 86, 8, 22, 17, COL.macro); rect(farG, 52, 50, 15, 19, COL.macro);
    for (let x = 6; x < 120; x += 16) rect(farG, x, 0, 1.2, 80, COL.power, { opacity: 0.8 });
  }
  const midG = document.getElementById('mid-art');
  if (midG) {
    for (let r = 0; r < 10; r++) {
      const rand = rng(hash(r, 7));
      let x = 0;
      while (x < 120) {
        const w = [4, 6, 8, 8, 10, 12][(rand() * 6) | 0];
        rect(midG, x + 0.6, r * 8 + 0.6, w - 1.2, 6.8, rand() > 0.75 ? COL.filler : COL.cell);
        x += w;
      }
    }
    rect(midG, 70, 16, 34, 32, COL.macro, { stroke: COL.macroEdge, 'stroke-width': 0.6 });
  }
  const deepG = document.getElementById('deep-art');
  if (deepG) {
    const cells = [[4, 10, 34, 0], [40, 10, 22, 0], [64, 10, 50, 0], [4, 44, 46, 1], [52, 44, 30, 1], [84, 44, 30, 1]];
    for (const [x, y, w, flip] of cells) {
      const h = 32;
      rect(deepG, x, y + (flip ? h / 2 : 0), w, h / 2, COL.nwell);
      const f = Math.max(1, Math.round(w / 9)), p = w / (f + 1);
      for (let i = 1; i <= f; i++) rect(deepG, x + i * p - 1.2, y + 5, 2.4, h - 10, COL.poly);
      for (let i = 0; i <= f; i++) {
        rect(deepG, x + (i + 0.5) * p - 0.9, y + 9, 1.8, 1.8, COL.contact);
        rect(deepG, x + (i + 0.5) * p - 0.9, y + 21, 1.8, 1.8, COL.contact);
      }
      rect(deepG, x + w * 0.5 - 1.5, y + 10, 3, 12, COL.metal1, { opacity: 0.85 });
      rect(deepG, x + w * 0.12, y + 15, 4, 2, COL.pin);
      rect(deepG, x, y - 1.2, w, 2.4, COL.metal1);
      rect(deepG, x, y + h - 1.2, w, 2.4, COL.metal1);
      rect(deepG, x + 0.3, y + 0.3, w - 0.6, h - 0.6, 'none', { stroke: '#2b4163', 'stroke-width': 0.6 });
    }
  }
}

// URL anatomy: hover a parameter or its legend row to pair them.
function urlCard() {
  const parts = document.querySelectorAll('[data-i]');
  parts.forEach(el => {
    const on = v => document.querySelectorAll(`[data-i="${el.dataset.i}"]`).forEach(p => p.classList.toggle('on', v));
    el.addEventListener('mouseenter', () => on(true));
    el.addEventListener('mouseleave', () => on(false));
  });
}

function copyButtons() {
  document.querySelectorAll('.copy').forEach(b => b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(b.dataset.copy);
      b.textContent = 'copied';
    } catch {
      b.textContent = 'select & copy';
    }
    setTimeout(() => { b.textContent = 'copy'; }, 1600);
  }));
}

startHero();
svgArt();
urlCard();
copyButtons();
