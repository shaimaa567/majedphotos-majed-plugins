// Composition engine: turns a beat (role + Arabic copy) into engine layers.
// 18 visual compositions; the selector never repeats one in a plan unless forced, alternates milk/red tone,
// varies motion language (word reveal, icon/polaroid entrance, rays direction, polaroid side) scene to scene,
// and keeps art/icon/asset/text unique across the project (the validator's "no repetition" rule).
import { plain, keywordOf } from './copy.mjs';
import { OCCASIONS, PRODUCTS } from './analyze.mjs';

const W = 1080;
const MILK = '#FBF4EC';
const RED_BG = 'linear-gradient(165deg,#C8102E 0%,#8E0B20 100%)';
const WORD_IN = ['blur', 'rise', 'pop', 'slideR', 'scale', 'drop'];
const ICON_IN = ['draw', 'pop', 'flip', 'scale'];
const POL_IN = ['settle', 'slideR', 'flip', 'pop', 'rise'];
const ART_STYLES = ['lattice', 'frames', 'rings', 'lines', 'bands', 'grid', 'shards'];

// ---------- text fitting (calibrated against real renders: Kufi 800 ≈ 0.56em/char) ----------
export function wrapLines(text, size, w, weight = 800) {
  const cw = size * (weight >= 800 ? 0.56 : 0.5), space = size * 0.26;
  let lines = 1, cur = 0;
  for (const wd of plain(text).split(/\s+/).filter(Boolean)) {
    const ww = [...wd].length * cw;
    if (cur > 0 && cur + space + ww > w) { lines++; cur = ww; } else cur += (cur ? space : 0) + ww;
  }
  return lines;
}
export function fit(text, { w = 900, max = 96, min = 52, maxLines = 3, weight = 800 } = {}) {
  let size = max;
  while (size > min && wrapLines(text, size, w, weight) > maxLines) size -= 4;
  return { size, lines: wrapLines(text, size, w, weight) };
}

// ---------- scene-building context ----------
export function makeCtx({ rng, beat, analysis, used, freeAssets, prev, tone }) {
  const c = {
    rng, beat, a: analysis, used, tone,
    side: prev.side === 'r' ? 'l' : 'r',
    dir: prev.dir === 1 ? -1 : 1,
    m: {
      wordIn: pickOther(rng, WORD_IN, prev.wordIn),
      iconIn: pickOther(rng, ICON_IN, prev.iconIn),
      polIn: pickOther(rng, POL_IN, prev.polIn),
      stagger: [0.1, 0.13, 0.16, 0.19][rng.int(4)],
    },
    slots: [],
    freeAssets: [...freeAssets],
  };
  c.art = (prefer = ART_STYLES) => {
    const pool = prefer.filter((s) => s !== prev.art);
    const list = rng.shuffle(pool.length ? pool : prefer);
    for (const style of list) {
      for (let tries = 0; tries < 30; tries++) {
        const seed = rng.int(9000) + 1;
        if (!used.art.has(`${style}:${seed}`)) { used.art.add(`${style}:${seed}`); c.artStyle = style; return { type: 'art', style, seed }; }
      }
    }
    return { type: 'art', style: 'shards', seed: rng.int(9000) + 1 };
  };
  c.icon = (...hints) => {
    const pool = [...hints.flat().filter(Boolean), 'star', 'heart', 'gift', 'camera', 'sparkles', 'frame', 'palette', 'scissors', 'link', 'crown', 'gem', 'smile', 'flower', 'cake'];
    const n = pool.find((x) => !used.icons.has(x)) || 'star';
    used.icons.add(n); return n;
  };
  c.sparkles = (o = {}) => ({ type: 'sparkles', seed: rng.int(9000) + 1, count: o.count ?? 12, region: o.region, colors: o.colors, size: o.size, at: o.at ?? 0.9 });
  c.photo = (kind = 'moment') => {
    const key = `${beat.id}-${c.slots.length + 1}`;
    const asset = c.freeAssets.shift();
    const d = slotInfo(kind, analysis);
    c.slots.push({ key, kind, ...d, asset: asset || null });
    return { slot: key, fallback: 'art', motifSeed: rng.int(900) + 1, ...(asset ? { asset } : {}) };
  };
  return c;
}
function pickOther(rng, arr, prevVal) { const o = arr.filter((x) => x !== prevVal); return rng.pick(o.length ? o : arr); }

