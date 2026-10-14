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
  };
  const DEFAULT_EASE = { pop: 'outBack', draw: 'inOutCubic', slideR: 'outExpo', slideL: 'outExpo', rise: 'outExpo' };

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

  // ---------- layer builders ----------
  function buildLayer(L, sceneEl, scene) {
    const pal = PROJECT.palette;
    const el = document.createElement('div');
    place(el, L);
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
              `<polygon points="${poly}" transform="translate(${off},${off})" fill="${L.badgeShadowColor || pal.accent}"/>` +
              `<polygon points="${poly}" fill="${L.badge === true ? pal.bg : L.badge}" stroke="${L.color || pal.ink}" stroke-width="3"/></svg>`;
      }
      el.innerHTML = pre + L.svg;
      const s = el.querySelector('svg:last-of-type');
      s.setAttribute('width', size); s.setAttribute('height', size);
      s.setAttribute('stroke', L.color || pal.ink);
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
      sv.innerHTML = `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${L.fill || 'none'}" fill-opacity="${L.fillOpacity ?? 1}" stroke="${L.stroke || 'none'}" stroke-width="${L.strokeWidth || 0}"/>`;
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
          `color:${L.fill || 'transparent'};-webkit-text-stroke:${L.strokeWidth ?? 3}px ${L.color || pal.ink};opacity:${L.opacity ?? 0.13};top:${(L.y ?? 120) + i * size * (L.gap ?? 1.15)}px`;
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
      const fam = L.font === 'body' ? PROJECT.fonts.body : PROJECT.fonts.display;
      const accent = L.keyColor || pal.accent;
      const box = document.createElement('div');
      box.className = 'txt';
      box.dir = hasArabic(L.text) ? 'rtl' : 'ltr';
      box.style.cssText = `font-family:${fam};font-weight:${L.weight || 800};font-size:${size}px;line-height:${L.lh || 1.45};` +
        `color:${L.color || pal.ink};text-align:${L.align || (box.dir === 'rtl' ? 'right' : 'left')};` +
        (L.shadow ? `text-shadow:${L.shadow};` : '') + (L.tracking ? `letter-spacing:${L.tracking}px;` : '');
      const words = [];
      const toks = L.text.split(/(\s+)/);
      let keyOn = false;
      toks.forEach((tk) => {
        if (/^\s+$/.test(tk)) { box.appendChild(document.createTextNode(tk.includes('\n') ? '\n' : ' ')); return; }
        if (!tk) return;
        let t = tk, start = false, end = false;
        if (t.startsWith('*')) { keyOn = true; t = t.slice(1); start = true; }
        if (t.endsWith('*')) { end = true; t = t.slice(0, -1); }
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
    sc.band.style.display = 'none';
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
    const style = document.createElement('style');
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

  window.initProject = initProject;
  window.renderFrame = renderFrame;
})();
