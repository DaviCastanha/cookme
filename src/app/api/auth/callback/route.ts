import { NextResponse, type NextRequest } from 'next/server';
import { decodeIdToken, exchangeCode, googleConfig, mergeTokens } from '@/lib/server/google';
import { getSession, setSession, takeOAuthState } from '@/lib/server/session';

function withParam(base: string, path: string, key: string, value: string) {
  const sep = path.includes('?') ? '&' : '?';
  return `${base}${path}${sep}${key}=${encodeURIComponent(value)}`;
}

export async function GET(request: NextRequest) {
  const appUrl = googleConfig()?.appUrl ?? request.nextUrl.origin;
  const params = request.nextUrl.searchParams;
  const state = await takeOAuthState();
  const returnTo = state?.returnTo ?? '/';
  const fail = (reason: string) => NextResponse.redirect(withParam(appUrl, returnTo, 'auth_error', reason));

  if (!state || state.nonce !== params.get('state')) return fail('Sessão de login expirada. Tente novamente.');
  if (params.get('error')) return fail(params.get('error') === 'access_denied' ? 'Permissão negada.' : String(params.get('error')));
  const code = params.get('code');
  if (!code) return fail('Resposta inválida do Google.');

  try {
    const tokens = await exchangeCode(code);
    const profile = tokens.id_token ? decodeIdToken(tokens.id_token) : undefined;
    const previous = await getSession();
    // Switching accounts discards the previous account's tokens.
    const base = previous && profile && previous.sub !== profile.sub ? null : previous;
    await setSession(mergeTokens(base, tokens, profile));
    return NextResponse.redirect(withParam(appUrl, returnTo, 'auth', state.intent));
  } catch (error) {
    console.error(error);
    return fail('Não foi possível concluir o login.');
  }
}
