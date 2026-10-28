// Renders docs/social.png, the 1280x640 link preview GitHub shows when the repo URL is shared.
import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const font = (name) => new URL(`../assets/fonts/${name}.ttf`, import.meta.url).pathname;
const card = (await readFile(new URL('../docs/card.png', import.meta.url))).toString('base64');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1280" height="640">
  <defs>
    <radialGradient id="a" cx="0.05" cy="0.05" r="0.8"><stop offset="0" stop-color="#8B6CFF" stop-opacity="0.5"/><stop offset="1" stop-color="#8B6CFF" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="1" cy="1" r="0.7"><stop offset="0" stop-color="#FF7A59" stop-opacity="0.4"/><stop offset="1" stop-color="#FF7A59" stop-opacity="0"/></radialGradient>
    <linearGradient id="h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFB199"/><stop offset="0.55" stop-color="#FF7A59"/><stop offset="1" stop-color="#8B6CFF"/></linearGradient>
  </defs>
  <rect width="1280" height="640" fill="#0A0B14"/><rect width="1280" height="640" fill="url(#a)"/><rect width="1280" height="640" fill="url(#b)"/>
  <text x="64" y="250" font-family="Geist" font-weight="900" font-size="72" letter-spacing="-2" fill="url(#h)">vibewrapped</text>
  <text x="66" y="310" font-family="Geist" font-size="30" fill="#F5F3FF">Wrapped for your</text>
  <text x="66" y="350" font-family="Geist" font-size="30" fill="#F5F3FF">Claude Code history</text>
  <text x="66" y="430" font-family="Geist Mono" font-weight="700" font-size="28" fill="#FF7A59">$ npx vibewrapped</text>
  <text x="66" y="472" font-family="Geist" font-size="20" fill="#9C99B8">100% local. Nothing is uploaded.</text>
  <image x="636" y="157" width="580" height="326" xlink:href="data:image/png;base64,${card}"/>
  <rect x="636" y="157" width="580" height="326" rx="6" fill="none" stroke="#FFFFFF" stroke-opacity="0.18"/>
</svg>`;

const png = new Resvg(svg, {
  font: { fontFiles: ['Geist-Regular', 'Geist-Black', 'GeistMono-Bold'].map(font), loadSystemFonts: false, defaultFontFamily: 'Geist' },
}).render().asPng();
await writeFile(new URL('../docs/social.png', import.meta.url), png);
