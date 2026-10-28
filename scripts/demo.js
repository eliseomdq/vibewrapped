// Renders docs/card.png from sample stats, so the README never shows anyone's real usage.
import { writeFile } from 'node:fs/promises';
import { renderCardSvg } from '../src/card.js';
import { svgToPng } from '../src/render.js';

const sample = {
  range: { first: '2026-01-05T12:00:00Z', last: '2026-12-01T12:00:00Z' },
  sessions: 1284, subagentRuns: 310, prompts: 9412, interrupts: 388, politePrompts: 1210,
  messages: 61000, toolCalls: 88400, absolutelyRight: 4, catchphrases: [{ name: 'Let me…', count: 2140 }],
  tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 4_700_000_000 },
  costUSD: null, topTools: [{ name: 'Bash', count: 40000 }], topModels: [],
  activeDays: 212, longestStreak: 47, peakHour: 2, hours: Array(24).fill(0),
  activeMinutes: 61_200, longestSessionMinutes: 540,
};

await writeFile(new URL('../docs/card.png', import.meta.url), svgToPng(renderCardSvg(sample, { timeZone: 'UTC' })));
