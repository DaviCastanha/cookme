'use client';

import { useMemo } from 'react';
import * as repo from '@/lib/repository';
import type { ExplorerItem } from '@/lib/schemas';
import { useProjectData } from '@/features/projects/ProjectDataProvider';
import { ancestorIds } from '@/features/explorer/tree';
import { confirmDialog, promptDialog } from '@/stores/dialogStore';
import { trackSave, useStatusStore } from '@/stores/statusStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export type NewItemKind = 'folder' | 'recipe';

/**
 * High-level actions shared by the explorer and the recipe page. Components call these instead
 * of touching the repository or stores directly.
 */
export function useWorkspaceActions() {
  const { project, items } = useProjectData();
  const projectId = project.id;

  return useMemo(() => {
    const ws = () => useWorkspaceStore.getState();
    const toast = (...args: Parameters<ReturnType<typeof useStatusStore.getState>['toast']>) =>
      useStatusStore.getState().toast(...args);

    const openRecipe = (id: string) => {
      ws().openRecipe(projectId, id);
      ws().expandFolders(projectId, ancestorIds(items, id));
    };

    /** Recipes open; folders open or close (or, with `reveal`, just open). */
    const openItem = (item: ExplorerItem, opts: { reveal?: boolean } = {}) => {
      if (item.type === 'recipe') return openRecipe(item.id);
      if (opts.reveal) {
        ws().expandFolders(projectId, [...ancestorIds(items, item.id), item.id]);
        ws().setMobileView('list');
      } else {
        ws().toggleFolder(projectId, item.id);
      }
    };

    const createFolder = async (parentId: string | null) => {
      const name = await promptDialog({
        title: 'Nova pasta',
        label: 'Nome',
        placeholder: 'Ex.: Massas, Natal, Receitas da vó',
        confirmLabel: 'Criar',
      });
      if (!name) return null;
      const item = await trackSave(repo.createItem(projectId, { type: 'folder', name, parentId }));
      if (parentId) ws().toggleFolder(projectId, parentId, true);
      return item;
    };

    /** New recipes open right away, with the title selected so the name can be typed. */
    const createRecipe = async (parentId: string | null) => {
      const item = await trackSave(repo.createItem(projectId, { type: 'recipe', name: 'Nova receita', parentId }));
      if (parentId) ws().toggleFolder(projectId, parentId, true);
      ws().setTitleFocus(item.id);
      openRecipe(item.id);
      return item;
    };

    const createItem = (kind: NewItemKind, parentId: string | null) =>
      kind === 'folder' ? createFolder(parentId) : createRecipe(parentId);

    const renameItem = async (item: ExplorerItem, name?: string) => {
      const next =
        name ?? (await promptDialog({ title: 'Renomear', label: 'Nome', defaultValue: item.name, confirmLabel: 'Renomear' }));
      if (!next || next === item.name) return;
      await trackSave(repo.updateItem(item.id, { name: next }));
    };

    const deleteItem = async (item: ExplorerItem) => {
      const inside = repo.collectSubtree(items, item.id).length - 1;
      const what = item.type === 'folder' ? 'a pasta' : 'a receita';
      const ok = await confirmDialog({
        title: `Excluir ${what} “${item.name}”?`,
        message:
          inside > 0
            ? `Isso também exclui ${inside} ${inside === 1 ? 'item' : 'itens'} dentro dela. Essa ação não pode ser desfeita.`
            : 'Essa ação não pode ser desfeita.',
        confirmLabel: 'Excluir',
        danger: true,
      });
      if (!ok) return;
      const removed = (await trackSave(repo.deleteItem(item.id))) ?? [];
      const wasOpen = removed.some((r) => r.id === ws().viewByProject[projectId]?.openId);
      ws().forget(projectId, removed.map((r) => r.id));
      if (wasOpen) ws().setMobileView('list');
      toast(`“${item.name}” foi excluído.`, 'success');
    };

    const moveItem = async (item: ExplorerItem, parentId: string | null, beforeId?: string) => {
      try {
        await trackSave(repo.moveItem(item.id, parentId, beforeId));
        if (parentId) ws().toggleFolder(projectId, parentId, true);
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Não foi possível mover.', 'error');
      }
    };

    const setAppearance = (item: ExplorerItem, patch: Pick<ExplorerItem, 'icon' | 'color'>) =>
      trackSave(repo.updateItem(item.id, patch));

    const duplicateRecipe = async (item: ExplorerItem) => {
      const copy = await trackSave(repo.duplicateRecipe(item.id));
      if (copy) {
        openRecipe(copy.id);
        toast(`Cópia criada: “${copy.name}”.`, 'success');
      }
    };

    return { openRecipe, openItem, createItem, createFolder, createRecipe, renameItem, deleteItem, moveItem, setAppearance, duplicateRecipe };
  }, [projectId, items]);
}
