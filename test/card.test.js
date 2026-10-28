import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCardSvg, highlight } from '../src/card.js';

const stats = {
  range: { first: '2026-01-03T12:00:00Z', last: '2026-10-28T12:00:00Z' },
  sessions: 327, subagentRuns: 241, prompts: 1052, interrupts: 40, politePrompts: 12,
  messages: 6115, toolCalls: 5900, absolutelyRight: 312, catchphrases: [{ name: 'Let me…', count: 900 }],
  tokens: { input: 1, output: 1, cacheRead: 1, cacheWrite: 1, total: 2_400_000_000 },
  costUSD: 1234.5, topTools: [{ name: 'Bash', count: 3000 }], topModels: [{ name: 'claude-opus-5-5', count: 5000 }],
  activeDays: 120, longestStreak: 21, peakHour: 15, hours: Array(24).fill(1),
  activeMinutes: 18_000, longestSessionMinutes: 400,
};

test('renders the headline numbers, persona and date range', () => {
  const svg = renderCardSvg(stats, { timeZone: 'UTC' });
  for (const expected of ['2.4B', '327', '300', '21', '1.1K', '5.9K', '3 PM', 'The Orchestrator', 'Jan 3 – Oct 28, 2026', '312']) {
    assert.ok(svg.includes(expected), `missing ${expected}`);
  }
  assert.ok(svg.startsWith('<svg'));
});

test('never puts project paths or branch names on the card', () => {
  const svg = renderCardSvg(stats, { timeZone: 'UTC' });
  assert.ok(!svg.includes('/Users/'));
});

test('highlight prefers "absolutely right", then the top catchphrase, then other fallbacks', () => {
  assert.equal(highlight(stats).quote, '“You’re absolutely right!”');
  assert.deepEqual(highlight({ ...stats, absolutelyRight: 9 }), { quote: '“Let me…”', count: 900, caption: 'Claude’s catchphrase: times it said it to you' });
  const noPhrases = { ...stats, catchphrases: [] };
  assert.deepEqual(highlight({ ...noPhrases, absolutelyRight: 0 }), { quote: 'Esc pressed mid-answer', count: 40, caption: 'times you stopped Claude to correct it' });
  assert.equal(highlight({ ...noPhrases, absolutelyRight: 0, interrupts: 0 }).quote, 'please & thank you');
  assert.equal(highlight({ ...noPhrases, absolutelyRight: 0, interrupts: 0, politePrompts: 0 }).caption, 'prompts sent');
});
