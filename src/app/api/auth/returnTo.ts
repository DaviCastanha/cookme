import { NextResponse, type NextRequest } from 'next/server';

/** Only allow same-site relative paths after OAuth (prevents open redirects). */
export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  return value;
}

/** Sends the user back with a readable message when Google credentials are missing. */
export function notConfigured(request: NextRequest, returnTo: string) {
  const url = new URL(returnTo, request.nextUrl.origin);
  url.searchParams.set('auth_error', 'Login com Google não configurado neste servidor (veja docs/GOOGLE_SETUP.md).');
  return NextResponse.redirect(url);
}