export function slotInfo(kind, a) {
  const O = a.occasion ? OCCASIONS[a.occasion] : null;
  const K = {
    moment: [O ? O.moment : 'لقطة عفوية لمناسبة عزيزة', O ? O.momentEn : 'a candid warm family moment'],
    cover: ['غلاف كتاب الذكريات وعليه شريط ساتان أحمر', 'a printed memory book cover tied with a red satin ribbon'],
    book: ['كتاب ذكريات مفتوح على صفحتين مليئتين بالصور', 'an open photo memory book spread'],
    gift: ['كتاب مغلّف بشريط ساتان أحمر كهدية', 'a gift-wrapped memory book with red satin ribbon'],
    closeup: ['لقطة قريبة لصور مطبوعة بجودة عالية', 'close-up of high quality printed photographs'],
    invite: ['دعوة مطبوعة أنيقة', 'an elegant printed invitation card'],
    prints: ['صور مطبوعة متناثرة على طاولة', 'scattered printed photographs on a table'],
  }[kind] || ['صورة تعبّر عن المشهد', 'an image expressing the scene'];
  return {
    desc: K[0],
    prompt: `${K[0]}. إضاءة ناعمة دافئة، خلفية بيضاء حليبية، لمسات حمراء ساتانية، تكوين عمودي، بدون نصوص أو شعارات.`,
    promptEn: `${K[1]}, soft warm light, milk-white background, deep red satin accents, vertical composition, no text, no logos, photorealistic`,
  };
}

// ---------- layer helpers ----------
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));
function T(c, text, o = {}) {
  const w = o.w ?? 900, x = o.x ?? (W - w) / 2;
  const f = fit(text, { w, max: o.max ?? 96, min: o.min ?? 52, maxLines: o.maxLines ?? 3, weight: o.weight ?? 800 });
  const lh = o.lh ?? 1.45, h = f.lines * f.size * lh;
  const layer = clean({ type: 'text', text, x, y: Math.round(o.y), w, size: f.size, align: o.align ?? 'center', at: o.at ?? 0.6, stagger: o.stagger ?? c.m.stagger,
    wordIn: o.wordIn ?? c.m.wordIn, font: o.font, weight: o.weight, color: o.color, keyColor: o.keyColor, keyShadow: o.keyShadow, lh: o.lh });
  return { layer, h, bottom: o.y + h, size: f.size, lines: f.lines };
}
function S(c, text, o = {}) {
  const layer = clean({ type: 'text', text, font: o.font ?? 'body', weight: o.weight ?? 500, x: o.x ?? 110, y: Math.round(o.y), w: o.w ?? 860, size: o.size ?? 52, align: o.align ?? 'center',
    color: o.color ?? 'muted', reveal: 'block', in: o.in ?? 'rise', at: o.at ?? 1.8 });
  const lines = wrapLines(text, layer.size, layer.w, layer.weight);
  return { layer, h: lines * layer.size * 1.45, bottom: o.y + lines * layer.size * 1.45 };
}
const rays = (cx, cy, o = {}) => clean({ type: 'rays', cx, cy, count: o.count ?? 16, color: o.color ?? 'accent', opacity: o.opacity ?? 0.26, speed: o.speed ?? 3, at: o.at ?? 0, dur: 1.2 });
const ribbon = (shape, y, o = {}) => clean({ type: 'ribbon', shape, y, width: o.width ?? 58, at: o.at ?? 1.4, dur: o.dur ?? 1.1, color: o.color, light: o.light, dark: o.dark });
const badge = (c, name, x, y, o = {}) => clean({ type: 'icon', name, size: o.size ?? 140, x, y, badge: true, in: o.in ?? c.m.iconIn, dur: 0.9, at: o.at ?? 0.3, color: o.color, stroke: o.stroke });
const bow = (size, x, y, o = {}) => clean({ type: 'bow', size, x: Math.round(x ?? (W - size * 1.3) / 2), y, at: o.at ?? 0.3, color: o.color, dark: o.dark, light: o.light });
const redFill = () => ({ type: 'fill', gradient: RED_BG });
const keyWord = (copy) => { const k = keywordOf(copy.headline); return k ? plain(k).replace(/[.,،؟?!…]+$/, '') : plain(copy.headline).split(/\s+/)[0]; };

// ---------- compositions ----------
// each returns layers[]; c.slots is filled through c.photo()
const COMP = {};
const def = (id, o) => { COMP[id] = { id, ...o }; };

def('hero-polaroid', { label: 'إطار Polaroid كبير مع أشعة', roles: ['hook'], tone: 'milk', family: 'photo', build(c) {
  const copy = c.beat.copy, pw = 660, L = [];
  L.push(c.art(['lattice', 'frames', 'rings']));
  L.push(rays(540, 240, { speed: c.dir * 3 }));
  L.push(clean({ type: 'polaroid', x: Math.round((W - pw) / 2 + (c.side === 'r' ? 36 : -36)), y: 290, w: pw, rot: c.side === 'r' ? 5 : -5, caption: copy.caption, ...c.photo(c.beat.slotKind || 'moment'), in: c.m.polIn, at: 0.3 }));
  L.push(c.sparkles({ region: { x: 40, y: 240, w: 1000, h: 800 }, at: 1.0 }));
  const t = T(c, copy.headline, { y: 1100, max: 96, maxLines: 3, at: 1.2 }); L.push(t.layer);
  if (copy.sub) L.push(S(c, copy.sub, { y: t.bottom + 10, at: 2.2 }).layer);
  L.push(ribbon(c.rng.pick(['sweep', 'wave']), 1640, { at: 1.7, width: 52 }));
  return L;
}, why: (a) => `إطار Polaroid كبير لأن الافتتاح يحتاج صورة عاطفية${a.occasion ? ' من ' + OCCASIONS[a.occasion].label : ''}`, });

