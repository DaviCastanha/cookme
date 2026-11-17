/**
 * Pure helpers over the stored Tiptap JSON of a recipe. They let search, the share image and
 * the cooking mode work on recipes that are not open in an editor.
 */
import type { RichContent } from '@/lib/schemas';
import { createId } from '@/lib/utils/id';

export const ASSET_IMAGE_NODE = 'assetImage';
export const AUDIO_NOTE_NODE = 'audioNote';
/** Node types that receive a stable `id` attribute (UniqueID extension). */
export const BLOCK_ID_TYPES = ['paragraph', 'heading', 'blockquote', ASSET_IMAGE_NODE, AUDIO_NOTE_NODE];

export const SECTION_TITLES = { ingredients: 'Ingredientes', steps: 'Modo de preparo', tips: 'Dicas' } as const;

const p = (): RichContent => ({ type: 'paragraph', attrs: { id: createId('b') } });
const h = (text: string): RichContent => ({
  type: 'heading',
  attrs: { id: createId('b'), level: 2 },
  content: [{ type: 'text', text }],
});

/** Every new recipe starts with its sections in place and nothing written in them. */
export function emptyRecipeContent(): RichContent {
  return {
    type: 'doc',
    content: [
      h(SECTION_TITLES.ingredients),
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [p()] }] },
      h(SECTION_TITLES.steps),
      { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [p()] }] },
      h(SECTION_TITLES.tips),
      p(),
    ],
  };
}

export function nodeText(node: RichContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(nodeText).join('');
}

export interface TextBlock {
  blockId: string;
  type: string;
  text: string;
}

/** Visits every textblock (paragraph/heading) in reading order. */
export function getTextBlocks(doc: RichContent): TextBlock[] {
  const out: TextBlock[] = [];
  let fallback = 0;
  const visit = (node: RichContent) => {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const text = nodeText(node);
      const blockId = String(node.attrs?.id ?? `anon_${fallback++}`);
      if (text.trim()) out.push({ blockId, type: node.type, text });
      return;
    }
    (node.content ?? []).forEach(visit);
  };
  (doc.content ?? []).forEach(visit);
  return out;
}

// ---------------------------------------------------------------- structured view

export type SectionLine =
  | { kind: 'bullet'; text: string; checked?: boolean }
  | { kind: 'number'; n: number; text: string }
  | { kind: 'text'; text: string };

export interface RecipeSection {
  title: string | null;
  /** 2 = section (Ingredientes), 3 = part of a section (Massa, Cobertura). */
  level: 2 | 3;
  /** For a level-3 part: the title of the section it belongs to. */
  parentTitle: string | null;
  lines: SectionLine[];
}

/** Text of a list item without its nested lists (those become their own lines). */
function itemLines(item: RichContent, number: number | null): SectionLine[] {
  const own = (item.content ?? []).filter((c) => c.type === 'paragraph').map(nodeText).join(' ').trim();
  const out: SectionLine[] = [];
  if (own) {
    if (number !== null) out.push({ kind: 'number', n: number, text: own });
    else out.push({ kind: 'bullet', text: own, checked: item.type === 'taskItem' ? Boolean(item.attrs?.checked) : undefined });
  }
  for (const child of item.content ?? []) if (child.type !== 'paragraph') out.push(...blockLines(child));
  return out;
}

function blockLines(node: RichContent): SectionLine[] {
  if (node.type === 'paragraph' || node.type === 'blockquote') {
    const text = nodeText(node).trim();
    return text ? [{ kind: 'text', text }] : [];
  }
  if (node.type === 'bulletList' || node.type === 'taskList') return (node.content ?? []).flatMap((i) => itemLines(i, null));
  if (node.type === 'orderedList') {
    const start = Number(node.attrs?.start ?? 1) || 1;
    let n = start;
    return (node.content ?? []).flatMap((i) => itemLines(i, n++));
  }
  return [];
}

/**
 * The recipe as sections (one per heading) of plain lines, ignoring images and audio.
 * Sections with nothing written are left out, except a section title whose parts (h3) have content.
 */
export function getSections(doc: RichContent): RecipeSection[] {
  const sections: RecipeSection[] = [];
  let parent: string | null = null;
  let current: RecipeSection = { title: null, level: 2, parentTitle: null, lines: [] };
  for (const node of doc.content ?? []) {
    if (node.type === 'heading') {
      sections.push(current);
      const title = nodeText(node).trim() || null;
      const level = Number(node.attrs?.level ?? 2) >= 3 ? 3 : 2;
      if (level === 2) parent = title;
      current = { title, level, parentTitle: level === 3 ? parent : null, lines: [] };
      continue;
    }
    current.lines.push(...blockLines(node));
  }
  sections.push(current);
  return sections.filter((s, i) => {
    if (s.lines.length) return true;
    if (s.level !== 2 || !s.title) return false;
    // Keep "Ingredientes" when it only holds parts like "Massa" and "Cobertura".
    for (const next of sections.slice(i + 1)) {
      if (next.level === 2) return false;
      if (next.lines.length) return true;
    }
    return false;
  });
}

export interface CookingPlan {
  ingredients: string[];
  steps: string[];
}

const STEP_TITLE = /preparo|passo|como fazer|montagem/i;
const INGREDIENT_TITLE = /ingrediente/i;

/** Ingredients and steps for the cooking mode. */
export function getCookingPlan(doc: RichContent): CookingPlan {
  const sections = getSections(doc);
  const ingredients: string[] = [];
  const steps: string[] = [];
  for (const s of sections) {
    const titles = [s.title, s.parentTitle].filter((t): t is string => !!t);
    const isSteps = titles.some((t) => STEP_TITLE.test(t));
    const isIngredients = titles.some((t) => INGREDIENT_TITLE.test(t));
    for (const line of s.lines) {
      if (isIngredients || (!isSteps && line.kind === 'bullet' && line.checked !== undefined)) ingredients.push(line.text);
      else if (isSteps || line.kind === 'number') steps.push(line.text);
    }
  }
  return { ingredients, steps };
}

/** Asset ids referenced by the recipe body (images and audio). */
export function getAssetIds(doc: RichContent): string[] {
  const ids: string[] = [];
  const visit = (node: RichContent) => {
    if ((node.type === ASSET_IMAGE_NODE || node.type === AUDIO_NOTE_NODE) && node.attrs?.assetId) ids.push(String(node.attrs.assetId));
    (node.content ?? []).forEach(visit);
  };
  visit(doc);
  return ids;
}

/** Returns a copy of the document with asset ids replaced (used when importing a recipe). */
export function mapAssetIds(doc: RichContent, map: Map<string, string>): RichContent {
  const visit = (node: RichContent): RichContent => {
    const next: RichContent = { ...node };
    if (node.attrs?.assetId && map.has(String(node.attrs.assetId))) {
      next.attrs = { ...node.attrs, assetId: map.get(String(node.attrs.assetId)) };
    }
    if (node.content) next.content = node.content.map(visit);
    return next;
  };
  return visit(doc);
}

/** Unchecks every ingredient (after cooking). */
export function uncheckAll(doc: RichContent): RichContent {
  const visit = (node: RichContent): RichContent => {
    const next: RichContent = { ...node };
    if (node.type === 'taskItem') next.attrs = { ...node.attrs, checked: false };
    if (node.content) next.content = node.content.map(visit);
    return next;
  };
  return visit(doc);
}
