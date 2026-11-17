/**
 * The workspace is one static page for every caderno (the id goes in the query string), so the
 * service worker can open any caderno offline from a single cached page.
 */
export function workspaceHref(projectId: string) {
  return `/workspace?p=${encodeURIComponent(projectId)}`;
}

const LAST_KEY = 'cookme.lastProject';

/** The app opens straight into the last caderno used on this device. */
export function rememberLastProject(projectId: string) {
  try {
    localStorage.setItem(LAST_KEY, projectId);
  } catch {
    // Private mode: the app opens on the caderno list instead.
  }
}

export function lastProject(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}
