'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

const subscribe = () => () => {};

/**
 * Renders children only in the browser. The app's data lives in IndexedDB and layout
 * preferences in localStorage, so there is nothing meaningful to server-render.
 */
export function ClientGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return <>{isClient ? children : fallback}</>;
}
