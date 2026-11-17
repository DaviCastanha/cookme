/**
 * Encrypted, httpOnly session cookie. Google tokens live only here (server side);
 * the browser never sees them and they are never written to project files.
 */
import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'cm_session';
const MAX_AGE = 60 * 60 * 24 * 30;

export interface Session {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  scopes: string[];
  refreshToken: string | null;
  accessToken: string | null;
  /** Epoch ms. */
  accessTokenExpiresAt: number;
}

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres).');
  return crypto.createHash('sha256').update(secret).digest();
}

export function seal(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}

export function unseal<T>(sealed: string): T | null {
  try {
    const raw = Buffer.from(sealed, 'base64url');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')) as T;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function getSession(): Promise<Session | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  return value ? unseal<Session>(value) : null;
}

export async function setSession(session: Session) {
  (await cookies()).set(COOKIE, seal(session), { ...cookieOptions, maxAge: MAX_AGE });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

/** Short-lived cookie that carries OAuth `state` across the redirect. */
export async function setOAuthState(state: { nonce: string; returnTo: string; intent: 'login' | 'drive' }) {
  (await cookies()).set('cm_oauth', seal(state), { ...cookieOptions, maxAge: 600 });
}

export async function takeOAuthState() {
  const store = await cookies();
  const value = store.get('cm_oauth')?.value;
  store.delete('cm_oauth');
  return value ? unseal<{ nonce: string; returnTo: string; intent: 'login' | 'drive' }>(value) : null;
}
