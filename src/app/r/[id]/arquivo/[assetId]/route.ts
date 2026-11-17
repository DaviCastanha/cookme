import { NextResponse } from 'next/server';
import { fetchPublicFile, fetchPublicRecipe } from '@/lib/server/publicDrive';

/**
 * A photo or audio of a public recipe. Only files listed in that recipe's public copy can be
 * read here, so this is not an open proxy to Drive.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await params;
  const recipe = await fetchPublicRecipe(id);
  const fileId = recipe?.files[assetId];
  if (!recipe || !fileId) return new NextResponse('Não encontrado', { status: 404 });

  const res = await fetchPublicFile(fileId, { revalidate: 0 });
  if (!res?.body) return new NextResponse('Não encontrado', { status: 404 });
  const type = recipe.mimeTypes[assetId] ?? res.headers.get('content-type') ?? 'application/octet-stream';
  if (!/^(image|audio)\//.test(type)) return new NextResponse('Não encontrado', { status: 404 });

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': type,
      // Asset files never change (a new photo is a new file): cache them at the edge.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
