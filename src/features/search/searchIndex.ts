/**
 * In-memory search index for one caderno. Built locally from the recipes, so it never needs to
 * be persisted or synced. Updates incrementally: only recipes whose `updatedAt` changed are
 * re-indexed.
 */
import MiniSearch, { type SearchResult } from 'minisearch';
import type { ExplorerItem, Recipe } from '@/lib/schemas';
import { getTextBlocks } from '@/features/recipes/content';
import { findAll, normalize, normalizeKeepLength, snippet } from '@/lib/utils/text';

export interface SearchSource {
  items: ExplorerItem[];
  recipes: Recipe[];
}

interface EntityDoc {
  id: string;
  kind: ExplorerItem['type'];
  name: string;
  /** Folder names above the item, so "doces" also finds what is inside "Doces". */
  path: string;
}

interface BlockDoc {
  id: string;
  recipeId: string;
  blockId: string;
  text: string;
}

export interface EntityHit {
  id: string;
  kind: ExplorerItem['type'];
  name: string;
  item: ExplorerItem;
  location: string[];
  score: number;
}

export interface OccurrenceHit {
  key: string;
  recipeId: string;
  recipeName: string;
  blockId: string;
  location: string[];
  before: string;
  match: string;
  after: string;
  /** Text to select inside the block when navigating. */
  matchText: string;
  score: number;
}

export interface SearchResults {
  query: string;
  entities: EntityHit[];
  occurrences: OccurrenceHit[];
  totalOccurrences: number;
}

const processTerm = (term: string) => normalize(term);

export class ProjectSearchIndex {
  private entities = new MiniSearch<EntityDoc>({
    fields: ['name', 'path'],
    storeFields: ['kind'],
    processTerm,
    searchOptions: { boost: { name: 4 }, prefix: true, fuzzy: 0.2 },
  });
  private blocks = new MiniSearch<BlockDoc>({
    fields: ['text'],
    storeFields: ['recipeId', 'blockId', 'text'],
    processTerm,
    searchOptions: { prefix: true, fuzzy: 0.15, combineWith: 'AND' },
  });

  private items = new Map<string, ExplorerItem>();
  private recipes = new Map<string, Recipe>();
  private blockIdsByRecipe = new Map<string, string[]>();
  private entityVersion = new Map<string, string>();

  /** Brings the index in sync with the given data, re-indexing only what changed. */
  sync(source: SearchSource) {
    const nextItems = new Map(source.items.map((i) => [i.id, i]));
    this.items = nextItems;

    for (const id of this.entityVersion.keys()) {
      if (!nextItems.has(id)) {
        this.entities.discard(id);
        this.entityVersion.delete(id);
      }
    }
    for (const item of source.items) {
      const path = this.itemPath(item.id).slice(0, -1).join(' ');
      const version = `${item.updatedAt}|${item.name}|${path}`;
      if (this.entityVersion.get(item.id) === version) continue;
      if (this.entityVersion.has(item.id)) this.entities.discard(item.id);
      this.entities.add({ id: item.id, kind: item.type, name: item.name, path });
      this.entityVersion.set(item.id, version);
    }

    const next = new Map(source.recipes.map((r) => [r.id, r]));
    for (const id of [...this.recipes.keys()]) {
      if (!next.has(id)) this.removeRecipeBlocks(id);
    }
    for (const recipe of source.recipes) {
      const prev = this.recipes.get(recipe.id);
      if (prev && prev.updatedAt === recipe.updatedAt && prev.content === recipe.content) continue;
      this.removeRecipeBlocks(recipe.id);
      const blocks = getTextBlocks(recipe.content).map((b) => ({
        id: `${recipe.id}:${b.blockId}`,
        recipeId: recipe.id,
        blockId: b.blockId,
        text: b.text,
      }));
      // Duplicate ids can appear transiently (e.g. pasted blocks before UniqueID runs).
      const unique = [...new Map(blocks.map((b) => [b.id, b])).values()];
      this.blocks.addAll(unique);
      this.blockIdsByRecipe.set(recipe.id, unique.map((b) => b.id));
      this.recipes.set(recipe.id, recipe);
    }
  }

  private removeRecipeBlocks(id: string) {
    for (const blockId of this.blockIdsByRecipe.get(id) ?? []) this.blocks.discard(blockId);
    this.blockIdsByRecipe.delete(id);
    this.recipes.delete(id);
  }

  search(query: string, limits = { entities: 8, occurrences: 30 }): SearchResults {
    const q = query.trim();
    if (!q) return { query, entities: [], occurrences: [], totalOccurrences: 0 };

    const entities: EntityHit[] = [];
    for (const r of this.entities.search(q).slice(0, limits.entities)) {
      const item = this.items.get(String(r.id));
      if (!item) continue;
      entities.push({ id: item.id, kind: item.type, name: item.name, item, location: this.itemPath(item.id).slice(0, -1), score: r.score });
    }

    const blockResults = this.blocks.search(q).filter((r) => this.items.has(String(r.recipeId)));
    const occurrences = blockResults.slice(0, limits.occurrences).map((r) => this.toOccurrence(r, q));
    return { query, entities, occurrences, totalOccurrences: blockResults.length };
  }

  private toOccurrence(r: SearchResult, query: string): OccurrenceHit {
    const text = String(r.text);
    const recipeId = String(r.recipeId);
    const { start, length } = locateMatch(text, query, r.terms);
    const snip = snippet(text, start, length);
    return {
      key: String(r.id),
      recipeId,
      recipeName: this.items.get(recipeId)?.name ?? 'Receita',
      blockId: String(r.blockId),
      location: this.itemPath(recipeId),
      before: snip.before,
      match: snip.match,
      after: snip.after,
      matchText: text.slice(start, start + length),
      score: r.score,
    };
  }

  /** Names of the item and its ancestor folders, root first. */
  itemPath(id: string): string[] {
    const out: string[] = [];
    let current = this.items.get(id);
    while (current) {
      out.unshift(current.name);
      current = current.parentId ? this.items.get(current.parentId) : undefined;
    }
    return out;
  }
}

/** Finds where to highlight: the full query if present, otherwise the first matched term. */
export function locateMatch(text: string, query: string, terms: string[]) {
  const exact = findAll(text, query)[0];
  if (exact !== undefined) return { start: exact, length: query.length };
  const normalized = normalizeKeepLength(text);
  for (const term of [...terms].sort((a, b) => b.length - a.length)) {
    const idx = normalized.indexOf(term);
    if (idx !== -1) {
      // Extend to the end of the word so prefix matches highlight the whole word.
      let end = idx + term.length;
      while (end < text.length && /[\p{L}\p{N}]/u.test(text[end])) end++;
      return { start: idx, length: end - idx };
    }
  }
  return { start: 0, length: 0 };
}
