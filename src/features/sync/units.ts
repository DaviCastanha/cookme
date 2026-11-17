/**
 * Mapping between local data and Drive files (a visible "CookMe" folder in the person's Drive):
 *
 * CookMe/
 *   app-index.json
 *   cadernos/<projectId>/
 *     caderno.json  pastas.json  arquivos.json
 *     receitas/<recipeId>.json
 *     arquivos/fotos/<assetId>.<ext>
 *     arquivos/audios/<assetId>.<ext>
 */
import { getDb, type SyncUnit } from '@/lib/db/database';
import { AssetsFileSchema, ExplorerFileSchema, ProjectSchema, RecipeSchema, SCHEMA_VERSION, type Recipe } from '@/lib/schemas';

export const PROJECTS_DIR = 'cadernos';
export const RECIPES_DIR = 'receitas';
export const ASSETS_DIR = 'arquivos';

/** File names of the per-caderno units. */
const ROOT_FILES: Record<'project' | 'explorer' | 'assets', string> = {
  project: 'caderno.json',
  explorer: 'pastas.json',
  assets: 'arquivos.json',
};

export interface UnitLocation {
  /** Folder names below the CookMe root. */
  dirs: string[];
  name: string;
  mimeType: string;
}

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/webm': 'webm',
};

export function projectDirs(projectId: string) {
  return [PROJECTS_DIR, projectId];
}

/** Logical path of a caderno's own file (`caderno.json`), used to know if it was ever synced. */
export function projectFileKey(projectId: string) {
  return [...projectDirs(projectId), ROOT_FILES.project].join('/');
}

export function unitLocation(projectId: string, unit: SyncUnit, assetMime?: string): UnitLocation {
  const base = projectDirs(projectId);
  const json = 'application/json';
  if (unit.startsWith('recipe:')) return { dirs: [...base, RECIPES_DIR], name: `${unit.slice(7)}.json`, mimeType: json };
  if (unit.startsWith('asset:')) {
    const mime = assetMime ?? 'application/octet-stream';
    const kind = mime.startsWith('image/') ? 'fotos' : mime.startsWith('audio/') ? 'audios' : 'outros';
    return { dirs: [...base, ASSETS_DIR, kind], name: `${unit.slice(6)}.${EXT[mime.split(';')[0].trim()] ?? 'bin'}`, mimeType: mime };
  }
  return { dirs: base, name: ROOT_FILES[unit as keyof typeof ROOT_FILES], mimeType: json };
}

export function locationKey(loc: Pick<UnitLocation, 'dirs' | 'name'>) {
  return [...loc.dirs, loc.name].join('/');
}

/** Reads the current local state of a unit. Returns null when the record no longer exists. */
export async function serializeUnit(projectId: string, unit: SyncUnit): Promise<{ body: Blob | string; mimeType: string } | null> {
  const db = getDb();
  const json = (value: unknown) => ({ body: JSON.stringify(value, null, 1), mimeType: 'application/json' });

  if (unit === 'project') {
    const project = await db.projects.get(projectId);
    return project ? json(project) : null;
  }
  if (unit === 'explorer') {
    const items = await db.items.where('projectId').equals(projectId).toArray();
    return json({ schemaVersion: SCHEMA_VERSION, items });
  }
  if (unit === 'assets') {
    const assets = await db.assets.where('projectId').equals(projectId).toArray();
    return json({ schemaVersion: SCHEMA_VERSION, assets });
  }
  if (unit.startsWith('recipe:')) {
    const recipe = await db.recipes.get(unit.slice(7));
    return recipe ? json(recipe) : null;
  }
  if (unit.startsWith('asset:')) {
    const id = unit.slice(6);
    const [asset, blob] = await Promise.all([db.assets.get(id), db.assetBlobs.get(id)]);
    return asset && blob ? { body: blob.blob, mimeType: asset.mimeType } : null;
  }
  return null;
}

/** Applies a unit downloaded from Drive to the local database (without re-enqueueing it). */
export async function applyRemoteUnit(projectId: string, unit: SyncUnit, data: unknown) {
  const db = getDb();
  if (unit === 'project') {
    await db.projects.put(ProjectSchema.parse(data));
  } else if (unit === 'explorer') {
    const parsed = ExplorerFileSchema.parse(data);
    await db.transaction('rw', db.items, async () => {
      await db.items.where('projectId').equals(projectId).delete();
      await db.items.bulkPut(parsed.items);
    });
  } else if (unit === 'assets') {
    await db.assets.bulkPut(AssetsFileSchema.parse(data).assets);
  } else if (unit.startsWith('recipe:')) {
    await db.recipes.put(RecipeSchema.parse(data) as Recipe);
  }
}

/** Inverse of unitLocation for files listed inside a caderno folder. */
export function unitFromRemote(dir: 'root' | typeof RECIPES_DIR, fileName: string): SyncUnit | null {
  if (dir === RECIPES_DIR) return fileName.endsWith('.json') ? `recipe:${fileName.replace(/\.json$/, '')}` : null;
  const entry = Object.entries(ROOT_FILES).find(([, name]) => name === fileName);
  return entry ? (entry[0] as SyncUnit) : null;
}
