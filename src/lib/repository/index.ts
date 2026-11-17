/**
 * Local repository: the single entry point for reading and writing caderno data.
 * IndexedDB is the source of truth on this device; every write enqueues the affected
 * Drive file so the sync engine can upload it in the background.
 */
import { getDb, type SyncUnit } from '@/lib/db/database';
import { SCHEMA_VERSION, type Asset, type ExplorerItem, type Project, type Recipe, type RichContent } from '@/lib/schemas';
import { createId, nowIso } from '@/lib/utils/id';
import { emptyRecipeContent } from '@/features/recipes/content';

export const ORDER_STEP = 1024;

// ---------------------------------------------------------------- sync queue

export async function enqueue(projectId: string, unit: SyncUnit, op: 'put' | 'delete' = 'put') {
  const db = getDb();
  await db.syncQueue.put({ key: `${projectId}|${unit}`, projectId, unit, op, queuedAt: Date.now(), attempts: 0 });
  notifyLocalWrite();
}

type Listener = () => void;
const writeListeners = new Set<Listener>();
/** Lets the sync engine wake up as soon as something is written locally. */
export function onLocalWrite(listener: Listener) {
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}
function notifyLocalWrite() {
  writeListeners.forEach((l) => l());
}

async function touchProject(projectId: string) {
  await getDb().projects.update(projectId, { updatedAt: nowIso() });
  await enqueue(projectId, 'project');
}

// ---------------------------------------------------------------- cadernos

export async function listProjects(): Promise<Project[]> {
  return getDb().projects.orderBy('updatedAt').reverse().toArray();
}

export async function getProject(id: string) {
  return getDb().projects.get(id);
}

/** Starter folders of a new caderno: helpful, but fully editable/removable. */
export const STARTER_FOLDERS: Pick<ExplorerItem, 'name' | 'icon' | 'color'>[] = [
  { name: 'Salgados', icon: 'cooking-pot', color: 'tomato' },
  { name: 'Doces', icon: 'cake-slice', color: 'beet' },
  { name: 'Bebidas', icon: 'cup-soda', color: 'blueberry' },
];

export async function createProject(name: string, options: { starterFolders?: boolean } = {}): Promise<Project> {
  const db = getDb();
  const now = nowIso();
  const project: Project = {
    id: createId('project'),
    name: name.trim() || 'Meu caderno',
    kind: 'book',
    schemaVersion: SCHEMA_VERSION,
    description: '',
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction('rw', [db.projects, db.syncQueue], async () => {
    await db.projects.add(project);
    await enqueue(project.id, 'project');
  });
  if (options.starterFolders !== false) {
    for (const folder of STARTER_FOLDERS) await createItem(project.id, { type: 'folder', parentId: null, ...folder });
  }
  return project;
}

export async function renameProject(id: string, name: string) {
  await getDb().projects.update(id, { name: name.trim(), updatedAt: nowIso() });
  await enqueue(id, 'project');
}

export async function deleteProject(id: string) {
  const db = getDb();
  await db.transaction('rw', [db.projects, db.items, db.recipes, db.assets, db.assetBlobs, db.syncQueue], async () => {
    const assetIds = await db.assets.where('projectId').equals(id).primaryKeys();
    await db.assetBlobs.bulkDelete(assetIds);
    await Promise.all([
      db.projects.delete(id),
      db.items.where('projectId').equals(id).delete(),
      db.recipes.where('projectId').equals(id).delete(),
      db.assets.where('projectId').equals(id).delete(),
      db.syncQueue.where('projectId').equals(id).delete(),
    ]);
    // A single delete entry removes the whole caderno folder from Drive.
    await enqueue(id, 'project', 'delete');
  });
}

// ---------------------------------------------------------------- explorer

export async function listItems(projectId: string): Promise<ExplorerItem[]> {
  return getDb().items.where('projectId').equals(projectId).toArray();
}

export interface NewItemInput {
  type: ExplorerItem['type'];
  name: string;
  parentId: string | null;
  icon?: string | null;
  color?: ExplorerItem['color'];
  /** Recipe body (defaults to the empty sections). */
  content?: RichContent;
  /** Place before this sibling instead of at the end. */
  beforeId?: string;
}

export async function createItem(projectId: string, input: NewItemInput): Promise<ExplorerItem> {
  const db = getDb();
  const now = nowIso();
  const siblings = (await listItems(projectId)).filter((i) => i.parentId === input.parentId);
  const item: ExplorerItem = {
    id: createId(input.type === 'folder' ? 'folder' : 'recipe'),
    projectId,
    type: input.type,
    name: input.name,
    icon: input.icon ?? null,
    color: input.color ?? null,
    parentId: input.parentId,
    order: computeOrder(siblings, input.beforeId),
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', [db.items, db.recipes, db.syncQueue], async () => {
    await db.items.add(item);
    await enqueue(projectId, 'explorer');
    if (input.type === 'recipe') {
      await db.recipes.add(newRecipe(item.id, projectId, input.content));
      await enqueue(projectId, `recipe:${item.id}`);
    }
  });
  await touchProject(projectId);
  return item;
}

