import { NextResponse } from 'next/server';
import { googleConfig, hasDriveAccess } from '@/lib/server/google';
import { getSession } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/** Public session info for the client. Never includes tokens. */
export async function GET() {
  const configured = !!googleConfig();
  const session = configured ? await getSession() : null;
  return NextResponse.json({
    configured,
    user: session ? { email: session.email, name: session.name, picture: session.picture } : null,
    driveConnected: hasDriveAccess(session),
  });
}
