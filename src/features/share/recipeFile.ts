/**
 * A single recipe as a ".cookme" file (JSON), with its photos and audio embedded, so it can be
 * sent to someone and imported into their own CookMe as an editable copy.
 */
import { z } from 'zod';
import { getAssetIds, mapAssetIds } from '@/features/recipes/content';
import * as repo from '@/lib/repository';
import { AssetSchema, ColorNameSchema, RichContentSchema, type ExplorerItem, type Recipe, type RichContent } from '@/lib/schemas';
import { createId } from '@/lib/utils/id';
import { shareOrDownload, slugify, type ShareOutcome } from './shareFile';

export const RECIPE_FILE_FORMAT = 'cookme-recipe';
/** Accepted by the import picker (some apps add .txt or .json when saving the file). */
export const RECIPE_FILE_ACCEPT = '.cookme,.txt,.json,application/json,text/plain';

const RecipeFileSchema = z.object({
  format: z.literal(RECIPE_FILE_FORMAT),
  version: z.number(),
  exportedAt: z.string(),
  item: z.object({ name: z.string(), icon: z.string().nullable().default(null), color: ColorNameSchema.nullable().catch(null) }),
  recipe: z.object({
    content: RichContentSchema,
    coverAssetId: z.string().nullable().default(null),
    coverUrl: z.string().nullable().default(null),
    servings: z.string().default(''),
    time: z.string().default(''),
  }),
  assets: z.array(AssetSchema.pick({ id: true, name: true, mimeType: true }).extend({ data: z.string() })),
});
export type RecipeFile = z.infer<typeof RecipeFileSchema>;

export async function buildRecipeFile(item: Pick<ExplorerItem, 'name' | 'icon' | 'color'>, recipe: Recipe): Promise<RecipeFile> {
  const ids = [...new Set([...(recipe.coverAssetId ? [recipe.coverAssetId] : []), ...getAssetIds(recipe.content)])];
  const assets: RecipeFile['assets'] = [];
  for (const id of ids) {
    const [asset, blob] = await Promise.all([repo.getAsset(id), repo.getAssetBlob(id)]);
    if (!asset || !blob) continue; // Not on this device yet: the copy goes without it.
    assets.push({ id, name: asset.name, mimeType: asset.mimeType, data: await toBase64(blob) });
  }
  return {
    format: RECIPE_FILE_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    item: { name: item.name, icon: item.icon, color: item.color },
    recipe: {
      content: recipe.content,
      coverAssetId: recipe.coverAssetId,
      coverUrl: recipe.coverUrl,
      servings: recipe.servings,
      time: recipe.time,
    },
    assets,
  };
}

export async function shareRecipeFile(item: ExplorerItem, recipe: Recipe): Promise<ShareOutcome> {
  const data = JSON.stringify(await buildRecipeFile(item, recipe));
  const base = slugify(item.name);
  // Share sheets only take some file types: try the real extension, then plain text.
  return shareOrDownload(
    [new File([data], `${base}.cookme`, { type: 'application/json' }), new File([data], `${base}.cookme.txt`, { type: 'text/plain' })],
    item.name,
  );
}

export async function readRecipeFile(file: File): Promise<RecipeFile> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error('Este arquivo não é uma receita do CookMe.');
  }
  const parsed = RecipeFileSchema.safeParse(json);
  if (!parsed.success) throw new Error('Este arquivo não é uma receita do CookMe (ou está incompleto).');
  return parsed.data;
}

/** Adds the recipe of a .cookme file to a caderno, with new ids for its photos and audio. */
export async function importRecipeFile(projectId: string, parentId: string | null, file: File) {
  const data = await readRecipeFile(file);
  const idMap = new Map<string, string>();
  const assets = [];
  for (const a of data.assets) {
    const blob = fromBase64(a.data, a.mimeType);
    const id = createId('asset');
    idMap.set(a.id, id);
    assets.push({
      asset: {
        id,
        projectId,
        kind: a.mimeType.startsWith('image/') ? ('image' as const) : a.mimeType.startsWith('audio/') ? ('audio' as const) : ('file' as const),
        name: a.name,
        mimeType: a.mimeType,
        size: blob.size,
        createdAt: new Date().toISOString(),
      },
      blob,
    });
  }
  const cover = data.recipe.coverAssetId ? idMap.get(data.recipe.coverAssetId) ?? null : null;
  return repo.insertRecipe(projectId, parentId, {
    item: data.item,
    recipe: {
      content: mapAssetIds(data.recipe.content as RichContent, idMap),
      coverAssetId: cover,
      coverUrl: cover ? null : data.recipe.coverUrl,
      servings: data.recipe.servings,
      time: data.recipe.time,
    },
    assets,
  });
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function fromBase64(data: string, type: string): Blob {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type });
}
