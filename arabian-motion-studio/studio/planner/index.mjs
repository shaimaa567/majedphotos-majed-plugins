// Planner entry points: idea → editable scene plan (project spec), single-scene regeneration,
// audio suggestions. Everything here is deterministic given (idea, seed, regen counter).
import { analyzeIdea, summarizeAnalysis } from './analyze.mjs';
import { buildStory, writeBeat, narrationOf, ROLE_LABELS, rngFrom, hashStr, plain, keywordOf } from './copy.mjs';
import { makeCtx, chooseComposition, chooseTransition, buildScene, COMPOSITIONS } from './compose.mjs';
import { BRAND } from '../templates.mjs';

export { ROLE_LABELS, COMPOSITIONS };
export const KIND_ROLES = { reel: 'ريل', product: 'إعلان منتج', intro: 'فيديو تعريفي' };

const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
const round1 = (x) => Math.round(x * 10) / 10;

export function timeline(scenes) {
  let cursor = 0;
  return scenes.map((s, i) => {
    const tr = s.transitionIn && s.transitionIn.type !== 'none' ? s.transitionIn : null;
    const start = i === 0 ? 0 : cursor - (tr ? tr.dur : 0);
    const end = start + s.duration;
    cursor = end;
    return { id: s.id, start, end };
  });
}

function usedFromScenes(scenes) {
  const used = { art: new Set(), icons: new Set(), assets: new Set(), texts: new Set() };
  for (const s of scenes) for (const l of s.layers) {
    if (l.type === 'art') used.art.add(`${l.style || 'shards'}:${l.seed || 1}`);
    if (l.type === 'icon') used.icons.add(l.name);
    if (l.asset) used.assets.add(l.asset);
    if (l.type === 'text') used.texts.add(plain(l.text).trim());
  }
  return used;
}

function labelBeats(beats) {
  const total = {}, seen = {};
  beats.forEach((b) => { total[b.role] = (total[b.role] || 0) + 1; });
  beats.forEach((b) => { seen[b.role] = (seen[b.role] || 0) + 1; b.label = ROLE_LABELS[b.role] + (total[b.role] > 1 ? ` ${seen[b.role]}` : ''); });
}

function applyBrief(beat, br, addr) {
  // brief (from an LLM) overrides wording only; layout stays local & deterministic
  if (!br) return;
  const c = beat.copy;
  if (br.headline) { c.headline = br.headline; c.keyword = keywordOf(br.headline); }
  if (br.sub !== undefined) c.sub = br.sub || null;
  if (br.items && br.items.length) c.items = br.items;
  if (br.narration) beat.narration = br.narration;
}

export function analysisPublic(a) {
  return { product: a.product, productDetected: a.productDetected, occasion: a.occasion, features: a.features, offer: a.offer, tone: a.tone, ctaKind: a.ctaKind, quoted: a.quoted, giftFraming: a.giftFraming, summary: summarizeAnalysis(a) };
}

