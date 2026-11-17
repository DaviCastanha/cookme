'use client';

import { ChevronRight, Copy, FolderInput, FolderPlus, MoreHorizontal, Palette, Pencil, Plus, SquareArrowOutUpRight, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ItemIcon } from '@/components/ui/Icon';
import { useMenu, type MenuEntry } from '@/components/ui/Menu';
import { ancestorIds, buildTree, type TreeNode } from '@/features/explorer/tree';
import { useWorkspaceActions } from '@/features/explorer/useWorkspaceActions';
import { useProjectData } from '@/features/projects/ProjectDataProvider';
import { isDescendant } from '@/lib/repository';
import type { ExplorerItem } from '@/lib/schemas';
import { useProjectView, useWorkspaceStore } from '@/stores/workspaceStore';
import styles from './ExplorerTree.module.scss';

type DropHint = { id: string; mode: 'into' | 'before' } | null;

export function ExplorerTree({
  onAppearance,
  onMove,
}: {
  onAppearance: (item: ExplorerItem) => void;
  onMove: (item: ExplorerItem) => void;
}) {
  const { project, items } = useProjectData();
  const actions = useWorkspaceActions();
  const tree = useMemo(() => buildTree(items), [items]);
  const expanded = useWorkspaceStore((s) => s.expandedByProject[project.id]);
  const expandedSet = useMemo(() => new Set(expanded ?? []), [expanded]);
  const { openId: activeId } = useProjectView(project.id);
  const recipeCount = useMemo(() => countRecipes(tree), [tree]);
  const menu = useMenu();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const touch = useTouchDrag();

  // Reveal the open recipe (e.g. opened from search).
  useEffect(() => {
    if (!activeId) return;
    const ancestors = ancestorIds(items, activeId);
    if (ancestors.some((id) => !expandedSet.has(id))) useWorkspaceStore.getState().expandFolders(project.id, ancestors);
  }, [activeId]);

  const itemMenu = (item: ExplorerItem): MenuEntry[] => {
    const entries: MenuEntry[] = [];
    if (item.type === 'folder') {
      entries.push(
        { label: 'Nova receita aqui', icon: <Plus />, onSelect: () => void actions.createRecipe(item.id) },
        { label: 'Nova pasta aqui', icon: <FolderPlus />, onSelect: () => void actions.createFolder(item.id) },
        { kind: 'separator' },
      );
    } else {
      entries.push(
        { label: 'Abrir', icon: <SquareArrowOutUpRight />, onSelect: () => actions.openItem(item) },
        { label: 'Duplicar', icon: <Copy />, onSelect: () => void actions.duplicateRecipe(item) },
      );
    }
    entries.push(
      { label: 'Renomear', icon: <Pencil />, hint: 'F2', onSelect: () => setRenaming(item.id) },
      { label: 'Ícone e cor…', icon: <Palette />, onSelect: () => onAppearance(item) },
      { label: 'Mover para…', icon: <FolderInput />, onSelect: () => onMove(item) },
      { kind: 'separator' },
      { label: 'Excluir', icon: <Trash2 />, danger: true, onSelect: () => void actions.deleteItem(item) },
    );
    return entries;
  };

  const canDrop = (targetId: string | null, movingId = dragging) => {
    if (!movingId) return false;
    if (targetId === null) return true;
    return targetId !== movingId && !isDescendant(items, targetId, movingId);
  };

  const drop = (target: ExplorerItem | null, mode: 'into' | 'before', movingId = dragging) => {
    const moving = items.find((i) => i.id === movingId);
    setDragging(null);
    setDropHint(null);
    if (!moving || (target && !canDrop(target.id, moving.id))) return;
    if (!target) return void actions.moveItem(moving, null);
    if (mode === 'into') return void actions.moveItem(moving, target.id);
    return void actions.moveItem(moving, target.parentId, target.id);
  };

  // ---------------------------------------------------------------- touch: hold, then drag

  /** Where a finger at (x, y) would drop the item being moved. */
  const hintAt = (x: number, y: number, movingId: string): DropHint => {
    const el = document.elementFromPoint(x, y);
    const row = el?.closest<HTMLElement>('[data-item-id]');
    if (row) {
      const target = items.find((i) => i.id === row.dataset.itemId);
      if (!target || !canDrop(target.id, movingId)) return null;
      const rect = row.getBoundingClientRect();
      // Folders: top third inserts before, the rest drops inside. Recipes: insert before.
      const mode = target.type === 'folder' && y > rect.top + rect.height / 3 ? 'into' : 'before';
      return { id: target.id, mode };
    }
    // Empty space below the list: end of the caderno (outside folders).
    return el && listRef.current?.parentElement?.contains(el) ? { id: 'root', mode: 'into' } : null;
  };

  const startTouchDrag = (item: ExplorerItem, e: React.TouchEvent) => {
    if (renaming || e.touches.length !== 1) return;
    touch.arm(e.touches[0], () => {
      setDragging(item.id);
      navigator.vibrate?.(15);
      const scroller = listRef.current?.parentElement ?? null;
      let hint: DropHint = null;
      touch.follow({
        move: (x, y) => {
          touch.setGhost({ x, y, name: item.name });
          hint = hintAt(x, y, item.id);
          setDropHint(hint);
          // Scroll the list when the finger reaches its top or bottom edge.
          if (scroller) {
            const r = scroller.getBoundingClientRect();
            if (y < r.top + 48) scroller.scrollBy(0, -12);
            else if (y > r.bottom - 48) scroller.scrollBy(0, 12);
          }
        },
        end: () => {
          touch.setGhost(null);
          const final = hint;
          if (!final) {
            setDragging(null);
            setDropHint(null);
            return;
          }
          const target = final.id === 'root' ? null : (items.find((i) => i.id === final.id) ?? null);
          drop(target, final.mode, item.id);
        },
      });
    });
  };

  const renderNode = (node: TreeNode) => {
    const { item } = node;
    const expandable = item.type === 'folder' && node.children.length > 0;
    const count = item.type === 'folder' ? recipeCount.get(item.id) ?? 0 : 0;
    const open = expandedSet.has(item.id);
    const hint = dropHint?.id === item.id ? dropHint.mode : null;

    return (
      <li key={item.id} role="treeitem" aria-expanded={expandable ? open : undefined} aria-selected={activeId === item.id}>
        <div
          className={[
            styles.row,
            activeId === item.id && styles.active,
            item.type === 'folder' && styles.folderRow,
            hint === 'into' && styles.dropInto,
            hint === 'before' && styles.dropBefore,
            dragging === item.id && styles.dragging,
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ paddingLeft: 6 + node.depth * 16 }}
          data-item-id={item.id}
          draggable={renaming !== item.id}
          onTouchStart={(e) => startTouchDrag(item, e)}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.name);
            setDragging(item.id);
          }}
          onDragEnd={() => {
            setDragging(null);
            setDropHint(null);
          }}
          onDragOver={(e) => {
            if (!dragging || dragging === item.id || !canDrop(item.id)) return;
            e.preventDefault();
            e.stopPropagation();
            // Folders accept drops inside, except on their top edge; recipes insert before themselves.
            const nearTop = e.clientY < e.currentTarget.getBoundingClientRect().top + 6;
            const mode = item.type === 'folder' && !nearTop ? 'into' : 'before';
            if (dropHint?.id !== item.id || dropHint.mode !== mode) setDropHint({ id: item.id, mode });
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            drop(item, hint ?? 'before');
          }}
          onClick={() => {
            if (touch.consumeClick()) return; // The tap that ended a drag.
            actions.openItem(item);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            // A long press on phones is "hold to drag"; the menu is on the ⋯ button.
            if (touch.recentTouch()) return;
            menu.open({ x: e.clientX, y: e.clientY }, itemMenu(item), item.name);
          }}
          onKeyDown={(e) => {
            if (e.key === 'F2') setRenaming(item.id);
            if (e.key === 'Enter') actions.openItem(item);
            if (e.key === 'Delete') void actions.deleteItem(item);
          }}
          tabIndex={0}
        >
          <span
            className={[styles.chevron, open && styles.open, !expandable && styles.hiddenChevron].filter(Boolean).join(' ')}
            onClick={(e) => {
              if (!expandable) return;
              e.stopPropagation();
              useWorkspaceStore.getState().toggleFolder(project.id, item.id);
            }}
          >
            <ChevronRight size={14} />
          </span>
          <ItemIcon item={item} size={item.type === 'folder' ? 17 : 16} />
          {renaming === item.id ? (
            <input
              className={styles.renameInput}
              defaultValue={item.name}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                setRenaming(null);
                void actions.renameItem(item, e.target.value.trim() || item.name);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  e.currentTarget.value = item.name;
                  e.currentTarget.blur();
                }
              }}
            />
          ) : (
            <span className={styles.name} onDoubleClick={() => setRenaming(item.id)}>
              {item.name}
            </span>
          )}
          {item.type === 'folder' && count > 0 && <span className={styles.count}>{count}</span>}
          {item.type === 'folder' && (
            <button
              className={styles.more}
              aria-label={`Nova receita em ${item.name}`}
              title="Nova receita aqui"
              onClick={(e) => {
                e.stopPropagation();
                void actions.createRecipe(item.id);
              }}
            >
              <Plus size={15} />
            </button>
          )}
          <button
            className={styles.more}
            aria-label={`Opções de ${item.name}`}
            onClick={(e) => {
              e.stopPropagation();
              menu.open(e.currentTarget, itemMenu(item), item.name);
            }}
          >
            <MoreHorizontal size={15} />
          </button>
        </div>

        {open && item.type === 'folder' && node.children.length > 0 && (
          <ul role="group" className={styles.group}>
            {node.children.map(renderNode)}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      <ul
        ref={listRef}
        role="tree"
        aria-label="Pastas e receitas"
        className={[styles.tree, dropHint?.id === 'root' && styles.dropRoot].filter(Boolean).join(' ')}
        onDragOver={(e) => {
          if (!dragging) return;
          e.preventDefault();
          if (dropHint?.id !== 'root') setDropHint({ id: 'root', mode: 'into' });
        }}
        onDrop={(e) => {
          e.preventDefault();
          drop(null, 'into');
        }}
      >
        {tree.map(renderNode)}
      </ul>
      {menu.element}
      {touch.ghost && (
        <div className={styles.ghost} style={{ left: touch.ghost.x, top: touch.ghost.y }} aria-hidden>
          {touch.ghost.name}
        </div>
      )}
    </>
  );
}

