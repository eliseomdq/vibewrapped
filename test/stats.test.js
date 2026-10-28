import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../src/stats.js';

const TZ = 'UTC';

function assistant({ id, ts, model = 'claude-opus-5-5', block, usage, sidechain = false }) {
  return {
    type: 'assistant',
    timestamp: ts,
    isSidechain: sidechain,
    message: {
      id,
      model,
      content: [block],
      usage: usage ?? { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000, cache_creation_input_tokens: 50 },
    },
  };
}

function prompt(ts, content) {
  return { type: 'user', timestamp: ts, isSidechain: false, message: { role: 'user', content } };
}

async function* source(files) {
  for (const [file, records, isSubagent = false] of files) {
    for (const record of records) yield { file, record, isSubagent };
  }
}

test('counts usage once per message id even when the message spans several lines', async () => {
  const lines = [
    assistant({ id: 'm1', ts: '2026-03-01T10:00:00Z', block: { type: 'text', text: 'hi' } }),
    assistant({ id: 'm1', ts: '2026-03-01T10:00:01Z', block: { type: 'tool_use', id: 't1', name: 'Bash', input: {} } }),
  ];
  const stats = await computeStats(source([['a.jsonl', lines]]), { timeZone: TZ });
  assert.deepEqual(stats.tokens, { input: 10, output: 100, cacheRead: 1000, cacheWrite: 50, total: 1160 });
  assert.equal(stats.messages, 1);
});

test('counts each tool call once by tool_use id and ranks tools', async () => {
  const lines = [
    assistant({ id: 'm1', ts: '2026-03-01T10:00:00Z', block: { type: 'tool_use', id: 't1', name: 'Bash', input: {} } }),
    assistant({ id: 'm1', ts: '2026-03-01T10:00:00Z', block: { type: 'tool_use', id: 't1', name: 'Bash', input: {} } }),
    assistant({ id: 'm2', ts: '2026-03-01T10:01:00Z', block: { type: 'tool_use', id: 't2', name: 'Edit', input: {} } }),
    assistant({ id: 'm3', ts: '2026-03-01T10:02:00Z', block: { type: 'tool_use', id: 't3', name: 'Bash', input: {} } }),
  ];
  const stats = await computeStats(source([['a.jsonl', lines]]), { timeZone: TZ });
  assert.equal(stats.toolCalls, 3);
  assert.deepEqual(stats.topTools, [{ name: 'Bash', count: 2 }, { name: 'Edit', count: 1 }]);
});

test('counts real prompts, skipping tool results, system notifications and interrupts', async () => {
  const lines = [
    prompt('2026-03-01T10:00:00Z', 'fix the login bug please'),
    prompt('2026-03-01T10:05:00Z', '<task-notification>done</task-notification>'),
    prompt('2026-03-01T10:06:00Z', [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }]),
    prompt('2026-03-01T10:07:00Z', [{ type: 'text', text: '[Request interrupted by user]' }]),
    prompt('2026-03-01T10:08:00Z', [{ type: 'text', text: 'gracias, ahora el logout' }]),
  ];
  const stats = await computeStats(source([['a.jsonl', lines]]), { timeZone: TZ });
  assert.equal(stats.prompts, 2);
  assert.equal(stats.interrupts, 1);
  assert.equal(stats.politePrompts, 2);
});

test('counts "you\'re absolutely right" once per distinct text block, in English and Spanish', async () => {
  const lines = [
    assistant({ id: 'm1', ts: '2026-03-01T10:00:00Z', block: { type: 'text', text: "You're absolutely right! Let me fix that." } }),
    assistant({ id: 'm1', ts: '2026-03-01T10:00:00Z', block: { type: 'text', text: "You're absolutely right! Let me fix that." } }),
    assistant({ id: 'm2', ts: '2026-03-01T10:01:00Z', block: { type: 'text', text: 'Tenés toda la razón, me equivoqué.' } }),
    assistant({ id: 'm3', ts: '2026-03-01T10:02:00Z', block: { type: 'text', text: 'Done.' } }),
  ];
  const stats = await computeStats(source([['a.jsonl', lines]]), { timeZone: TZ });
  assert.equal(stats.absolutelyRight, 2);
});

