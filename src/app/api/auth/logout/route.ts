import { NextResponse } from 'next/server';
import { assertSameOrigin } from '@/lib/server/google';
import { clearSession } from '@/lib/server/session';
import { errorResponse } from '@/lib/server/respond';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await clearSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
