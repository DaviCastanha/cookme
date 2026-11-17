/**
 * Renders a recipe as a tall PNG card (photo, title, time/servings, ingredients and steps) to
 * send on WhatsApp, Instagram and the like. Drawn on a canvas in the browser: nothing leaves
 * the device until the person shares it.
 */
import { getSections, type RecipeSection } from '@/features/recipes/content';
import { getAssetBlob } from '@/lib/repository';
import type { Recipe } from '@/lib/schemas';
import { shareOrDownload, slugify, type ShareOutcome } from './shareFile';

const W = 1080;
const PAD = 84;
const MAX_H = 7000;

const C = {
  bg: '#faf6f0',
  ink: '#2a211b',
  soft: '#4d4138',
  muted: '#8a7d71',
  accent: '#c2562f',
  accentSoft: '#f8e5da',
  rule: '#e6dccf',
};

interface Fonts {
  serif: string;
  sans: string;
}

function readFonts(): Fonts {
  const style = getComputedStyle(document.documentElement);
  const serif = style.getPropertyValue('--font-fraunces').trim() || 'Georgia, serif';
  const sans = style.getPropertyValue('--font-inter').trim() || 'system-ui, sans-serif';
  return { serif, sans };
}

export async function renderRecipeImage(name: string, recipe: Recipe): Promise<Blob> {
  await document.fonts?.ready;
  const fonts = readFonts();
  const cover = await loadCover(recipe);
  const sections = getSections(recipe.content);

  // First pass measures, second pass draws on a canvas of the right height.
  const measure = document.createElement('canvas').getContext('2d')!;
  const height = Math.min(MAX_H, draw(measure, { name, recipe, sections, cover, fonts, dryRun: true }));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador não consegue gerar imagens.');
  draw(ctx, { name, recipe, sections, cover, fonts, dryRun: false, maxHeight: height });
  cover?.close?.();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Não foi possível gerar a imagem.');
  return blob;
}

export async function shareRecipeImage(name: string, recipe: Recipe): Promise<ShareOutcome> {
  const blob = await renderRecipeImage(name, recipe);
  return shareOrDownload([new File([blob], `${slugify(name)}.png`, { type: 'image/png' })], name);
}

// ------------------------------------------------------------------ drawing

interface DrawInput {
  name: string;
  recipe: Recipe;
  sections: RecipeSection[];
  cover: ImageBitmap | null;
  fonts: Fonts;
  dryRun: boolean;
  maxHeight?: number;
}

/** Draws the card and returns its total height. */
function draw(ctx: CanvasRenderingContext2D, input: DrawInput): number {
  const { name, recipe, sections, cover, fonts, dryRun } = input;
  const limit = (input.maxHeight ?? MAX_H) - 160;
  const width = W - PAD * 2;
  let y = 0;
  let truncated = false;

  if (!dryRun) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, input.maxHeight ?? MAX_H);
  }

  // Photo, full width.
  if (cover) {
    const h = 760;
    if (!dryRun) drawCover(ctx, cover, 0, 0, W, h);
    y = h + 72;
  } else {
    y = 120;
    if (!dryRun) {
      ctx.fillStyle = C.accent;
      ctx.fillRect(PAD, y - 40, 64, 6);
    }
  }

  // Title.
  ctx.font = `700 76px ${fonts.serif}`;
  for (const line of wrap(ctx, name, width)) {
    y += 84;
    if (!dryRun) {
      ctx.fillStyle = C.ink;
      ctx.fillText(line, PAD, y);
    }
  }

  // Time · servings.
  const meta = [recipe.time && `⏱ ${recipe.time}`, recipe.servings && `Rende ${recipe.servings}`].filter(Boolean).join('   ·   ');
  if (meta) {
    y += 64;
    ctx.font = `600 32px ${fonts.sans}`;
    if (!dryRun) {
      ctx.fillStyle = C.accent;
      ctx.fillText(meta, PAD, y);
    }
  }
  y += 36;

  for (const section of sections) {
    if (y > limit) {
      truncated = true;
      break;
    }
    if (section.title && section.level === 3) {
      y += 66;
      ctx.font = `600 36px ${fonts.serif}`;
      if (!dryRun) {
        ctx.fillStyle = C.soft;
        ctx.fillText(section.title, PAD, y);
      }
      y += 4;
    } else if (section.title) {
      y += 88;
      ctx.font = `600 46px ${fonts.serif}`;
      if (!dryRun) {
        ctx.fillStyle = C.ink;
        ctx.fillText(section.title, PAD, y);
        ctx.fillStyle = C.rule;
        ctx.fillRect(PAD, y + 22, width, 2);
        ctx.fillStyle = C.accent;
        ctx.fillRect(PAD, y + 21, 56, 4);
      }
      y += 34;
    }
    for (const line of section.lines) {
      if (y > limit) {
        truncated = true;
        break;
      }
      y = drawLine(ctx, line, y, width, fonts, dryRun);
    }
  }

  if (truncated) {
    y += 64;
    ctx.font = `italic 400 30px ${fonts.sans}`;
    if (!dryRun) {
      ctx.fillStyle = C.muted;
      ctx.fillText('A receita continua no CookMe…', PAD, y);
    }
  }

  // Footer.
  y += 110;
  ctx.font = `600 28px ${fonts.serif}`;
  if (!dryRun) {
    ctx.fillStyle = C.rule;
    ctx.fillRect(PAD, y - 62, width, 2);
    ctx.fillStyle = C.muted;
    ctx.fillText('Feito com CookMe', PAD, y);
  }
  return y + 72;
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  line: RecipeSection['lines'][number],
  top: number,
  width: number,
  fonts: Fonts,
  dryRun: boolean,
): number {
  const size = 34;
  const leading = 50;
  const indent = line.kind === 'text' ? 0 : line.kind === 'number' ? 76 : 44;
  ctx.font = `400 ${size}px ${fonts.sans}`;
  const lines = wrap(ctx, line.text, width - indent);
  let y = top + (line.kind === 'number' ? 30 : 22);

  if (!dryRun && line.kind === 'number') {
    const cy = y + leading - 12;
    ctx.fillStyle = C.accentSoft;
    ctx.beginPath();
    ctx.arc(PAD + 26, cy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.accent;
    ctx.font = `700 28px ${fonts.serif}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(line.n), PAD + 26, cy + 10);
    ctx.textAlign = 'left';
    ctx.font = `400 ${size}px ${fonts.sans}`;
  }
  if (!dryRun && line.kind === 'bullet') {
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.arc(PAD + 10, y + leading - 12, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const text of lines) {
    y += leading;
    if (!dryRun) {
      ctx.fillStyle = line.kind === 'text' ? C.soft : C.ink;
      ctx.fillText(text, PAD + indent, y);
    }
  }
  return y;
}

/** Breaks text into lines that fit `width` (long words are split as a last resort). */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= width) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      line = word;
      while (ctx.measureText(line).width > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > width) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [''];
}

function drawCover(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  // object-fit: cover
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/** The cover as a bitmap. Links without CORS cannot be drawn (the card goes without the photo). */
async function loadCover(recipe: Recipe): Promise<ImageBitmap | null> {
  try {
    if (recipe.coverAssetId) {
      const blob = await getAssetBlob(recipe.coverAssetId);
      return blob ? await createImageBitmap(blob) : null;
    }
    if (recipe.coverUrl) {
      const res = await fetch(recipe.coverUrl, { mode: 'cors' });
      if (!res.ok) return null;
      return await createImageBitmap(await res.blob());
    }
  } catch {
    // Unreadable image: skip it.
  }
  return null;
}