test('ranks Claude\'s catchphrases, counting each text block once', async () => {
  const lines = [
    assistant({ id: 'm1', ts: '2026-03-01T10:00:00Z', block: { type: 'text', text: 'Let me check the logs.' } }),
    assistant({ id: 'm1', ts: '2026-03-01T10:00:00Z', block: { type: 'text', text: 'Let me check the logs.' } }),
    assistant({ id: 'm2', ts: '2026-03-01T10:01:00Z', block: { type: 'text', text: 'Good catch. Let me fix it.' } }),
    assistant({ id: 'm3', ts: '2026-03-01T10:02:00Z', block: { type: 'text', text: 'Perfect! Tests pass.' } }),
    assistant({ id: 'm4', ts: '2026-03-01T10:03:00Z', block: { type: 'text', text: 'Tenés razón, me equivoqué.' } }),
  ];
  const stats = await computeStats(source([['a.jsonl', lines]]), { timeZone: TZ });
  assert.deepEqual(stats.catchphrases[0], { name: 'Let me…', count: 2 });
  assert.equal(stats.catchphrases.length, 3);
});

test('uses the last cost-state per file and reports null cost when no file has one', async () => {
  const withCost = [
    { type: 'cost-state', totalCostUSD: 1.5 },
    { type: 'cost-state', totalCostUSD: 4.25 },
  ];
  const stats = await computeStats(source([['a.jsonl', withCost], ['b.jsonl', [{ type: 'cost-state', totalCostUSD: 0.75 }]]]), { timeZone: TZ });
  assert.equal(stats.costUSD, 5);

  const noCost = await computeStats(source([['c.jsonl', [prompt('2026-03-01T10:00:00Z', 'hi')]]]), { timeZone: TZ });
  assert.equal(noCost.costUSD, null);
});

test('separates sessions from subagent runs and keeps subagent tokens', async () => {
  const main = [prompt('2026-03-01T10:00:00Z', 'go'), assistant({ id: 'm1', ts: '2026-03-01T10:00:05Z', block: { type: 'text', text: 'ok' } })];
  const sub = [assistant({ id: 's1', ts: '2026-03-01T10:01:00Z', sidechain: true, block: { type: 'text', text: 'sub' } })];
  const stats = await computeStats(source([['a.jsonl', main], ['a/subagents/x.jsonl', sub, true]]), { timeZone: TZ });
  assert.equal(stats.sessions, 1);
  assert.equal(stats.subagentRuns, 1);
  assert.equal(stats.tokens.total, 2320);
});

test('ignores synthetic models and ranks real ones by message count', async () => {
  const lines = [
    assistant({ id: 'm1', ts: '2026-03-01T10:00:00Z', model: 'claude-opus-5-5', block: { type: 'text', text: 'a' } }),
    assistant({ id: 'm2', ts: '2026-03-01T10:00:00Z', model: 'claude-opus-5-5', block: { type: 'text', text: 'b' } }),
    assistant({ id: 'm3', ts: '2026-03-01T10:00:00Z', model: 'claude-haiku-5-5', block: { type: 'text', text: 'c' } }),
    assistant({ id: 'm4', ts: '2026-03-01T10:00:00Z', model: '<synthetic>', block: { type: 'text', text: 'd' } }),
  ];
  const stats = await computeStats(source([['a.jsonl', lines]]), { timeZone: TZ });
  assert.deepEqual(stats.topModels, [{ name: 'claude-opus-5-5', count: 2 }, { name: 'claude-haiku-5-5', count: 1 }]);
});

test('computes active days, longest streak and peak prompt hour in the given time zone', async () => {
  const lines = [
    prompt('2026-03-01T03:00:00Z', 'a'),
    prompt('2026-03-02T03:10:00Z', 'b'),
    prompt('2026-03-03T03:20:00Z', 'c'),
    prompt('2026-03-10T15:00:00Z', 'd'),
  ];
  const utc = await computeStats(source([['a.jsonl', lines]]), { timeZone: 'UTC' });
  assert.equal(utc.activeDays, 4);
  assert.equal(utc.longestStreak, 3);
  assert.equal(utc.peakHour, 3);

  const ba = await computeStats(source([['a.jsonl', lines]]), { timeZone: 'America/Argentina/Buenos_Aires' });
  assert.equal(ba.peakHour, 0);
});