def('giant-type', { label: 'طباعة ضخمة متحركة', roles: ['hook', 'about'], tone: 'milk', family: 'type', build(c) {
  const copy = c.beat.copy, L = [];
  L.push(c.art(['lines', 'grid', 'bands']));
  L.push({ type: 'bgtext', text: keyWord(copy), rows: 3, size: 470, y: 250, opacity: 0.1, speed: c.dir * 60 });
  L.push(badge(c, c.icon(c.beat.iconHint), c.side === 'r' ? 810 : 150, 330, { size: 120 }));
  const t = T(c, copy.headline, { x: 90, w: 900, y: 560, max: 124, maxLines: 4, align: c.side === 'r' ? 'right' : 'left', at: 0.5 }); L.push(t.layer);
  if (copy.sub) L.push(S(c, copy.sub, { y: t.bottom + 20, align: c.side === 'r' ? 'right' : 'left', x: 90, w: 900, at: 1.8 }).layer);
  L.push(ribbon('diagonal', 1580, { at: 1.3, width: 62 }));
  L.push(c.sparkles({ region: { x: 80, y: 1100, w: 920, h: 400 }, count: 9, at: 1.4 }));
  return L;
}, why: () => 'طباعة ضخمة لأن الفكرة قصيرة وقوية وتستحق أن تُقرأ قبل أي صورة', });

def('book-hero-dark', { label: 'كتاب مغلق على خلفية حمراء', roles: ['hook', 'reveal'], tone: 'red', family: 'book', when: (a) => ['memory_book', 'album', 'gift'].includes(a.product), build(c) {
  const copy = c.beat.copy, L = [], bw = 480, bx = Math.round((W - bw * 1.08) / 2);
  L.push(redFill());
  L.push(rays(540, 700, { color: '#FFFFFF', opacity: 0.26, speed: c.dir * 4, count: 20 }));
  L.push(c.sparkles({ colors: ['#FFFFFF', '#FBF4EC', '#F6CFD2'], region: { x: 40, y: 230, w: 1000, h: 780 }, at: 0.8, count: 14 }));
  L.push({ type: 'book', variant: 'closed', cover: 'milk', w: bw, x: bx, y: 280, seed: c.rng.int(90) + 1, at: 0.3, in: c.rng.pick(['settle', 'pop', 'rise']) });
  const t = T(c, copy.headline, { y: 1060, max: 92, maxLines: 3, color: MILK, keyColor: '#FFFFFF', keyShadow: false, at: 1.1 }); L.push(t.layer);
  if (copy.sub) L.push(S(c, copy.sub, { y: t.bottom + 12, color: '#F6CFD2', at: 2.0 }).layer);
  return L;
}, why: () => 'كتاب على خلفية حمراء عميقة لإبراز المنتج بلمسة فاخرة', });

def('card-quote', { label: 'بطاقة بيضاء بفيونكة', roles: ['hook', 'emotion', 'about'], tone: 'milk', family: 'card', build(c) {
  const copy = c.beat.copy, L = [];
  L.push(c.art(['lattice', 'grid', 'lines']));
  L.push({ type: 'shape', kind: 'rect', rx: 112, ry: 466, rw: 880, rh: 700, fill: 'accent2', at: 0.2, dur: 0.6, in: 'wipe' });
  L.push({ type: 'shape', kind: 'rect', rx: 90, ry: 440, rw: 880, rh: 700, fill: '#FFFDF9', stroke: 'accent', strokeWidth: 3, at: 0.1, dur: 0.6, in: 'wipe' });
  L.push(bow(170, undefined, 330, { at: 0.8 }));
  const t = T(c, copy.headline, { x: 150, w: 780, y: 640, max: 88, min: 56, maxLines: 4, at: 1.0 }); L.push(t.layer);
  if (copy.sub) L.push(S(c, copy.sub, { x: 150, w: 780, y: Math.min(t.bottom + 18, 1010), size: 46, at: 2.0 }).layer);
  L.push(c.sparkles({ at: 1.4, count: 8, region: { x: 40, y: 250, w: 1000, h: 170 } }));
  L.push(c.sparkles({ at: 1.6, count: 6, region: { x: 40, y: 1180, w: 1000, h: 250 } }));
  return L;
}, why: (a, b) => (b.copy.question ? 'بطاقة بيضاء لأن الافتتاح سؤال يحتاج مساحة هادئة' : 'بطاقة بيضاء بفيونكة لتركيز النظر على الجملة'), });

