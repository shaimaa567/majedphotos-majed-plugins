/* Arabian Motion Studio — runtime
 * Pure function of time: renderFrame(t) draws exactly the same pixels for the same t.
 * No timers, no CSS animations, no unseeded randomness.
 */
(() => {
  const W = 1080, H = 1920;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const prog = (local, at, dur) => (dur <= 0 ? (local >= at ? 1 : 0) : clamp((local - at) / dur));

  const ease = {
    linear: (t) => t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };

  // Entrance presets. p is eased progress (0 hidden → 1 settled).
  // slideR moves right→left: forward direction in Arabic (RTL) reading.
  const PRESET = {
    none: () => ({}),
    fade: (p) => ({ o: p }),
    rise: (p) => ({ o: clamp(p * 1.6), ty: (1 - p) * 70 }),
    drop: (p) => ({ o: clamp(p * 1.6), ty: -(1 - p) * 70 }),
    slideR: (p) => ({ o: clamp(p * 2.2), tx: (1 - p) * 260 }),
    slideL: (p) => ({ o: clamp(p * 2.2), tx: -(1 - p) * 260 }),
    scale: (p) => ({ o: clamp(p * 1.6), s: 0.82 + 0.18 * p }),
    pop: (p) => ({ o: clamp(p * 4), s: 0.35 + 0.65 * p }),
    wipe: (p) => ({ clip: `inset(0 0 0 ${(1 - p) * 100}%)` }),
    wipeUp: (p) => ({ clip: `inset(${(1 - p) * 100}% 0 0 0)` }),
    blur: (p) => ({ o: clamp(p * 1.6), blur: (1 - p) * 18, ty: (1 - p) * 24 }),
    draw: (p) => ({ draw: p }),
    settle: (p) => ({ o: clamp(p * 3), ty: -(1 - p) * 520, r: -(1 - p) * 16 }),
    flip: (p) => ({ o: clamp(p * 3), s: 0.6 + 0.4 * p, r: (1 - p) * 40 }),
  };
  const DEFAULT_EASE = { pop: 'outBack', settle: 'outBack', flip: 'outBack', draw: 'inOutCubic', slideR: 'outExpo', slideL: 'outExpo', rise: 'outExpo' };

  const base = () => ({ o: 1, tx: 0, ty: 0, s: 1, r: 0, clip: null, blur: 0, draw: 1 });
  const stateOf = (name, p) => Object.assign(base(), (PRESET[name] || PRESET.fade)(p));

  function layerState(L, local, defIn = 'fade') {
    const at = L.at || 0;
    const inName = L.in || defIn;
    const e = (ease[L.ease || DEFAULT_EASE[inName] || 'outCubic'])(prog(local, at, L.dur ?? 0.6));
    let st = stateOf(inName, e);
    if (local < at) st.o = 0;
    if (L.outAt != null) {
      const op = prog(local, L.outAt, L.outDur ?? 0.35);
      if (op > 0) st = stateOf(L.out || 'fade', 1 - ease.inCubic(op));
    }
    return st;
  }

  function apply(el, st) {
    el.style.opacity = String(clamp(st.o, 0, 1));
    el.style.transform = `translate(${st.tx}px, ${st.ty}px) scale(${st.s}) rotate(${st.r}deg)`;
    el.style.clipPath = st.clip || 'none';
    el.style.filter = st.blur > 0.01 ? `blur(${st.blur}px)` : 'none';
  }

  // Seeded RNG: same seed → same composition, every render.
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const NS = 'http://www.w3.org/2000/svg';
  const hasArabic = (s) => /[؀-ۿ]/.test(s);
  const hasLatin = (s) => /[A-Za-z0-9]/.test(s);

  let PROJECT = null;
  let scenes = [];
  let pending = [];

  function place(el, L) {
    el.classList.add('layer');
    if (L.x != null) el.style.left = L.x + 'px';
    if (L.y != null) el.style.top = L.y + 'px';
    if (L.w != null) el.style.width = L.w + 'px';
    if (L.h != null) el.style.height = L.h + 'px';
    if (L.origin) el.style.transformOrigin = L.origin;
  }

  // ---------- procedural digital art (sharp-edged, seeded) ----------
  function buildArt(L, pal) {
    const R = rng(L.seed || 1);
    const c = Object.assign({}, pal, L.colors || {});
    const pick = (arr) => arr[Math.floor(R() * arr.length)];
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const groups = [];
    let html = `<rect width="${W}" height="${H}" fill="${c.bg}"/>`;
    const style = L.style || 'shards';
    const g = (par, rot, inner) => { const i = groups.length; groups.push({ par, rot }); return `<g data-g="${i}">${inner}</g>`; };

    if (style === 'shards') {
      for (let layer = 0; layer < 3; layer++) {
        let inner = '';
        const n = 3 + Math.floor(R() * 3);
        for (let i = 0; i < n; i++) {
          const cx = R() * W, cy = R() * H, rad = 260 + R() * 620, k = 3 + Math.floor(R() * 2), a0 = R() * 6.283;
          const pts = [];
          for (let j = 0; j < k; j++) { const a = a0 + (j / k) * 6.283 + (R() - 0.5) * 0.9, r = rad * (0.55 + R() * 0.6); pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`); }
          inner += `<polygon points="${pts.join(' ')}" fill="${pick([c.accent2, c.accent, c.muted, c.accent2])}" opacity="${(0.04 + R() * 0.11).toFixed(3)}"/>`;
        }
        html += g(8 + layer * 14, 0, inner);
      }
      let lines = '';
      for (let i = 0; i < 5; i++) { const y = R() * H, x1 = R() * W * 0.4, x2 = x1 + 300 + R() * 600; lines += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y - 120 - R() * 200}" stroke="${c.ink}" stroke-opacity=".35" stroke-width="2"/>`; }
      html += g(30, 0, lines);
    } else if (style === 'lines') {
      const ang = (L.angle ?? (-24 + R() * 48)), sp = 54 + Math.floor(R() * 30);
      let inner = '';
      for (let i = -40; i < 90; i++) inner += `<line x1="${-800}" y1="${i * sp}" x2="${W + 800}" y2="${i * sp}" stroke="${c.ink}" stroke-opacity="${i % 5 === 0 ? 0.22 : 0.07}" stroke-width="${i % 5 === 0 ? 3 : 1.5}"/>`;
      html += `<g transform="rotate(${ang} ${W / 2} ${H / 2})">${g(20, 0, inner)}</g>`;
      const bx = R() * 500, by = 200 + R() * 1200;
      html += g(40, 0, `<polygon points="${bx},${by} ${bx + 520},${by - 90} ${bx + 520},${by - 30} ${bx},${by + 60}" fill="${c.accent}" opacity=".9"/>`);
    } else if (style === 'rings') {
      const cx = R() * W, cy = H * (0.2 + R() * 0.6), sides = pick([6, 8, 5]), rot0 = R() * 60;
      let inner = '';
      for (let i = 1; i <= 11; i++) {
        const r = i * 110, pts = [];
        for (let j = 0; j < sides; j++) { const a = (j / sides) * 6.283 - 1.5708; pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`); }
        inner += `<polygon points="${pts.join(' ')}" fill="none" stroke="${i % 3 === 0 ? c.accent2 : c.ink}" stroke-opacity="${i % 3 === 0 ? 0.7 : 0.16}" stroke-width="${i % 3 === 0 ? 4 : 2}"/>`;
      }
      html += `<g transform="rotate(${rot0} ${cx} ${cy})">${g(0, 6, inner).replace('<g ', `<g data-cx="${cx}" data-cy="${cy}" `)}</g>`;
    } else if (style === 'bands') {
      let inner = '';
      const n = 5, h0 = 260 + R() * 120, sk = 160 + R() * 160, y0 = -200 + R() * 200;
      for (let i = 0; i < n; i++) {
        const y = y0 + i * (h0 + 90), col = [c.accent, c.accent2, c.ink, c.muted, c.accent][i];
        inner += `<polygon points="-100,${y + sk} ${W + 100},${y} ${W + 100},${y + h0} -100,${y + h0 + sk}" fill="${col}" opacity="${(0.07 + R() * 0.15).toFixed(3)}"/>`;
      }
      html += g(18, 0, inner);
    } else if (style === 'lattice') {
      let inner = '';
      const step = 130 + Math.floor(R() * 40);
      for (let y = -step; y < H + step; y += step) for (let x = -step; x < W + step; x += step) {
        const cx2 = x + ((y / step) % 2 ? step / 2 : 0), h2 = step * 0.5, w2 = step * 0.42, hot = R() < 0.12;
        inner += `<polygon points="${cx2},${y - h2} ${cx2 + w2},${y} ${cx2},${y + h2} ${cx2 - w2},${y}" fill="${hot ? pick([c.accent, c.accent2]) : 'none'}" fill-opacity="${hot ? (0.1 + R() * 0.18).toFixed(2) : 0}" stroke="${c.accent}" stroke-opacity=".16" stroke-width="2"/>`;
      }
      html += g(10, 0, inner);
    } else if (style === 'frames') {
      let inner = '';
      for (let i = 0; i < 6; i++) {
        const w0 = 360 + i * 130 + R() * 60, h0 = w0 * 1.16, cx2 = R() * W, cy2 = R() * H, rot = -18 + R() * 36;
        inner += `<rect x="${-w0 / 2}" y="${-h0 / 2}" width="${w0}" height="${h0}" transform="translate(${cx2.toFixed(0)} ${cy2.toFixed(0)}) rotate(${rot.toFixed(1)})" fill="${i % 3 === 0 ? c.accent2 : 'none'}" fill-opacity=".35" stroke="${c.accent}" stroke-opacity="${(0.12 + R() * 0.2).toFixed(2)}" stroke-width="3"/>`;
      }
      html += g(16, 0, inner);
    } else if (style === 'grid') {
      let inner = '';
      const step = 96;
      for (let y = 0; y <= H + step; y += step) for (let x = 0; x <= W + step; x += step) {
        const hot = R() < 0.07;
        inner += `<path d="M${x - 9} ${y}H${x + 9}M${x} ${y - 9}V${y + 9}" stroke="${hot ? c.accent : c.ink}" stroke-opacity="${hot ? 1 : 0.22}" stroke-width="${hot ? 4 : 2}"/>`;
      }
      html += g(14, 0, inner);
    }
    svg.innerHTML = html;
    return { svg, groups: [...svg.querySelectorAll('[data-g]')].map((el, i) => ({ el, ...groups[i] })) };
  }

  // ---------- original vector illustrations (no stock photos needed) ----------
  // Abstract "photo" art: sharp-edged motifs, seeded → every print/page looks different.
  function motifSvg(seed, w, h, pal) {
    const R = rng(seed || 1);
    const kinds = ['hills', 'heart', 'diamonds', 'sunrise', 'stripes'];
    const k = kinds[Math.floor(R() * kinds.length)];
    const bgs = [pal.accent2, '#FBE3D6', '#F3C4C8', '#FFE9D0', '#F6D9D2'];
    const bg = bgs[Math.floor(R() * bgs.length)], a = pal.accent, a2 = '#8E0B20';
    let s = `<rect width="${w}" height="${h}" fill="${bg}"/>`;
    if (k === 'hills') {
      s += `<circle cx="${w * (0.25 + R() * 0.5)}" cy="${h * 0.3}" r="${w * 0.12}" fill="${a}" opacity=".9"/>`;
      for (let i = 0; i < 3; i++) { const x0 = -w * 0.2 + i * w * 0.3 + R() * w * 0.1; s += `<polygon points="${x0},${h} ${x0 + w * 0.45},${h * (0.45 + i * 0.1)} ${x0 + w * 0.9},${h}" fill="${i % 2 ? a2 : a}" opacity="${0.3 + i * 0.25}"/>`; }
    } else if (k === 'heart') {
      const cx = w / 2, cy = h * 0.52, q = Math.min(w, h) * 0.3;
      s += `<polygon points="${cx},${cy + q} ${cx - q * 1.15},${cy - q * 0.1} ${cx - q * 0.62},${cy - q * 0.72} ${cx},${cy - q * 0.34} ${cx + q * 0.62},${cy - q * 0.72} ${cx + q * 1.15},${cy - q * 0.1}" fill="${a}"/>`;
      s += `<polygon points="${cx},${cy + q} ${cx + q * 1.15},${cy - q * 0.1} ${cx + q * 0.62},${cy - q * 0.72} ${cx},${cy - q * 0.34}" fill="${a2}" opacity=".45"/>`;
    } else if (k === 'diamonds') {
      for (let i = 0; i < 7; i++) { const cx = R() * w, cy = R() * h, r = w * (0.08 + R() * 0.16); s += `<polygon points="${cx},${cy - r} ${cx + r * 0.7},${cy} ${cx},${cy + r} ${cx - r * 0.7},${cy}" fill="${i % 2 ? a : a2}" opacity="${0.25 + R() * 0.5}"/>`; }
    } else if (k === 'sunrise') {
      const cx = w / 2, cy = h * 0.8;
      for (let i = 0; i < 9; i++) { const a0 = Math.PI + (i / 9) * Math.PI, a1 = a0 + (Math.PI / 9) * 0.55, r = w; s += `<polygon points="${cx},${cy} ${cx + Math.cos(a0) * r},${cy + Math.sin(a0) * r} ${cx + Math.cos(a1) * r},${cy + Math.sin(a1) * r}" fill="${a}" opacity=".35"/>`; }
      s += `<polygon points="${cx - w * 0.16},${cy} ${cx},${cy - w * 0.16} ${cx + w * 0.16},${cy}" fill="${a}"/>`;
    } else {
      for (let i = -2; i < 8; i++) s += `<polygon points="${i * w * 0.22},${h} ${i * w * 0.22 + w * 0.1},${h} ${i * w * 0.22 + w * 0.5},0 ${i * w * 0.22 + w * 0.4},0" fill="${i % 2 ? a : a2}" opacity="${0.18 + R() * 0.3}"/>`;
    }
    return s;
  }
  const SATIN = (id, c0, c1, c2) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c0}"/><stop offset=".45" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></linearGradient>`;
  const bars = (x, y, w, n, gap, h, col, op = 0.5) => Array.from({ length: n }, (_, i) => `<rect x="${x}" y="${y + i * gap}" width="${i === n - 1 ? w * 0.6 : w}" height="${h}" fill="${col}" opacity="${op}"/>`).join('');

  function bookSvg(L, pal, uid) {
    const W = L.w || 520, H = W * 1.32, ch = W * 0.09;
    const cover = L.cover === 'milk' ? ['#FFFDF9', '#EAD7CC', '#FFFFFF'] : ['#8E0B20', '#C8102E', '#E2354F'];
    const ink = L.cover === 'milk' ? '#C8102E' : '#FFFDF9';
    if (L.variant === 'open') {
      const OW = L.w || 820, OH = OW * 0.62, m = OW / 2;
      const page = (side) => { // side: -1 = left page, +1 = right page
        const x0 = side < 0 ? 0 : m, x1 = side < 0 ? m : OW;
        const g = (x, y, w, h, sd) => `<g transform="translate(${x} ${y})"><clipPath id="${uid}c${sd}"><rect width="${w}" height="${h}"/></clipPath><g clip-path="url(#${uid}c${sd})">${motifSvg((L.seed || 1) * 7 + sd, w, h, pal)}</g><rect width="${w}" height="${h}" fill="none" stroke="#FFFDF9" stroke-width="6"/></g>`;
        const px = side < 0 ? OW * 0.07 : m + OW * 0.07, pw = m - OW * 0.14;
        const content = side < 0
          ? g(px, OH * 0.12, pw, OH * 0.36, 1) + g(px, OH * 0.52, pw * 0.62, OH * 0.3, 2) + bars(px + pw * 0.66, OH * 0.56, pw * 0.34, 4, OH * 0.055, 6, '#8A5A60', 0.45)
          : g(px, OH * 0.1, pw, OH * 0.58, 3) + bars(px, OH * 0.74, pw, 3, OH * 0.06, 6, '#8A5A60', 0.45) + `<polygon points="${px + pw * 0.86},${OH * 0.76} ${px + pw},${OH * 0.8} ${px + pw * 0.86},${OH * 0.86} ${px + pw * 0.72},${OH * 0.8}" fill="${pal.accent}"/>`;
        return `<g transform="skewY(${side < 0 ? -3 : 3}) translate(0 ${side < 0 ? OW * 0.026 : -OW * 0.026})"><polygon points="${x0},${OH * 0.04} ${x1},0 ${x1},${OH * 0.97} ${x0},${OH}" fill="#FFFDF9" stroke="#E7D3C8" stroke-width="2"/>${content}</g>`;
      };
      return { w: OW, h: OH + OW * 0.07, svg: `<defs>${SATIN(uid + 'g', cover[0], cover[1], cover[2])}<linearGradient id="${uid}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E7D3C8"/><stop offset=".5" stop-color="#B89C90"/><stop offset="1" stop-color="#E7D3C8"/></linearGradient></defs>` +
        `<polygon points="${-OW * 0.02},${OH * 0.07} ${OW * 1.02},${OH * 0.02} ${OW * 1.02},${OH * 1.05} ${-OW * 0.02},${OH * 1.09}" fill="#2A0208" opacity=".25" transform="translate(${OW * 0.02} ${OW * 0.03})"/>` +
        `<polygon points="${-OW * 0.02},${OH * 0.03} ${OW * 1.02},${OH * -0.02} ${OW * 1.02},${OH * 1.03} ${-OW * 0.02},${OH * 1.06}" fill="url(#${uid}g)"/>` +
        page(-1) + page(1) + `<rect x="${m - 6}" y="0" width="12" height="${OH}" fill="url(#${uid}s)" opacity=".7"/>` +
        `<polygon points="${m + OW * 0.1},${OH * 0.01} ${m + OW * 0.15},${OH * 0.005} ${m + OW * 0.15},${OH * 1.12} ${m + OW * 0.125},${OH * 1.07} ${m + OW * 0.1},${OH * 1.12}" fill="#C8102E"/>` };
    }
    // closed book, spine on the RIGHT (Arabic book)
    const poly = `0,${ch} ${ch},0 ${W},0 ${W},${H - ch} ${W - ch},${H} 0,${H}`;
    return { w: W * 1.08, h: H * 1.1, svg: `<defs>${SATIN(uid + 'g', cover[0], cover[1], cover[2])}${SATIN(uid + 'r', '#8E0B20', '#C8102E', '#F2475F')}</defs>` +
      `<g transform="translate(${W * 0.02} 0)"><polygon points="${poly}" transform="translate(${W * 0.045} ${W * 0.05})" fill="#2A0208" opacity=".28"/>` +
      `<polygon points="${-W * 0.035},${ch + W * 0.03} ${ch - W * 0.02},${W * 0.03} ${W * 0.95},${W * 0.03} ${W * 0.95},${H + W * 0.03} ${-W * 0.035},${H + W * 0.03}" fill="#FFFDF9" stroke="#E0C9BD" stroke-width="2"/>` +
      `<polygon points="${poly}" fill="url(#${uid}g)"/><rect x="${W * 0.84}" y="0" width="${W * 0.16}" height="${H - ch}" fill="#000" opacity=".2"/>` +
      `<polygon points="0,${ch} ${ch},0 ${W * 0.55},0 ${W * 0.2},${H}" fill="#fff" opacity=".1"/>` +
      `<g transform="translate(${W * 0.16} ${H * 0.13})"><rect width="${W * 0.52}" height="${H * 0.4}" fill="#FFFDF9"/><clipPath id="${uid}m"><rect x="${W * 0.03}" y="${W * 0.03}" width="${W * 0.46}" height="${H * 0.4 - W * 0.12}"/></clipPath><g clip-path="url(#${uid}m)" transform="translate(${W * 0.03} ${W * 0.03})">${motifSvg(L.seed || 3, W * 0.46, H * 0.4 - W * 0.12, pal)}</g></g>` +
      bars(W * 0.2, H * 0.6, W * 0.44, 3, H * 0.045, 7, ink, 0.8) +
      `<rect x="${W * 0.7}" y="0" width="${W * 0.07}" height="${H}" fill="url(#${uid}r)" transform="translate(0 ${-0})"/>` +
      `<polygon points="${W * 0.7},${H - ch} ${W * 0.77},${H - ch} ${W * 0.77},${H + W * 0.16} ${W * 0.735},${H + W * 0.11} ${W * 0.7},${H + W * 0.16}" fill="url(#${uid}r)"/></g>` };
  }

  function printsSvg(L, pal, uid) {
    const n = L.count || 3, pw = L.w || 420, ph = pw * 1.18, tot = { w: pw * (1 + 0.55 * (n - 1)) + 80, h: ph + 120 };
    let s = '';
    for (let i = 0; i < n; i++) {
      const rot = (i - (n - 1) / 2) * 9 + ((L.seed || 1) % 3 - 1) * 2, x = 40 + i * pw * 0.55, y = 50 + Math.abs(i - (n - 1) / 2) * 26;
      s += `<g transform="translate(${x} ${y}) rotate(${rot} ${pw / 2} ${ph / 2})"><rect x="${pw * 0.03}" y="${pw * 0.04}" width="${pw}" height="${ph}" fill="#2A0208" opacity=".22"/><rect width="${pw}" height="${ph}" fill="#FFFDF9"/>` +
        `<clipPath id="${uid}p${i}"><rect x="${pw * 0.06}" y="${pw * 0.06}" width="${pw * 0.88}" height="${ph * 0.78}"/></clipPath><g clip-path="url(#${uid}p${i})" transform="translate(${pw * 0.06} ${pw * 0.06})">${motifSvg((L.seed || 1) * 13 + i * 5, pw * 0.88, ph * 0.78, pal)}</g></g>`;
    }
    return { w: tot.w, h: tot.h, svg: s };
  }

  function inviteSvg(L, pal, uid) {
    const W = L.w || 520, H = W * 1.4, ch = W * 0.1;
    const poly = `0,${ch} ${ch},0 ${W - ch},0 ${W},${ch} ${W},${H - ch} ${W - ch},${H} ${ch},${H} 0,${H - ch}`;
    return { w: W * 1.08, h: H * 1.06, svg: `<defs>${SATIN(uid + 'r', '#8E0B20', '#C8102E', '#F2475F')}</defs>` +
      `<polygon points="${W * 0.05},${H * 0.12} ${W / 2},${H * 0.42} ${W * 0.95},${H * 0.12} ${W * 0.95},${H * 0.98} ${W * 0.05},${H * 0.98}" fill="${pal.accent2}" transform="translate(${W * 0.03} ${W * 0.04})"/>` +
      `<polygon points="${poly}" fill="#2A0208" opacity=".22" transform="translate(${W * 0.04} ${W * 0.05})"/><polygon points="${poly}" fill="#FFFDF9"/>` +
      `<polygon points="${ch + 14},${ch + 22} ${ch + 22},${ch + 14} ${W - ch - 22},${ch + 14} ${W - ch - 14},${ch + 22} ${W - ch - 14},${H - ch - 22} ${W - ch - 22},${H - ch - 14} ${ch + 22},${H - ch - 14} ${ch + 14},${H - ch - 22}" fill="none" stroke="${pal.accent}" stroke-width="3"/>` +
      `<polygon points="${W / 2},${H * 0.16} ${W * 0.62},${H * 0.23} ${W / 2},${H * 0.36} ${W * 0.38},${H * 0.23}" fill="${pal.accent}"/>` +
      bars(W * 0.22, H * 0.46, W * 0.56, 1, 0, 16, pal.ink, 0.85) + bars(W * 0.28, H * 0.54, W * 0.44, 4, H * 0.045, 7, pal.muted, 0.5) +
      `<rect x="${W * 0.66}" y="0" width="${W * 0.08}" height="${H}" fill="url(#${uid}r)"/>` +
      `<polygon points="${W * 0.66},${H} ${W * 0.74},${H} ${W * 0.74},${H + W * 0.12} ${W * 0.70},${H + W * 0.07} ${W * 0.66},${H + W * 0.12}" fill="url(#${uid}r)"/>` };
  }

  // ---------- layer builders ----------
  function buildLayer(L, sceneEl, scene) {
    const pal = PROJECT.palette;
    const C = (v) => (v && pal[v]) || v;
    const el = document.createElement('div');
    place(el, L);
    el.dataset.li = String(L._index); el.dataset.scene = scene.id; el.dataset.type = L.type;
    sceneEl.appendChild(el);
    const inst = { L, el, update() {} };

    if (L.type === 'art') {
      el.style.left = '0px'; el.style.top = '0px'; el.style.width = W + 'px'; el.style.height = H + 'px';
      const art = buildArt(L, pal);
      el.appendChild(art.svg);
      inst.update = (local) => {
        art.groups.forEach((gr) => {
          const dx = -gr.par * local * 6, dy = gr.par * local * 3;
          const rot = gr.rot ? gr.rot * local : 0;
          const cx = gr.el.dataset.cx, cy = gr.el.dataset.cy;
          gr.el.setAttribute('transform', cx ? `rotate(${rot} ${cx} ${cy})` : `translate(${dx} ${dy})`);
        });
        apply(el, layerState(L, local, 'none'));
      };
    } else if (L.type === 'image' || L.type === 'video') {
      el.style.left = (L.x ?? 0) + 'px'; el.style.top = (L.y ?? 0) + 'px';
      el.style.width = (L.w ?? W) + 'px'; el.style.height = (L.h ?? H) + 'px';
      el.style.overflow = 'hidden';
      if (L.clip) el.style.clipPath = `polygon(${L.clip.map((p) => p[0] + '% ' + p[1] + '%').join(',')})`;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;inset:0;overflow:hidden';
      const img = document.createElement('img');
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;transform-origin:50% 50%';
      if (L.filter) img.style.filter = L.filter;
      wrap.appendChild(img);
      if (L.overlay) { const ov = document.createElement('div'); ov.style.cssText = `position:absolute;inset:0;background:${L.overlay}`; wrap.appendChild(ov); }
      el.appendChild(wrap);
      let cur = '';
      const setSrc = (src) => { if (src !== cur) { cur = src; img.src = src; pending.push(img.decode().catch(() => {})); } };
      if (L.type === 'image') setSrc(L.src);
      const kb = L.kenburns;
      inst.update = (local) => {
        if (L.type === 'video') {
          const idx = clamp(Math.floor(local * PROJECT.fps), 0, L.frameCount - 1) + 1;
          setSrc(L.framesBase + String(idx).padStart(5, '0') + '.jpg');
        }
        if (kb) {
          const q = clamp(local / (scene.duration || 1));
          const sc = (kb.from ?? 1) + ((kb.to ?? 1.1) - (kb.from ?? 1)) * q;
          img.style.transform = `translate(${(kb.dx ?? 0) * q}px, ${(kb.dy ?? 0) * q}px) scale(${sc})`;
        }
        const st = layerState(L, local, 'fade');
        // keep user clip-path for the frame, only animate other props
        el.style.opacity = String(clamp(st.o, 0, 1));
        el.style.transform = `translate(${st.tx}px, ${st.ty}px) scale(${st.s}) rotate(${st.r}deg)`;
        if (st.clip) el.style.clipPath = st.clip;
        else if (L.clip) el.style.clipPath = `polygon(${L.clip.map((p) => p[0] + '% ' + p[1] + '%').join(',')})`;
        else el.style.clipPath = 'none';
      };
    } else if (L.type === 'icon') {
      const size = L.size || 160;
      el.style.width = size + 'px'; el.style.height = size + 'px';
      let pre = '';
      if (L.badge) {
        const pad = L.badgePad ?? 36, tot = size + pad * 2, ch = tot * 0.22, off = L.badgeShadow ?? 12;
        const poly = `0,0 ${tot - ch},0 ${tot},${ch} ${tot},${tot} ${ch},${tot} 0,${tot - ch}`;
        pre = `<svg width="${tot}" height="${tot}" viewBox="0 0 ${tot} ${tot}" style="position:absolute;left:${-pad}px;top:${-pad}px;overflow:visible">` +
              `<polygon points="${poly}" transform="translate(${off},${off})" fill="${C(L.badgeShadowColor) || pal.accent}"/>` +
              `<polygon points="${poly}" fill="${L.badge === true ? pal.bg : C(L.badge)}" stroke="${C(L.color) || pal.ink}" stroke-width="3"/></svg>`;
      }
      el.innerHTML = pre + L.svg;
      const s = el.querySelector('svg:last-of-type');
      s.setAttribute('width', size); s.setAttribute('height', size);
      s.setAttribute('stroke', C(L.color) || pal.ink);
      s.setAttribute('stroke-width', String(L.stroke || 1.75));
      s.style.position = 'absolute'; s.style.left = '0'; s.style.top = '0';
      const shapes = s.querySelectorAll('path,line,polyline,polygon,circle,rect,ellipse');
      shapes.forEach((n) => { n.setAttribute('pathLength', '1'); n.style.strokeDasharray = '1 1'; });
      inst.update = (local) => {
        const st = layerState(L, local, 'draw');
        shapes.forEach((n) => { n.style.strokeDashoffset = String(1 - st.draw); });
        const pre0 = el.querySelector('svg:first-child'); if (pre0 && pre0 !== s) pre0.style.opacity = String(clamp(st.draw * 2));
        apply(el, Object.assign(st, { draw: 1 }));
      };
    } else if (L.type === 'shape') {
      el.style.left = '0px'; el.style.top = '0px'; el.style.width = W + 'px'; el.style.height = H + 'px';
      const sv = document.createElementNS(NS, 'svg');
      sv.setAttribute('width', W); sv.setAttribute('height', H); sv.setAttribute('viewBox', `0 0 ${W} ${H}`);
      let pts = L.points;
      if (L.kind === 'rect') pts = [[L.rx, L.ry], [L.rx + L.rw, L.ry], [L.rx + L.rw, L.ry + L.rh], [L.rx, L.ry + L.rh]];
      sv.innerHTML = `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${C(L.fill) || 'none'}" fill-opacity="${L.fillOpacity ?? 1}" stroke="${C(L.stroke) || 'none'}" stroke-width="${L.strokeWidth || 0}"/>`;
      el.appendChild(sv);
      inst.update = (local) => apply(el, layerState(L, local, 'wipe'));
    } else if (L.type === 'bgtext') {
      el.style.left = '0px'; el.style.top = '0px'; el.style.width = W + 'px'; el.style.height = H + 'px'; el.style.overflow = 'hidden';
      const rows = L.rows || 3, size = L.size || 420;
      const rowEls = [];
      for (let i = 0; i < rows; i++) {
        const r = document.createElement('div');
        r.dir = hasArabic(L.text) ? 'rtl' : 'ltr';
        r.style.cssText = `position:absolute;left:0;white-space:nowrap;font:${L.weight || 900} ${size}px/1 ${PROJECT.fonts.display};` +
          `color:${C(L.fill) || 'transparent'};-webkit-text-stroke:${L.strokeWidth ?? 3}px ${C(L.color) || pal.ink};opacity:${L.opacity ?? 0.13};top:${(L.y ?? 120) + i * size * (L.gap ?? 1.15)}px`;
        r.textContent = Array(6).fill(L.text).join('   ');
        el.appendChild(r); rowEls.push(r);
      }
      inst.update = (local) => {
        rowEls.forEach((r, i) => { const dir = i % 2 ? 1 : -1; r.style.transform = `translateX(${(-1500 + i * 260) + dir * (L.speed ?? 70) * local}px)`; });
        apply(el, layerState(L, local, 'fade'));
      };
    } else if (L.type === 'text') {
      const size = L.size || 90;
      el.style.width = (L.w ?? 900) + 'px';
      const fam = PROJECT.fonts[L.font] || PROJECT.fonts.display;
      const accent = C(L.keyColor) || pal.accent;
      const box = document.createElement('div');
      box.className = 'txt';
      box.dir = hasArabic(L.text) ? 'rtl' : 'ltr';
      box.style.cssText = `font-family:${fam};font-weight:${L.weight || 800};font-size:${size}px;line-height:${L.lh || 1.45};` +
        `color:${C(L.color) || pal.ink};text-align:${L.align || (box.dir === 'rtl' ? 'right' : 'left')};` +
        (L.shadow ? `text-shadow:${L.shadow};` : '') + (L.tracking ? `letter-spacing:${L.tracking}px;` : '');
      const words = [];
      const toks = L.text.split(/(\s+)/);
      let keyOn = false;
      toks.forEach((tk) => {
        if (/^\s+$/.test(tk)) { box.appendChild(document.createTextNode(tk.includes('\n') ? '\n' : ' ')); return; }
        if (!tk) return;
        let t = tk, start = false, end = false;
        if (t.startsWith('*')) { keyOn = true; t = t.slice(1); start = true; }
        if (t.includes('*')) { end = true; t = t.replace(/\*/g, ''); } // closing * may be followed by punctuation (e.g. *نحن*؟)
        const sp = document.createElement('span');
        sp.className = 'w' + (hasLatin(t) && !hasArabic(t) ? ' ltr' : '');
        sp.textContent = t;
        if (keyOn) { sp.style.color = accent; if (L.keyShadow !== false) sp.style.textShadow = L.keyShadow || `0.07em 0.07em 0 ${pal.accent2}`; }
        if (end) keyOn = false;
        box.appendChild(sp); words.push(sp);
      });
      el.appendChild(box);
      const mode = L.reveal || 'words';
      inst.update = (local) => {
        if (mode === 'words') {
          words.forEach((sp, i) => {
            const at = L.wordAt ? (L.wordAt[i] ?? L.wordAt[L.wordAt.length - 1]) : (L.at || 0) + i * (L.stagger ?? 0.12);
            const st = layerState({ in: L.wordIn || 'blur', at, dur: L.wordDur ?? 0.5, ease: L.wordEase }, local, 'blur');
            sp.style.opacity = String(clamp(st.o)); sp.style.transform = `translate(${st.tx}px,${st.ty}px) scale(${st.s})`;
            sp.style.filter = st.blur > 0.01 ? `blur(${st.blur}px)` : 'none';
          });
          const st = L.outAt != null ? layerState({ in: 'none', at: 0, dur: 0, out: L.out, outAt: L.outAt, outDur: L.outDur }, local, 'none') : base();
          apply(el, st);
        } else {
          apply(el, layerState(L, local, 'rise'));
        }
      };
    } else if (L.type === 'fill') {
      el.style.left = '0px'; el.style.top = '0px'; el.style.width = W + 'px'; el.style.height = H + 'px';
      el.style.background = L.gradient || C(L.color) || pal.bg;
      inst.update = (local) => apply(el, layerState(L, local, 'none'));
    } else if (L.type === 'rays') {
      // sharp light wedges radiating from a point ("أشعة الضوء")
      el.style.left = '0px'; el.style.top = '0px'; el.style.width = W + 'px'; el.style.height = H + 'px'; el.style.overflow = 'hidden';
      if (L.blend) el.style.mixBlendMode = L.blend;
      const cx = L.cx ?? W * 0.5, cy = L.cy ?? H * 0.3, n = L.count || 14, R0 = Math.hypot(W, H) * 1.1;
      const col = C(L.color) || '#FFFFFF', gid = `rg_${scene.id}_${L._index}`, wedge = (Math.PI * 2) / n;
      let pts = '';
      for (let i = 0; i < n; i += 2) {
        const a0 = i * wedge, a1 = a0 + wedge * (L.fill ?? 0.6);
        pts += `<polygon points="${cx},${cy} ${(cx + Math.cos(a0) * R0).toFixed(1)},${(cy + Math.sin(a0) * R0).toFixed(1)} ${(cx + Math.cos(a1) * R0).toFixed(1)},${(cy + Math.sin(a1) * R0).toFixed(1)}" fill="url(#${gid})"/>`;
      }
      const sv = document.createElementNS(NS, 'svg');
      sv.setAttribute('width', W); sv.setAttribute('height', H); sv.setAttribute('viewBox', `0 0 ${W} ${H}`);
      sv.innerHTML = `<defs><radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${R0 * 0.7}"><stop offset="0" stop-color="${col}" stop-opacity="${L.opacity ?? 0.5}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs><g>${pts}</g>`;
      el.appendChild(sv);
      const g = sv.querySelector('g');
      inst.update = (local) => {
        g.setAttribute('transform', `rotate(${(L.speed ?? 4) * local} ${cx} ${cy})`);
        const st = layerState(L, local, 'fade');
        st.o *= 0.9 + 0.1 * Math.sin(local * 1.7);
        apply(el, st);
      };
    } else if (L.type === 'sparkles') {
      // magic twinkles: sharp 4-point stars, seeded, deterministic
      el.style.left = '0px'; el.style.top = '0px'; el.style.width = W + 'px'; el.style.height = H + 'px';
      const R = rng(L.seed || 1), n = L.count || 14, rg = L.region || { x: 60, y: 260, w: 960, h: 1200 };
      const cols = (L.colors || ['#FFFFFF', pal.accent, pal.accent2]).map(C);
      const sv = document.createElementNS(NS, 'svg');
      sv.setAttribute('width', W); sv.setAttribute('height', H); sv.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const stars = [];
      let html = '';
      for (let i = 0; i < n; i++) {
        const r = (L.size || 46) * (0.45 + R() * 0.9), q = r * 0.17;
        const d = `M0 ${-r}L${q} ${-q}L${r} 0L${q} ${q}L0 ${r}L${-q} ${q}L${-r} 0L${-q} ${-q}Z`;
        stars.push({ x: rg.x + R() * rg.w, y: rg.y + R() * rg.h, ph: R(), f: 0.35 + R() * 0.5, rot: R() * 40 });
        html += `<path data-s="${i}" d="${d}" fill="${cols[Math.floor(R() * cols.length)]}"/>`;
      }
      sv.innerHTML = html; el.appendChild(sv);
      const nodes = [...sv.querySelectorAll('path')];
      inst.update = (local) => {
        nodes.forEach((nd, i) => {
          const s = stars[i], k = Math.pow(Math.max(0, Math.sin(Math.PI * 2 * (s.f * local + s.ph))), 2);
          nd.setAttribute('transform', `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${s.rot + local * 12}) scale(${(0.15 + 0.85 * k).toFixed(3)})`);
          nd.setAttribute('opacity', k.toFixed(3));
        });
        apply(el, layerState(L, local, 'fade'));
      };
    } else if (L.type === 'ribbon') {
      // red satin ribbon sweeping across the frame
      el.style.left = '0px'; el.style.top = '0px'; el.style.width = W + 'px'; el.style.height = H + 'px';
      const y0 = L.y ?? 1480;
      const paths = {
        sweep: `M -120 ${y0 + 240} C 260 ${y0 - 160}, 720 ${y0 + 700}, 1200 ${y0 + 120}`,
        wave: `M -120 ${y0} C 200 ${y0 - 260}, 380 ${y0 + 260}, 540 ${y0} S 880 ${y0 - 260}, 1200 ${y0 + 20}`,
        diagonal: `M -120 ${y0 + 360} L 1200 ${y0 - 220}`,
        loop: `M -120 ${y0 + 120} C 300 ${y0 - 300}, 900 ${y0 - 300}, 780 ${y0 + 40} S 120 ${y0 + 420}, 1200 ${y0 + 200}`,
      };
      const d = L.d || paths[L.shape || 'sweep'], wd = L.width || 70, gid = `sg_${scene.id}_${L._index}`;
      const c1 = C(L.color) || '#C8102E', c0 = C(L.dark) || '#6E0A18', c2 = C(L.light) || '#F2475F';
      const sv = document.createElementNS(NS, 'svg');
      sv.setAttribute('width', W); sv.setAttribute('height', H); sv.setAttribute('viewBox', `0 0 ${W} ${H}`);
      sv.innerHTML = `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0">` +
        `<stop offset="0" stop-color="${c0}"/><stop offset=".3" stop-color="${c1}"/><stop offset=".5" stop-color="${c2}"/><stop offset=".72" stop-color="${c1}"/><stop offset="1" stop-color="${c0}"/></linearGradient></defs>` +
        `<path class="rb" d="${d}" transform="translate(0 16)" stroke="#2A0208" stroke-opacity=".22" stroke-width="${wd}" fill="none"/>` +
        `<path class="rb" d="${d}" stroke="${c0}" stroke-width="${wd + 6}" fill="none"/>` +
        `<path class="rb" d="${d}" stroke="url(#${gid})" stroke-width="${wd}" fill="none"/>` +
        `<path class="rb" d="${d}" transform="translate(0 ${-wd * 0.2})" stroke="#FFFFFF" stroke-opacity=".34" stroke-width="${wd * 0.16}" fill="none"/>`;
      el.appendChild(sv);
      const nodes = [...sv.querySelectorAll('.rb')];
      nodes.forEach((n) => { n.setAttribute('pathLength', '1'); n.style.strokeDasharray = '1 1'; });
      inst.update = (local) => {
        const st = layerState(L, local, 'draw');
        nodes.forEach((n) => { n.style.strokeDashoffset = String(1 - st.draw); });
        apply(el, Object.assign(st, { draw: 1 }));
      };
    } else if (L.type === 'bow') {
      // geometric satin bow (sharp facets)
      const S = L.size || 360, gid = `bg_${scene.id}_${L._index}`;
      el.style.width = (S * 1.3) + 'px'; el.style.height = (S * 1.5) + 'px';
      const c1 = C(L.color) || '#C8102E', c0 = C(L.dark) || '#6E0A18', c2 = C(L.light) || '#F2475F';
      const P = (arr) => arr.map(([a, b]) => `${(a * S).toFixed(1)},${(b * S).toFixed(1)}`).join(' ');
      const o = S * 0.65; // origin x offset so that bow is centred in the box
      el.innerHTML = `<svg width="${S * 1.3}" height="${S * 1.5}" viewBox="${-o} ${-S * 0.4} ${S * 1.3} ${S * 1.5}" style="overflow:visible">` +
        `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset=".55" stop-color="${c1}"/><stop offset="1" stop-color="${c0}"/></linearGradient></defs>` +
        `<g transform="translate(0 ${S * 0.04})" fill="#2A0208" fill-opacity=".2"><polygon points="${P([[-0.10, 0], [-0.52, -0.30], [-0.60, 0.06], [-0.50, 0.34]])}"/><polygon points="${P([[0.10, 0], [0.52, -0.30], [0.60, 0.06], [0.50, 0.34]])}"/></g>` +
        `<polygon points="${P([[-0.07, 0.08], [0.04, 0.08], [-0.12, 0.84], [-0.22, 0.72], [-0.36, 0.84]])}" fill="${c0}"/>` +
        `<polygon points="${P([[0.07, 0.08], [-0.04, 0.08], [0.12, 0.84], [0.22, 0.72], [0.36, 0.84]])}" fill="${c1}"/>` +
        `<polygon points="${P([[-0.10, 0], [-0.52, -0.30], [-0.60, 0.06], [-0.50, 0.34]])}" fill="url(#${gid})"/>` +
        `<polygon points="${P([[0.10, 0], [0.52, -0.30], [0.60, 0.06], [0.50, 0.34]])}" fill="url(#${gid})"/>` +
        `<polygon points="${P([[-0.10, 0], [-0.52, -0.30], [-0.46, 0.00]])}" fill="#fff" fill-opacity=".28"/>` +
        `<polygon points="${P([[0.10, 0], [0.52, -0.30], [0.46, 0.00]])}" fill="#fff" fill-opacity=".18"/>` +
        `<polygon points="${P([[-0.12, -0.12], [0.12, -0.12], [0.15, -0.06], [0.15, 0.08], [0.12, 0.14], [-0.12, 0.14], [-0.15, 0.08], [-0.15, -0.06]])}" fill="${c1}" stroke="${c0}" stroke-width="3"/>` +
        `<polygon points="${P([[-0.12, -0.12], [0.12, -0.12], [0.0, -0.04]])}" fill="#fff" fill-opacity=".3"/></svg>`;
      inst.update = (local) => apply(el, layerState(L, local, 'pop'));
    } else if (L.type === 'polaroid') {
      const w = L.w || 640, h = w * 1.16;
      el.style.width = w + 'px'; el.style.height = h + 'px';
      const rot = L.rot ?? -4;
      const card = document.createElement('div');
      card.style.cssText = `position:absolute;inset:0;background:${C(L.paper) || '#FFFDF9'};transform:rotate(${rot}deg);` +
        `box-shadow:${w * 0.026}px ${w * 0.034}px 0 ${L.shadowColor || 'rgba(110,10,24,.30)'};`;
      const ph = document.createElement('div');
      ph.style.cssText = `position:absolute;left:5.5%;top:5.5%;width:89%;height:76.7%;overflow:hidden;background:${pal.accent2}`;
      let img = null;
      if (L.src) {
        img = document.createElement('img');
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;transform-origin:50% 50%';
        if (L.filter) img.style.filter = L.filter;
        img.src = L.src; pending.push(img.decode().catch(() => {}));
        ph.appendChild(img);
      } else if (L.fallback === 'art') {
        ph.dataset.illustration = '1';
        const pwid = w * 0.89, phei = w * 1.16 * 0.767;
        ph.innerHTML = `<svg width="${pwid}" height="${phei}" viewBox="0 0 ${pwid} ${phei}" style="display:block">${motifSvg(L.motifSeed || (L.x || 1) + (L.y || 1), pwid, phei, pal)}</svg>`;
      } else {
        ph.dataset.placeholder = '1';
        ph.style.background = `repeating-linear-gradient(45deg, ${pal.accent2} 0 22px, ${pal.bg} 22px 44px)`;
        const t = document.createElement('div');
        t.textContent = L.placeholder || 'صورتك هنا';
        t.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 ${w * 0.08}px ${PROJECT.fonts.display};color:${pal.accent}`;
        ph.appendChild(t);
      }
      card.appendChild(ph);
      if (L.caption) {
        const c = document.createElement('div');
        c.dir = 'rtl'; c.textContent = L.caption;
        c.style.cssText = `position:absolute;left:5%;right:5%;bottom:3.2%;height:12.5%;display:flex;align-items:center;justify-content:center;text-align:center;` +
          `font:${L.captionWeight || 700} ${w * (L.captionSize || 0.078)}px ${PROJECT.fonts[L.captionFont || 'script'] || PROJECT.fonts.display};color:${C(L.captionColor) || '#3A0A14'}`;
        card.appendChild(c);
      }
      if (L.tape !== false) {
        const tp = document.createElement('div');
        tp.style.cssText = `position:absolute;left:36%;top:-3.2%;width:28%;height:6.5%;background:${C(L.tapeColor) || pal.accent};opacity:.88;transform:rotate(${L.tapeRot ?? -5}deg);` +
          `clip-path:polygon(0 0,100% 0,96% 50%,100% 100%,0 100%,4% 50%)`;
        card.appendChild(tp);
      }
      el.appendChild(card);
      const kb = L.kenburns;
      inst.update = (local) => {
        if (img && kb) { const q = clamp(local / (scene.duration || 1)); img.style.transform = `scale(${(kb.from ?? 1) + ((kb.to ?? 1.1) - (kb.from ?? 1)) * q})`; }
        apply(el, layerState(L, local, 'settle'));
      };
    } else if (L.type === 'book' || L.type === 'prints' || L.type === 'invite') {
      const uid = `il_${scene.id}_${L._index}_`;
      const d = L.type === 'book' ? bookSvg(L, pal, uid) : L.type === 'prints' ? printsSvg(L, pal, uid) : inviteSvg(L, pal, uid);
      el.style.width = d.w + 'px'; el.style.height = d.h + 'px';
      el.innerHTML = `<svg width="${d.w}" height="${d.h}" viewBox="0 0 ${d.w} ${d.h}" style="overflow:visible">${d.svg}</svg>`;
      if (L.rot) el.style.transformOrigin = '50% 50%';
      inst.update = (local) => { const st = layerState(L, local, 'settle'); if (L.rot) st.r += L.rot; apply(el, st); };
    } else {
      throw new Error('unknown layer type: ' + L.type);
    }
    return inst;
  }

  // ---------- transitions ----------
  function applyTransition(sc, i, t) {
    const el = sc.el, T = sc.transitionIn;
    el.style.clipPath = 'none'; el.style.opacity = '1'; el.style.transform = 'none';
    const prev = scenes[i - 1];
    if (prev) prev.el.style.transform = 'none';
    sc.band.style.display = 'none'; sc.band.style.background = PROJECT.palette.accent;
    if (!T || T.type === 'none') return;
    const p = clamp((t - sc.start) / T.dur);
    if (p >= 1) return;
    const e = ease.inOutCubic(p);
    if (T.type === 'fade') { el.style.opacity = String(e); }
    else if (T.type === 'wipe') {
      const s = 24, xt = (100 + s) * (1 - e), xb = xt - s;
      el.style.clipPath = `polygon(${xt}% 0, 101% 0, 101% 100%, ${xb}% 100%)`;
      const bw = 5;
      sc.band.style.display = 'block';
      sc.band.style.clipPath = `polygon(${xt - bw}% 0, ${xt}% 0, ${xb}% 100%, ${xb - bw}% 100%)`;
    } else if (T.type === 'satin') {
      const s2 = 30, xt = (100 + s2) * (1 - e), xb = xt - s2, bw = 14;
      el.style.clipPath = `polygon(${xt}% 0, 101% 0, 101% 100%, ${xb}% 100%)`;
      sc.band.style.display = 'block';
      sc.band.style.background = 'linear-gradient(90deg,#6E0A18,#C8102E 35%,#F2475F 55%,#C8102E 75%,#6E0A18)';
      sc.band.style.clipPath = `polygon(${xt - bw}% 0, ${xt}% 0, ${xb}% 100%, ${xb - bw}% 100%)`;
    } else if (T.type === 'iris') {
      el.style.clipPath = `circle(${(e * Math.hypot(W, H) * 0.56).toFixed(1)}px at 50% 46%)`;
    } else if (T.type === 'slide') {
      el.style.transform = `translateX(${(1 - e) * W}px)`;
      if (prev) prev.el.style.transform = `translateX(${-e * W * 0.25}px)`;
    } else if (T.type === 'bars') {
      const n = 6, bw = W / n; let d = '';
      for (let k = 0; k < n; k++) {
        const kk = n - 1 - k; // first bar on the right (RTL)
        const pk = clamp((e * (1 + 0.5) - (k / n) * 0.5));
        const x = (n - 1 - k) * bw; d += `M${x} 0H${x + bw}V${H * pk}H${x}Z`;
      }
      el.style.clipPath = `path('${d}')`;
    }
  }

  async function initProject(project) {
    PROJECT = project;
    const stage = document.getElementById('stage');
    stage.innerHTML = '';
    stage.style.background = project.palette.bg;
    // fonts (real files with real weights)
    document.getElementById('fontfaces')?.remove();
    const style = document.createElement('style'); style.id = 'fontfaces';
    style.textContent = project.fontFaces.map((f) => `@font-face{font-family:'${f.family}';font-weight:${f.weight};src:url('${f.url}') format('woff2');unicode-range:${f.range || 'U+0000-10FFFF'};}`).join('\n');
    document.head.appendChild(style);
    await Promise.all(project.fontFaces.map((f) => document.fonts.load(`${f.weight} 40px '${f.family}'`, f.sample || 'ع A')));
    await document.fonts.ready;

    scenes = project.scenes.map((S, i) => {
      const el = document.createElement('div');
      el.className = 'scene'; el.style.zIndex = String((i + 1) * 10);
      stage.appendChild(el);
      const band = document.createElement('div');
      band.style.cssText = `position:absolute;inset:0;background:${project.palette.accent};display:none`;
      band.style.zIndex = String((i + 1) * 10 - 5); stage.appendChild(band);
      const sc = { ...S, el, band, layers: [] };
      S.layers.forEach((L) => sc.layers.push(buildLayer(L, el, S)));
      return sc;
    });
    await Promise.all(pending); pending = [];
    return true;
  }

  async function renderFrame(t, opts = {}) {
    scenes.forEach((sc, i) => {
      const local = t - sc.start;
      const vis = t >= sc.start - 1e-6 && t <= sc.end + 1e-6;
      sc.el.style.display = vis ? 'block' : 'none';
      if (!vis) { sc.band.style.display = 'none'; return; }
      applyTransition(sc, i, t);
      sc.layers.forEach((ly) => ly.update(local));
    });
    const dbg = document.getElementById('dbg');
    dbg.style.display = opts.debug ? 'block' : 'none';
    if (opts.debug) dbg.textContent = t.toFixed(2) + 's';
    await Promise.all(pending); pending = [];
    return true;
  }

  window.layerRect = (sceneId, li) => {
    const sc = scenes.find((x) => x.id === sceneId); const ly = sc && sc.layers[li];
    if (!ly) return null; const r = ly.el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const BACK = new Set(['art', 'fill', 'bgtext', 'rays', 'sparkles', 'ribbon', 'shape']); // full-stage layers: select from the list
  window.hitTest = (x, y) => {
    const hits = document.elementsFromPoint(x, y).map((e) => e.closest('.layer[data-li]')).filter(Boolean)
      .filter((e, i, a) => a.indexOf(e) === i && parseFloat(e.style.opacity || '1') > 0.05);
    const area = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
    const front = hits.filter((e) => !BACK.has(e.dataset.type)).sort((a, b) => area(a) - area(b));
    const pick = front[0] || hits[0];
    return pick ? { scene: pick.dataset.scene, li: Number(pick.dataset.li), type: pick.dataset.type } : null;
  };
  window.initProject = initProject;
  window.renderFrame = renderFrame;
})();