test('measures active time with gaps over 30 minutes treated as breaks', async () => {
  const lines = [
    prompt('2026-03-01T10:00:00Z', 'a'),
    prompt('2026-03-01T10:20:00Z', 'b'),
    prompt('2026-03-01T12:00:00Z', 'c'),
    prompt('2026-03-01T12:10:00Z', 'd'),
  ];
  const stats = await computeStats(source([['a.jsonl', lines]]), { timeZone: TZ });
  assert.equal(stats.activeMinutes, 30);
  assert.equal(stats.longestSessionMinutes, 30);
});

test('filters records outside the requested date range', async () => {
  const lines = [prompt('2025-12-31T23:00:00Z', 'old'), prompt('2026-01-02T10:00:00Z', 'new')];
  const stats = await computeStats(source([['a.jsonl', lines]]), { timeZone: TZ, since: new Date('2026-01-01T00:00:00Z') });
  assert.equal(stats.prompts, 1);
  assert.equal(stats.range.first, '2026-01-02T10:00:00.000Z');
});

test('returns empty stats for no data', async () => {
  const stats = await computeStats(source([]), { timeZone: TZ });
  assert.equal(stats.sessions, 0);
  assert.equal(stats.range, null);
  assert.equal(stats.peakHour, null);
});

test('takes the final usage of a message, since output_tokens grows while it streams', async () => {
  const lines = [
    assistant({ id: 'm1', ts: '2026-03-01T10:00:00Z', block: { type: 'text', text: 'a' }, usage: { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 } }),
    assistant({ id: 'm1', ts: '2026-03-01T10:00:02Z', block: { type: 'tool_use', id: 't1', name: 'Bash', input: {} }, usage: { input_tokens: 5, output_tokens: 300, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 } }),
  ];
  const stats = await computeStats(source([['a.jsonl', lines]]), { timeZone: TZ });
  assert.deepEqual(stats.tokens, { input: 5, output: 300, cacheRead: 100, cacheWrite: 0, total: 405 });
});

test('survives records with unexpected shapes', async () => {
  const lines = [
    prompt('2026-03-01T10:00:00Z', [{ type: 'text' }]),
    prompt('2026-03-01T10:00:00Z', [null, 42]),
    { type: 'user', timestamp: '2026-03-01T10:00:00Z' },
    assistant({ id: 'm1', ts: '2026-03-01T10:00:00Z', model: 42, block: null, usage: { input_tokens: 'x', output_tokens: null } }),
    { type: 'assistant', timestamp: '2026-03-01T10:00:00Z', message: 'nope' },
    null,
    'string record',
  ];
  const stats = await computeStats(source([['a.jsonl', lines]]), { timeZone: TZ });
  assert.equal(stats.prompts, 0);
  assert.equal(stats.tokens.total, 0);
  assert.deepEqual(stats.topModels, []);
});

test('skips meta records, compaction summaries and system tags, but keeps real prompts that start with <', async () => {
  const lines = [
    { ...prompt('2026-03-01T10:00:00Z', 'Caveat: generated by a local command'), isMeta: true },
    { ...prompt('2026-03-01T10:00:00Z', 'This session is being continued from a previous conversation'), isCompactSummary: true },
    prompt('2026-03-01T10:00:00Z', '<command-name>/clear</command-name>'),
    prompt('2026-03-01T10:00:00Z', '<local-command-stdout></local-command-stdout>'),
    prompt('2026-03-01T10:00:00Z', '<div> why is this not centered'),
    prompt('2026-03-01T10:00:00Z', [{ type: 'image', source: {} }, { type: 'text', text: 'what is wrong in this screenshot' }]),
  ];
  const stats = await computeStats(source([['a.jsonl', lines]]), { timeZone: TZ });
  assert.equal(stats.prompts, 2);
});

test('counts a prompt replayed into another file only once', async () => {
  const p = { ...prompt('2026-03-01T10:00:00Z', 'hello'), uuid: 'u1' };
  const stats = await computeStats(source([['a.jsonl', [p]], ['b.jsonl', [p]]]), { timeZone: TZ });
  assert.equal(stats.prompts, 1);
});

test('drops cost when a date range is requested, since cost-state is cumulative and undated', async () => {
  const lines = [{ type: 'cost-state', totalCostUSD: 9 }, prompt('2026-03-01T10:00:00Z', 'hi')];
  const stats = await computeStats(source([['a.jsonl', lines]]), { timeZone: TZ, since: new Date('2026-01-01T00:00:00Z') });
  assert.equal(stats.costUSD, null);
});
