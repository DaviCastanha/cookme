import { NextResponse, type NextRequest } from 'next/server';
import { getDriveAccessToken } from '@/lib/server/google';
import { listChildren } from '@/lib/server/drive';
import { errorResponse } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const parentId = request.nextUrl.searchParams.get('parentId');
    if (!parentId) return NextResponse.json({ error: 'parentId é obrigatório' }, { status: 400 });
    const token = await getDriveAccessToken();
    return NextResponse.json({ files: await listChildren(token, parentId) });
  } catch (error) {
    return errorResponse(error);
  }
}
