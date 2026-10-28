import { compact, dateRange, escapeXml, hourLabel } from './format.js';
import { pickPersona } from './persona.js';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 675;
const REPO = 'github.com/eliseomdq/vibewrapped';

const C = {
  bg: '#0A0B14',
  text: '#F5F3FF',
  muted: '#9C99B8',
  accent: '#FF7A59',
  violet: '#8B6CFF',
};

/**
 * The meme line at the bottom of the card: the most screenshot-worthy stat available.
 * @param {import('./stats.js').Stats} stats
 */
export function highlight(stats) {
  if (stats.absolutelyRight > 0) {
    return { quote: '“You’re absolutely right!”', count: stats.absolutelyRight, caption: 'times Claude said it to you' };
  }
  if (stats.interrupts > 0) {
    return { quote: 'Esc pressed mid-answer', count: stats.interrupts, caption: 'times you stopped Claude to correct it' };
  }
  if (stats.politePrompts > 0) {
    return { quote: 'please & thank you', count: stats.politePrompts, caption: 'prompts where you were polite to a robot' };
  }
  return { quote: 'prompts', count: stats.prompts, caption: 'prompts sent' };
}

/** Shrinks a font size so a line of text fits the given width (Geist averages ~0.56em per glyph). */
function fit(text, maxSize, width) {
  return Math.min(maxSize, Math.floor(width / (text.length * 0.56)));
}

function stat(x, y, value, label) {
  return `
    <text x="${x}" y="${y}" font-family="Geist Mono" font-weight="700" font-size="44" fill="${C.text}">${escapeXml(value)}</text>
    <text x="${x}" y="${y + 30}" font-family="Geist" font-size="17" fill="${C.muted}">${escapeXml(label)}</text>`;
}

/**
 * Renders the shareable card. Only aggregate numbers appear on it: no paths, projects or branches.
 * @param {import('./stats.js').Stats} stats
 * @param {{ timeZone: string }} options
 * @returns {string}
 */
export function renderCardSvg(stats, { timeZone }) {
  const persona = pickPersona(stats);
  const hi = highlight(stats);
  const range = stats.range ? dateRange(stats.range, timeZone) : '';
  const hours = Math.round(stats.activeMinutes / 60);
  const cells = [
    [compact(stats.sessions), 'sessions'],
    [compact(hours), 'hours with your agent'],
    [`${stats.longestStreak}`, 'day streak'],
    [compact(stats.prompts), 'prompts'],
    [compact(stats.toolCalls), 'tool calls'],
    [hourLabel(stats.peakHour), 'peak hour'],
  ];
  const grid = cells
    .map(([value, label], i) => stat(712 + (i % 2) * 230, 190 + Math.floor(i / 2) * 100, value, label))
    .join('');
  const tokens = compact(stats.tokens.total);
  const personaSize = fit(persona.name, 50, 580);
  const quoteSize = fit(hi.quote, 30, 700);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <radialGradient id="glowA" cx="0.12" cy="0.1" r="0.7">
      <stop offset="0" stop-color="${C.violet}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${C.violet}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0.95" cy="1" r="0.65">
      <stop offset="0" stop-color="${C.accent}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${C.accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hero" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FFB199"/>
      <stop offset="0.55" stop-color="${C.accent}"/>
      <stop offset="1" stop-color="${C.violet}"/>
    </linearGradient>
  </defs>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${C.bg}"/>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#glowA)"/>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#glowB)"/>

  <text x="64" y="84" font-family="Geist Mono" font-weight="700" font-size="17" letter-spacing="4" fill="${C.accent}">VIBE CODING WRAPPED</text>
  <text x="1136" y="84" text-anchor="end" font-family="Geist Mono" font-size="17" fill="${C.muted}">${escapeXml(range)}</text>

  <text x="58" y="250" font-family="Geist" font-weight="900" font-size="150" letter-spacing="-3" fill="url(#hero)">${escapeXml(tokens)}</text>
  <text x="64" y="292" font-family="Geist" font-size="24" fill="${C.muted}">tokens through Claude Code</text>

  <text x="64" y="370" font-family="Geist" font-size="20" fill="${C.muted}">You are</text>
  <text x="64" y="${370 + personaSize + 6}" font-family="Geist" font-weight="700" font-size="${personaSize}" fill="${C.text}">${escapeXml(persona.name)}</text>
  <text x="64" y="${370 + personaSize + 44}" font-family="Geist" font-size="20" fill="${C.muted}">${escapeXml(persona.line)}</text>

  ${grid}

  <rect x="64" y="490" width="1072" height="104" rx="18" fill="#FFFFFF" fill-opacity="0.05" stroke="#FFFFFF" stroke-opacity="0.12"/>
  <text x="96" y="535" font-family="Geist" font-weight="700" font-size="${quoteSize}" fill="${C.text}">${escapeXml(hi.quote)}</text>
  <text x="96" y="570" font-family="Geist" font-size="18" fill="${C.muted}">${escapeXml(hi.caption)}</text>
  <text x="1104" y="562" text-anchor="end" font-family="Geist" font-weight="900" font-size="64" fill="${C.accent}">×${escapeXml(compact(hi.count))}</text>

  <text x="64" y="640" font-family="Geist Mono" font-size="18" fill="${C.text}">$ npx vibewrapped</text>
  <text x="1136" y="640" text-anchor="end" font-family="Geist Mono" font-size="16" fill="${C.muted}">${REPO}</text>
</svg>`;
}
