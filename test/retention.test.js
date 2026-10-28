import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { keepHistory, retentionDays, KEEP_DAYS } from '../src/retention.js';

async function dir() {
  return mkdtemp(path.join(tmpdir(), 'vibewrapped-keep-'));
}

test('creates settings.json with long retention when none exists', async () => {
  const d = await dir();
  const result = await keepHistory(d);
  assert.deepEqual(result, { before: null, after: KEEP_DAYS });
  assert.deepEqual(JSON.parse(await readFile(path.join(d, 'settings.json'), 'utf8')), { cleanupPeriodDays: KEEP_DAYS });
});

test('raises retention while keeping every other key', async () => {
  const d = await dir();
  await writeFile(path.join(d, 'settings.json'), JSON.stringify({ model: 'opus', cleanupPeriodDays: 30 }));
  assert.deepEqual(await keepHistory(d), { before: 30, after: KEEP_DAYS });
  assert.deepEqual(JSON.parse(await readFile(path.join(d, 'settings.json'), 'utf8')), { model: 'opus', cleanupPeriodDays: KEEP_DAYS });
});

test('leaves a longer retention untouched', async () => {
  const d = await dir();
  await writeFile(path.join(d, 'settings.json'), JSON.stringify({ cleanupPeriodDays: 99999 }));
  assert.deepEqual(await keepHistory(d), { before: 99999, after: 99999 });
});

test('refuses to touch a settings file that is not valid JSON', async () => {
  const d = await dir();
  await writeFile(path.join(d, 'settings.json'), '{ "model": "opus", }');
  await assert.rejects(keepHistory(d), /not valid JSON/);
  assert.equal(await readFile(path.join(d, 'settings.json'), 'utf8'), '{ "model": "opus", }');
});

test('reports the default retention of 30 days when unset', async () => {
  const d = await dir();
  assert.equal(await retentionDays(d), 30);
  await writeFile(path.join(d, 'settings.json'), JSON.stringify({ cleanupPeriodDays: 365 }));
  assert.equal(await retentionDays(d), 365);
});

test('refuses settings that are valid JSON but not an object', async () => {
  for (const raw of ['[1]', 'null', '"x"']) {
    const d = await dir();
    await writeFile(path.join(d, 'settings.json'), raw);
    await assert.rejects(keepHistory(d), /not a JSON object/);
    assert.equal(await readFile(path.join(d, 'settings.json'), 'utf8'), raw);
  }
});

test('fails clearly when the config dir does not exist', async () => {
  await assert.rejects(keepHistory(path.join(await dir(), 'missing')), /does not exist/);
});
