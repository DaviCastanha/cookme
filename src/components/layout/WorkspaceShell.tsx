'use client';

import { BookOpen, ChefHat, PanelLeft, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ExplorerPanel } from '@/components/explorer/ExplorerPanel';
import { CookingMode } from '@/components/recipe/CookingMode';
import { RecipeArea } from '@/components/recipe/RecipeArea';
import { SearchModal } from '@/components/search/SearchModal';
import { SettingsModal } from '@/components/account/SettingsModal';
import { IconButton } from '@/components/ui/Button';
import { useProjectData } from '@/features/projects/ProjectDataProvider';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { ResizeHandle } from './ResizeHandle';
import { SaveIndicator } from './SaveIndicator';
import { useIsMobile } from './useIsMobile';
import styles from './WorkspaceShell.module.scss';

/**
 * Desktop/tablet: recipe list on the left, the open recipe on the right.
 * Phone: one at a time, switched by the bottom bar (Receitas · Receita · Buscar).
 * One component tree for both, so the editor never remounts on resize.
 */
export function WorkspaceShell() {
  const { project, itemsById } = useProjectData();
  const isMobile = useIsMobile();
  const s = useWorkspaceStore(
    useShallow((st) => ({
      leftWidth: st.leftWidth,
      leftCollapsed: st.leftCollapsed,
      mobileView: st.mobileView,
      openId: st.viewByProject[project.id]?.openId ?? null,
    })),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hideLeft = !isMobile && s.leftCollapsed;

  useGlobalShortcuts();

  // Phone: open on the list unless a recipe was open.
  useEffect(() => {
    useWorkspaceStore.getState().setMobileView(s.openId ? 'recipe' : 'list');
  }, [project.id]);

  return (
    <div
      className={[styles.shell, hideLeft && styles.hideLeft].filter(Boolean).join(' ')}
      data-view={s.mobileView}
      style={{ '--left-width': `${s.leftWidth}px` } as React.CSSProperties}
    >
      <div className={styles.body}>
        <div className={styles.left}>
          <ExplorerPanel onOpenSettings={() => setSettingsOpen(true)} />
        </div>
        {!hideLeft && !isMobile && <ResizeHandle />}

        <main className={styles.center}>
          <RecipeArea visible={!isMobile || s.mobileView === 'recipe'} />
          <div className={styles.statusBar}>
            <IconButton
              label={hideLeft ? 'Mostrar lista de receitas' : 'Ocultar lista de receitas'}
              size="sm"
              active={!hideLeft}
              onClick={() => useWorkspaceStore.getState().togglePanel()}
            >
              <PanelLeft size={15} />
            </IconButton>
            <span className={styles.statusSpacer} />
            <SaveIndicator onClick={() => setSettingsOpen(true)} />
          </div>
        </main>
      </div>

      <MobileNav recipeName={s.openId ? itemsById.get(s.openId)?.name ?? null : null} />
      <SearchModal />
      <CookingMode />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} projectId={project.id} />
    </div>
  );
}

/** Phone only: switch between the list and the open recipe, and open the search. */
function MobileNav({ recipeName }: { recipeName: string | null }) {
  const view = useWorkspaceStore((s) => s.mobileView);
  const setView = useWorkspaceStore((s) => s.setMobileView);
  const items = [
    { key: 'list', label: 'Receitas', icon: <BookOpen size={21} />, active: view === 'list', onClick: () => setView('list') },
    {
      key: 'recipe',
      label: recipeName ?? 'Receita',
      icon: <ChefHat size={21} />,
      active: view === 'recipe',
      onClick: () => setView('recipe'),
    },
    { key: 'search', label: 'Buscar', icon: <Search size={21} />, active: false, onClick: () => useWorkspaceStore.getState().setSearchOpen(true) },
  ];
  return (
    <nav className={styles.mobileNav} aria-label="Navegação">
      {items.map((n) => (
        <button
          key={n.key}
          className={[styles.navItem, n.active && styles.navActive].filter(Boolean).join(' ')}
          aria-current={n.active ? 'page' : undefined}
          onClick={n.onClick}
        >
          {n.icon}
          <span>{n.label}</span>
        </button>
      ))}
    </nav>
  );
}

function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const st = useWorkspaceStore.getState();
        st.setSearchOpen(!st.searchOpen);
      }
      if (mod && e.key === '\\') {
        e.preventDefault();
        useWorkspaceStore.getState().togglePanel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
