import { NextResponse } from 'next/server';
import { assertSameOrigin, getDriveAccessToken } from '@/lib/server/google';
import { setPublic } from '@/lib/server/drive';
import { errorResponse } from '@/lib/server/respond';

/** Makes files public ("anyone with the link") or private again. Body: { fileIds, public }. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { fileIds, public: isPublic } = (await request.json()) as { fileIds?: unknown; public?: unknown };
    if (!Array.isArray(fileIds) || !fileIds.every((id) => typeof id === 'string') || typeof isPublic !== 'boolean') {
      return NextResponse.json({ error: 'fileIds (lista) e public (booleano) são obrigatórios' }, { status: 400 });
    }
    if (fileIds.length > 60) return NextResponse.json({ error: 'Arquivos demais de uma vez.' }, { status: 400 });
    const token = await getDriveAccessToken();
    for (const id of fileIds as string[]) await setPublic(token, id, isPublic);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
