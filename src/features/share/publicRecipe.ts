/**
 * The public copy of a recipe ("link público"). It lives in the owner's Drive, in
 * `cadernos/<id>/publicas/<recipeId>.json`, shared as "anyone with the link can view". The
 * public page `/r/<fileId>` reads it; nothing is stored on CookMe's server.
 */
import { z } from 'zod';
import { ColorNameSchema, RichContentSchema } from '@/lib/schemas';

export const PUBLIC_FORMAT = 'cookme-public';
export const PUBLIC_DIR = 'publicas';

export const PublicRecipeSchema = z.object({
  format: z.literal(PUBLIC_FORMAT),
  version: z.number(),
  publishedAt: z.string(),
  name: z.string(),
  icon: z.string().nullable().default(null),
  color: ColorNameSchema.nullable().catch(null),
  time: z.string().default(''),
  servings: z.string().default(''),
  coverAssetId: z.string().nullable().default(null),
  coverUrl: z.string().nullable().default(null),
  content: RichContentSchema,
  /** assetId → Drive file id of each photo/audio used (also shared publicly). */
  files: z.record(z.string(), z.string()).default({}),
  /** MIME type of each asset, for the public page and the "save to my CookMe" file. */
  mimeTypes: z.record(z.string(), z.string()).default({}),
});
export type PublicRecipe = z.infer<typeof PublicRecipeSchema>;

export function publicRecipeUrl(origin: string, fileId: string) {
  return `${origin.replace(/\/$/, '')}/r/${encodeURIComponent(fileId)}`;
}
