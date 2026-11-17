'use client';

import { create } from 'zustand';

export interface SessionInfo {
  configured: boolean;
  user: { email: string; name: string; picture: string | null } | null;
  driveConnected: boolean;
}

interface SessionState extends SessionInfo {
  status: 'loading' | 'ready' | 'error';
  /** Account used the last time we were online; lets the app open offline. */
  lastAccount: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const LAST_ACCOUNT_KEY = 'cookme.lastAccount';
/** Set when the server has no Google login configured (local-only mode). */
const LOCAL_MODE_KEY = 'cookme.localMode';

function readLocalMode() {
  try {
    return localStorage.getItem(LOCAL_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeLocalMode(local: boolean) {
  try {
    if (local) localStorage.setItem(LOCAL_MODE_KEY, '1');
    else localStorage.removeItem(LOCAL_MODE_KEY);
  } catch {
    // Ignore: only affects opening offline.
  }
}

function readLastAccount() {
  try {
    return localStorage.getItem(LAST_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

function writeLastAccount(email: string | null) {
  try {
    if (email) localStorage.setItem(LAST_ACCOUNT_KEY, email);
    else localStorage.removeItem(LAST_ACCOUNT_KEY);
  } catch {
    // Storage unavailable (private mode): offline start just won't remember the account.
  }
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  status: 'loading',
  configured: false,
  user: null,
  driveConnected: false,
  lastAccount: typeof window === 'undefined' ? null : readLastAccount(),

  refresh: async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as SessionInfo;
      writeLastAccount(data.user?.email ?? null);
      writeLocalMode(!data.configured);
      set({ ...data, status: 'ready', lastAccount: data.user?.email ?? null });
    } catch {
      // Offline or server unreachable: the app keeps working with the cached account
      // (or in local-only mode, when that is how this server runs).
      if (readLocalMode()) set({ status: 'ready', configured: false, user: null, driveConnected: false });
      else set({ status: 'error', lastAccount: readLastAccount() });
    }
  },
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    writeLastAccount(null);
    await get().refresh();
  },
}));

export function loginUrl(returnTo: string) {
  return `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Re-asks only for Drive access (when the user unchecked it on Google's consent screen). */
export function connectDriveUrl(returnTo: string) {
  return `/api/auth/drive?returnTo=${encodeURIComponent(returnTo)}`;
}