def('photo-strip', { label: 'ثلاث صور Polaroid متداخلة', roles: ['emotion', 'occasion'], tone: 'milk', family: 'photo', build(c) {
  const copy = c.beat.copy, L = [];
  L.push(c.art(['frames', 'rings', 'lattice']));
  const m = c.m.polIn, k = c.beat.slotKind || 'moment';
  L.push(clean({ type: 'polaroid', x: 40, y: 380, w: 470, rot: -9, caption: copy.caption, ...c.photo(k), in: m, at: 0.2 }));
  L.push(clean({ type: 'polaroid', x: 570, y: 340, w: 470, rot: 7, ...c.photo(k), in: m, at: 0.45 }));
  L.push(clean({ type: 'polaroid', x: 290, y: 600, w: 500, rot: -2, ...c.photo(k), in: m, at: 0.7 }));
  L.push(c.sparkles({ at: 1.3, count: 10, region: { x: 40, y: 280, w: 1000, h: 940 } }));
  const t = T(c, copy.headline, { y: 1220, max: 72, min: 54, maxLines: 2, at: 1.2 }); L.push(t.layer);
  if (copy.sub && t.bottom < 1400) L.push(S(c, copy.sub, { y: t.bottom + 4, size: 44, at: 2.1 }).layer);
  return L;
}, why: () => 'ثلاث صور متداخلة لأن اللحظة العاطفية تُحكى بأكثر من لقطة', });

def('prints-text', { label: 'مطبوعات متناثرة', roles: ['emotion', 'reveal', 'feature'], tone: 'milk', family: 'prints', build(c) {
  const copy = c.beat.copy, L = [];
  L.push(c.art(['lines', 'bands', 'frames']));
  L.push(rays(540, 560, { opacity: 0.18, speed: c.dir * 2, count: 14 }));
  L.push({ type: 'prints', count: 3, w: 380, x: 100, y: 300, seed: c.rng.int(90) + 1, at: 0.3, in: c.m.polIn });
  const t = T(c, copy.headline, { y: 1010, max: 92, maxLines: 3, at: 1.1 }); L.push(t.layer);
  if (copy.sub) L.push(S(c, copy.sub, { y: t.bottom + 12, at: 2.0 }).layer);
  L.push(ribbon('wave', 1640, { at: 1.6, width: 48 }));
  return L;
}, why: () => 'مطبوعات مرسومة بأسلوب البراند لإظهار فكرة الصور المطبوعة دون الحاجة لصور حقيقية', });

def('poem', { label: 'نص شعري بخط الرقعة', roles: ['emotion', 'hook'], tone: 'milk', family: 'type', build(c) {
  const copy = c.beat.copy, L = [];
  L.push(c.art(['bands', 'frames', 'lattice']));
  L.push(badge(c, c.icon(c.beat.iconHint, 'heart'), 810, 300, { size: 110 }));
  const t = T(c, copy.headline, { x: 110, w: 860, y: 520, max: 104, maxLines: 4, align: 'right', at: 0.6 }); L.push(t.layer);
  if (copy.sub) L.push(S(c, copy.sub, { x: 110, w: 860, y: t.bottom + 26, size: 58, font: 'script', weight: 700, color: 'accent', align: 'right', at: 2.0 }).layer);
  L.push(ribbon('wave', 1560, { at: 1.5, width: 50 }));
  L.push(c.sparkles({ at: 1.2, count: 12, region: { x: 40, y: 1080, w: 1000, h: 420 } }));
  return L;
}, why: () => 'نص شعري بخط الرقعة لأن اللحظة عاطفية وتحتاج هدوءًا لا صخبًا', });

def('book-open-hero', { label: 'كتاب مفتوح بصفحات مصوّرة', roles: ['reveal', 'feature'], tone: 'milk', family: 'book', when: (a) => ['memory_book', 'album', 'gift'].includes(a.product), build(c) {
  const copy = c.beat.copy, L = [];
  L.push(c.art(['lattice', 'grid']));
  L.push(rays(540, 650, { opacity: 0.22, speed: c.dir * 3, count: 18 }));
  L.push({ type: 'book', variant: 'open', w: 900, x: 90, y: 340, seed: c.rng.int(90) + 1, at: 0.3, in: c.rng.pick(['settle', 'rise', 'pop']) });
  L.push(bow(190, c.side === 'r' ? 790 : 60, 250, { at: 1.0 }));
  const t = T(c, copy.headline, { y: 1090, max: 92, maxLines: 3, at: 1.1 }); L.push(t.layer);
  if (copy.sub) L.push(S(c, copy.sub, { y: t.bottom + 12, at: 2.0 }).layer);
  L.push(c.sparkles({ at: 1.5, count: 10, region: { x: 60, y: 300, w: 960, h: 700 } }));
  return L;
}, why: () => 'كتاب مفتوح بصفحات مصوّرة لتقريب فكرة المنتج من المشاهد', });

