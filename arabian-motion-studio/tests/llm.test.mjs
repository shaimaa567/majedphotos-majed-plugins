import test from 'node:test';
import assert from 'node:assert/strict';
import { llmBrief, validateBrief, buildPrompt, llmStatus } from '../studio/planner/llm.mjs';
import { planProject, storyFor } from '../studio/planner/index.mjs';
import { check, IDEA } from './helpers.mjs';

const stubClient = (fn) => ({ messages: { parse: async (req) => fn(req) } });

test('LLM planner: request shape + brief is merged into the local plan (stub client — not the live API)', async () => {
  const { analysis, roles } = storyFor({ idea: IDEA, seconds: 26 });
  let seen;
  const brief = { beats: roles.map((role, i) => ({ role, headline: `عنوان *تجريبي* ${i + 1}`, sub: `سطر داعم ${i + 1}`, items: ['أ', 'ب', 'ج'], narration: `تعليق ${i + 1}` })) };
  const got = await llmBrief({ idea: IDEA, analysis, roles, client: stubClient((req) => { seen = req; return { stop_reason: 'end_turn', parsed_output: brief }; }) });
  assert.equal(seen.model, 'claude-opus-5-5'); assert.equal(seen.output_config.effort, 'low'); assert.ok(seen.output_config.format);
  assert.equal('thinking' in seen, false); assert.equal('temperature' in seen, false);
  assert.match(seen.messages[0].content, new RegExp(roles.join('.*'))); assert.match(seen.system, /المؤنث/);
  const { spec, plan } = planProject({ idea: IDEA, seconds: 26, brief: got, source: 'llm' });
  assert.equal(plan.source, 'llm');
  assert.match(plan.beats[0].copy.headline, /^عنوان \*تجريبي\* 1/); assert.equal(plan.beats[0].narration, 'تعليق 1');
  assert.deepEqual(check(spec).errors, []);
});

test('LLM planner rejects refusals, empty and malformed output (caller falls back to local)', async () => {
  const { analysis, roles } = storyFor({ idea: IDEA, seconds: 26 });
  await assert.rejects(llmBrief({ idea: IDEA, analysis, roles, client: stubClient(() => ({ stop_reason: 'refusal', parsed_output: null })) }), /refusal/);
  await assert.rejects(llmBrief({ idea: IDEA, analysis, roles, client: stubClient(() => ({ stop_reason: 'end_turn', parsed_output: null })) }), /تحليل/);
  await assert.rejects(llmBrief({ idea: IDEA, analysis, roles, client: stubClient(() => ({ stop_reason: 'end_turn', parsed_output: { beats: [] } })) }), /غير صالح/);
  assert.ok(validateBrief({ beats: [{ role: 'cta', headline: 'مكرر', sub: 'مكرر', items: null, narration: 'x' }] }, ['cta']).some((e) => /مكرر/.test(e)));
  assert.ok(validateBrief({ beats: [{ role: 'hook', headline: 'abc', sub: null, items: null, narration: 'x' }] }, ['cta']).length);
  assert.equal(typeof buildPrompt({ idea: 'x', analysis, roles, address: 'm' }).system, 'string');
});

test('LLM status reflects environment only', () => {
  const old = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
  assert.equal(llmStatus().configured, false); assert.equal(llmStatus().tested, false);
  process.env.ANTHROPIC_API_KEY = 'x'; assert.equal(llmStatus().configured, true);
  if (old === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = old;
});
