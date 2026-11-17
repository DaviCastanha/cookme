import { NextResponse } from 'next/server';
import { slugify } from '@/features/share/shareFile';
import { fetchPublicFile, fetchPublicRecipe } from '@/lib/server/publicDrive';

/** Public recipe as a ".cookme" file (same format as "Enviar arquivo CookMe"), to import into one's own CookMe. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await fetchPublicRecipe(id);
  if (!recipe) return new NextResponse('Não encontrado', { status: 404 });

  const assets = [];
  for (const [assetId, fileId] of Object.entries(recipe.files)) {
    const res = await fetchPublicFile(fileId, { revalidate: 0 });
    if (!res) continue;
    const data = Buffer.from(await res.arrayBuffer()).toString('base64');
    const mimeType = recipe.mimeTypes[assetId] ?? res.headers.get('content-type') ?? 'application/octet-stream';
    assets.push({ id: assetId, name: assetId, mimeType, data });
  }

  const file = {
    format: 'cookme-recipe',
    version: 1,
    exportedAt: new Date().toISOString(),
    item: { name: recipe.name, icon: recipe.icon, color: recipe.color },
    recipe: {
      content: recipe.content,
      coverAssetId: recipe.coverAssetId,
      coverUrl: recipe.coverUrl,
      servings: recipe.servings,
      time: recipe.time,
    },
    assets,
  };
  return new NextResponse(JSON.stringify(file), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slugify(recipe.name)}.cookme"`,
      'Cache-Control': 'no-store',
    },
  });
}