/** Recipes inside each folder, counting subfolders too. */
function countRecipes(nodes: TreeNode[]): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (node: TreeNode): number => {
    if (node.item.type === 'recipe') return 1;
    const total = node.children.reduce((sum, c) => sum + walk(c), 0);
    counts.set(node.item.id, total);
    return total;
  };
  nodes.forEach(walk);
  return counts;
}

const HOLD_MS = 380;
const MOVE_TOLERANCE = 10;

/**
 * Hold-then-drag for touch screens (HTML drag and drop does not work with fingers). A short
 * swipe still scrolls the list; holding still for a moment picks the item up.
 */
function useTouchDrag() {
  const [ghost, setGhost] = useState<{ x: number; y: number; name: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTouch = useRef(0);
  const swallowClick = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return {
    ghost,
    setGhost,
    recentTouch: () => Date.now() - lastTouch.current < 1500,
    consumeClick: () => {
      const swallow = swallowClick.current;
      swallowClick.current = false;
      return swallow;
    },
    /** Starts the hold timer; moving the finger first cancels it (normal scrolling). */
    arm(start: { clientX: number; clientY: number }, onHold: () => void) {
      cancel();
      lastTouch.current = Date.now();
      const x0 = start.clientX;
      const y0 = start.clientY;
      const onMove = (e: TouchEvent) => {
        const t = e.touches[0];
        if (Math.hypot(t.clientX - x0, t.clientY - y0) > MOVE_TOLERANCE) stop();
      };
      const stop = () => {
        cancel();
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', stop);
        window.removeEventListener('touchcancel', stop);
      };
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', stop);
      window.addEventListener('touchcancel', stop);
      timer.current = setTimeout(() => {
        stop();
        onHold();
      }, HOLD_MS);
    },
    /** While dragging: the page must not scroll, and the finger position drives the drop target. */
    follow(handlers: { move: (x: number, y: number) => void; end: () => void }) {
      const onMove = (e: TouchEvent) => {
        e.preventDefault();
        const t = e.touches[0];
        handlers.move(t.clientX, t.clientY);
      };
      const done = () => {
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        window.removeEventListener('touchcancel', onEnd);
        cleanup.current = null;
      };
      const onEnd = () => {
        lastTouch.current = Date.now();
        swallowClick.current = true;
        setTimeout(() => (swallowClick.current = false), 400);
        done();
        handlers.end();
      };
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
      window.addEventListener('touchcancel', onEnd);
      cleanup.current = done;
    },
  };
}
