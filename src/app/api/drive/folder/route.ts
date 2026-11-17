import { NextResponse } from 'next/server';
import { assertSameOrigin, getDriveAccessToken } from '@/lib/server/google';
import { findOrCreateFolder } from '@/lib/server/drive';
import { errorResponse } from '@/lib/server/respond';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { name, parentId } = (await request.json()) as { name?: string; parentId?: string };
    if (!name || !parentId) return NextResponse.json({ error: 'name e parentId são obrigatórios' }, { status: 400 });
    const token = await getDriveAccessToken();
    const folder = await findOrCreateFolder(token, name, parentId);
    return NextResponse.json({ id: folder.id });
  } catch (error) {
    return errorResponse(error);
  }
}
