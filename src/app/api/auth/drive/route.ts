import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { buildAuthUrl, googleConfig, DRIVE_SCOPE, LOGIN_SCOPES } from '@/lib/server/google';
import { getSession, setOAuthState } from '@/lib/server/session';
import { errorResponse } from '@/lib/server/respond';
import { notConfigured, safeReturnTo } from '../returnTo';

/** Asks again for Drive access, for users who unchecked it on Google's consent screen. */
export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('returnTo'));
  if (!googleConfig()) return notConfigured(request, returnTo);
  try {
    const session = await getSession();
    const nonce = crypto.randomBytes(16).toString('base64url');
    await setOAuthState({ nonce, returnTo, intent: 'drive' });
    return NextResponse.redirect(
      buildAuthUrl({ scopes: [...LOGIN_SCOPES, DRIVE_SCOPE], state: nonce, offline: true, loginHint: session?.email }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
