// Project lint: catches repeated assets/icons/art, missing files, unsafe zones, RTL mistakes.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const hasArabic = (s) => /[؀-ۿ]/.test(s);

export function validate(P) {
  const errors = [], warns = [];
  const E = (m) => errors.push(m), Wn = (m) => warns.push(m);
  const seen = { icon: new Map(), art: new Map(), asset: new Map(), text: new Map() };
  const dup = (map, key, where, label) => {
    if (map.has(key)) E(`repeated ${label} "${key}": ${map.get(key)} and ${where}`);
    else map.set(key, where);
  };

  P.resolved.scenes.forEach((sc) => {
    if (sc.duration < 1) Wn(`${sc.id}: scene shorter than 1s (${sc.duration.toFixed(2)}s)`);
    if (sc.duration > 8) Wn(`${sc.id}: scene longer than 8s — consider splitting for Reels pacing`);
    sc.layers.forEach((L) => {
      const where = `${sc.id}#${L._index}`;
      if (L.type === 'icon') dup(seen.icon, L.name, where, 'icon');
      if (L.type === 'art') dup(seen.art, `${L.style || 'shards'}:${L.seed || 1}`, where, 'art composition (style+seed)');
      if (L.type === 'image' || L.type === 'video') dup(seen.asset, L.asset, where, 'asset');
      if (L.type === 'polaroid') {
        if (L.asset) dup(seen.asset, L.asset, where, 'asset');
        else if (L.fallback === 'art') Wn(`${where}: الصورة المطلوبة «${L.slot || 'Polaroid'}» غير مرفوعة — يُستخدم رسم أصلي بدلًا منها`);
        else Wn(`${where}: إطار Polaroid بلا صورة (placeholder) — ضع صورة حقيقية قبل التصدير النهائي`);
      }
      if (L.type === 'text') {
        dup(seen.text, L.text.replace(/\*/g, '').trim(), where, 'text');
        if (!hasArabic(L.text) && !/[A-Za-z0-9]/.test(L.text)) Wn(`${where}: text has no letters`);
        const size = L.size || 90, y = L.y ?? 0, w = L.w ?? 900, x = L.x ?? 0;
        if (y < 220) Wn(`${where}: text starts at y=${y} — inside top 220px platform UI zone`);
        const lines = Math.ceil((L.text.length * size * 0.5) / w);
        if (y + lines * size * (L.lh || 1.45) > 1920 - 420) Wn(`${where}: text may enter the bottom 420px UI zone`);
        if (x + w > 1080 - 60 + 1 || x < 40) Wn(`${where}: text box x=${x}..${x + w} is outside the 40px side margins`);
        if (hasArabic(L.text) && L.align === 'left') Wn(`${where}: Arabic text with left alignment (RTL expected right/center)`);
        if (hasArabic(L.text) && /(^|\s)[A-Za-z]/.test(L.text) && !/\*/.test(L.text)) { /* mixed ok: runtime isolates Latin tokens */ }
      }
      if (L.type === 'icon' && (L.y ?? 0) < 220) Wn(`${where}: icon inside top 220px UI zone`);
      if (['text', 'icon'].includes(L.type) && L.at > sc.duration - 0.3) Wn(`${where}: starts at ${L.at.toFixed(2)}s, almost at scene end`);
    });
  });

  // asset registry
  const hashes = new Map(), pexels = new Map();
  for (const [id, a] of Object.entries(P.assets)) {
    const f = path.resolve(P.dir, a.file || '');
    if (!fs.existsSync(f)) { E(`asset ${id}: file missing (${a.file})`); continue; }
    const h = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    if (hashes.has(h)) E(`asset ${id} is byte-identical to ${hashes.get(h)}`); else hashes.set(h, id);
    if (a.pexelsId) { if (pexels.has(a.pexelsId)) E(`asset ${id} reuses Pexels id ${a.pexelsId} (${pexels.get(a.pexelsId)})`); else pexels.set(a.pexelsId, id); }
    if (!a.license) Wn(`asset ${id}: no license recorded`);
    if (!seen.asset.has(id)) Wn(`asset ${id}: registered but not used in any scene`);
  }

  // audio
  const au = P.spec.audio || {};
  for (const f of [au.vo, au.music, ...(au.sfx || []).map((s) => s.file)].filter(Boolean)) {
    if (!fs.existsSync(path.resolve(P.dir, f))) E(`audio file missing: ${f}`);
  }
  if (P.resolved.scenes.some((s) => JSON.stringify(s.layers).includes('wordAt')) && !P.sync) Wn('word timing used without sync.json');
  return { errors, warns };
}
