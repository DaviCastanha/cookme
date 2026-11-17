'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '@/lib/db/database';
import { importBundle } from '@/lib/repository';
import { buildTutorialBundle } from '@/lib/mock/seed';
import { createId, nowIso } from '@/lib/utils/id';

export function useProjects() {
  return useLiveQuery(() => getDb().projects.orderBy('updatedAt').reverse().toArray(), []);
}

export interface ProjectStats {
  recipes: number;
  folders: number;
}

export function useProjectStats() {
  return useLiveQuery(async () => {
    const db = getDb();
    const stats = new Map<string, ProjectStats>();
    const items = await db.items.toArray();
    for (const item of items) {
      const s = stats.get(item.projectId) ?? { recipes: 0, folders: 0 };
      if (item.type === 'recipe') s.recipes++;
      else s.folders++;
      stats.set(item.projectId, s);
    }
    return stats;
  }, []);
}

/** Adds a fresh copy of the tutorial caderno (unique ids, so copies never collide). */
export async function createTutorialProject(options = { enqueueSync: true }) {
  const bundle = buildTutorialBundle(createId('b').slice(2, 8));
  // A new copy is created now (the template's fixed dates are only placeholders).
  const now = nowIso();
  bundle.project = { ...bundle.project, createdAt: now, updatedAt: now };
  await importBundle(bundle, options);
  return bundle.project;
}

const seeding = new Map<string, Promise<void>>();

/**
 * Local-only mode: seed the tutorial caderno once, so the app is explorable right away.
 * Signed-in accounts are not seeded automatically — their cadernos come from Drive, and a
 * copy per device would pile up there. They get a "Caderno de exemplo" button instead.
 */
export function ensureSeeded(autoSeed: boolean): Promise<void> {
  const db = getDb();
  if (!autoSeed) return Promise.resolve();
  let pending = seeding.get(db.name);
  if (!pending) {
    pending = (async () => {
      if (await db.meta.get('seeded')) return;
      if ((await db.projects.count()) === 0) await createTutorialProject({ enqueueSync: false });
      await db.meta.put({ key: 'seeded', value: true });
    })();
    seeding.set(db.name, pending);
  }
  return pending;
}

export function useSeed(autoSeed: boolean) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureSeeded(autoSeed).finally(() => setReady(true));
  }, [autoSeed]);
  return ready;
}
