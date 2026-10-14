// Audio: voiceover + music (auto-ducked under voice) + SFX cues at exact times → AAC, loudness-normalised.
import fs from 'node:fs';
import path from 'node:path';
import { run } from './render.mjs';
import { parseTime } from './project.mjs';

export function buildAudioPlan(P) {
  const a = P.spec.audio || {};
  const scenesById = {};
  P.resolved.scenes.forEach((s) => { scenesById[s.id] = s.start; });
  const ctx = { sync: P.sync, sceneStarts: scenesById, total: P.total };
  const abs = (f) => path.resolve(P.dir, f);
  const plan = { vo: null, music: null, sfx: [], loudness: a.loudness ?? -14, duck: a.duck !== false };
  if (a.vo) plan.vo = { file: abs(a.vo), gain: a.voGain ?? 0 };
  if (a.music) plan.music = { file: abs(a.music), gain: a.musicGain ?? -18 };
  for (const s of a.sfx || []) plan.sfx.push({ file: abs(s.file), at: parseTime(s.at, ctx), gain: s.gain ?? -8 });
  for (const f of [plan.vo?.file, plan.music?.file, ...plan.sfx.map((s) => s.file)].filter(Boolean)) {
    if (!fs.existsSync(f)) throw new Error('audio file missing: ' + f);
  }
  return plan;
}

export function muxAudio(P, videoFile, outFile) {
  const plan = buildAudioPlan(P);
  const dur = P.total;
  const inputs = ['-i', videoFile];
  const chains = [];
  const mixed = [];
  let idx = 1;
  let voLabel = null;
  if (plan.vo) {
    inputs.push('-i', plan.vo.file);
    chains.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${plan.vo.gain}dB,asplit=2[vo][vosc]`);
    mixed.push('[vo]'); voLabel = '[vosc]'; idx++;
  }
  if (plan.music) {
    inputs.push('-stream_loop', '-1', '-i', plan.music.file);
    let m = `[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${dur},volume=${plan.music.gain}dB,afade=t=out:st=${Math.max(0, dur - 1.2)}:d=1.2`;
    if (voLabel && plan.duck) {
      chains.push(m + '[mraw]');
      chains.push(`[mraw]${voLabel}sidechaincompress=threshold=0.04:ratio=9:attack=25:release=450[mduck]`);
      mixed.push('[mduck]');
    } else { chains.push(m + '[mus]'); mixed.push('[mus]'); }
    idx++;
  }
  plan.sfx.forEach((s, k) => {
    inputs.push('-i', s.file);
    const ms = Math.max(0, Math.round(s.at * 1000));
    chains.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${s.gain}dB,adelay=${ms}|${ms}[sfx${k}]`);
    mixed.push(`[sfx${k}]`); idx++;
  });
  if (!mixed.length) {
    run('ffmpeg', ['-y', '-v', 'error', '-i', videoFile, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-shortest', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', outFile]);
    return { audio: 'silent' };
  }
  chains.push(`${mixed.join('')}amix=inputs=${mixed.length}:normalize=0:duration=longest,apad,atrim=0:${dur},loudnorm=I=${plan.loudness}:TP=-1.5:LRA=11[aout]`);
  run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', chains.join(';'), '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(dur), '-movflags', '+faststart', outFile]);
  return { audio: 'mixed', tracks: mixed.length };
}