export function planProject({ idea, kind = 'reel', theme = 'milk', address = 'f', seconds = 25, seed, title, name = 'plan', assets = {}, brief = null, source = 'local' }) {
  if (!String(idea || '').trim()) throw new Error('اكتبي فكرة الفيديو أولًا');
  const analysis = analyzeIdea(idea, { kind });
  const baseSeed = ((seed ?? hashStr(`${idea}|${kind}|${address}`)) >>> 0) || 1;
  const rng = rngFrom(baseSeed);
  const story = buildStory(analysis, { kind, seconds });

  const used = { art: new Set(), icons: new Set(), assets: new Set(), texts: new Set() };
  let fi = 0;
  const beats = story.roles.map((role, i) => {
    const b = writeBeat(role, analysis, { rng, addr: address, used: used.texts, featureKey: role === 'feature' ? story.featureKeys[fi++] : null });
    b.id = `s${i + 1}`;
    applyBrief(b, brief?.beats?.[i], address);
    used.texts.add(plain(b.copy.headline));
    b.narration = b.narration || narrationOf(b);
    b.narrSec = round1(words(b.narration) / 2.4);
    return b;
  });
  labelBeats(beats);

  const freeAssets = Object.entries(assets).filter(([, a]) => a.type === 'image').map(([id]) => id);
  const st = { prev: {}, usedComps: new Set(), tones: [], prevFamily: null, prevComp: null, prevTrans: null };
  const scenes = [], slots = [];
  beats.forEach((b, i) => {
    const compId = chooseComposition(b.role, analysis, b, { rng, usedComps: st.usedComps, prevTone: st.tones.at(-1), prev2Tone: st.tones.at(-2), prevFamily: st.prevFamily, prevComp: st.prevComp });
    const comp = COMPOSITIONS[compId];
    const ctx = makeCtx({ rng, beat: b, analysis, used, freeAssets, prev: st.prev, tone: comp.tone });
    const { scene, slots: sl } = buildScene({ id: b.id, beat: b, compId, ctx, role: b.role });
    freeAssets.splice(0, freeAssets.length, ...ctx.freeAssets);
    if (i > 0) { scene.transitionIn = chooseTransition(b.role, st.prevTrans, rng); st.prevTrans = scene.transitionIn.type; }
    st.prev = { side: ctx.side, dir: ctx.dir, wordIn: ctx.m.wordIn, iconIn: ctx.m.iconIn, polIn: ctx.m.polIn, art: ctx.artStyle || st.prev.art };
    st.usedComps.add(compId); st.tones.push(comp.tone); st.prevFamily = comp.family; st.prevComp = compId;
    b.composition = compId; b.why = scene.plan.why; b.slotKeys = sl.map((x) => x.key);
    scenes.push(scene); slots.push(...sl.map((x) => ({ ...x, scene: b.id })));
  });

  const palette = { ...(BRAND.themes[theme] || BRAND.themes.milk) }; delete palette.label;
  const plan = {
    version: 2, source, idea, kind, address, seconds, seed: baseSeed, regen: 0, createdAt: new Date().toISOString(),
    analysis: analysisPublic(analysis), beats: beats.map(stripBeat), slots: slots.map(slotRecord), audio: null,
  };
  const spec = {
    name, fps: 30,
    meta: { title: title || 'مشروع جديد', kind, brand: BRAND.id, theme, idea, createdAt: plan.createdAt, plan },
    palette, audio: { vo: null, music: null, sfx: [] }, scenes,
  };
  plan.audio = buildAudio(spec);
  return { spec, plan };
}

const stripBeat = (b) => ({ id: b.id, role: b.role, label: b.label, copy: b.copy, iconHint: b.iconHint, slotKind: b.slotKind, featureKey: b.featureKey || null, composition: b.composition, why: b.why, slotKeys: b.slotKeys || [], narration: b.narration, narrSec: b.narrSec });
const slotRecord = (s) => ({ key: s.key, scene: s.scene, kind: s.kind, desc: s.desc, prompt: s.prompt, promptEn: s.promptEn });

