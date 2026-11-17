/**
 * Generates the PWA icons in public/ from the chef-hat mark used in favicon.svg.
 * Run after changing the logo: `node scripts/generate-icons.mjs` (uses sharp, bundled with Next).
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const BG = '#c2562f';
const INK = '#fffdf9';
// Lucide "chef-hat" (ISC license), drawn as strokes on a 24×24 grid.
const HAT = [
  'M10 11v5',
  'M14 11v5',
  'M6 12.65c0-.457-.316-.844-.727-1.041A4 4 0 017.52 4.034a1.53 1.53 0 001.367-.547 4 4 0 016.225 0 1.53 1.53 0 001.367.547 4 4 0 012.248 7.575c-.411.197-.727.584-.727 1.04V19a2 2 0 01-2 2H8a2 2 0 01-2-2z',
  'M6 16h12',
];

/** `inset` shrinks the hat toward the center (maskable icons need a safe zone). */
function svg({ rounded, inset = 0 }) {
  const size = 64 * (1 - inset);
  const offset = (64 - size) / 2;
  const scale = size / 24;
  const paths = HAT.map((d) => `<path d="${d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" ${rounded ? 'rx="16"' : ''} fill="${BG}"/>
    <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
  </svg>`;
}

writeFileSync(path.join(root, 'favicon.svg'), svg({ rounded: true, inset: 0.22 }).replace(/\n\s*/g, ''));
console.log('wrote favicon.svg');

const outputs = [
  ['icon-192.png', 192, { rounded: true, inset: 0.24 }],
  ['icon-512.png', 512, { rounded: true, inset: 0.24 }],
  ['icon-maskable-512.png', 512, { rounded: false, inset: 0.42 }],
  ['apple-touch-icon.png', 180, { rounded: false, inset: 0.3 }],
];

for (const [name, size, opts] of outputs) {
  await sharp(Buffer.from(svg(opts)), { density: 600 }).resize(size, size).png().toFile(path.join(root, name));
  console.log('wrote', name);
}