export function newRecipe(id: string, projectId: string, content?: RichContent): Recipe {
  return {
    id,
    projectId,
    content: content ?? emptyRecipeContent(),
    coverAssetId: null,
    coverUrl: null,
    servings: '',
    time: '',
    updatedAt: nowIso(),
  };
}

export function computeOrder(siblings: Pick<ExplorerItem, 'id' | 'order'>[], beforeId?: string): number {
  const sorted = [...siblings].sort((a, b) => a.order - b.order);
  if (!sorted.length) return ORDER_STEP;
  const idx = beforeId ? sorted.findIndex((s) => s.id === beforeId) : -1;
  if (idx === -1) return sorted[sorted.length - 1].order + ORDER_STEP;
  const prev = idx > 0 ? sorted[idx - 1].order : sorted[idx].order - ORDER_STEP;
  return (prev + sorted[idx].order) / 2;
}

export async function updateItem(id: string, patch: Partial<Pick<ExplorerItem, 'name' | 'icon' | 'color'>>) {
  const db = getDb();
  const item = await db.items.get(id);
  if (!item) return;
  await db.items.update(id, { ...patch, updatedAt: nowIso() });
  await enqueue(item.projectId, 'explorer');
  await touchProject(item.projectId);
}

export async function moveItem(id: string, parentId: string | null, beforeId?: string) {
  const db = getDb();
  const item = await db.items.get(id);
  if (!item) return;
  const all = await listItems(item.projectId);
  if (parentId && isDescendant(all, parentId, id)) {
    throw new Error('Não é possível mover uma pasta para dentro dela mesma.');
  }
  const siblings = all.filter((i) => i.parentId === parentId && i.id !== id);
  await db.items.update(id, { parentId, order: computeOrder(siblings, beforeId), updatedAt: nowIso() });
  await enqueue(item.projectId, 'explorer');
  await touchProject(item.projectId);
}

/** True when `nodeId` is `ancestorId` itself or lives somewhere below it. */
export function isDescendant(items: Pick<ExplorerItem, 'id' | 'parentId'>[], nodeId: string, ancestorId: string) {
  const byId = new Map(items.map((i) => [i.id, i]));
  let current: string | null = nodeId;
  while (current) {
    if (current === ancestorId) return true;
    current = byId.get(current)?.parentId ?? null;
  }
  return false;
}

export function collectSubtree(items: ExplorerItem[], rootId: string): ExplorerItem[] {
  const out: ExplorerItem[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    const item = items.find((i) => i.id === id);
    if (!item) continue;
    out.push(item);
    items.filter((i) => i.parentId === id).forEach((c) => stack.push(c.id));
  }
  return out;
}

export async function deleteItem(id: string) {
  const db = getDb();
  const item = await db.items.get(id);
  if (!item) return;
  const subtree = collectSubtree(await listItems(item.projectId), id);
  await db.transaction('rw', [db.items, db.recipes, db.syncQueue], async () => {
    for (const node of subtree) {
      await db.items.delete(node.id);
      if (node.type === 'recipe') {
        await db.recipes.delete(node.id);
        await enqueue(item.projectId, `recipe:${node.id}`, 'delete');
      }
    }
    await enqueue(item.projectId, 'explorer');
  });
  await touchProject(item.projectId);
  return subtree;
}

/** Copies a recipe right after the original ("Duplicar"). Photos and audio are shared, not copied. */
export async function duplicateRecipe(id: string): Promise<ExplorerItem | null> {
  const db = getDb();
  const [item, recipe] = await Promise.all([db.items.get(id), db.recipes.get(id)]);
  if (!item || !recipe) return null;
  const siblings = (await listItems(item.projectId)).filter((i) => i.parentId === item.parentId);
  const after = [...siblings].sort((a, b) => a.order - b.order).find((s) => s.order > item.order);
  const copy = await createItem(item.projectId, {
    type: 'recipe',
    name: `${item.name} (cópia)`,
    parentId: item.parentId,
    icon: item.icon,
    color: item.color,
    content: recipe.content,
    beforeId: after?.id,
  });
  await saveRecipe(copy.id, { coverAssetId: recipe.coverAssetId, coverUrl: recipe.coverUrl, servings: recipe.servings, time: recipe.time });
  return copy;
}

// ---------------------------------------------------------------- recipes

export async function getRecipe(id: string) {
  return getDb().recipes.get(id);
}

export async function listRecipes(projectId: string) {
  return getDb().recipes.where('projectId').equals(projectId).toArray();
}

/**
 * Saves the editor JSON and returns the new `updatedAt`. Returns null when the recipe was
 * deleted meanwhile (e.g. the last autosave of a recipe removed on another device).
 */
