'use client';

import { FileDown, FolderPlus, Info, Plus, Search, Settings } from 'lucide-react';
import { useRef, useState } from 'react';
import { IconButton } from '@/components/ui/Button';
import { useMenu } from '@/components/ui/Menu';
import { ProjectSwitcher } from '@/components/projects/ProjectSwitcher';
import { useWorkspaceActions } from '@/features/explorer/useWorkspaceActions';
import { useProjectData } from '@/features/projects/ProjectDataProvider';
import { importRecipeFile, RECIPE_FILE_ACCEPT } from '@/features/share/recipeFile';
import type { ExplorerItem } from '@/lib/schemas';
import { APP_VERSION } from '@/content/releases';
import { useAboutStore } from '@/stores/aboutStore';
import { trackSave, useStatusStore } from '@/stores/statusStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { ExplorerTree } from './ExplorerTree';
import { IconColorDialog } from './IconColorDialog';
import { MoveDialog } from './MoveDialog';
import styles from './ExplorerPanel.module.scss';

export function ExplorerPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { items, project } = useProjectData();
  const actions = useWorkspaceActions();
  const addMenu = useMenu();
  const importRef = useRef<HTMLInputElement>(null);
  const [appearanceFor, setAppearanceFor] = useState<ExplorerItem | null>(null);
  const [moveFor, setMoveFor] = useState<ExplorerItem | null>(null);

  const onImport = async (file?: File) => {
    if (!file) return;
    try {
      const item = await trackSave(importRecipeFile(project.id, null, file));
      actions.openRecipe(item.id);
      useStatusStore.getState().toast(`“${item.name}” importada para este caderno.`, 'success');
    } catch (error) {
      useStatusStore.getState().toast(error instanceof Error ? error.message : 'Não foi possível importar.', 'error');
    }
  };

  return (
    <aside className={styles.panel} aria-label="Receitas">
      <div className={styles.top}>
        <div className={styles.brandRow}>
          <ProjectSwitcher />
          <IconButton label="Configurações" onClick={onOpenSettings}>
            <Settings size={18} />
          </IconButton>
        </div>
        <button className={styles.search} onClick={() => useWorkspaceStore.getState().setSearchOpen(true)}>
          <Search size={16} />
          <span>Buscar receitas e ingredientes</span>
          <kbd>Ctrl K</kbd>
        </button>
      </div>

      <div className={styles.sectionHeader}>
        <span>Receitas</span>
        <IconButton
          label="Adicionar"
          size="sm"
          onClick={(e) =>
            addMenu.open(e.currentTarget, [
              { label: 'Nova receita', icon: <Plus />, onSelect: () => void actions.createRecipe(null) },
              { label: 'Nova pasta', icon: <FolderPlus />, onSelect: () => void actions.createFolder(null) },
              { kind: 'separator' },
              { label: 'Importar receita (.cookme)…', icon: <FileDown />, onSelect: () => importRef.current?.click() },
            ])
          }
        >
          <Plus size={16} />
        </IconButton>
      </div>

      <div className={styles.tree}>
        <ExplorerTree onAppearance={setAppearanceFor} onMove={setMoveFor} />
        {!items.length && (
          <div className={styles.empty}>
            <p>Caderno vazio. Que tal começar pela receita que você mais faz?</p>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button className={`${styles.footerButton} ${styles.primaryAction}`} onClick={() => void actions.createRecipe(null)}>
          <Plus size={16} /> Receita
        </button>
        <button className={styles.footerButton} onClick={() => void actions.createFolder(null)}>
          <FolderPlus size={16} /> Pasta
        </button>
        <button
          className={styles.aboutButton}
          onClick={() => useAboutStore.getState().showAbout()}
          aria-label={`Sobre o CookMe, versão ${APP_VERSION}`}
          title="Sobre o CookMe e novidades"
        >
          <Info size={17} />
        </button>
      </div>

      {addMenu.element}
      <input
        ref={importRef}
        type="file"
        accept={RECIPE_FILE_ACCEPT}
        hidden
        onChange={(e) => {
          void onImport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <IconColorDialog
        item={appearanceFor}
        onClose={() => setAppearanceFor(null)}
        onSave={(patch) => {
          if (appearanceFor) void actions.setAppearance(appearanceFor, patch);
          setAppearanceFor(null);
        }}
      />
      <MoveDialog
        item={moveFor}
        onClose={() => setMoveFor(null)}
        onMove={(parentId) => {
          if (moveFor) void actions.moveItem(moveFor, parentId);
          setMoveFor(null);
        }}
      />
    </aside>
  );
}
