import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { buildAuthUrl, DRIVE_SCOPE, googleConfig, LOGIN_SCOPES } from '@/lib/server/google';
import { setOAuthState } from '@/lib/server/session';
import { errorResponse } from '@/lib/server/respond';
import { notConfigured, safeReturnTo } from '../returnTo';

/**
 * Sign in with Google and grant Drive access in a single consent. `drive.file` only covers
 * files CookMe itself creates (the "CookMe" folder), never the rest of the Drive.
 */
export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('returnTo'));
  if (!googleConfig()) return notConfigured(request, returnTo);
  try {
    const nonce = crypto.randomBytes(16).toString('base64url');
    await setOAuthState({ nonce, returnTo, intent: 'login' });
    return NextResponse.redirect(buildAuthUrl({ scopes: [...LOGIN_SCOPES, DRIVE_SCOPE], state: nonce, offline: true }));
  } catch (error) {
    return errorResponse(error);
  }
}
