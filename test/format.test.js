import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compact, hourLabel, dateRange, escapeXml } from '../src/format.js';

test('compacts large numbers', () => {
  assert.equal(compact(950), '950');
  assert.equal(compact(1234), '1.2K');
  assert.equal(compact(45_600_000), '45.6M');
  assert.equal(compact(2_400_000_000), '2.4B');
  assert.equal(compact(3_000_000), '3M');
});

test('labels hours on a 12-hour clock', () => {
  assert.equal(hourLabel(0), '12 AM');
  assert.equal(hourLabel(3), '3 AM');
  assert.equal(hourLabel(12), '12 PM');
  assert.equal(hourLabel(23), '11 PM');
  assert.equal(hourLabel(null), '—');
});

test('formats the date range in the given time zone', () => {
  const range = { first: '2026-01-03T12:00:00Z', last: '2026-10-28T12:00:00Z' };
  assert.equal(dateRange(range, 'UTC'), 'Jan 3 – Oct 28, 2026');
  assert.equal(dateRange({ first: '2025-11-02T12:00:00Z', last: '2026-02-01T12:00:00Z' }, 'UTC'), 'Nov 2, 2025 – Feb 1, 2026');
});

test('escapes XML special characters', () => {
  assert.equal(escapeXml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;');
});
