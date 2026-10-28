#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { defaultClaudeDirs, findSessionFiles, readRecords } from '../src/sessions.js';
import { computeStats } from '../src/stats.js';
import { renderCardSvg, highlight } from '../src/card.js';
import { svgToPng } from '../src/render.js';
import { pickPersona } from '../src/persona.js';
import { compact, dateRange, hourLabel } from '../src/format.js';
import { DEFAULT_DAYS, keepHistory, retentionDays } from '../src/retention.js';
import { copyImage } from '../src/clipboard.js';

const HELP = `vibewrapped — Spotify Wrapped for your AI coding agent

Usage: npx vibewrapped [options]

  --year <yyyy>    Only count one calendar year (default: all history)
  --dir <path>     Claude config dir (default: $CLAUDE_CONFIG_DIR or ~/.claude); repeatable
  --out <file>     Where to save the card (default: ./vibewrapped.png)
  --json           Print the raw stats as JSON instead of the card
  --share          Copy the card to your clipboard and open a pre-filled post on X
  --keep           Stop Claude Code from deleting history after 30 days
                   (sets cleanupPeriodDays to 3650 in settings.json)
  --no-open        Do not open the card when done
  -h, --help       Show this help

Everything runs locally. Nothing is uploaded.`;

const { values } = parseArgs({
  options: {
    year: { type: 'string' },
    dir: { type: 'string', multiple: true },
    out: { type: 'string', default: 'vibewrapped.png' },
    json: { type: 'boolean', default: false },
    share: { type: 'boolean', default: false },
    keep: { type: 'boolean', default: false },
    'no-open': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  process.stdout.write(`${HELP}\n`);
  process.exit(0);
}

if (values.year && !/^\d{4}$/.test(values.year)) {
  process.stderr.write(`--year must look like 2026, got "${values.year}"\n`);
  process.exit(1);
}

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const dirs = values.dir ?? defaultClaudeDirs(process.env, homedir());

const files = (await Promise.all(dirs.map(findSessionFiles))).flat();

if (files.length === 0) {
  process.stderr.write(`No Claude Code sessions found in ${dirs.join(', ')}.\nPoint me at your config dir with --dir <path>.\n`);
  process.exit(1);
}

// Local midnight, matching the time zone used for days and hours.
const since = values.year ? new Date(Number(values.year), 0, 1) : undefined;
const until = values.year ? new Date(Number(values.year) + 1, 0, 1) : undefined;

process.stderr.write(`Reading ${files.length} session files…\n`);
let unreadable = 0;
const stats = await computeStats(readRecords(files, () => unreadable++), { timeZone, since, until });
if (unreadable) process.stderr.write(`Skipped ${unreadable} session files that could not be read.\n`);

async function keep() {
  for (const dir of dirs) {
    try {
      const { before, after } = await keepHistory(dir);
      process.stderr.write(`History retention in ${dir}: ${before ?? `${DEFAULT_DAYS} (default)`} → ${after} days\n`);
    } catch (error) {
      process.stderr.write(`Could not update ${dir}: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}

if (values.json) {
  process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
  if (values.keep) await keep();
  process.exit();
}

if (stats.prompts === 0) {
  process.stderr.write('No prompts found in that range. Try without --year.\n');
  process.exit(1);
}

const out = path.resolve(values.out);
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, svgToPng(renderCardSvg(stats, { timeZone })));

const persona = pickPersona(stats);
const hi = highlight(stats);
const cost = stats.costUSD === null ? '' : `\n  API-equivalent cost   $${compact(stats.costUSD)}`;
process.stdout.write(`
  VIBE CODING WRAPPED   ${dateRange(stats.range, timeZone)}

  ${compact(stats.tokens.total)} tokens through Claude Code
  You are ${persona.name}. ${persona.line}

  sessions              ${stats.sessions}
  hours with your agent ${Math.round(stats.activeMinutes / 60)}
  day streak            ${stats.longestStreak}
  prompts               ${stats.prompts}
  tool calls            ${stats.toolCalls}
  peak hour             ${hourLabel(stats.peakHour)}
  favorite tool         ${stats.topTools[0]?.name ?? '—'}
  favorite model        ${stats.topModels[0]?.name ?? '—'}${cost}

  ${hi.quote} ×${hi.count}

  Card saved to ${out}
`);

if (values.keep) {
  await keep();
} else {
  const retention = Math.min(...(await Promise.all(dirs.map(retentionDays))));
  if (retention <= DEFAULT_DAYS) {
    process.stdout.write(`
  Heads up: Claude Code deletes sessions older than ${retention} days, so this card can't go further back.
  Run "npx vibewrapped --keep" now and your December wrapped will cover the whole stretch.
`);
  }
}

function open(target) {
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [target]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', target]]
    : ['xdg-open', [target]];
  // Opening is a convenience: on a headless box the card is still saved and its path printed.
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}

if (!values['no-open']) open(out);

if (values.share) {
  const text = `My vibe coding wrapped: ${compact(stats.tokens.total)} tokens, ${stats.sessions} sessions, and I'm "${persona.name}".\n\n${hi.quote} ×${hi.count} 💀\n\nGet yours: npx vibewrapped`;
  const copied = await copyImage(out);
  open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://github.com/eliseomdq/vibewrapped')}`);
  process.stdout.write(copied
    ? '  Opened X in your browser. The card is on your clipboard: paste it into the post.\n'
    : '  Opened X in your browser. Attach the card and post.\n');
}
