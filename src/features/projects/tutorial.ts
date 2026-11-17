/**
 * Keeps tutorial copies current: when the app ships a newer tutorial (TUTORIAL_VERSION), every
 * local copy is replaced in place with the new content. The tutorial is a place to try things,
 * not to keep recipes, so the person's edits there are not preserved.
 *
 * Every device produces exactly the same content for a given copy (same id suffix, fixed dates),
 * so two devices updating the same copy upload identical files and do not conflict.
 */
import { getDb } from '@/lib/db/database';
import { buildTutorialBundle, TUTORIAL_VERSION } from '@/lib/mock/seed';
import { replaceProjectContent } from '@/lib/repository';
import type { Project } from '@/lib/schemas';
import { nowIso } from '@/lib/utils/id';
import { isTutorial } from './kinds';

export function needsTutorialUpgrade(project: Project) {
  return isTutorial(project) && (project.contentVersion ?? 1) < TUTORIAL_VERSION;
}

/** `project_tutorial_ab12cd` → `ab12cd` (copies made by older versions all have a suffix). */
export function tutorialSuffix(projectId: string): string | undefined {
  return /^project_tutorial_(.+)$/.exec(projectId)?.[1];
}

export interface TutorialUpgrade {
  projectId: string;
  /** Recipes that no longer exist (closed if open). */
  removed: string[];
}

let running: Promise<TutorialUpgrade[]> | null = null;

export function upgradeTutorials(): Promise<TutorialUpgrade[]> {
  running ??= (async () => {
    const upgraded: TutorialUpgrade[] = [];
    for (const project of await getDb().projects.toArray()) {
      if (!needsTutorialUpgrade(project)) continue;
      const bundle = buildTutorialBundle(tutorialSuffix(project.id));
      if (bundle.project.id !== project.id) continue;
      bundle.project = { ...bundle.project, createdAt: project.createdAt, updatedAt: nowIso() };
      upgraded.push({ projectId: project.id, removed: await replaceProjectContent(bundle) });
    }
    return upgraded;
  })().finally(() => {
    running = null;
  });
  return running;
}