// ---------- single-scene regeneration / smart add ----------
// modes: all (new copy + new layout) | copy (same layout, new wording) | layout (same wording, new layout) | new (add a scene of `role`)
export function replanScene({ spec, sceneId, mode = 'all', role = 'feature', afterId = null, seed, assets = {} }) {
  const plan0 = spec.meta?.plan;
  if (!plan0) throw new Error('هذا المشروع لا يملك خطة مولَّدة (أنشئيه من فكرة أولًا)');
  const plan = JSON.parse(JSON.stringify(plan0));
  plan.regen = (plan.regen || 0) + 1;
  const analysis = analyzeIdea(plan.idea, { kind: plan.kind });
  const scenes = spec.scenes;
  const rng = rngFrom(((seed ?? hashStr(`${plan.seed}|${sceneId || afterId}|${mode}|${plan.regen}`)) >>> 0) || 1);

  let idx, beat, oldScene = null;
  if (mode === 'new') {
    idx = Math.max(0, scenes.findIndex((s) => s.id === afterId)) + 1;
    let n = 1; const ids = new Set(scenes.map((s) => s.id)); while (ids.has('s' + n)) n++;
    beat = { id: 's' + n, role, copy: null };
  } else {
    idx = scenes.findIndex((s) => s.id === sceneId);
    if (idx < 0) throw new Error('المشهد غير موجود');
    oldScene = scenes[idx];
    const found = plan.beats.find((b) => b.id === sceneId) || { id: sceneId, role: oldScene.plan?.role || 'feature', copy: null };
    beat = JSON.parse(JSON.stringify(found));
  }

  const others = scenes.filter((s) => s.id !== sceneId);
  const used = usedFromScenes(others);
  const freeAssets = [];
  if (oldScene) for (const l of oldScene.layers) if (l.asset) freeAssets.push(l.asset); // keep the user's photos on this scene
  for (const [id, a] of Object.entries(assets)) if (a.type === 'image' && !used.assets.has(id) && !freeAssets.includes(id)) freeAssets.push(id); // unused uploaded photos come next

  // wording
  if (mode === 'new' || mode === 'copy' || mode === 'all') {
    const prevHead = beat.copy ? plain(beat.copy.headline) : null;
    if (prevHead) used.texts.add(prevHead);
    const featUsed = new Set(plan.beats.filter((b) => b.id !== beat.id && b.featureKey).map((b) => b.featureKey));
    let featureKey = beat.featureKey || null;
    if (beat.role === 'feature' && (!featureKey || mode === 'new')) {
      const keys = ['custom', 'quality', 'packaging', 'cover', 'delivery', 'fast', 'qr', 'pages'];
      const fresh = keys.filter((k) => !featUsed.has(k));
      featureKey = rng.pick(fresh.length ? fresh : keys);
    }
    const nb = writeBeat(beat.role, analysis, { rng, addr: plan.address, used: used.texts, featureKey });
    beat.copy = nb.copy; beat.iconHint = nb.iconHint; beat.slotKind = nb.slotKind; beat.featureKey = nb.featureKey || featureKey || null;
    beat.narration = narrationOf(beat); beat.narrSec = round1(words(beat.narration) / 2.4);
  }
  if (mode === 'new') { beat.label = ROLE_LABELS[role]; }

  // layout
  const prevScene = scenes[idx - 1];
  const prevMotion = prevScene?.plan?.motion || {};
  const prevComp = prevScene?.plan?.composition || null;
  const prevTone = prevScene?.plan?.tone || null;
  const nextScene = scenes[idx + (mode === 'new' ? 0 : 1)];
  const exclude = [];
  if (mode === 'layout' || mode === 'all') if (oldScene?.plan?.composition) exclude.push(oldScene.plan.composition);
  if (prevComp) exclude.push(prevComp);
  if (nextScene?.plan?.composition) exclude.push(nextScene.plan.composition);
  const usedComps = new Set(others.map((s) => s.plan?.composition).filter(Boolean));
  const force = mode === 'copy' && oldScene?.plan?.composition && (oldScene.plan.composition in COMPOSITIONS) ? oldScene.plan.composition : null;
  let compId = chooseComposition(beat.role, analysis, beat, { rng, usedComps, prevTone, prev2Tone: scenes[idx - 2]?.plan?.tone, prevFamily: prevScene?.plan?.composition ? COMPOSITIONS[prevScene.plan.composition]?.family : null, prevComp, force, exclude });
  if (!compId) compId = 'icon-hero';
  const comp = COMPOSITIONS[compId];
  const ctx = makeCtx({ rng, beat: { ...beat, label: beat.label }, analysis, used, freeAssets, prev: prevMotion, tone: comp.tone });
  ctx.beat = beat;
  const { scene, slots } = buildScene({ id: beat.id, beat, compId, ctx, role: beat.role });
  scene.title = beat.label || ROLE_LABELS[beat.role];
  const prevTrans = prevScene?.transitionIn?.type || null;
  if (idx > 0) {
    if (mode === 'copy' && oldScene?.transitionIn) scene.transitionIn = oldScene.transitionIn;
    else {
      let tr = chooseTransition(beat.role, prevTrans, rng);
      if (nextScene?.transitionIn?.type === tr.type && mode !== 'new') tr = chooseTransition(beat.role, tr.type, rng);
      scene.transitionIn = tr;
    }
  }
  beat.composition = compId; beat.why = scene.plan.why; beat.slotKeys = slots.map((x) => x.key);

  // merge into plan
  if (mode === 'new') plan.beats.splice(idx, 0, stripBeat(beat));
  else plan.beats[plan.beats.findIndex((b) => b.id === beat.id)] = stripBeat(beat);
  plan.slots = plan.slots.filter((s) => s.scene !== beat.id).concat(slots.map((x) => ({ ...slotRecord(x), scene: beat.id })));

  const newScenes = [...scenes];
  if (mode === 'new') newScenes.splice(idx, 0, scene); else newScenes[idx] = scene;
  const draft = { ...spec, scenes: newScenes, meta: { ...spec.meta, plan } };
  plan.audio = buildAudio(draft);
  return { scene, plan, index: idx };
}

