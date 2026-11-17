import { create } from 'zustand';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type SyncState = 'disabled' | 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
  action?: { label: string; run: () => void };
}

interface StatusState {
  save: SaveState;
  saveError: string | null;
  pendingSaves: number;
  sync: SyncState;
  syncMessage: string | null;
  pendingSync: number;
  lastSyncedAt: number | null;
  /** True once the first sync after login finished (projects from Drive are local). */
  firstSyncDone: boolean;
  toasts: Toast[];

  beginSave: () => void;
  endSave: (error?: unknown) => void;
  setSync: (sync: SyncState, extra?: { message?: string | null; pending?: number; lastSyncedAt?: number }) => void;
  setFirstSyncDone: (done: boolean) => void;
  toast: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useStatusStore = create<StatusState>()((set, get) => ({
  save: 'idle',
  saveError: null,
  pendingSaves: 0,
  sync: 'disabled',
  syncMessage: null,
  pendingSync: 0,
  lastSyncedAt: null,
  firstSyncDone: false,
  toasts: [],

  beginSave: () => set((s) => ({ save: 'saving', pendingSaves: s.pendingSaves + 1 })),
  endSave: (error) =>
    set((s) => {
      const pendingSaves = Math.max(0, s.pendingSaves - 1);
      if (error) {
        return {
          pendingSaves,
          save: 'error',
          saveError: error instanceof Error ? error.message : 'Não foi possível salvar.',
        };
      }
      return { pendingSaves, save: pendingSaves ? 'saving' : 'saved', saveError: null };
    }),
  setSync: (sync, extra = {}) =>
    set((s) => ({
      sync,
      syncMessage: extra.message !== undefined ? extra.message : s.syncMessage,
      pendingSync: extra.pending ?? s.pendingSync,
      lastSyncedAt: extra.lastSyncedAt ?? s.lastSyncedAt,
    })),
  setFirstSyncDone: (firstSyncDone) => set({ firstSyncDone }),
  toast: (message, tone = 'info', action) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone, action }] }));
    setTimeout(() => get().dismissToast(id), tone === 'error' ? 7000 : 4000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Wraps a local write so the save indicator reflects it. */
export async function trackSave<T>(work: Promise<T>): Promise<T> {
  const { beginSave, endSave } = useStatusStore.getState();
  beginSave();
  try {
    const result = await work;
    endSave();
    return result;
  } catch (error) {
    endSave(error);
    throw error;
  }
}
