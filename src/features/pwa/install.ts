'use client';

import { create } from 'zustand';

/** Chrome/Edge/Android event that lets the app show its own "Install" button. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** Set when the browser allows installing right now. */
  installEvent: BeforeInstallPromptEvent | null;
  /** The app is running from its installed icon (own window). */
  standalone: boolean;
  /** A service worker controls the page: it opens without internet. */
  offlineReady: boolean;
}

export const usePwaStore = create<PwaState>()(() => ({ installEvent: null, standalone: false, offlineReady: false }));

let listening = false;

/** Registers the service worker and tracks install state. Called once from the root layout. */
export function setupPwa() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  const standalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  usePwaStore.setState({ standalone: standalone() });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwaStore.setState({ installEvent: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => usePwaStore.setState({ installEvent: null, standalone: standalone() }));

  // Ask the browser not to evict IndexedDB when space is short (the projects live there).
  void navigator.storage?.persist?.().catch(() => {});

  if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
  navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then(async () => {
      const registration = await navigator.serviceWorker.ready;
      usePwaStore.setState({ offlineReady: true });
      // Files this page already loaded (before the worker existed) are cached for offline use.
      const urls = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((url) => url.startsWith(`${location.origin}/_next/static/`));
      registration.active?.postMessage({ type: 'cache-urls', urls });
    })
    .catch((error) => console.warn('[pwa] service worker', error));
}

export async function promptInstall() {
  const event = usePwaStore.getState().installEvent;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  usePwaStore.setState({ installEvent: null });
  return outcome === 'accepted';
}

export type InstallPlatform = 'ios' | 'android' | 'desktop';

export function installPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}
