import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIdea } from '../studio/planner/analyze.mjs';
import { planProject, replanScene, buildAudio, collectSlots, storyFor } from '../studio/planner/index.mjs';
import { plain } from '../studio/planner/copy.mjs';
import { wrapLines } from '../studio/planner/compose.mjs';
import { check, IDEA } from './helpers.mjs';

const sig = (s) => JSON.stringify(s);
const slotWarn = (w) => /الصورة المطلوبة|Polaroid بلا صورة/.test(w);

test('analysis: product, occasion, offer, ctaKind; "أبي" (I want) is not "my father"', () => {
  const a = analyzeIdea('أبي ريل لكتب الذكريات هدية للأم في عيد الأم، خصم 20% لفترة محدودة، اطلبي من رابط البايو');
  assert.equal(a.product, 'memory_book'); assert.equal(a.occasion, 'mothers_day');
  assert.equal(a.offer.discount, 20); assert.equal(a.offer.deadline, true); assert.equal(a.ctaKind, 'link');
  assert.equal(analyzeIdea('دعوات زفاف إلكترونية').product, 'e_invite');
  assert.equal(analyzeIdea('دعوات مطبوعة للتخرج').product, 'invitation');
  assert.equal(analyzeIdea('ريل لطباعة الصور بسعر 49 ريال خلال 3 أيام').offer.price.value, 49);
  assert.deepEqual(analyzeIdea('«ليلة العمر تبدأ هنا» دعوات').quoted, ['ليلة العمر تبدأ هنا']);
});

test('new-idea plan: 6–8 custom scenes, varied compositions/motion/transitions, validates', () => {
  const { spec, plan } = planProject({ idea: IDEA, seconds: 30, title: 't', name: 'x' });
  const n = spec.scenes.length;
  assert.ok(n >= 6 && n <= 8, `scenes=${n}`);
  const comps = spec.scenes.map((s) => s.plan.composition);
  assert.equal(new Set(comps).size, n, 'every scene uses a different composition: ' + comps);
  for (let i = 1; i < n; i++) assert.notEqual(spec.scenes[i].transitionIn.type, spec.scenes[i - 1].transitionIn?.type, 'adjacent transitions differ');
  assert.ok(new Set(spec.scenes.map((s) => s.plan.motion.wordIn)).size >= 3, 'word-reveal presets vary');
  assert.ok(new Set(spec.scenes.map((s) => s.plan.tone)).size === 2, 'milk and red scenes both present');
  assert.ok(spec.scenes.some((s) => s.layers.some((l) => l.type === 'polaroid')) && spec.scenes.some((s) => s.layers.some((l) => ['book', 'prints', 'invite'].includes(l.type))), 'brand objects used');
  // brand objects are chosen, not dumped into every scene
  const ribbons = spec.scenes.filter((s) => s.layers.some((l) => l.type === 'ribbon')).length;
  assert.ok(ribbons < n, `ribbon in ${ribbons}/${n}`);
  // customised to the idea
  const all = spec.scenes.flatMap((s) => s.layers.filter((l) => l.type === 'text').map((l) => plain(l.text))).join(' ');
  assert.match(all, /15%/); assert.match(all, /توصيل/); assert.match(all, /البايو/);
  assert.equal(plan.beats.at(-1).role, 'cta'); assert.ok(plan.beats.some((b) => b.role === 'offer'));
  const { errors, warns } = check(spec);
  assert.deepEqual(errors, []);
  assert.deepEqual(warns.filter((w) => !slotWarn(w)), [], 'no layout warnings (safe zones, margins)');
});

test('text fits its box by construction (≤ 4 lines) and stays above the bottom UI zone', () => {
  for (const kind of ['reel', 'product', 'intro']) {
    const { spec } = planProject({ idea: IDEA, kind, seconds: 30 });
    for (const s of spec.scenes) for (const l of s.layers) if (l.type === 'text' && l.reveal !== 'block') {
      assert.ok(wrapLines(l.text, l.size, l.w, l.weight || 800) <= 4, `${s.id} too many lines: ${l.text}`);
    }
  }
});

test('deterministic for the same seed, different for another seed', () => {
  const a = planProject({ idea: IDEA, seed: 7 }), b = planProject({ idea: IDEA, seed: 7 }), c = planProject({ idea: IDEA, seed: 8 });
  const strip = (x) => sig(x.spec.scenes);
  assert.equal(strip(a), strip(b)); assert.notEqual(strip(a), strip(c));
});