def('split-diagonal', { label: 'قطع قطري أحمر مع Polaroid', roles: ['reveal', 'feature', 'about'], tone: 'red', family: 'photo', build(c) {
  const copy = c.beat.copy, L = [];
  L.push({ type: 'fill', color: 'bg' });
  L.push({ type: 'shape', kind: 'poly', points: [[0, 0], [1080, 0], [1080, 860], [0, 1100]], fill: 'accent', at: 0.1, dur: 0.7, in: 'wipe' });
  L.push(rays(1000, 80, { color: '#FFFFFF', opacity: 0.22, speed: c.dir * 3, count: 14, at: 0.3 }));
  const t0 = T(c, copy.headline, { x: 90, w: 900, y: 0, max: 108, maxLines: 3, align: 'right', color: MILK, keyColor: '#FFFFFF', keyShadow: false, at: 0.8 });
  const t = T(c, copy.headline, { x: 90, w: 900, y: Math.max(300, 520 - t0.h / 2), max: 108, maxLines: 3, align: 'right', color: MILK, keyColor: '#FFFFFF', keyShadow: false, at: 0.8 }); L.push(t.layer);
  L.push(clean({ type: 'polaroid', x: c.side === 'r' ? 560 : 70, y: 960, w: 440, rot: c.side === 'r' ? 6 : -6, caption: copy.caption, ...c.photo(c.beat.slotKind || 'moment'), in: c.m.polIn, at: 1.0 }));
  if (copy.sub) L.push(S(c, copy.sub, { x: c.side === 'r' ? 70 : 560, w: 450, y: 1190, size: 50, color: 'ink', align: 'right', at: 1.9 }).layer);
  L.push(c.sparkles({ at: 1.4, count: 9, region: { x: 60, y: 900, w: 960, h: 500 } }));
  return L;
}, why: () => 'قطع قطري أحمر يفصل العنوان عن الصورة ويعطي ديناميكية للكشف', });

def('icon-hero', { label: 'أيقونة كبيرة مع عنوان', roles: ['feature', 'reveal', 'steps', 'occasion'], tone: 'milk', family: 'icon', build(c) {
  const copy = c.beat.copy, L = [];
  L.push(c.art(['rings', 'lattice', 'grid', 'bands']));
  if (c.rng() < 0.6) L.push(rays(540, 520, { opacity: 0.18, speed: c.dir * 2, count: 14 }));
  const sz = c.rng.pick([150, 170]);
  L.push(badge(c, c.icon(c.beat.iconHint), Math.round((W - sz) / 2), 400, { size: sz, at: 0.3 }));
  const t = T(c, copy.headline, { y: 400 + sz + 130, max: 100, maxLines: 3, at: 0.9 }); L.push(t.layer);
  if (copy.sub) L.push(S(c, copy.sub, { y: t.bottom + 16, at: 2.0 }).layer);
  if (c.rng() < 0.5) L.push(ribbon(c.rng.pick(['wave', 'sweep']), 1600, { at: 1.5, width: 50 }));
  return L;
}, why: (a, b) => `أيقونة كبيرة لإبراز ميزة واحدة بوضوح${b.featureKey ? '' : ''}`, });

def('icon-list', { label: 'قائمة بأيقونات (يمين ← يسار)', roles: ['steps', 'services', 'occasion', 'feature'], tone: 'milk', family: 'list', needsItems: true, build(c) {
  const copy = c.beat.copy, L = [], items = copy.items || [plain(copy.headline)];
  L.push(c.art(['lattice', 'lines', 'frames']));
  const t = T(c, copy.headline, { y: 290, max: 100, maxLines: 2, at: 0.2 }); L.push(t.layer);
  const n = items.length, step = n >= 4 ? 250 : 290, y0 = 560;
  items.forEach((it, i) => {
    const y = y0 + i * step, at = 0.9 + i * 0.55;
    L.push(badge(c, c.icon(copy.itemIcons?.[i]), 800, y, { size: 110, at, in: c.m.iconIn }));
    const f = fit(it, { w: 650, max: 62, min: 46, maxLines: 2, weight: 700 });
    L.push(clean({ type: 'text', text: it, x: 90, y: Math.round(y + (110 - f.lines * f.size * 1.45) / 2), w: 650, size: f.size, align: 'right', weight: 700, at: at + 0.15, stagger: 0.1, wordIn: i % 2 ? 'rise' : 'slideR' }));
  });
  L.push(c.sparkles({ at: 1.5, count: 8, region: { x: 60, y: 1400, w: 960, h: 200 } }));
  return L;
}, why: (a, b) => (b.role === 'steps' ? 'قائمة مرقّمة بالأيقونات تُقرأ من اليمين لليسار لتوضيح الخطوات' : 'قائمة بأيقونات لعرض عناصر متعددة في مشهد واحد'), });

