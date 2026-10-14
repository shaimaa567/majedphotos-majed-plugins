// Image-generation provider registry. NO provider ships enabled: the studio never claims that images are
// generated until a provider module is added, configured (API key) and tested.
//
// To add a service: create studio/imagegen/providers/<name>.mjs exporting default:
//   { id, label, envKey, configured(): boolean, generate({ prompt, promptEn, aspect }) → Promise<Buffer|{buffer, ext}> }
// (see providers/_template.mjs). Files starting with "_" are ignored.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const registry = new Map();
let loaded = false;

export class NotConfiguredError extends Error { constructor(msg) { super(msg); this.name = 'NotConfiguredError'; } }

export function registerProvider(p) {
  if (!p?.id || typeof p.generate !== 'function' || typeof p.configured !== 'function') throw new Error('مزوّد غير صالح: يلزم id وconfigured() وgenerate()');
  registry.set(p.id, p);
}
export const unregisterProvider = (id) => registry.delete(id);

async function load() {
  if (loaded) return; loaded = true;
  const dir = path.join(HERE, 'providers');
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!f.endsWith('.mjs') || f.startsWith('_')) continue;
    try { registerProvider((await import(pathToFileURL(path.join(dir, f)).href)).default); } catch (e) { console.error('imagegen provider', f, e.message); }
  }
}

export async function listProviders() {
  await load();
  return [...registry.values()].map((p) => ({ id: p.id, label: p.label || p.id, envKey: p.envKey || null, configured: !!p.configured(), tested: !!p.tested }));
}

// Generates one image and registers it as a project asset (never overwrites; dedupes by hash).
export async function generateForProject({ dir, providerId, prompt, promptEn, aspect = '1:1', slot = null }) {
  await load();
  const list = [...registry.values()].filter((p) => p.configured());
  if (!list.length) throw new NotConfiguredError('لا توجد خدمة توليد صور مربوطة. أضيفي مزوّدًا في studio/imagegen/providers وفعّلي مفتاحه، وإلى ذلك الحين استخدمي صور منتجاتك أو الرسوم الأصلية.');
  const p = providerId ? registry.get(providerId) : list[0];
  if (!p) throw new Error('مزوّد غير معروف: ' + providerId);
  if (!p.configured()) throw new NotConfiguredError(`المزوّد «${p.label || p.id}» غير مفعّل${p.envKey ? ` (يلزم ${p.envKey})` : ''}`);
  const out = await p.generate({ prompt, promptEn, aspect });
  const buffer = Buffer.isBuffer(out) ? out : out.buffer, ext = (Buffer.isBuffer(out) ? '.png' : out.ext) || '.png';
  if (!buffer?.length) throw new Error('المزوّد لم يُرجع صورة');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const reg = path.join(dir, 'assets.json');
  const assets = fs.existsSync(reg) ? JSON.parse(fs.readFileSync(reg, 'utf8')) : {};
  const dup = Object.entries(assets).find(([, a]) => a.sha256 === hash);
  if (dup) return { assetId: dup[0], duplicate: true, asset: dup[1] };
  let id = `ai_${p.id}`.replace(/[^\w-]/g, '_'), n = 1; while (assets[id + '_' + n]) n++; id = `${id}_${n}`;
  fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'media', id + ext), buffer);
  assets[id] = { type: 'image', file: `media/${id}${ext}`, source: 'ai-generated', provider: p.id, credit: 'مولَّدة بالذكاء الاصطناعي', license: 'حسب شروط المزوّد', prompt, slot, sha256: hash, addedAt: new Date().toISOString().slice(0, 10) };
  fs.writeFileSync(reg, JSON.stringify(assets, null, 2) + '\n');
  return { assetId: id, asset: assets[id] };
}
