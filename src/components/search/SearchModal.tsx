'use client';

import { ArrowRight, ChevronRight, CornerDownLeft, Search, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ItemIcon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { useWorkspaceActions } from '@/features/explorer/useWorkspaceActions';
import { useProjectData } from '@/features/projects/ProjectDataProvider';
import type { EntityHit, OccurrenceHit } from '@/features/search/searchIndex';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import styles from './SearchModal.module.scss';

type Row = { kind: 'entity'; hit: EntityHit } | { kind: 'occurrence'; hit: OccurrenceHit };

export function SearchModal() {
  const open = useWorkspaceStore((s) => s.searchOpen);
  const setOpen = useWorkspaceStore((s) => s.setSearchOpen);
  return open ? <SearchDialog onClose={() => setOpen(false)} /> : null;
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const { project, searchIndex, indexVersion } = useProjectData();
  const actions = useWorkspaceActions();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const deferred = useDeferredValue(query);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => searchIndex.search(deferred, expanded ? { entities: 30, occurrences: 200 } : { entities: 6, occurrences: 8 }),
    // indexVersion: re-run when the index refreshes.
    [deferred, expanded, searchIndex, indexVersion],
  );

  const rows: Row[] = useMemo(
    () => [
      ...results.entities.map((hit) => ({ kind: 'entity' as const, hit })),
      ...results.occurrences.map((hit) => ({ kind: 'occurrence' as const, hit })),
    ],
    [results],
  );

  useEffect(() => setActive(0), [deferred]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (row: Row | undefined) => {
    if (!row) return;
    if (row.kind === 'entity') {
      actions.openItem(row.hit.item, { reveal: true });
      onClose();
    } else {
      useWorkspaceStore.getState().navigate(project.id, {
        recipeId: row.hit.recipeId,
        blockId: row.hit.blockId,
        text: row.hit.matchText,
      });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(rows[active]);
    }
  };

  const entityRows = rows.filter((r) => r.kind === 'entity');
  const hidden = results.totalOccurrences - results.occurrences.length;

  return (
    <Modal open onClose={onClose} bare placement="top" size="md" labelledBy="search-title" className={styles.modal}>
      <h2 id="search-title" className="visually-hidden">
        Buscar no caderno
      </h2>
      <div className={styles.inputRow} onKeyDown={onKeyDown}>
        <Search size={19} className={styles.searchIcon} />
        <input
          className={styles.input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setExpanded(false);
          }}
          placeholder="Buscar receitas, ingredientes, pastas…"
          aria-label="Buscar"
          autoComplete="off"
          enterKeyHint="search"
          data-autofocus
        />
        <button className={styles.clear} aria-label={query ? 'Limpar busca' : 'Fechar busca'} onClick={() => (query ? setQuery('') : onClose())}>
          <X size={17} />
        </button>
      </div>

      {deferred.trim() && (
        <div className={styles.results} ref={listRef}>
          {rows.length === 0 && <p className={styles.empty}>Nada encontrado para “{deferred}”.</p>}

          {entityRows.length > 0 && <div className={styles.groupLabel}>Receitas e pastas</div>}
          {rows.map((row, idx) =>
            row.kind === 'entity' ? (
              <button
                key={`e-${row.hit.id}`}
                data-row={idx}
                className={[styles.row, idx === active && styles.active].filter(Boolean).join(' ')}
                onMouseMove={() => setActive(idx)}
                onClick={() => choose(row)}
              >
                <ItemIcon item={row.hit.item} size={18} soft />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{row.hit.name}</span>
                  <span className={styles.rowMeta}>
                    {row.hit.kind === 'folder' ? 'Pasta' : 'Receita'}
                    {row.hit.location.length > 0 && ` • ${row.hit.location.join(' › ')}`}
                  </span>
                </span>
                <ChevronRight size={16} className={styles.chevron} />
              </button>
            ) : null,
          )}

          {results.occurrences.length > 0 && (
            <div className={styles.groupLabel}>
              Dentro das receitas <span>{results.totalOccurrences}</span>
            </div>
          )}
          {rows.map((row, idx) =>
            row.kind === 'occurrence' ? (
              <button
                key={`o-${row.hit.key}`}
                data-row={idx}
                className={[styles.row, styles.occurrence, idx === active && styles.active].filter(Boolean).join(' ')}
                onMouseMove={() => setActive(idx)}
                onClick={() => choose(row)}
              >
                <span className={styles.rowText}>
                  <span className={styles.location}>{[project.name, ...row.hit.location].join(' › ')}</span>
                  <span className={styles.context}>
                    {row.hit.before}
                    <mark>{row.hit.match}</mark>
                    {row.hit.after}
                  </span>
                </span>
                {idx === active && <CornerDownLeft size={15} className={styles.chevron} />}
              </button>
            ) : null,
          )}

          {!expanded && (hidden > 0 || results.entities.length >= 6) && (
            <button className={styles.more} onClick={() => setExpanded(true)}>
              Ver todos os resultados <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}

      {!deferred.trim() && (
        <p className={styles.tip}>
          Busque pelo nome da receita, por um ingrediente (“leite condensado”) ou por qualquer trecho. <kbd>↑</kbd>{' '}
          <kbd>↓</kbd> para navegar, <kbd>Enter</kbd> para abrir.
        </p>
      )}
    </Modal>
  );
}
