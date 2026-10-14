#!/usr/bin/env node
// Ms. Memories Studio server.
// Serves the studio UI, the SAME engine runtime used for export, project CRUD, uploads and render jobs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, FONT_DIR, loadProject, readJson } from '../src/project.mjs';
import { validate } from '../src/validate.mjs';
import { prepVideoLayers } from '../src/render.mjs';
import { BRAND, KINDS, buildProject } from './templates.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UI = path.join(HERE, 'ui');
const PROJECTS = path.join(ROOT, 'projects');
const OUTPUT = path.join(ROOT, 'output');
const ICON_DIR = path.join(ROOT, 'node_modules/lucide-static/icons');
const PORT = Number(process.env.PORT || 4173);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ID_RE = /^[\w-]{1,60}$/;

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const fail = (res, code, msg) => send(res, code, { error: msg });
const readBody = (req, limit = 60 * 1024 * 1024) => new Promise((resolve, reject) => {
  const chunks = []; let n = 0;
  req.on('data', (c) => { n += c.length; if (n > limit) { reject(new Error('الملف أكبر من المسموح')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});
const readJsonBody = async (req) => JSON.parse((await readBody(req, 5 * 1024 * 1024)).toString('utf8') || '{}');

// safe join: result must stay inside base
function inside(base, ...parts) {
  const p = path.resolve(base, ...parts);
  if (p !== base && !p.startsWith(base + path.sep)) return null;
  return p;
}
function projectDir(id) {
  if (!ID_RE.test(id || '')) return null;
  const d = path.join(PROJECTS, id);
  return fs.existsSync(path.join(d, 'project.json')) ? d : null;
}
const writeJsonAtomic = (file, obj) => {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, file);
};

// url mapper: absolute file → URL the browser can load from this server
function urlMapper(id) {
  const dir = path.join(PROJECTS, id);
  return (abs) => {
    const bust = (() => { try { return fs.statSync(abs).mtimeMs.toString(36); } catch { return '0'; } })();
    if (abs.startsWith(FONT_DIR + path.sep)) return '/assets/fonts/' + path.basename(abs);
    if (abs.startsWith(dir + path.sep)) return `/files/${id}/` + path.relative(dir, abs).split(path.sep).map(encodeURIComponent).join('/') + '?v=' + bust;
    return '/files/missing';
  };
}

function resolveForPreview(id, spec) {
  const dir = path.join(PROJECTS, id);
  const P = loadProject(dir, { spec, url: urlMapper(id) });
  prepVideoLayers(P, (d) => `/files/${id}/` + path.relative(dir, d).split(path.sep).join('/') + '/');
  return P;
}

function listProjects() {
  if (!fs.existsSync(PROJECTS)) return [];
  return fs.readdirSync(PROJECTS).filter((id) => fs.existsSync(path.join(PROJECTS, id, 'project.json'))).map((id) => {
    const f = path.join(PROJECTS, id, 'project.json');
    let spec = {}; try { spec = readJson(f); } catch { /* broken project shown anyway */ }
    const dur = (() => { try { return loadProject(path.join(PROJECTS, id)).total; } catch { return null; } })();
    return { id, title: spec.meta?.title || spec.name || id, kind: spec.meta?.kind || 'reel', theme: spec.meta?.theme || null, scenes: spec.scenes?.length || 0, duration: dur, updated: fs.statSync(f).mtimeMs, palette: spec.palette || null };
  }).sort((a, b) => b.updated - a.updated);
}

// ---------------- render jobs (run the real CLI) ----------------
const jobs = new Map();
let activeJob = null;
function startJob(id, kind, args) {
  if (activeJob && !activeJob.done) throw new Error('هناك عملية تصدير جارية، انتظر حتى تنتهي');
  const jobId = crypto.randomBytes(5).toString('hex');
  const job = { id: jobId, project: id, kind, done: false, ok: null, progress: 0, log: '', file: null, startedAt: Date.now() };
  jobs.set(jobId, job); activeJob = job;
  const before = new Set(fs.existsSync(path.join(OUTPUT, id)) ? fs.readdirSync(path.join(OUTPUT, id)) : []);
  const child = spawn(process.execPath, [path.join(ROOT, 'src/cli.mjs'), ...args], { cwd: ROOT, env: process.env });
  const onData = (d) => {
    const t = d.toString(); job.log = (job.log + t).slice(-4000);
    const m = [...t.matchAll(/frame (\d+)\/(\d+)/g)].pop();
    if (m) job.progress = Number(m[1]) / Number(m[2]);
  };
  child.stdout.on('data', onData); child.stderr.on('data', onData);
  child.on('close', (code) => {
    job.done = true; job.ok = code === 0;
    const out = path.join(OUTPUT, id);
    const fresh = fs.existsSync(out) ? fs.readdirSync(out).filter((f) => /\.(mp4|png)$/.test(f) && (!before.has(f) || fs.statSync(path.join(out, f)).mtimeMs >= job.startedAt - 1000)).sort((a, b) => fs.statSync(path.join(out, a)).mtimeMs - fs.statSync(path.join(out, b)).mtimeMs) : [];
    if (job.ok && fresh.length) { job.file = `/output/${id}/${fresh[fresh.length - 1]}`; job.progress = 1; }
    if (job.ok && !job.file) { job.ok = false; job.log += '\nلم يُنتج ملف'; }
  });
  return job;
}

// ---------------- routes ----------------
async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // after 'api'
  const m = req.method;

  if (parts[0] === 'brand' && m === 'GET') return send(res, 200, { brand: BRAND, kinds: KINDS });

  if (parts[0] === 'projects' && parts.length === 1) {
    if (m === 'GET') return send(res, 200, listProjects());
    if (m === 'POST') {
      const b = await readJsonBody(req);
      const kind = b.kind || 'reel';
      if (!KINDS[kind]?.ready) return fail(res, 400, 'هذا النوع يُضاف في مرحلة لاحقة');
      const id = 'mm-' + new Date().toISOString().replace(/\D/g, '').slice(2, 12) + '-' + crypto.randomBytes(2).toString('hex');
      const dir = path.join(PROJECTS, id);
      const spec = buildProject({ name: id, title: String(b.title || 'مشروع جديد').slice(0, 80), kind, theme: b.theme === 'wine' ? 'wine' : 'milk', idea: String(b.idea || '').slice(0, 4000) });
      for (const d of ['media', 'audio', 'icons']) fs.mkdirSync(path.join(dir, d), { recursive: true });
      writeJsonAtomic(path.join(dir, 'assets.json'), {});
      writeJsonAtomic(path.join(dir, 'project.json'), spec);
      return send(res, 201, { id });
    }
  }

  if (parts[0] === 'projects' && parts[1]) {
    const id = parts[1];
    const dir = projectDir(id);
    if (!dir) return fail(res, 404, 'المشروع غير موجود');
    const sub = parts[2];

    if (!sub && m === 'GET') return send(res, 200, { id, spec: readJson(path.join(dir, 'project.json')), assets: readJson(path.join(dir, 'assets.json'), {}) });
    if (!sub && m === 'DELETE') {
      if (!id.startsWith('mm-')) return fail(res, 403, 'يمكن حذف مشاريع الاستوديو فقط (mm-…)');
      const trash = path.join(PROJECTS, '.trash'); fs.mkdirSync(trash, { recursive: true });
      fs.renameSync(dir, path.join(trash, id + '-' + Date.now())); // moved, never destroyed
      return send(res, 200, { ok: true });
    }
    if (sub === 'save' && m === 'PUT') {
      const spec = await readJsonBody(req);
      if (!spec || !Array.isArray(spec.scenes) || !spec.scenes.length) return fail(res, 400, 'مشروع غير صالح (لا مشاهد)');
      spec.name = id; // output folder follows the id
      const f = path.join(dir, 'project.json');
      try { fs.copyFileSync(f, f + '.bak'); } catch { /* first save */ }
      writeJsonAtomic(f, spec);
      return send(res, 200, { ok: true, savedAt: Date.now() });
    }
    if (sub === 'resolve' && m === 'POST') {
      const spec = await readJsonBody(req);
      try {
        const P = resolveForPreview(id, spec);
        const { errors, warns } = validate(P);
        return send(res, 200, { resolved: P.resolved, total: P.total, errors, warns });
      } catch (e) { return send(res, 200, { error: e.message }); }
    }
    if (sub === 'media' && m === 'POST') {
      const name = decodeURIComponent(String(req.headers['x-filename'] || 'image.jpg'));
      const ext = path.extname(name).toLowerCase();
      if (!IMG_EXT.has(ext)) return fail(res, 400, 'الصيغ المدعومة: JPG, PNG, WEBP');
      const buf = await readBody(req);
      if (buf.length < 100) return fail(res, 400, 'ملف فارغ');
      const hash = crypto.createHash('sha256').update(buf).digest('hex');
      const reg = path.join(dir, 'assets.json'); const assets = readJson(reg, {});
      const same = Object.entries(assets).find(([, a]) => a.sha256 === hash);
      if (same) return send(res, 200, { assetId: same[0], duplicate: true, asset: same[1] });
      let base = (path.basename(name, ext).replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'photo').slice(0, 30).toLowerCase();
      let assetId = base, i = 2; while (assets[assetId]) assetId = `${base}_${i++}`;
      const file = `media/${assetId}${ext}`;
      fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
      fs.writeFileSync(path.join(dir, file), buf);
      assets[assetId] = { type: 'image', file, source: 'user', credit: 'Ms. Memories', license: 'own', sha256: hash, originalName: name, addedAt: new Date().toISOString().slice(0, 10) };
      writeJsonAtomic(reg, assets);
      return send(res, 201, { assetId, asset: assets[assetId] });
    }
    if (sub === 'render' && m === 'POST') {
      const b = await readJsonBody(req);
      try { return send(res, 202, startJob(id, 'render', ['render', id, ...(b.preview ? ['--preview'] : [])])); } catch (e) { return fail(res, 409, e.message); }
    }
    if (sub === 'still' && m === 'POST') {
      const b = await readJsonBody(req); const t = Number(b.t);
      if (!Number.isFinite(t) || t < 0) return fail(res, 400, 'زمن غير صالح');
      try { return send(res, 202, startJob(id, 'still', ['still', id, '--t', String(t), '--scale', '1'])); } catch (e) { return fail(res, 409, e.message); }
    }
  }

  if (parts[0] === 'jobs' && parts[1] && m === 'GET') {
    const j = jobs.get(parts[1]); return j ? send(res, 200, j) : fail(res, 404, 'عملية غير معروفة');
  }
  if (parts[0] === 'icons' && m === 'GET') {
    const q = (url.searchParams.get('q') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const all = fs.readdirSync(ICON_DIR).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4));
    return send(res, 200, (q ? all.filter((n) => n.includes(q)) : all).slice(0, 80));
  }
  return fail(res, 404, 'مسار غير معروف');
}

function serveFile(res, file, req) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return fail(res, 404, 'غير موجود');
  const ext = path.extname(file).toLowerCase();
  const stat = fs.statSync(file);
  const range = req.headers.range;
  if (range && ext === '.mp4') {
    const [a, b] = range.replace('bytes=', '').split('-'); const start = Number(a), end = b ? Number(b) : stat.size - 1;
    res.writeHead(206, { 'Content-Type': MIME[ext], 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(url.pathname);
    if (p.startsWith('/api/')) return await api(req, res, url);
    if (p.startsWith('/engine/')) return serveFile(res, inside(path.join(ROOT, 'engine'), p.slice(8)), req);
    if (p.startsWith('/assets/fonts/')) return serveFile(res, inside(FONT_DIR, p.slice(14)), req);
    if (p.startsWith('/icon/')) return serveFile(res, inside(ICON_DIR, p.slice(6) + '.svg'), req);
    if (p.startsWith('/files/')) {
      const [, , id, ...rest] = p.split('/');
      if (!ID_RE.test(id || '')) return fail(res, 404, 'غير موجود');
      return serveFile(res, inside(path.join(PROJECTS, id), ...rest), req);
    }
    if (p.startsWith('/output/')) {
      const [, , id, ...rest] = p.split('/');
      if (!ID_RE.test(id || '')) return fail(res, 404, 'غير موجود');
      return serveFile(res, inside(path.join(OUTPUT, id), ...rest), req);
    }
    const rel = p === '/' ? 'index.html' : p.slice(1);
    return serveFile(res, inside(UI, rel), req);
  } catch (e) {
    return fail(res, 500, e.message);
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`Ms. Memories Studio → http://127.0.0.1:${PORT}`));
