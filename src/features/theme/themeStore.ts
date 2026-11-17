'use client';

import { useLayoutEffect } from 'react';
import { create } from 'zustand';
import { DEFAULT_THEME_ID, getTheme, THEME_STORAGE_KEY } from './themes';

function readSaved(): string {
  try {
    return getTheme(localStorage.getItem(THEME_STORAGE_KEY)).id;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

/** Puts the theme on <html> and on the browser/status bar color. */
export function applyTheme(id: string) {
  const theme = getTheme(id);
  document.documentElement.setAttribute('data-theme', theme.id);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg);
}

interface ThemeState {
  themeId: string;
  setTheme: (id: string) => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  themeId: typeof window === 'undefined' ? DEFAULT_THEME_ID : readSaved(),
  setTheme: (id) => {
    const theme = getTheme(id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    } catch {
      // Private mode: the theme still applies until the page is closed.
    }
    applyTheme(theme.id);
    set({ themeId: theme.id });
  },
}));

/**
 * The inline script in the root layout applies the saved theme before the first paint. This
 * re-applies it after hydration: in development React's remount clears attributes it doesn't manage
 * on <html>, and Next may re-render the metadata's theme-color.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    const id = readSaved();
    applyTheme(id);
    if (useThemeStore.getState().themeId !== id) useThemeStore.setState({ themeId: id });

    // Another tab changed the theme.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = readSaved();
      applyTheme(next);
      useThemeStore.setState({ themeId: next });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return null;
}
