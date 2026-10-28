import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findSessionFiles, readRecords, defaultClaudeDirs } from '../src/sessions.js';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'vibe wrapped '));
  const project = path.join(root, 'projects', '-Users-me-My App');
  await mkdir(path.join(project, 'abc', 'subagents'), { recursive: true });
  await writeFile(path.join(project, 'abc.jsonl'), '{"type":"user"}\nnot json\n\n{"type":"assistant"}\n');
  await writeFile(path.join(project, 'abc', 'subagents', 'agent-1.jsonl'), '{"type":"assistant"}\n');
  await writeFile(path.join(project, 'empty.jsonl'), '');
  await writeFile(path.join(project, 'notes.txt'), 'ignore me');
  return root;
}

test('finds main and subagent session files under projects/, ignoring other files', async () => {
  const root = await fixture();
  const files = await findSessionFiles(root);
  assert.deepEqual(
    files.map((f) => [path.basename(f.path), f.isSubagent]).sort(),
    [['abc.jsonl', false], ['agent-1.jsonl', true], ['empty.jsonl', false]],
  );
});

test('returns no files when the directory has no projects/', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'vibewrapped-empty-'));
  assert.deepEqual(await findSessionFiles(root), []);
});

test('reads records, skipping blank and malformed lines', async () => {
  const root = await fixture();
  const files = await findSessionFiles(root);
  const records = [];
  for await (const r of readRecords(files)) records.push([path.basename(r.file), r.record.type, r.isSubagent]);
  assert.deepEqual(records.sort(), [
    ['abc.jsonl', 'assistant', false],
    ['abc.jsonl', 'user', false],
    ['agent-1.jsonl', 'assistant', true],
  ]);
});

test('prefers CLAUDE_CONFIG_DIR over the home directory', () => {
  assert.deepEqual(defaultClaudeDirs({ CLAUDE_CONFIG_DIR: '/x/claude' }, '/home/me'), ['/x/claude']);
  assert.deepEqual(defaultClaudeDirs({}, '/home/me'), [path.join('/home/me', '.claude')]);
});

test('skips files that disappear or cannot be read, and reports them', async () => {
  const root = await fixture();
  const files = [...(await findSessionFiles(root)), { path: path.join(root, 'gone.jsonl'), isSubagent: false }];
  const failed = [];
  const records = [];
  for await (const r of readRecords(files, (file) => failed.push(path.basename(file)))) records.push(r);
  assert.equal(records.length, 3);
  assert.deepEqual(failed, ['gone.jsonl']);
});