export async function saveRecipeContent(id: string, content: RichContent): Promise<string | null> {
  const db = getDb();
  const updatedAt = nowIso();
  // Read and write in one transaction: never overwrite fields saved meanwhile (cover, time, servings).
  const recipe = await db.transaction('rw', db.recipes, async () => {
    const current = await db.recipes.get(id);
    if (current) await db.recipes.put({ ...current, content, updatedAt });
    return current;
  });
  if (!recipe) return null;
  await enqueue(recipe.projectId, `recipe:${id}`);
  await touchProject(recipe.projectId);
  return updatedAt;
}

export async function saveRecipe(id: string, patch: Partial<Omit<Recipe, 'id' | 'projectId'>>) {
  const db = getDb();
  // Read and write in one transaction: never overwrite the body being autosaved by the editor.
  const recipe = await db.transaction('rw', db.recipes, async () => {
    const current = await db.recipes.get(id);
    if (current) await db.recipes.put({ ...current, ...patch, updatedAt: nowIso() });
    return current;
  });
  if (!recipe) return; // Deleted meanwhile.
  await enqueue(recipe.projectId, `recipe:${id}`);
  await touchProject(recipe.projectId);
}

// ---------------------------------------------------------------- assets

export async function addAsset(projectId: string, file: Blob, name: string): Promise<Asset> {
  const db = getDb();
  const asset: Asset = {
    id: createId('asset'),
    projectId,
    kind: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file',
    name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: nowIso(),
  };
  await db.transaction('rw', [db.assets, db.assetBlobs, db.syncQueue], async () => {
    await db.assets.add(asset);
    await db.assetBlobs.put({ id: asset.id, blob: file });
    await enqueue(projectId, `asset:${asset.id}`);
    await enqueue(projectId, 'assets');
  });
  return asset;
}

export async function getAsset(id: string) {
  return getDb().assets.get(id);
}

export async function getAssetBlob(id: string) {
  return (await getDb().assetBlobs.get(id))?.blob ?? null;
}

// ---------------------------------------------------------------- bundles

/** Everything that makes up a caderno; used for seeding and for importing backups. */
export interface ProjectBundle {
  project: Project;
  items: ExplorerItem[];
  recipes: Recipe[];
  assets: Asset[];
}

export async function importBundle(bundle: ProjectBundle, options: { enqueueSync: boolean }) {
  const db = getDb();
  const pid = bundle.project.id;
  await db.transaction('rw', [db.projects, db.items, db.recipes, db.assets, db.syncQueue], async () => {
    await db.projects.put(bundle.project);
    await db.items.bulkPut(bundle.items);
    await db.recipes.bulkPut(bundle.recipes);
    await db.assets.bulkPut(bundle.assets);
    if (options.enqueueSync) {
      const units: SyncUnit[] = ['project', 'explorer', 'assets', ...bundle.recipes.map((r) => `recipe:${r.id}` as const)];
      for (const unit of units) await enqueue(pid, unit);
    }
  });
}

/**
 * Replaces everything inside a caderno with the bundle's content (keeping the caderno id, so
 * its Drive folder stays valid). Used to update the built-in tutorial.
 * Returns the ids of recipes that no longer exist.
 */
export async function replaceProjectContent(bundle: ProjectBundle): Promise<string[]> {
  const db = getDb();
  const pid = bundle.project.id;
  let removed: string[] = [];
  await db.transaction('rw', [db.projects, db.items, db.recipes, db.assets, db.syncQueue], async () => {
    const oldItems = await db.items.where('projectId').equals(pid).toArray();
    const keep = new Set(bundle.recipes.map((r) => r.id));
    removed = oldItems.filter((i) => i.type === 'recipe' && !keep.has(i.id)).map((i) => i.id);
    for (const id of removed) await enqueue(pid, `recipe:${id}`, 'delete');
    await Promise.all([db.items.where('projectId').equals(pid).delete(), db.recipes.where('projectId').equals(pid).delete()]);
  });
  await importBundle(bundle, { enqueueSync: true });
  return removed;
}

/** A recipe received from someone else (a .cookme file), with fresh asset ids, ready to be added. */
export interface RecipeImport {
  item: Pick<ExplorerItem, 'name' | 'icon' | 'color'>;
  recipe: Pick<Recipe, 'content' | 'coverAssetId' | 'coverUrl' | 'servings' | 'time'>;
  assets: { asset: Asset; blob: Blob }[];
}

export async function insertRecipe(projectId: string, parentId: string | null, input: RecipeImport): Promise<ExplorerItem> {
  const db = getDb();
  await db.transaction('rw', [db.assets, db.assetBlobs, db.syncQueue], async () => {
    for (const { asset, blob } of input.assets) {
      await db.assets.put({ ...asset, projectId });
      await db.assetBlobs.put({ id: asset.id, blob });
      await enqueue(projectId, `asset:${asset.id}`);
    }
    if (input.assets.length) await enqueue(projectId, 'assets');
  });
  const item = await createItem(projectId, { type: 'recipe', parentId, ...input.item, content: input.recipe.content });
  await saveRecipe(item.id, {
    coverAssetId: input.recipe.coverAssetId,
    coverUrl: input.recipe.coverUrl,
    servings: input.recipe.servings,
    time: input.recipe.time,
  });
  return item;
}
