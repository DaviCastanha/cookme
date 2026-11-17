'use client';

import { useEffect } from 'react';
import { useSessionStore } from '@/features/auth/sessionStore';
import { useStatusStore } from '@/stores/statusStore';
import { syncEngine } from './syncEngine';

/** Loads the session and starts/stops Drive sync accordingly. Renders nothing. */
export function SyncProvider() {
  const refresh = useSessionStore((s) => s.refresh);
  const driveConnected = useSessionStore((s) => s.driveConnected);
  const email = useSessionStore((s) => s.user?.email ?? null);

  useEffect(() => {
    void refresh();
    // Feedback after returning from Google's consent screen.
    const url = new URL(window.location.href);
    const auth = url.searchParams.get('auth');
    const error = url.searchParams.get('auth_error');
    const toast = useStatusStore.getState().toast;
    if (auth === 'login') toast('Login realizado.', 'success');
    if (auth === 'drive') toast('Google Drive conectado. Sincronizando…', 'success');
    if (error) toast(error, 'error');
    if (auth || error) {
      url.searchParams.delete('auth');
      url.searchParams.delete('auth_error');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }, [refresh]);

  // Coming back online: re-check the session (the app may have opened offline).
  useEffect(() => {
    const onOnline = () => void refresh();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [refresh]);

  useEffect(() => {
    if (driveConnected && email) void syncEngine.start(email);
    else syncEngine.stop();
  }, [driveConnected, email]);

  return null;
}
