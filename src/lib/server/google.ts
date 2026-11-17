/** Minimal Google OAuth 2.0 (authorization code flow) for a confidential web client. */
import { getSession, setSession, type Session } from './session';

export const LOGIN_SCOPES = ['openid', 'email', 'profile'];
/** Only files created/opened by CookMe — never the user's whole Drive. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 401,
  ) {
    super(message);
  }
}

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const sessionSecret = process.env.SESSION_SECRET;
  if (!clientId || !clientSecret || !sessionSecret) return null;
  return { clientId, clientSecret, appUrl, redirectUri: `${appUrl}/api/auth/callback` };
}

export function buildAuthUrl(opts: { scopes: string[]; state: string; offline: boolean; loginHint?: string }) {
  const config = googleConfig();
  if (!config) throw new AuthError('Google não configurado.', 503);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: opts.scopes.join(' '),
    state: opts.state,
    include_granted_scopes: 'true',
  });
  if (opts.offline) {
    params.set('access_type', 'offline');
    // Ensures a refresh token is returned when Drive access is (re)granted.
    params.set('prompt', 'consent');
  } else {
    params.set('prompt', 'select_account');
  }
  if (opts.loginHint) params.set('login_hint', opts.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const config = googleConfig();
  if (!config) throw new AuthError('Google não configurado.', 503);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...body }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new AuthError(`Falha na troca de token com o Google (${res.status}): ${detail.slice(0, 200)}`, res.status === 400 ? 401 : 502);
  }
  return res.json() as Promise<TokenResponse>;
}

export function exchangeCode(code: string) {
  const config = googleConfig();
  if (!config) throw new AuthError('Google não configurado.', 503);
  return tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: config.redirectUri });
}

/**
 * The id_token comes straight from Google's token endpoint over TLS, so its payload can be
 * trusted without verifying the signature (per Google's OpenID Connect guidance).
 */
export function decodeIdToken(idToken: string): { sub: string; email: string; name?: string; picture?: string } {
  const payload = idToken.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

export function mergeTokens(previous: Session | null, tokens: TokenResponse, profile?: ReturnType<typeof decodeIdToken>): Session {
  const scopes = new Set([...(previous?.scopes ?? []), ...tokens.scope.split(' ')]);
  return {
    sub: profile?.sub ?? previous?.sub ?? '',
    email: profile?.email ?? previous?.email ?? '',
    name: profile?.name ?? previous?.name ?? profile?.email ?? '',
    picture: profile?.picture ?? previous?.picture ?? null,
    scopes: [...scopes],
    refreshToken: tokens.refresh_token ?? previous?.refreshToken ?? null,
    accessToken: tokens.access_token,
    accessTokenExpiresAt: Date.now() + (tokens.expires_in - 60) * 1000,
  };
}

export function hasDriveAccess(session: Session | null) {
  return !!session && session.scopes.includes(DRIVE_SCOPE) && !!session.refreshToken;
}

/** Returns a valid Drive access token for the current session, refreshing it if needed. */
export async function getDriveAccessToken(): Promise<string> {
  const session = await getSession();
  if (!session) throw new AuthError('Faça login com o Google.');
  if (!hasDriveAccess(session)) throw new AuthError('Acesso ao Google Drive não autorizado.', 403);
  if (session.accessToken && session.accessTokenExpiresAt > Date.now()) return session.accessToken;
  const tokens = await tokenRequest({ refresh_token: session.refreshToken!, grant_type: 'refresh_token' });
  const next = mergeTokens(session, tokens);
  await setSession(next);
  return next.accessToken!;
}

export async function revokeToken(token: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
}

/** Rejects cross-site mutations (defense in depth on top of SameSite=Lax). */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const host = request.headers.get('host');
  if (new URL(origin).host !== host) throw new AuthError('Origem não permitida.', 403);
}