def('split-polaroid', { label: 'صورة جانبية ونص مقابل', roles: ['feature', 'reveal', 'occasion'], tone: 'milk', family: 'photo', build(c) {
  const copy = c.beat.copy, L = [], left = c.side === 'l';
  L.push(c.art(['bands', 'frames', 'lattice']));
  L.push(clean({ type: 'polaroid', x: left ? 50 : 560, y: 470, w: 470, rot: left ? -6 : 6, ...c.photo(c.beat.slotKind || 'moment'), in: c.m.polIn, at: 0.3 }));
  const tx = left ? 560 : 50;
  L.push(badge(c, c.icon(c.beat.iconHint), tx + 470 - 140, 440, { size: 110, at: 0.8 }));
  const t = T(c, copy.headline, { x: tx, w: 470, y: 640, max: 76, min: 54, maxLines: 4, align: 'right', at: 1.0 }); L.push(t.layer);
  if (copy.sub) L.push(S(c, copy.sub, { x: tx, w: 470, y: t.bottom + 14, size: 44, align: 'right', at: 2.0 }).layer);
  L.push(ribbon('diagonal', 1600, { at: 1.4, width: 56 }));
  return L;
}, why: () => 'صورة على جانب ونص على الجانب المقابل لتنويع التكوين وإعطاء الميزة سياقًا بصريًا', });

def('big-word', { label: 'كلمة مفتاحية ضخمة', roles: ['feature', 'about'], tone: 'milk', family: 'type', needsKeyword: true, build(c) {
  const copy = c.beat.copy, L = [], kw = keyWord(copy);
  L.push(c.art(['grid', 'rings', 'lines']));
  L.push(rays(540, 640, { opacity: 0.2, speed: c.dir * 3, count: 18 }));
  const big = T(c, `*${kw}*`, { y: 430, max: 330, min: 150, maxLines: 1, weight: 900, wordIn: 'pop', at: 0.3, lh: 1.2, keyShadow: false }); L.push(big.layer);
  L.push(badge(c, c.icon(c.beat.iconHint), Math.round((W - 100) / 2), 330 + 0, { size: 100, at: 0.2 }));
  const rest = plain(copy.headline);
  const t = T(c, rest, { y: 430 + big.size * 1.2 + 70, max: 68, min: 50, maxLines: 2, weight: 700, at: 1.0 }); L.push(t.layer);
  if (copy.sub) L.push(S(c, copy.sub, { y: t.bottom + 12, at: 1.9 }).layer);
  L.push(c.sparkles({ at: 1.3, count: 10, region: { x: 40, y: 1240, w: 1000, h: 260 } }));
  return L;
}, why: () => 'كلمة مفتاحية ضخمة لأن الميزة تُختصر في كلمة واحدة', });

def('offer-burst', { label: 'عرض بأشعة على الأحمر', roles: ['offer'], tone: 'red', family: 'offer', build(c) {
  const copy = c.beat.copy, L = [];
  L.push(redFill());
  L.push(rays(540, 640, { color: '#FFFFFF', opacity: 0.3, speed: c.dir * 5, count: 22 }));
  L.push(T(c, copy.pre || '', { y: 330, max: 88, maxLines: 1, color: MILK, weight: 700, at: 0.3 }).layer);
  const num = T(c, copy.number || plain(copy.headline), { y: 440, max: 340, min: 140, maxLines: 1, weight: 900, color: MILK, font: 'display', wordIn: 'pop', at: 0.6, lh: 1.15 }); L.push(num.layer);
  let y = 440 + num.size * 1.15 + 10;
  if (copy.post) { const p = T(c, copy.post, { y, max: 96, maxLines: 1, color: MILK, weight: 700, at: 1.0 }); L.push(p.layer); y = p.bottom + 10; }
  if (copy.sub) L.push(S(c, copy.sub, { y: y + 10, color: '#F6CFD2', at: 1.8 }).layer);
  L.push(bow(200, undefined, 1340, { color: '#FBF4EC', dark: '#E8CFC4', light: '#FFFFFF', at: 1.4 }));
  L.push(c.sparkles({ colors: ['#FFFFFF', '#FBF4EC'], at: 1.0, count: 10, region: { x: 40, y: 230, w: 1000, h: 130 } }));
  return L;
}, why: () => 'رقم العرض ضخم على الأحمر ليُقرأ في ثانية واحدة', });

def('big-number', { label: 'رقم العرض على الأبيض', roles: ['offer'], tone: 'milk', family: 'offer', build(c) {
  const copy = c.beat.copy, L = [];
  L.push(c.art(['rings', 'lattice']));
  L.push(T(c, copy.pre || '', { y: 330, max: 88, maxLines: 1, weight: 700, at: 0.2 }).layer);
  const num = T(c, copy.number || plain(copy.headline), { y: 440, max: 340, min: 140, maxLines: 1, weight: 900, color: 'accent', font: 'display', wordIn: 'pop', at: 0.5, lh: 1.15 }); L.push(num.layer);
  let y = 440 + num.size * 1.15 + 10;
  if (copy.post) { const p = T(c, copy.post, { y, max: 96, maxLines: 1, weight: 700, at: 0.9 }); L.push(p.layer); y = p.bottom + 10; }
  if (copy.sub) L.push(S(c, copy.sub, { y: y + 10, at: 1.7 }).layer);
  L.push(ribbon('sweep', 1560, { at: 1.3 }));
  L.push(c.sparkles({ at: 1.0, count: 8, region: { x: 40, y: 230, w: 1000, h: 130 } }));
  return L;
}, why: () => 'رقم العرض باللون الأحمر على خلفية هادئة', });

