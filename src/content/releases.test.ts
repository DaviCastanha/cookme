import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lastSeenVersion, markReleasesSeen, unseenReleases } from '@/stores/aboutStore';
import { APP_VERSION, compareVersions, RELEASES, releasesSince } from './releases';

describe('releases', () => {
  it('package.json version matches the latest release notes', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    expect(pkg.version).toBe(APP_VERSION);
  });

  it('lists releases newest first, each with a date and notes', () => {
    for (let i = 1; i < RELEASES.length; i++) expect(compareVersions(RELEASES[i - 1].version, RELEASES[i].version)).toBeGreaterThan(0);
    for (const r of RELEASES) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.items.length).toBeGreaterThan(0);
    }
  });

  it('compares versions numerically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(releasesSince('1.0.0').map((r) => r.version)).not.toContain('1.0.0');
  });
});

describe('what is new popup', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage;
  });
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.localStorage;
  });

  it('shows nothing to someone new, and marks the current version as seen', () => {
    expect(unseenReleases(false)).toEqual([]);
    expect(lastSeenVersion()).toBe(APP_VERSION);
  });

  it('shows what changed since 1.0 to someone who already had cadernos', () => {
    const fresh = unseenReleases(true);
    // Only releases after 1.0.0 (none while 1.0.0 is the latest).
    expect(fresh.every((r) => compareVersions(r.version, '1.0.0') > 0)).toBe(true);
    if (fresh.length) expect(fresh[0].version).toBe(APP_VERSION);
  });

  it('shows the newer releases to someone who saw an older version', () => {
    localStorage.setItem('cookme:lastSeenVersion', '0.9.0');
    expect(unseenReleases(true)[0].version).toBe(APP_VERSION);
  });

  it('shows each release only once', () => {
    markReleasesSeen();
    expect(unseenReleases(true)).toEqual([]);
  });
});
