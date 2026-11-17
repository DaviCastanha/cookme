import { NextResponse, type NextRequest } from 'next/server';
import { assertSameOrigin, getDriveAccessToken } from '@/lib/server/google';
import { upload } from '@/lib/server/drive';
import { errorResponse } from '@/lib/server/respond';

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Creates (parentId + name) or replaces (fileId) a file. Optional `ifMd5` makes the write fail
 * with 409 when the file content changed in Drive since the client last synced it.
 */
export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const p = request.nextUrl.searchParams;
    const parentId = p.get('parentId');
    const name = p.get('name');
    if (!parentId || !name) return NextResponse.json({ error: 'parentId e name são obrigatórios' }, { status: 400 });
    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return NextResponse.json({ error: 'Arquivo grande demais' }, { status: 413 });
    const token = await getDriveAccessToken();
    const file = await upload(token, {
      fileId: p.get('fileId') ?? undefined,
      ifMd5: p.get('ifMd5') ?? undefined,
      parentId,
      name,
      mimeType: request.headers.get('content-type') ?? 'application/octet-stream',
      body,
    });
    return NextResponse.json(file);
  } catch (error) {
    return errorResponse(error);
  }
}
