import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listProviders, generateForProject, registerProvider, unregisterProvider, NotConfiguredError } from '../studio/imagegen/index.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mm-ig-'));

test('no provider ships: listing is empty and generation refuses honestly', async () => {
  assert.deepEqual(await listProviders(), []);
  await assert.rejects(generateForProject({ dir: tmp(), prompt: 'x' }), NotConfiguredError);
});

test('a configured provider (test double) generates and registers an asset; duplicates are detected', async () => {
  const dir = tmp(), png = Buffer.from('89504e470d0a1a0a0000', 'hex');
  registerProvider({ id: 'fake', label: 'Fake', envKey: 'FAKE_KEY', configured: () => true, generate: async () => png });
  try {
    assert.equal((await listProviders())[0].configured, true);
    const r = await generateForProject({ dir, prompt: 'p', promptEn: 'e', slot: 's1-1' });
    assert.match(r.assetId, /^ai_fake_1$/); assert.equal(r.asset.source, 'ai-generated'); assert.ok(fs.existsSync(path.join(dir, r.asset.file)));
    const again = await generateForProject({ dir, prompt: 'p' }); assert.equal(again.duplicate, true);
  } finally { unregisterProvider('fake'); }
});

test('unconfigured provider reports the missing key', async () => {
  registerProvider({ id: 'nokey', label: 'NoKey', envKey: 'NOKEY_API_KEY', configured: () => false, generate: async () => Buffer.alloc(1) });
  try { await assert.rejects(generateForProject({ dir: tmp(), providerId: 'nokey', prompt: 'x' }), /NOKEY_API_KEY|لا توجد خدمة/); } finally { unregisterProvider('nokey'); }
});
