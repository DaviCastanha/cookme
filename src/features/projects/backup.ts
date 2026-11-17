/** Manual backup: a single JSON file with a whole caderno (photos and audio not included). */
import { z } from 'zod';
import { getDb } from '@/lib/db/database';
import { importBundle, type ProjectBundle } from '@/lib/repository';
import { AssetSchema, ExplorerItemSchema, ProjectSchema, RecipeSchema, type Recipe } from '@/lib/schemas';
import { slugify } from '@/features/share/shareFile';

const BackupSchema = z.object({
  format: z.literal('cookme-backup'),
  version: z.number(),
  exportedAt: z.string(),
  project: ProjectSchema,
  items: z.array(ExplorerItemSchema),
  recipes: z.array(RecipeSchema),
  assets: z.array(AssetSchema),
});

export async function exportProject(projectId: string): Promise<{ filename: string; blob: Blob }> {
  const db = getDb();
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Caderno não encontrado.');
  const backup = {
    format: 'cookme-backup' as const,
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    items: await db.items.where('projectId').equals(projectId).toArray(),
    recipes: await db.recipes.where('projectId').equals(projectId).toArray(),
    assets: await db.assets.where('projectId').equals(projectId).toArray(),
  };
  return {
    filename: `${slugify(project.name, 'caderno')}-${backup.exportedAt.slice(0, 10)}.cookme-backup.json`,
    blob: new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' }),
  };
}

export async function readBackup(file: File) {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error('Arquivo de backup inválido.');
  }
  const parsed = BackupSchema.safeParse(json);
  if (!parsed.success) throw new Error('Arquivo de backup inválido. (Para uma receita só, use “Importar receita” dentro de um caderno.)');
  return parsed.data;
}

export async function restoreBackup(backup: z.infer<typeof BackupSchema>) {
  const bundle: ProjectBundle = {
    project: backup.project,
    items: backup.items,
    recipes: backup.recipes as Recipe[],
    assets: backup.assets,
  };
  await importBundle(bundle, { enqueueSync: true });
  return backup.project;
}

export { downloadBlob } from '@/features/share/shareFile';
