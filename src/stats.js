const BREAK_MS = 30 * 60 * 1000;
const ABSOLUTELY_RIGHT = /you('| a)?re absolutely right|ten[eé]s toda la raz[oó]n|tienes toda la raz[oó]n/i;
const POLITE = /\b(please|pls|plz|thanks|thank you|ty)\b|por favor|gracias/i;
const INTERRUPT = /^\[Request interrupted by user/;
// Tags Claude Code wraps around messages it injects as "user" turns.
const SYSTEM_TAG = /^<(task-notification|fork-boilerplate|local-command-caveat|local-command-stdout|local-command-stderr|command-name|command-message|command-args|bash-input|bash-stdout|bash-stderr|system-reminder|artifact-content-authored-by-others)\b/;

/**
 * @typedef {{ file: string, record: any, isSubagent: boolean }} SourceRecord
 * @typedef {{ name: string, count: number }} Ranked
 * @typedef {{
 *   range: { first: string, last: string } | null,
 *   sessions: number, subagentRuns: number, prompts: number, interrupts: number,
 *   politePrompts: number, messages: number, toolCalls: number, absolutelyRight: number,
 *   tokens: { input: number, output: number, cacheRead: number, cacheWrite: number, total: number },
 *   costUSD: number | null, topTools: Ranked[], topModels: Ranked[],
 *   activeDays: number, longestStreak: number, peakHour: number | null,
 *   hours: number[], activeMinutes: number, longestSessionMinutes: number,
 * }} Stats
 */

/** @param {unknown} content @returns {string | null} */
function promptText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content) || content.some((b) => b?.type === 'tool_result')) return null;
  const text = content.find((b) => b?.type === 'text' && typeof b.text === 'string');
  return text ? text.text : null;
}

/** @param {unknown} n */
function num(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

/** @param {Map<string, number>} counts @param {number} limit @returns {Ranked[]} */
function rank(counts, limit) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

/** @param {Date} date @param {string} timeZone */
function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

/** @param {string[]} days sorted YYYY-MM-DD */
function longestStreak(days) {
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    const t = Date.parse(`${day}T00:00:00Z`);
    run = prev !== null && t - prev === 86400000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

/** @param {number[]} times sorted epoch ms */
function activeMs(times) {
  let total = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap <= BREAK_MS) total += gap;
  }
  return total;
}

/**
 * Aggregates Claude Code session records into wrapped stats.
 * Assistant messages are split across several lines sharing one message id,
 * so usage is counted once per id and tool calls once per tool_use id.
 * @param {AsyncIterable<SourceRecord>} records
 * @param {{ timeZone: string, since?: Date, until?: Date }} options
 * @returns {Promise<Stats>}
 */
export async function computeStats(records, { timeZone, since, until }) {
  const usageById = new Map();
  const promptIds = new Set();
  const toolIds = new Set();
  const textBlocks = new Set();
  const tools = new Map();
  const models = new Map();
  const costByFile = new Map();
  const timesByFile = new Map();
  const sessionFiles = new Set();
  const subagentFiles = new Set();
  const days = new Set();
  const hours = Array(24).fill(0);
  let prompts = 0;
  let interrupts = 0;
  let politePrompts = 0;
  let absolutelyRight = 0;
  let first = null;
  let last = null;

  for await (const { file, record, isSubagent } of records) {
    if (record?.type === 'cost-state') {
      if (typeof record.totalCostUSD === 'number') costByFile.set(file, record.totalCostUSD);
      continue;
    }
    if (record?.type !== 'user' && record?.type !== 'assistant') continue;
    if (typeof record.timestamp !== 'string' && record.timestamp !== undefined) continue;

    const time = record.timestamp ? new Date(record.timestamp) : null;
    if (time && Number.isNaN(time.getTime())) continue;
    if ((since || until) && !time) continue;
    if (time && ((since && time < since) || (until && time >= until))) continue;

    if (time) {
      if (!first || time < first) first = time;
      if (!last || time > last) last = time;
      const list = timesByFile.get(file) ?? [];
      list.push(time.getTime());
      timesByFile.set(file, list);
    }

    if (record.type === 'user') {
      if (isSubagent || record.isSidechain || record.isMeta || record.isCompactSummary) continue;
      const text = promptText(record.message?.content);
      if (text === null || SYSTEM_TAG.test(text)) continue;
      if (record.uuid) {
        if (promptIds.has(record.uuid)) continue;
        promptIds.add(record.uuid);
      }
      if (INTERRUPT.test(text)) {
        interrupts++;
        continue;
      }
      prompts++;
      if (POLITE.test(text)) politePrompts++;
      sessionFiles.add(file);
      if (time) {
        const { day, hour } = localParts(time, timeZone);
        days.add(day);
        hours[hour]++;
      }
      continue;
    }

    const message = typeof record.message === 'object' && record.message !== null ? record.message : {};
    if (isSubagent) subagentFiles.add(file);
    if (typeof message.id === 'string') {
      // A message is written once per content block and output_tokens grows as it streams,
      // so keep the largest value seen for each field.
      const usage = message.usage ?? {};
      const prev = usageById.get(message.id);
      usageById.set(message.id, {
        input: Math.max(prev?.input ?? 0, num(usage.input_tokens)),
        output: Math.max(prev?.output ?? 0, num(usage.output_tokens)),
        cacheRead: Math.max(prev?.cacheRead ?? 0, num(usage.cache_read_input_tokens)),
        cacheWrite: Math.max(prev?.cacheWrite ?? 0, num(usage.cache_creation_input_tokens)),
      });
      if (!prev && typeof message.model === 'string' && !message.model.startsWith('<')) {
        models.set(message.model, (models.get(message.model) ?? 0) + 1);
      }
    }
    for (const block of Array.isArray(message.content) ? message.content : []) {
      if (block?.type === 'tool_use' && block.id && !toolIds.has(block.id)) {
        toolIds.add(block.id);
        tools.set(block.name, (tools.get(block.name) ?? 0) + 1);
      }
      if (block?.type === 'text' && typeof block.text === 'string' && ABSOLUTELY_RIGHT.test(block.text)) {
        const key = `${message.id}:${block.text}`;
        if (!textBlocks.has(key)) {
          textBlocks.add(key);
          absolutelyRight++;
        }
      }
    }
  }

  const sessionDurations = [...timesByFile.entries()]
    .filter(([file]) => sessionFiles.has(file))
    .map(([, times]) => activeMs(times.sort((a, b) => a - b)));
  const peak = Math.max(...hours);
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const usage of usageById.values()) {
    for (const key of Object.keys(tokens)) tokens[key] += usage[key];
  }

  return {
    range: first ? { first: first.toISOString(), last: last.toISOString() } : null,
    sessions: sessionFiles.size,
    subagentRuns: subagentFiles.size,
    prompts,
    interrupts,
    politePrompts,
    messages: usageById.size,
    toolCalls: toolIds.size,
    absolutelyRight,
    tokens: { ...tokens, total: tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite },
    // cost-state is a cumulative, undated total per session, so it can't be split by date.
    costUSD: costByFile.size && !since && !until ? [...costByFile.values()].reduce((a, b) => a + b, 0) : null,
    topTools: rank(tools, 5),
    topModels: rank(models, 3),
    activeDays: days.size,
    longestStreak: longestStreak([...days].sort()),
    peakHour: peak > 0 ? hours.indexOf(peak) : null,
    hours,
    activeMinutes: Math.round(sessionDurations.reduce((a, b) => a + b, 0) / 60000),
    longestSessionMinutes: Math.round(Math.max(0, ...sessionDurations) / 60000),
  };
}