def('cta-bow', { label: 'فيونكة واسم البراند على الأحمر', roles: ['cta'], tone: 'red', family: 'cta', build(c) {
  const copy = c.beat.copy, L = [];
  L.push(redFill());
  L.push(rays(540, 640, { color: '#FFFFFF', opacity: 0.28, speed: c.dir * 4, count: 20 }));
  L.push(c.sparkles({ colors: ['#FFFFFF', '#FBF4EC', '#F6CFD2'], at: 0.6, count: 14, region: { x: 40, y: 230, w: 1000, h: 560 } }));
  L.push(bow(290, undefined, 320, { color: '#FBF4EC', dark: '#E8CFC4', light: '#FFFFFF', at: 0.3 }));
  L.push(T(c, copy.brand || 'Ms. Memories', { y: 830, max: 104, maxLines: 1, color: MILK, font: 'display', at: 1.0 }).layer);
  const t = T(c, copy.headline, { y: 990, max: 82, maxLines: 2, color: MILK, weight: 700, font: 'body', keyColor: '#FFFFFF', keyShadow: false, at: 1.6 }); L.push(t.layer);
  if (copy.sub) L.push(S(c, copy.sub, { y: t.bottom + 12, color: '#F6CFD2', at: 2.4 }).layer);
  return L;
}, why: () => 'فيونكة بيضاء على الأحمر العميق في الختام لترسيخ هوية البراند', });

def('cta-polaroid', { label: 'Polaroid وشريط ساتان للختام', roles: ['cta'], tone: 'milk', family: 'photo', build(c) {
  const copy = c.beat.copy, L = [];
  L.push(c.art(['frames', 'lattice']));
  L.push(rays(540, 260, { opacity: 0.22, speed: c.dir * 3 }));
  L.push(clean({ type: 'polaroid', x: Math.round((W - 520) / 2), y: 280, w: 520, rot: c.side === 'r' ? 4 : -4, caption: 'ذكرى لا تُنسى', ...c.photo('cover'), in: c.m.polIn, at: 0.3 }));
  L.push(ribbon('sweep', 1500, { at: 1.2, width: 54 }));
  const t = T(c, copy.headline, { y: 960, max: 86, maxLines: 2, at: 1.2 }); L.push(t.layer);
  if (copy.sub) L.push(S(c, copy.sub, { y: t.bottom + 10, at: 2.1 }).layer);
  L.push(T(c, copy.brand || 'Ms. Memories', { y: Math.max(t.bottom + 90, 1210), max: 64, maxLines: 1, color: 'accent', font: 'display', at: 2.5 }).layer);
  L.push(c.sparkles({ at: 1.3, count: 10, region: { x: 40, y: 240, w: 1000, h: 700 } }));
  return L;
}, why: () => 'Polaroid وشريط ساتان في الختام للحفاظ على دفء الهوية', });

def('invite-hero', { label: 'بطاقة دعوة مرسومة', roles: ['reveal', 'hook'], tone: 'milk', family: 'invite', when: (a) => ['invitation', 'e_invite'].includes(a.product), build(c) {
  const copy = c.beat.copy, L = [];
  L.push(c.art(['frames', 'lattice']));
  L.push(rays(540, 640, { opacity: 0.18, speed: c.dir * 2 }));
  L.push({ type: 'invite', w: 520, x: Math.round((W - 520 * 1.08) / 2), y: 290, at: 0.3, in: c.rng.pick(['settle', 'rise', 'pop']) });
  L.push(bow(170, c.side === 'r' ? 760 : 90, 270, { at: 1.0 }));
  const t = T(c, copy.headline, { y: 1130, max: 88, maxLines: 2, at: 1.1 }); L.push(t.layer);
  if (copy.sub) L.push(S(c, copy.sub, { y: t.bottom + 12, at: 2.0 }).layer);
  L.push(c.sparkles({ at: 1.4, count: 10, region: { x: 40, y: 250, w: 1000, h: 800 } }));
  return L;
}, why: () => 'بطاقة دعوة مرسومة لأن المنتج دعوات المناسبات', });

export const COMPOSITIONS = COMP;