// ---------- audio suggestions (text only — nothing is generated) ----------
const MUSIC = {
  emotional: { mood: 'بيانو دافئ وهادئ مع وتريات ناعمة', bpm: '70–80', notes: 'ارتفاع بسيط عند كشف المنتج، ثم هدوء عند الدعوة' },
  celebratory: { mood: 'ألحان خفيفة مبهجة بإيقاع احتفالي', bpm: '100–110', notes: 'نبضات خفيفة تتزامن مع الانتقالات' },
  elegant: { mood: 'وتريات أنيقة هادئة مع لمسة بيانو', bpm: '80', notes: 'مساحة صمت قصيرة قبل اسم البراند' },
  urgent: { mood: 'إيقاع أخف سرعة مع نهاية مفعمة بالأمل', bpm: '105–115', notes: 'تصاعد قبل العرض ثم نبرة دافئة في الختام' },
};
const SFX_BY_TRANS = { wipe: ['whoosh', 'مسحة هواء قصيرة'], bars: ['whoosh', 'ضربات خفيفة متتابعة'], slide: ['whoosh', 'انزلاق ناعم'], satin: ['silk', 'حفيف قماش ساتان'], iris: ['swell', 'تضخم ناعم'] };

export function buildAudio(spec) {
  const plan = spec.meta?.plan;
  const tl = timeline(spec.scenes);
  const beats = plan?.beats || [];
  const lines = spec.scenes.map((s, i) => {
    const b = beats.find((x) => x.id === s.id);
    const text = b?.narration || '';
    const w = words(text), sec = round1(w / 2.4);
    return { scene: s.id, title: s.title, start: round1(tl[i].start), text, words: w, narrSec: sec, fits: !text || sec <= s.duration - 0.4 };
  }).filter((l) => l.text);
  const sfx = [];
  spec.scenes.forEach((s, i) => {
    const st = tl[i].start;
    if (i > 0 && SFX_BY_TRANS[s.transitionIn?.type]) sfx.push({ at: round1(st), scene: s.id, type: SFX_BY_TRANS[s.transitionIn.type][0], note: SFX_BY_TRANS[s.transitionIn.type][1] });
    for (const l of s.layers) {
      const at = round1(st + (l.at || 0));
      if (l.type === 'sparkles') sfx.push({ at, scene: s.id, type: 'shimmer', note: 'تلألؤ خفيف مع اللمسات السحرية' });
      else if (l.type === 'ribbon') sfx.push({ at, scene: s.id, type: 'silk', note: 'حفيف ساتان مع رسم الشريط' });
      else if (l.type === 'book' || l.type === 'invite') sfx.push({ at, scene: s.id, type: 'soft-thud', note: 'نقرة ناعمة عند ظهور المنتج' });
      else if (l.type === 'bow') sfx.push({ at, scene: s.id, type: 'chime', note: 'رنّة قصيرة مع الفيونكة' });
      else if (l.type === 'text' && (l.wordIn === 'pop') && l.weight === 900) sfx.push({ at, scene: s.id, type: 'hit', note: 'ضربة قصيرة مع الرقم' });
    }
  });
  sfx.sort((a, b) => a.at - b.at);
  const total = tl.length ? tl[tl.length - 1].end : 0;
  const tone = MUSIC[plan?.analysis?.tone] ? plan.analysis.tone : 'emotional';
  const narrTotal = round1(lines.reduce((a, l) => a + l.narrSec, 0));
  return {
    voiceover: { script: lines.map((l) => l.text).join('\n'), lines, words: lines.reduce((a, l) => a + l.words, 0), seconds: narrTotal, videoSeconds: round1(total),
      note: 'اقتراح نص للتعليق الصوتي بسرعة قراءة ≈ 2.4 كلمة/ثانية. لم يُولَّد أي صوت؛ سجّليه أو ولّديه بخدمتك ثم أضيفيه إلى audio.vo.' },
    music: { ...MUSIC[tone], note: undefined, suggestion: MUSIC[tone].notes, duration: round1(total), duck: 'يُخفض تلقائيًا تحت الصوت عند إضافته' },
    sfx,
  };
}

export function collectSlots(spec) {
  const plan = spec.meta?.plan; const out = [];
  spec.scenes.forEach((s) => s.layers.forEach((l, li) => {
    if (!l.slot) return;
    const meta = plan?.slots?.find((x) => x.key === l.slot) || {};
    out.push({ key: l.slot, scene: s.id, sceneTitle: s.title, layerIndex: li, asset: l.asset || null, status: l.asset ? 'asset' : 'illustration', desc: meta.desc || 'صورة', prompt: meta.prompt || '', promptEn: meta.promptEn || '' });
  }));
  return out;
}

export function storyFor({ idea, kind = 'reel', seconds = 25 }) {
  const analysis = analyzeIdea(idea, { kind });
  return { analysis, roles: buildStory(analysis, { kind, seconds }).roles };
}
