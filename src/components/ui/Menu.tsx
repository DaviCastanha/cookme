'use client';

import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Menu.module.scss';

export type MenuEntry =
  | {
      kind?: 'item';
      label: string;
      icon?: ReactNode;
      hint?: string;
      danger?: boolean;
      disabled?: boolean;
      checked?: boolean;
      onSelect?: () => void;
      /** Opens a nested page of entries in place (works the same on desktop and mobile). */
      submenu?: MenuEntry[];
    }
  | { kind: 'separator' }
  | { kind: 'label'; label: string };

type Anchor = { x: number; y: number } | HTMLElement;

interface MenuState {
  anchor: Anchor;
  entries: MenuEntry[];
  title?: string;
}

/**
 * Lightweight menu controller.
 * Usage: `const menu = useMenu(); menu.open(event.currentTarget, entries); return <>{menu.element}</>`.
 */
export function useMenu() {
  const [state, setState] = useState<MenuState | null>(null);
  const close = useCallback(() => setState(null), []);
  const open = useCallback((anchor: Anchor, entries: MenuEntry[], title?: string) => {
    setState({ anchor, entries, title });
  }, []);
  const element = state ? <MenuPopup {...state} onClose={close} /> : null;
  return { open, close, isOpen: !!state, element };
}

function MenuPopup({ anchor, entries, title, onClose }: MenuState & { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [stack, setStack] = useState<{ title?: string; entries: MenuEntry[] }[]>([{ title, entries }]);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const page = stack[stack.length - 1];

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let top: number;
    let left: number;
    if (anchor instanceof HTMLElement) {
      const a = anchor.getBoundingClientRect();
      top = a.bottom + 4;
      left = a.left;
      if (top + rect.height > window.innerHeight - margin) top = Math.max(margin, a.top - rect.height - 4);
    } else {
      top = anchor.y;
      left = anchor.x;
      if (top + rect.height > window.innerHeight - margin) top = Math.max(margin, anchor.y - rect.height);
    }
    left = Math.min(left, window.innerWidth - rect.width - margin);
    setPos({ top, left: Math.max(margin, left) });
  }, [anchor, stack.length]);

  // Focus the first item once positioned (hidden elements cannot take focus).
  const positioned = pos !== null;
  useEffect(() => {
    if (!positioned) return;
    const first = ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    first?.focus({ preventScroll: true });
  }, [stack.length, positioned]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (stack.length > 1) setStack((s) => s.slice(0, -1));
        else onClose();
      }
    };
    const onScroll = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onClose);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onClose);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose, stack.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? (idx + 1) % buttons.length : (idx - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return createPortal(
    <>
      <div className={styles.scrim} aria-hidden />
      <div
        ref={ref}
        role="menu"
        className={styles.menu}
        style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {stack.length > 1 && (
          <button className={styles.back} onClick={() => setStack((s) => s.slice(0, -1))}>
            <ChevronLeft size={16} />
            <span>{page.title ?? 'Voltar'}</span>
          </button>
        )}
        {stack.length === 1 && page.title && <div className={styles.title}>{page.title}</div>}
        {page.entries.map((entry, idx) => {
          if (entry.kind === 'separator') return <div key={idx} className={styles.separator} role="separator" />;
          if (entry.kind === 'label') return <div key={idx} className={styles.label}>{entry.label}</div>;
          return (
            <button
              key={idx}
              role="menuitem"
              disabled={entry.disabled}
              className={[styles.item, entry.danger && styles.danger].filter(Boolean).join(' ')}
              onClick={() => {
                if (entry.submenu) {
                  setStack((s) => [...s, { title: entry.label, entries: entry.submenu! }]);
                  return;
                }
                onClose();
                entry.onSelect?.();
              }}
            >
              <span className={styles.icon}>{entry.icon}</span>
              <span className={styles.text}>{entry.label}</span>
              {entry.hint && <span className={styles.hint}>{entry.hint}</span>}
              {entry.checked && <Check size={15} className={styles.check} />}
              {entry.submenu && <ChevronRight size={15} className={styles.chevron} />}
            </button>
          );
        })}
      </div>
    </>,
    document.body,
  );
}
