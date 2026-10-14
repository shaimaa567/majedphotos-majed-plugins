#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { ROOT, loadProject, resolveProjectDir, iconPath } from './project.mjs';
import { validate } from './validate.mjs';
import { renderVideo, contactSheet, stillAt, run } from './render.mjs';
import { muxAudio } from './audio.mjs';

const HELP = `Arabian Motion Studio

  node src/cli.mjs <command> <project> [options]

  check   <p>                         فحص المشروع (تكرار صور/أيقونات، ملفات ناقصة، مناطق آمنة)
  sheet   <p> [--from 0 --to 5 --fps 6 --cols 6]   لوحة معاينة (contact sheet) لمدى زمني
  still   <p> --t 2.5 [--scale 0.5]   صورة لإطار واحد
  render  <p> [--scale 1 --crf 16] [--preview]      تصدير MP4 (مع الصوت) إلى output/
  credits <p>                         كتابة credits.md من assets.json
  pexels search <p> --q "..." [--type photo|video] [--n 12]
  pexels pick   <p> --id 123 --as hero_s2 --scene s2 [--type photo|video]
  icons search <word>                 البحث في أيقونات Lucide
  sync    <p> [--model small]         توقيت الكلمات من التعليق الصوتي (faster-whisper)
  new     <name>                      مشروع جديد فارغ
`;

const [cmd, ...rest] = process.argv.slice(2);
const opt = (extra) => parseArgs({ args: rest, allowPositionals: true, options: { from: { type: 'string' }, to: { type: 'string' }, fps: { type: 'string' }, cols: { type: 'string' }, t: { type: 'string' }, scale: { type: 'string' }, crf: { type: 'string' }, preview: { type: 'boolean' }, q: { type: 'string' }, type: { type: 'string' }, n: { type: 'string' }, id: { type: 'string' }, as: { type: 'string' }, scene: { type: 'string' }, model: { type: 'string' }, ...extra } });
const num = (v, d) => (v === undefined ? d : Number(v));

