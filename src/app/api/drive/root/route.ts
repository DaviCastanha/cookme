import { NextResponse } from 'next/server';
import { assertSameOrigin, getDriveAccessToken } from '@/lib/server/google';
import { findOrCreateFolder } from '@/lib/server/drive';
import { errorResponse } from '@/lib/server/respond';

/** Finds or creates the app folder "CookMe" in the user's My Drive. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const token = await getDriveAccessToken();
    const folder = await findOrCreateFolder(token, 'CookMe', 'root');
    return NextResponse.json({ id: folder.id });
  } catch (error) {
    return errorResponse(error);
  }
}
