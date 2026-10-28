import { Resvg } from '@resvg/resvg-js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CARD_WIDTH } from './card.js';

const FONTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');
const FONT_FILES = ['Geist-Regular', 'Geist-Bold', 'Geist-Black', 'GeistMono-Regular', 'GeistMono-Bold'].map((f) =>
  path.join(FONTS, `${f}.ttf`),
);

/**
 * Rasterizes the card at 2x with bundled fonts, so it looks the same on every machine.
 * @param {string} svg
 * @returns {Buffer}
 */
export function svgToPng(svg) {
  const resvg = new Resvg(svg, {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Geist' },
    fitTo: { mode: 'width', value: CARD_WIDTH * 2 },
  });
  return resvg.render().asPng();
}
