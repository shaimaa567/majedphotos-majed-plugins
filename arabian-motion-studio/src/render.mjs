// Deterministic frame renderer: headless Chromium (one frame per time value) → ffmpeg.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { ROOT } from './project.mjs';

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed:\n${(r.stderr || '').slice(-1500)}`);
  return r.stdout;
}

// video layers: pre-extract frames (cached) so every output frame maps to an exact source frame
export function prepVideoLayers(P, urlOf = (d) => pathToFileURL(d + path.sep).href) {
  const fps = P.resolved.fps;
  for (const sc of P.resolved.scenes) {
    for (const L of sc.layers) {
      if (L.type !== 'video') continue;
      const need = Math.ceil((sc.duration + 0.1) * fps);
      const tag = `${L.asset}_${L.trim || 0}_${need}_${fps}`;
      const dir = path.join(P.dir, '.cache', 'frames', tag);
      const first = path.join(dir, '00001.jpg');
      if (!fs.existsSync(first)) {
        fs.mkdirSync(dir, { recursive: true });
        run('ffmpeg', ['-y', '-v', 'error', '-ss', String(L.trim || 0), '-i', L.file, '-t', String(sc.duration + 0.1),
          '-vf', `fps=${fps},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`, '-q:v', '2', path.join(dir, '%05d.jpg')]);
      }
      L.frameCount = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).length;
      L.framesBase = urlOf(dir);
    }
  }
}

export async function openRenderer(P, { scale = 1 } = {}) {
  prepVideoLayers(P);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--font-render-hinting=none', '--force-color-profile=srgb', '--disable-lcd-text', '--allow-file-access-from-files'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.goto(pathToFileURL(path.join(ROOT, 'engine/index.html')).href);
  await page.evaluate((p) => window.initProject(p), P.resolved);
  return {
    async frame(t, { format = 'jpeg', quality = 92, debug = false } = {}) {
      await page.evaluate(([tt, d]) => window.renderFrame(tt, { debug: d }), [t, debug]);
      return page.screenshot({ type: format, quality: format === 'jpeg' ? quality : undefined });
    },
    close: () => browser.close(),
  };
}

// Render [from,to) at fps into an mp4 (video only).
export async function renderVideo(P, { from = 0, to, fps, scale = 1, out, crf = 16, preset = 'medium', format = 'png', log = true }) {
  fps = fps || P.resolved.fps;
  to = to ?? P.total;
  const n = Math.round((to - from) * fps);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = await openRenderer(P, { scale });
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', format === 'png' ? 'png' : 'mjpeg', '-i', '-',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p',
    '-r', String(fps), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { ff.on('close', (c) => (c ? rej(new Error('ffmpeg exited ' + c)) : res())); });
  const t0 = Date.now();
  try {
    for (let i = 0; i < n; i++) {
      const buf = await r.frame(from + i / fps, { format, quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise((res) => ff.stdin.once('drain', res));
      if (log && (i % 30 === 29 || i === n - 1)) process.stdout.write(`\r  frame ${i + 1}/${n}  (${((i + 1) / ((Date.now() - t0) / 1000)).toFixed(1)} fps)`);
    }
    ff.stdin.end();
    await done;
  } finally { await r.close(); }
  if (log) process.stdout.write('\n');
  return { frames: n };
}

// Contact sheet: many small frames of one range tiled into a single image.
export async function contactSheet(P, { from = 0, to, fps = 6, cols = 6, scale = 0.25, out }) {
  to = to ?? P.total;
  const tmp = path.join(P.dir, '.cache', 'sheet');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const r = await openRenderer(P, { scale });
  const n = Math.max(1, Math.round((to - from) * fps));
  try {
    for (let i = 0; i < n; i++) fs.writeFileSync(path.join(tmp, String(i + 1).padStart(4, '0') + '.jpg'), await r.frame(from + i / fps, { format: 'jpeg', debug: true }));
  } finally { await r.close(); }
  const rows = Math.ceil(n / cols);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  run('ffmpeg', ['-y', '-v', 'error', '-framerate', '1', '-i', path.join(tmp, '%04d.jpg'), '-vf', `tile=${Math.min(cols, n)}x${rows}:padding=6:color=0x222222`, '-frames:v', '1', '-q:v', '3', out]);
  return { frames: n, out };
}

export async function stillAt(P, { t, scale = 0.5, out }) {
  const r = await openRenderer(P, { scale });
  try { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, await r.frame(t, { format: 'png' })); } finally { await r.close(); }
  return out;
}
