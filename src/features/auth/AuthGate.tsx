'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { setActiveAccount } from '@/lib/db/database';
import { Splash } from '@/components/layout/Splash';
import { LoginScreen } from '@/components/account/LoginScreen';
import { AppHosts } from '@/components/layout/AppHosts';
import { useSessionStore } from './sessionStore';

export interface AccountInfo {
  /** Google e-mail, or null in local-only mode (Google not configured). */
  account: string | null;
  mode: 'google' | 'local';
}

const AccountContext = createContext<AccountInfo>({ account: null, mode: 'local' });

export function useAccount() {
  return useContext(AccountContext);
}

/**
 * Hosted with Google configured: login is required and each account gets its own local
 * database, synced to that person's Drive. Without Google configured (local development),
 * the app runs in local-only mode.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useSessionStore((s) => s.status);
  const configured = useSessionStore((s) => s.configured);
  const user = useSessionStore((s) => s.user);
  const lastAccount = useSessionStore((s) => s.lastAccount);

  if (status === 'loading') return <Splash />;

  let info: AccountInfo;
  if (status === 'error') {
    // Offline: reopen the last account's local copy; changes sync when the connection returns.
    if (!lastAccount) return <LoginScreen offline />;
    info = { account: lastAccount, mode: 'google' };
  } else if (!configured) {
    info = { account: null, mode: 'local' };
  } else if (!user) {
    return <LoginScreen />;
  } else {
    info = { account: user.email, mode: 'google' };
  }

  // Select the account's database before any child reads data.
  setActiveAccount(info.account);
  return (
    <AccountContext.Provider value={info} key={info.account ?? 'local'}>
      {children}
      <AppHosts />
    </AccountContext.Provider>
  );
}
