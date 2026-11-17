/**
 * UI state of the workspace: the open recipe, panels, mobile view, overlays and navigation
 * requests. Only layout preferences and the open recipe are persisted (per device, in localStorage).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface ProjectView {
  /** The recipe on screen (null = none). */
  openId: string | null;
  /** Previously opened recipes, most recent last. Powers "voltar". */
  history: string[];
}
export type MobileView = 'list' | 'recipe';

export interface NavigationRequest {
  recipeId: string;
  blockId?: string;
  /** Text to select inside the block (search hit). */
  text?: string;
  nonce: number;
}

interface WorkspaceState {
  // persisted
  viewByProject: Record<string, ProjectView>;
  expandedByProject: Record<string, string[]>;
  leftWidth: number;
  leftCollapsed: boolean;

  // transient
  mobileView: MobileView;
  searchOpen: boolean;
  navigation: NavigationRequest | null;
  /** Recipe shown in the full-screen cooking mode. */
  cookingId: string | null;
  /** A just-created recipe whose title should get the focus (selected) when it opens. */
  titleFocusId: string | null;

  openRecipe: (projectId: string, id: string) => void;
  closeRecipe: (projectId: string) => void;
  /** Closes the open recipe if it is one of `ids` (e.g. after deleting them). */
  forget: (projectId: string, ids: string[]) => void;
  goBack: (projectId: string) => void;
  setMobileView: (view: MobileView) => void;
  setSearchOpen: (open: boolean) => void;
  navigate: (projectId: string, req: Omit<NavigationRequest, 'nonce'>) => void;
  clearNavigation: () => void;
  setCooking: (id: string | null) => void;
  setTitleFocus: (id: string | null) => void;
  toggleFolder: (projectId: string, folderId: string, open?: boolean) => void;
  expandFolders: (projectId: string, ids: string[]) => void;
  setPanelWidth: (width: number) => void;
  togglePanel: (collapsed?: boolean) => void;
}

const emptyView: ProjectView = { openId: null, history: [] };
export const PANEL_LIMITS = { min: 220, max: 440 };

function withView(state: WorkspaceState, projectId: string, fn: (v: ProjectView) => ProjectView) {
  return { viewByProject: { ...state.viewByProject, [projectId]: fn(state.viewByProject[projectId] ?? emptyView) } };
}

function pushHistory(history: string[], id: string | null) {
  if (!id) return history;
  return [...history.filter((h) => h !== id), id].slice(-30);
}

function open(v: ProjectView, id: string): ProjectView {
  if (v.openId === id) return v;
  return { openId: id, history: pushHistory(v.history, v.openId).filter((h) => h !== id) };
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      viewByProject: {},
      expandedByProject: {},
      leftWidth: 300,
      leftCollapsed: false,

      mobileView: 'list',
      searchOpen: false,
      navigation: null,
      cookingId: null,
      titleFocusId: null,

      openRecipe: (projectId, id) => set((s) => ({ ...withView(s, projectId, (v) => open(v, id)), mobileView: 'recipe' })),

      closeRecipe: (projectId) =>
        set((s) => ({ ...withView(s, projectId, (v) => ({ openId: null, history: pushHistory(v.history, v.openId) })), mobileView: 'list' })),

      forget: (projectId, ids) =>
        set((s) =>
          withView(s, projectId, (v) => {
            const remove = new Set(ids);
            const history = v.history.filter((h) => !remove.has(h));
            return { openId: v.openId && remove.has(v.openId) ? null : v.openId, history };
          }),
        ),

      goBack: (projectId) =>
        set((s) => {
          const v = s.viewByProject[projectId] ?? emptyView;
          const prev = v.history.at(-1);
          if (!prev) return { ...withView(s, projectId, () => ({ openId: null, history: [] })), mobileView: 'list' };
          return withView(s, projectId, () => ({ openId: prev, history: v.history.slice(0, -1) }));
        }),

      setMobileView: (mobileView) => set({ mobileView }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),

      navigate: (projectId, req) =>
        set((s) => ({
          ...withView(s, projectId, (v) => open(v, req.recipeId)),
          navigation: { ...req, nonce: Date.now() + Math.random() },
          mobileView: 'recipe',
          searchOpen: false,
        })),
      clearNavigation: () => set({ navigation: null }),
      setCooking: (cookingId) => set({ cookingId }),
      setTitleFocus: (titleFocusId) => set({ titleFocusId }),

      toggleFolder: (projectId, folderId, shouldOpen) =>
        set((s) => {
          const current = new Set(s.expandedByProject[projectId] ?? []);
          const next = shouldOpen ?? !current.has(folderId);
          if (next) current.add(folderId);
          else current.delete(folderId);
          return { expandedByProject: { ...s.expandedByProject, [projectId]: [...current] } };
        }),
      expandFolders: (projectId, ids) =>
        set((s) => {
          const current = new Set(s.expandedByProject[projectId] ?? []);
          ids.forEach((id) => current.add(id));
          return { expandedByProject: { ...s.expandedByProject, [projectId]: [...current] } };
        }),

      setPanelWidth: (width) => set({ leftWidth: Math.round(Math.min(PANEL_LIMITS.max, Math.max(PANEL_LIMITS.min, width))) }),
      togglePanel: (collapsed) => set((s) => ({ leftCollapsed: collapsed ?? !s.leftCollapsed })),
    }),
    {
      name: 'cookme.workspace',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        viewByProject: s.viewByProject,
        expandedByProject: s.expandedByProject,
        leftWidth: s.leftWidth,
        leftCollapsed: s.leftCollapsed,
      }),
    },
  ),
);

export function useProjectView(projectId: string): ProjectView {
  return useWorkspaceStore((s) => s.viewByProject[projectId] ?? emptyView);
}