// ---------- selection ----------
const CANDIDATES = {
  hook: ['hero-polaroid', 'giant-type', 'book-hero-dark', 'card-quote', 'poem', 'invite-hero'],
  emotion: ['photo-strip', 'prints-text', 'poem', 'card-quote'],
  reveal: ['book-open-hero', 'book-hero-dark', 'split-diagonal', 'invite-hero', 'prints-text', 'icon-hero', 'split-polaroid'],
  feature: ['icon-hero', 'split-polaroid', 'big-word', 'prints-text', 'split-diagonal', 'book-open-hero'],
  steps: ['icon-list', 'icon-hero'],
  services: ['icon-list'],
  occasion: ['icon-list', 'photo-strip', 'split-polaroid'],
  about: ['giant-type', 'card-quote', 'split-diagonal', 'big-word'],
  offer: ['offer-burst', 'big-number'],
  cta: ['cta-bow', 'cta-polaroid'],
};

export function chooseComposition(role, a, beat, { rng, usedComps, prevTone, prev2Tone, prevFamily, prevComp, force = null, exclude = [] }) {
  if (force && COMP[force]) return force;
  const cands = (CANDIDATES[role] || ['icon-hero']).filter((id) => !exclude.includes(id)).filter((id) => {
    const c = COMP[id];
    if (c.when && !c.when(a)) return false;
    if (c.needsItems && !beat.copy.items && role !== 'feature') return false;
    if (c.needsItems && role === 'feature' && !beat.copy.items) return false;
    if (c.needsKeyword && !keywordOf(beat.copy.headline)) return false;
    if (c.id === 'card-quote' && role === 'hook' && !(beat.copy.question || plain(beat.copy.headline).split(/\s+/).length <= 6)) return false;
    return true;
  });
  const pool = cands.length ? cands : ['icon-hero'];
  let best = null, bestScore = -1e9;
  for (const id of pool) {
    const c = COMP[id];
    let s = rng() * 1.2;
    if (usedComps.has(id)) s -= 10;
    if (c.family === prevFamily) s -= 2.5;
    if (id === prevComp) s -= 20;
    if (c.tone === prevTone && c.tone === prev2Tone) s -= 4;
    else if (c.tone === prevTone) s -= 0.6;
    if (role === 'hook' && id === 'hero-polaroid') s += 0.5;
    if (role === 'reveal' && ['book-open-hero', 'invite-hero'].includes(id)) s += 1.2;
    if (role === 'emotion' && id === 'photo-strip') s += 0.6;
    if (s > bestScore) { bestScore = s; best = id; }
  }
  return best;
}

const TRANS_BY_ROLE = {
  hook: ['wipe', 'satin'], emotion: ['fade', 'iris', 'slide'], reveal: ['satin', 'iris', 'wipe'], feature: ['wipe', 'bars', 'slide', 'iris'],
  steps: ['bars', 'slide', 'wipe'], services: ['wipe', 'bars'], occasion: ['slide', 'iris'], about: ['fade', 'wipe'], offer: ['satin', 'bars'], cta: ['satin', 'iris'],
};
export function chooseTransition(role, prevType, rng) {
  const o = (TRANS_BY_ROLE[role] || ['wipe', 'bars', 'slide', 'fade']).filter((t) => t !== prevType);
  const t = rng.pick(o.length ? o : ['wipe', 'bars']);
  return { type: t, dur: t === 'fade' ? 0.7 : t === 'iris' ? 0.8 : t === 'satin' ? 0.75 : 0.6 };
}

// layer timeline end → minimum comfortable scene length
export function layersEnd(layers) {
  let end = 0;
  for (const l of layers) {
    if (['art', 'fill', 'bgtext', 'rays'].includes(l.type)) continue;
    let e = (l.at || 0) + (l.dur ?? 0.6);
    if (l.type === 'text' && (l.reveal || 'words') === 'words') e = (l.at || 0) + (plain(l.text).split(/\s+/).length - 1) * (l.stagger ?? 0.12) + 0.5;
    end = Math.max(end, e);
  }
  return end;
}

export function buildScene({ id, beat, compId, ctx, role }) {
  const comp = COMP[compId];
  const layers = comp.build(ctx);
  const words = (beat.copy.items ? beat.copy.items.join(' ') : '') + ' ' + plain(beat.copy.headline) + ' ' + (beat.copy.sub || '');
  const read = 1.5 + words.split(/\s+/).filter(Boolean).length * 0.28;
  const dur = Math.max(role === 'cta' ? 4.4 : 3.4, layersEnd(layers) + 1.3, Math.min(read, 6.2), beat.narrSec ? beat.narrSec + 0.5 : 0);
  return {
    scene: { id, title: `${beat.label}`, duration: Math.round(Math.min(dur, 7) * 10) / 10, layers, plan: { beat: beat.id, role, composition: compId, tone: comp.tone, why: comp.why(ctx.a, beat), motion: { wordIn: ctx.m.wordIn, iconIn: ctx.m.iconIn, polIn: ctx.m.polIn, side: ctx.side, rays: ctx.dir } } },
    slots: ctx.slots,
  };
}
