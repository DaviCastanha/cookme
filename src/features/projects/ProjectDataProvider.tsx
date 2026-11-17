'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '@/lib/db/database';
import type { ExplorerItem, Project, Recipe } from '@/lib/schemas';
import { ProjectSearchIndex } from '@/features/search/searchIndex';

export interface ProjectData {
  project: Project;
  items: ExplorerItem[];
  itemsById: Map<string, ExplorerItem>;
  recipes: Map<string, Recipe>;
  searchIndex: ProjectSearchIndex;
  /** Increments every time the search index is refreshed. */
  indexVersion: number;
}

const ProjectDataContext = createContext<ProjectData | null>(null);

export function ProjectDataProvider({
  projectId,
  children,
  fallback,
  notFound,
}: {
  projectId: string;
  children: ReactNode;
  fallback: ReactNode;
  notFound: ReactNode;
}) {
  const db = getDb();
  const project = useLiveQuery(async () => (await db.projects.get(projectId)) ?? null, [projectId]);
  const items = useLiveQuery(() => db.items.where('projectId').equals(projectId).toArray(), [projectId]);
  const recipes = useLiveQuery(() => db.recipes.where('projectId').equals(projectId).toArray(), [projectId]);

  const indexRef = useRef<ProjectSearchIndex | null>(null);
  if (!indexRef.current) indexRef.current = new ProjectSearchIndex();
  const [indexVersion, setIndexVersion] = useState(0);

  // Re-index shortly after changes settle; typing does not rebuild the index on every keystroke.
  useEffect(() => {
    if (!items || !recipes) return;
    const handle = setTimeout(
      () => {
        indexRef.current!.sync({ items, recipes });
        setIndexVersion((v) => v + 1);
      },
      indexVersion === 0 ? 0 : 350,
    );
    return () => clearTimeout(handle);
  }, [items, recipes]);

  const value = useMemo<ProjectData | null>(() => {
    if (!project || !items || !recipes) return null;
    return {
      project,
      items,
      itemsById: new Map(items.map((i) => [i.id, i])),
      recipes: new Map(recipes.map((r) => [r.id, r])),
      searchIndex: indexRef.current!,
      indexVersion,
    };
  }, [project, items, recipes, indexVersion]);

  if (project === null) return <>{notFound}</>;
  if (!value) return <>{fallback}</>;
  return <ProjectDataContext.Provider value={value}>{children}</ProjectDataContext.Provider>;
}

export function useProjectData(): ProjectData {
  const ctx = useContext(ProjectDataContext);
  if (!ctx) throw new Error('useProjectData must be used inside ProjectDataProvider');
  return ctx;
}
