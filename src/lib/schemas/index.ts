import { z } from 'zod';

export const SCHEMA_VERSION = 1;

/** Item colors, named after ingredients (the names are stored in the data files). */
export const PALETTE = [
  'tomato',
  'carrot',
  'saffron',
  'olive',
  'basil',
  'mint',
  'blueberry',
  'plum',
  'beet',
  'cinnamon',
  'cocoa',
  'pepper',
] as const;
export const ColorNameSchema = z.enum(PALETTE);
export type ColorName = z.infer<typeof ColorNameSchema>;

/** Tiptap/ProseMirror JSON. Validated loosely: structure is owned by the editor schema. */
export const RichContentSchema = z.looseObject({
  type: z.string(),
  content: z.array(z.any()).optional(),
});
export type RichContent = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichContent[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

// ---------- Caderno (internally a "project") ----------

/**
 * - `book`: a regular caderno de receitas.
 * - `tutorial`: the built-in tutorial; replaced automatically when the app ships a newer one.
 */
export const ProjectKindSchema = z.enum(['book', 'tutorial']);
export type ProjectKind = z.infer<typeof ProjectKindSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  kind: ProjectKindSchema.optional(),
  /** Version of built-in content (the tutorial), used to update it in place. */
  contentVersion: z.number().int().optional(),
  schemaVersion: z.number().int(),
  description: z.string().default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

// ---------- Explorer (pastas e receitas) ----------

export const ExplorerItemTypeSchema = z.enum(['folder', 'recipe']);
export type ExplorerItemType = z.infer<typeof ExplorerItemTypeSchema>;

export const ExplorerItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: ExplorerItemTypeSchema,
  name: z.string(),
  icon: z.string().nullable().default(null),
  color: ColorNameSchema.nullable().default(null),
  /** null = root of the caderno. */
  parentId: z.string().nullable(),
  /** Sort key among siblings (ascending). Fractional values allow inserts between items. */
  order: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ExplorerItem = z.infer<typeof ExplorerItemSchema>;

// ---------- Recipes ----------

export const RecipeSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  /** One Tiptap document: Ingredientes, Modo de preparo and Dicas are ordinary blocks inside it. */
  content: RichContentSchema,
  /** Cover photo: an uploaded asset or a link (never both). */
  coverAssetId: z.string().nullable().default(null),
  coverUrl: z.string().nullable().default(null),
  /** Free text, e.g. "8 fatias", "4 pessoas". */
  servings: z.string().default(''),
  /** Free text, e.g. "50 min", "1h30". */
  time: z.string().default(''),
  updatedAt: z.string(),
});
export type Recipe = Omit<z.infer<typeof RecipeSchema>, 'content'> & { content: RichContent };

// ---------- Assets ----------

export const AssetSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  kind: z.enum(['image', 'audio', 'file']),
  name: z.string(),
  mimeType: z.string(),
  size: z.number(),
  createdAt: z.string(),
});
export type Asset = z.infer<typeof AssetSchema>;

// ---------- Drive file envelopes ----------

export const AppIndexFileSchema = z.object({
  schemaVersion: z.number(),
  projects: z.array(
    z.object({ id: z.string(), name: z.string(), updatedAt: z.string(), deleted: z.boolean().optional() }),
  ),
});
export type AppIndexFile = z.infer<typeof AppIndexFileSchema>;

export const ExplorerFileSchema = z.object({
  schemaVersion: z.number(),
  items: z.array(ExplorerItemSchema),
});

export const AssetsFileSchema = z.object({
  schemaVersion: z.number(),
  assets: z.array(AssetSchema),
});