test('different ideas give different plans (not one fixed template)', () => {
  const ideas = ['ريل لدعوات زفاف إلكترونية «ليلة العمر تبدأ برابط» اطلبي من واتساب', 'إعلان لطباعة الصور بسعر 49 ريال خلال 3 أيام', 'فيديو لهدية تخرج: كتاب ذكريات لخريجة، تغليف هدية', IDEA];
  const plans = ideas.map((idea) => planProject({ idea, seconds: 26 }));
  const sigs = plans.map((p) => p.spec.scenes.map((s) => s.plan.composition).join('>'));
  assert.equal(new Set(sigs).size, 4, sigs.join(' | '));
  assert.match(plan0(plans[0]), /ليلة العمر تبدأ برابط/); assert.match(plan0(plans[0]), /واتساب/);
  assert.match(plan0(plans[1]), /49/);
  assert.match(plan0(plans[2]), /التخرج|تخرج|الخريجة|خريج|حلمك/);
  for (const p of plans) assert.deepEqual(check(p.spec).errors, []);
});
const plan0 = (p) => p.spec.scenes.flatMap((s) => s.layers.filter((l) => l.type === 'text').map((l) => plain(l.text))).join(' | ');

test('regenerate one scene: others untouched; modes behave; result validates', () => {
  const { spec } = planProject({ idea: IDEA, seconds: 30, seed: 11 });
  const target = spec.scenes[3].id;
  const others = (sp) => sig(sp.scenes.filter((s) => s.id !== target));
  const before = others(spec);
  const old = spec.scenes[3];

  for (const mode of ['all', 'copy', 'layout']) {
    const r = replanScene({ spec, sceneId: target, mode, seed: 5 + mode.length });
    assert.equal(r.scene.id, target);
    const next = { ...spec, scenes: spec.scenes.map((s) => (s.id === target ? r.scene : s)), meta: { ...spec.meta, plan: r.plan } };
    assert.equal(others(next), before, `${mode}: other scenes unchanged`);
    assert.deepEqual(check(next).errors, [], `${mode}: validates`);
    if (mode === 'copy') { assert.equal(r.scene.plan.composition, old.plan.composition); assert.notEqual(sig(r.scene.layers.filter((l) => l.type === 'text')), sig(old.layers.filter((l) => l.type === 'text'))); }
    if (mode === 'layout') { assert.notEqual(r.scene.plan.composition, old.plan.composition); assert.equal(r.plan.beats.find((b) => b.id === target).copy.headline, spec.meta.plan.beats.find((b) => b.id === target).copy.headline); }
    if (mode === 'all') assert.notEqual(sig(r.scene), sig(old));
    assert.notEqual(r.scene.plan.composition, spec.scenes[2].plan.composition, `${mode}: differs from previous scene`);
  }
});

test('add a smart scene after another one (role-based)', () => {
  const { spec } = planProject({ idea: IDEA, seconds: 26, seed: 3 });
  const r = replanScene({ spec, mode: 'new', role: 'steps', afterId: spec.scenes[2].id, seed: 9 });
  assert.equal(r.index, 3); assert.ok(!spec.scenes.some((s) => s.id === r.scene.id));
  const next = { ...spec, scenes: [...spec.scenes.slice(0, 3), r.scene, ...spec.scenes.slice(3)], meta: { ...spec.meta, plan: r.plan } };
  assert.equal(next.scenes.length, spec.scenes.length + 1);
  assert.deepEqual(check(next).errors, []);
  assert.equal(r.plan.beats[3].role, 'steps');
});

test('uploaded product photos are used first (unique per slot) and slots list stays accurate', () => {
  const assets = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((k) => [`p_${k}`, { type: 'image', file: `media/p_${k}.jpg`, license: 'own' }]));
  const { spec } = planProject({ idea: IDEA, seconds: 30, assets });
  const used = spec.scenes.flatMap((s) => s.layers.filter((l) => l.type === 'polaroid' && l.asset).map((l) => l.asset));
  assert.ok(used.length >= 1); assert.equal(new Set(used).size, used.length, 'no photo reused');
  const slots = collectSlots(spec);
  assert.ok(slots.length >= used.length); assert.ok(slots.every((s) => s.prompt && s.promptEn));
  const { errors } = check(spec, assets); assert.deepEqual(errors, []);
});

test('audio suggestions: voiceover script, music, SFX cues synced to the timeline', () => {
  const { spec, plan } = planProject({ idea: IDEA, seconds: 30, seed: 2 });
  const au = buildAudio(spec);
  assert.ok(au.voiceover.lines.length === spec.scenes.length); assert.ok(au.voiceover.words > 20);
  assert.ok(au.music.mood); assert.ok(au.sfx.length >= spec.scenes.length - 1);
  assert.ok(au.sfx.every((c, i, a) => i === 0 || a[i - 1].at <= c.at));
  assert.equal(plan.audio.voiceover.script, au.voiceover.script);
});

test('story roles follow product/kind', () => {
  assert.deepEqual(storyFor({ idea: 'ريل لكتب الذكريات', seconds: 30 }).roles.at(-1), 'cta');
  assert.ok(storyFor({ idea: 'تعريف بالبراند', kind: 'intro', seconds: 26 }).roles.includes('services'));
  assert.ok(storyFor({ idea: 'إعلان بخصم 10%', kind: 'product', seconds: 26 }).roles.includes('offer'));
});