async function main() {
  if (!cmd || cmd === 'help' || cmd === '--help') return console.log(HELP);

  if (cmd === 'new') {
    const name = rest[0];
    if (!name || !/^[\w-]+$/.test(name)) throw new Error('usage: new <name> (letters, digits, - _)');
    const dir = path.join(ROOT, 'projects', name);
    if (fs.existsSync(dir)) throw new Error('already exists: ' + dir);
    for (const d of ['media', 'audio', 'icons']) fs.mkdirSync(path.join(dir, d), { recursive: true });
    fs.writeFileSync(path.join(dir, 'assets.json'), '{}\n');
    fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({
      name, fps: 30, palette: { bg: '#0B0F1A', ink: '#F4F1EA', accent: '#FF5A36', accent2: '#2DD4BF', muted: '#8A93A6' },
      audio: { vo: null, music: null, sfx: [] },
      scenes: [{ id: 's1', duration: 4, layers: [
        { type: 'art', style: 'shards', seed: 1 },
        { type: 'text', text: 'عنوان *المشهد* الأول', x: 90, y: 760, w: 900, size: 110, at: 0.3, stagger: 0.14 },
      ] }],
    }, null, 2) + '\n');
    return console.log('created', dir);
  }

  if (cmd === 'icons') {
    const word = rest[1];
    const dir = path.join(ROOT, 'node_modules/lucide-static/icons');
    const all = fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4));
    return console.log((word ? all.filter((n) => n.includes(word)) : all).join('\n'));
  }

  if (cmd === 'pexels') {
    const sub = rest[0];
    const { values, positionals } = parseArgs({ args: rest.slice(1), allowPositionals: true, options: { q: { type: 'string' }, type: { type: 'string' }, n: { type: 'string' }, id: { type: 'string' }, as: { type: 'string' }, scene: { type: 'string' }, orientation: { type: 'string' } } });
    const P = loadProject(resolveProjectDir(positionals[0]));
    const px = await import('./pexels.mjs');
    if (sub === 'search') {
      const rows = await px.search(P, { query: values.q, type: values.type || 'photo', orientation: values.orientation || 'portrait', n: num(values.n, 12) });
      for (const r of rows) console.log(`${r.used ? '[USED] ' : ''}${r.id}\t${r.w}x${r.h}${r.dur ? ' ' + r.dur + 's' : ''}\t${r.by}\t${r.page}\n   thumb: ${r.thumbFile}`);
      return console.log(`\nانظر الصور المصغرة ثم اختر: pexels pick ${positionals[0]} --id <id> --as <assetId> --scene <sceneId>`);
    }
    if (sub === 'pick') {
      const e = await px.pick(P, { type: values.type || 'photo', id: values.id, as: values.as, scene: values.scene });
      return console.log('registered', values.as, '→', e.file, '| credit:', e.credit);
    }
    throw new Error('pexels search|pick');
  }

  const { values, positionals } = opt();
  const dir = resolveProjectDir(positionals[0]);
  const P = loadProject(dir);

  if (cmd === 'check') {
    const { errors, warns } = validate(P);
    warns.forEach((w) => console.log('⚠ ', w));
    errors.forEach((e) => console.log('✖ ', e));
    console.log(`\n${P.resolved.scenes.length} scenes · ${P.total.toFixed(2)}s · ${errors.length} errors · ${warns.length} warnings`);
    process.exitCode = errors.length ? 1 : 0;
    return;
  }

  if (cmd === 'sheet') {
    const out = path.join(ROOT, 'output', P.name, `sheet_${num(values.from, 0)}-${num(values.to, P.total)}.jpg`);
    const r = await contactSheet(P, { from: num(values.from, 0), to: num(values.to, undefined), fps: num(values.fps, 6), cols: num(values.cols, 6), scale: num(values.scale, 0.25), out });
    return console.log('sheet:', r.out, `(${r.frames} frames)`);
  }

  if (cmd === 'still') {
    const out = path.join(ROOT, 'output', P.name, `still_${values.t}.png`);
    await stillAt(P, { t: num(values.t, 0), scale: num(values.scale, 0.5), out });
    return console.log('still:', out);
  }

  if (cmd === 'credits') return console.log(writeCredits(P));

  if (cmd === 'sync') {
    const au = P.spec.audio?.vo;
    if (!au) throw new Error('project.json: audio.vo is not set');
    const py = spawnSync('python3', [path.join(ROOT, 'scripts/transcribe.py'), path.resolve(dir, au), path.join(dir, 'sync.json'), values.model || 'small'], { stdio: 'inherit' });
    process.exitCode = py.status || 0;
    return;
  }

  if (cmd === 'render') {
    const { errors, warns } = validate(P);
    warns.forEach((w) => console.log('⚠ ', w));
    if (errors.length) { errors.forEach((e) => console.log('✖ ', e)); throw new Error('fix the errors above first (check command)'); }
    const outDir = path.join(ROOT, 'output', P.name);
    fs.mkdirSync(outDir, { recursive: true });
    const preview = values.preview;
    const scale = num(values.scale, preview ? 0.4 : 1);
    let v = 1;
    while (fs.existsSync(path.join(outDir, `${P.name}_${preview ? 'preview' : 'v'}${v}.mp4`))) v++;
    const finalFile = path.join(outDir, `${P.name}_${preview ? 'preview' : 'v'}${v}.mp4`);
    const tmpVideo = path.join(outDir, '.video_only.mp4');
    console.log(`rendering ${P.total.toFixed(2)}s @ ${P.resolved.fps}fps, scale ${scale}`);
    await renderVideo(P, { scale, out: tmpVideo, crf: num(values.crf, preview ? 28 : 16), preset: preview ? 'veryfast' : 'medium', format: preview ? 'jpeg' : 'png' });
    const a = muxAudio(P, tmpVideo, finalFile);
    fs.rmSync(tmpVideo, { force: true });
    if (!preview) writeCredits(P);
    const pr = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,duration', '-of', 'compact', finalFile]);
    console.log(pr.trim());
    return console.log('done:', finalFile, `(audio: ${a.audio})`);
  }

  throw new Error('unknown command: ' + cmd + '\n' + HELP);
}

function writeCredits(P) {
  const out = path.join(ROOT, 'output', P.name, 'credits.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const lines = [`# Credits — ${P.name}`, '', '## Fonts', '- Tajawal, Noto Kufi Arabic — SIL Open Font License 1.1', '', '## Icons', '- Lucide (ISC License) — https://lucide.dev', ''];
  const rows = Object.entries(P.assets);
  if (rows.length) lines.push('## Media');
  for (const [id, a] of rows) lines.push(`- ${id}: ${a.credit || 'unknown'} — ${a.pageUrl || a.source} (${a.license || 'license?'})`);
  fs.writeFileSync(out, lines.join('\n') + '\n');
  return out;
}

main().catch((e) => { console.error('\n✖ ' + e.message); process.exit(1); });
