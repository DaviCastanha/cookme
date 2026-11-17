import type { Project } from '@/lib/schemas';

/** The built-in tutorial caderno. */
export function isTutorial(project: Pick<Project, 'id' | 'kind'>) {
  return project.kind === 'tutorial' || project.id.startsWith('project_tutorial');
}
