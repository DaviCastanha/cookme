import { create } from 'zustand';
import { APP_VERSION, compareVersions, releasesSince, type Release } from '@/content/releases';

const SEEN_KEY = 'cookme:lastSeenVersion';

interface AboutState {
  view: 'about' | 'news' | null;
  /** Releases highlighted as new in the "Novidades" dialog (empty = just browsing). */
  fresh: Release[];
  showAbout: () => void;
  showNews: (fresh?: Release[]) => void;
  close: () => void;
}

export const useAboutStore = create<AboutState>()((set) => ({
  view: null,
  fresh: [],
  showAbout: () => set({ view: 'about', fresh: [] }),
  showNews: (fresh = []) => {
    markReleasesSeen();
    set({ view: 'news', fresh });
  },
  close: () => set({ view: null, fresh: [] }),
}));

export function lastSeenVersion(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function markReleasesSeen() {
  try {
    localStorage.setItem(SEEN_KEY, APP_VERSION);
  } catch {
    // Private mode: the popup may show again next time, which is harmless.
  }
}

/**
 * Releases to announce on this device. Someone who never saw the popup but already has cadernos
 * was using 1.0.0; a brand-new person sees nothing (everything is new to them anyway).
 */
export function unseenReleases(hasProjects: boolean): Release[] {
  let seen = lastSeenVersion();
  if (!seen) {
    if (!hasProjects) {
      markReleasesSeen();
      return [];
    }
    seen = '1.0.0';
  }
  if (compareVersions(APP_VERSION, seen) <= 0) return [];
  return releasesSince(seen);
}
