import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPersona } from '../src/persona.js';

const base = { peakHour: 14, sessions: 20, subagentRuns: 0, prompts: 100, interrupts: 0, topTools: [{ name: 'Bash', count: 10 }] };

test('late-night peak beats every other trait', () => {
  assert.equal(pickPersona({ ...base, peakHour: 3, subagentRuns: 50 }).name, 'The 3AM Shipper');
});

test('heavy subagent use makes you the orchestrator', () => {
  assert.equal(pickPersona({ ...base, subagentRuns: 12 }).name, 'The Orchestrator');
});

test('frequent interrupts make you the backseat driver', () => {
  assert.equal(pickPersona({ ...base, interrupts: 15 }).name, 'The Backseat Driver');
});

test('falls back to the dominant tool', () => {
  assert.equal(pickPersona(base).name, 'The Terminal Goblin');
  assert.equal(pickPersona({ ...base, topTools: [{ name: 'Edit', count: 9 }] }).name, 'The Relentless Refactorer');
  assert.equal(pickPersona({ ...base, topTools: [{ name: 'Grep', count: 9 }] }).name, 'The Code Archaeologist');
});

test('uses the time of day when no tool dominates, and a default otherwise', () => {
  assert.equal(pickPersona({ ...base, topTools: [], peakHour: 22 }).name, 'The Night Owl');
  assert.equal(pickPersona({ ...base, topTools: [], peakHour: 6 }).name, 'The Early Shipper');
  assert.equal(pickPersona({ ...base, topTools: [] }).name, 'The Vibe Architect');
});
