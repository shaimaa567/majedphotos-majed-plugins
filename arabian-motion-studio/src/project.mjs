// Load a project folder, resolve timing references, icons, assets and fonts
// into the plain object the browser runtime consumes.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICON_DIR = path.join(ROOT, 'node_modules/lucide-static/icons');
const FONT_DIR = path.join(ROOT, 'assets/fonts');

export const readJson = (p, fallback) => {
  if (!fs.existsSync(p)) {
    if (fallback !== undefined) return fallback;
    throw new Error('missing file: ' + p);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

export function resolveProjectDir(arg) {
  if (!arg) throw new Error('project name/path required (e.g. demo)');
  const direct = path.resolve(arg);
  if (fs.existsSync(path.join(direct, 'project.json'))) return direct;
  const named = path.join(ROOT, 'projects', arg);
  if (fs.existsSync(path.join(named, 'project.json'))) return named;
  throw new Error(`project not found: ${arg}`);
}

export function iconPath(name, projectDir) {
  const custom = path.join(projectDir, 'icons', name + '.svg');
  if (fs.existsSync(custom)) return custom;
  return path.join(ICON_DIR, name + '.svg');
}

// Time references: number | "@w12" | "@w12+0.2" | "@scene:id" | "@end"
export function parseTime(v, ctx) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string' || !v.startsWith('@')) throw new Error('bad time value: ' + v);
  const m = v.match(/^@(w(\d+)(?:\.(s|e))?|scene:([\w-]+)|end)([+-]\d+(?:\.\d+)?)?$/);
  if (!m) throw new Error('bad time reference: ' + v);
  let t;
  if (m[2] !== undefined) {
    const w = ctx.sync?.words?.[Number(m[2])];
    if (!w) throw new Error(`time reference ${v}: sync.json has no word ${m[2]} (run "sync" after adding the voiceover)`);
    t = m[3] === 'e' ? w.e : w.s;
  } else if (m[4]) {
    const sc = ctx.sceneStarts?.[m[4]];
    if (sc === undefined) throw new Error(`time reference ${v}: unknown or later scene`);
    t = sc;
  } else {
    t = ctx.total;
    if (t === undefined) throw new Error('@end not available here');
  }
  return t + (m[5] ? Number(m[5]) : 0);
}

export function loadProject(dir) {
  const spec = readJson(path.join(dir, 'project.json'));
  const assets = readJson(path.join(dir, 'assets.json'), {});
  const sync = spec.sync ? readJson(path.join(dir, spec.sync), null) : null;
  const palette = Object.assign({ bg: '#0B0F1A', ink: '#F4F1EA', accent: '#FF5A36', accent2: '#2DD4BF', muted: '#8A93A6' }, spec.palette);
  const fps = spec.fps || 30;

  // scene timeline (a transition overlaps the previous scene by its duration)
  const sceneStarts = {};
  let cursor = 0;
  const scenes = spec.scenes.map((S, i) => {
    const tr = S.transitionIn && S.transitionIn.type !== 'none' ? S.transitionIn : null;
    const start = i === 0 ? 0 : cursor - (tr ? tr.dur : 0);
    sceneStarts[S.id] = start;
    const ctx = { sync, sceneStarts, total: undefined };
    const end = S.endAt !== undefined ? parseTime(S.endAt, ctx) : start + S.duration;
    cursor = end;
    return { S, start, end, ctx };
  });
  const total = cursor;

  const out = scenes.map(({ S, start, end, ctx }) => {
    const rel = (v) => (v === undefined ? undefined : typeof v === 'number' ? v : parseTime(v, { ...ctx, total }) - start);
    const layers = S.layers.map((L0, li) => {
      const L = { ...L0 };
      L.at = rel(L.at) ?? 0;
      if (L.outAt !== undefined) L.outAt = rel(L.outAt);
      if (L.type === 'icon') {
        const p = iconPath(L.name, dir);
        if (!fs.existsSync(p)) throw new Error(`scene ${S.id}: icon "${L.name}" not found (lucide name or projects/<p>/icons/<name>.svg)`);
        L.svg = fs.readFileSync(p, 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim();
      }
      if (L.type === 'text' && L.wordsFrom !== undefined) {
        const n = L.text.split(/\s+/).filter(Boolean).length;
        L.wordAt = Array.from({ length: n }, (_, k) => parseTime(`@w${L.wordsFrom + k}`, { ...ctx, total }) - start);
        if (L.at === 0) L.at = L.wordAt[0];
      }
      if (L.type === 'image' || L.type === 'video') {
        const a = assets[L.asset];
        if (!a) throw new Error(`scene ${S.id}: asset "${L.asset}" is not registered in assets.json`);
        const f = path.resolve(dir, a.file);
        if (!fs.existsSync(f)) throw new Error(`scene ${S.id}: asset file missing: ${a.file}`);
        L.file = f;
        L.assetType = a.type;
        if (L.type === 'image') L.src = pathToFileURL(f).href;
      }
      L._index = li;
      return L;
    });
    return { id: S.id, start, end, duration: end - start, transitionIn: S.transitionIn, layers };
  });

  const fontFaces = [];
  for (const f of spec.fontFaces || defaultFontFaces()) {
    const abs = path.join(FONT_DIR, f.file);
    if (!fs.existsSync(abs)) throw new Error('font file missing: ' + f.file);
    fontFaces.push({ family: f.family, weight: f.weight, url: pathToFileURL(abs).href, range: f.range, sample: f.sample });
  }

  return {
    dir, name: spec.name || path.basename(dir), spec, assets, sync, total,
    resolved: {
      width: 1080, height: 1920, fps, palette,
      fonts: Object.assign({ display: "'Noto Kufi Arabic','Tajawal',sans-serif", body: "'Tajawal','Noto Kufi Arabic',sans-serif" }, spec.fonts),
      fontFaces, scenes: out,
    },
  };
}

function defaultFontFaces() {
  const arab = 'U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF,U+200C-200F,U+2010-2011,U+25CC';
  const latin = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212';
  const out = [];
  for (const w of [400, 800, 900]) out.push({ family: 'Noto Kufi Arabic', weight: w, file: `noto-kufi-arabic-arabic-${w}-normal.woff2`, range: arab });
  for (const w of [400, 500, 700, 800]) {
    out.push({ family: 'Tajawal', weight: w, file: `tajawal-arabic-${w}-normal.woff2`, range: arab });
    out.push({ family: 'Tajawal', weight: w, file: `tajawal-latin-${w}-normal.woff2`, range: latin, sample: 'Aa' });
  }
  return out;
}
