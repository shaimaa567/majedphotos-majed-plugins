// Pexels API: search → review thumbnails → pick one file per scene (never reused).
import fs from 'node:fs';
import path from 'node:path';
import { run } from './render.mjs';
import { ROOT, readJson } from './project.mjs';

try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* .env is optional */ }

function key() {
  const k = process.env.PEXELS_API_KEY;
  if (!k || !k.trim()) {
    throw new Error('PEXELS_API_KEY غير موجود.\n  1) انسخ .env.example إلى .env\n  2) الصق مفتاحك بعد PEXELS_API_KEY=  (يُنشأ مجانًا من https://www.pexels.com/api/)\n  3) احفظ الملف وأعد الأمر.');
  }
  return k.trim();
}

async function api(url) {
  const r = await fetch(url, { headers: { Authorization: key() } });
  if (r.status === 401 || r.status === 403) throw new Error('Pexels رفض المفتاح (401/403). تحقق من PEXELS_API_KEY.');
  if (!r.ok) throw new Error(`Pexels HTTP ${r.status}`);
  return r.json();
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed ${r.status}: ${url}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

export async function search(P, { query, type = 'photo', orientation = 'portrait', n = 12, thumbs = true }) {
  if (!query) throw new Error('--q "search words" is required');
  const q = encodeURIComponent(query);
  const used = new Set(Object.values(P.assets).map((a) => a.pexelsId).filter(Boolean));
  const rows = [];
  if (type === 'photo') {
    const j = await api(`https://api.pexels.com/v1/search?query=${q}&orientation=${orientation}&size=large&per_page=${n}`);
    for (const p of j.photos) rows.push({ id: p.id, w: p.width, h: p.height, by: p.photographer, page: p.url, color: p.avg_color, thumb: p.src.medium, used: used.has(p.id) });
  } else {
    const j = await api(`https://api.pexels.com/videos/search?query=${q}&orientation=${orientation}&size=medium&per_page=${n}`);
    for (const v of j.videos) rows.push({ id: v.id, w: v.width, h: v.height, dur: v.duration, by: v.user.name, page: v.url, thumb: v.image, used: used.has(v.id) });
  }
  const dir = path.join(P.dir, '.cache', 'candidates');
  if (thumbs) for (const r of rows) { const f = path.join(dir, `${type}_${r.id}.jpg`); await download(r.thumb, f); r.thumbFile = f; }
  return rows;
}

export async function pick(P, { type = 'photo', id, as, scene }) {
  if (!id || !as) throw new Error('--id <pexelsId> --as <assetId> are required');
  const reg = path.join(P.dir, 'assets.json');
  const assets = readJson(reg, {});
  if (assets[as]) throw new Error(`asset id "${as}" already exists — choose a unique name`);
  const clash = Object.entries(assets).find(([, a]) => String(a.pexelsId) === String(id));
  if (clash) throw new Error(`Pexels ${type} ${id} is already used as "${clash[0]}" — the same media must not repeat`);
  const media = path.join(P.dir, 'media');
  fs.mkdirSync(media, { recursive: true });
  let entry;
  if (type === 'photo') {
    const p = await api(`https://api.pexels.com/v1/photos/${id}`);
    const raw = path.join(P.dir, '.cache', `pexels_${id}_orig.jpg`);
    await download(p.src.original, raw);
    const dest = path.join(media, `${as}.jpg`);
    run('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', "scale='if(gt(iw,ih),-2,min(2160,iw))':'if(gt(iw,ih),min(2160,ih),-2)'", '-q:v', '2', dest]);
    entry = { type: 'image', file: `media/${as}.jpg`, pexelsId: p.id, source: 'pexels', credit: p.photographer, creditUrl: p.photographer_url, pageUrl: p.url, license: 'Pexels License', width: p.width, height: p.height };
  } else {
    const v = await api(`https://api.pexels.com/videos/videos/${id}`);
    const files = v.video_files.filter((f) => f.file_type === 'video/mp4' && f.width && f.height).sort((a, b) => b.height - a.height);
    const f = files.find((x) => x.height >= 1920 && x.height <= 2600) || files.find((x) => x.height >= 1280) || files[0];
    const dest = path.join(media, `${as}.mp4`);
    await download(f.link, dest);
    entry = { type: 'video', file: `media/${as}.mp4`, pexelsId: v.id, source: 'pexels', credit: v.user.name, creditUrl: v.user.url, pageUrl: v.url, license: 'Pexels License', width: f.width, height: f.height, duration: v.duration };
  }
  entry.usedIn = scene ? [scene] : [];
  entry.addedAt = new Date().toISOString().slice(0, 10);
  assets[as] = entry;
  fs.writeFileSync(reg, JSON.stringify(assets, null, 2) + '\n');
  return entry;
}
