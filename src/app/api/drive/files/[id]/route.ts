import { NextResponse } from 'next/server';
import { assertSameOrigin, getDriveAccessToken } from '@/lib/server/google';
import { download, trash } from '@/lib/server/drive';
import { errorResponse } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = await getDriveAccessToken();
    const res = await download(token, id);
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Moves the file to the Drive trash. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const token = await getDriveAccessToken();
    await trash(token, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
