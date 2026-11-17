'use client';

import { Heading2, Heading3, Image, Lightbulb, List, ListChecks, ListOrdered, Mic, Minus, Type } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSlashStore } from './extensions/SlashCommand';
import styles from './SlashMenu.module.scss';

const ICONS: Record<string, ReactNode> = {
  text: <Type size={16} />,
  'heading-2': <Heading2 size={16} />,
  'heading-3': <Heading3 size={16} />,
  'list-checks': <ListChecks size={16} />,
  'list-ordered': <ListOrdered size={16} />,
  list: <List size={16} />,
  lightbulb: <Lightbulb size={16} />,
  image: <Image size={16} />,
  mic: <Mic size={16} />,
  minus: <Minus size={16} />,
};

/** Renders the "/" block menu for whichever editor is currently typing a slash command. */
export function SlashMenu() {
  const props = useSlashStore((s) => s.props);
  const selected = useSlashStore((s) => s.selected);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!props) return;
    const rect = props.clientRect?.();
    const el = ref.current;
    if (!rect || !el) return;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 12) top = Math.max(12, rect.top - h - 6);
    const left = Math.min(rect.left, window.innerWidth - el.offsetWidth - 12);
    setPos({ top, left: Math.max(12, left) });
  }, [props]);

  useLayoutEffect(() => {
    ref.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!props) return null;

  return createPortal(
    <div
      ref={ref}
      className={styles.menu}
      style={pos ?? { visibility: 'hidden', top: 0, left: 0 }}
      role="listbox"
      aria-label="Inserir bloco"
      onMouseDown={(e) => e.preventDefault()}
    >
      {props.items.length ? (
        props.items.map((item, idx) => (
          <button
            key={item.id}
            data-index={idx}
            role="option"
            aria-selected={idx === selected}
            className={[styles.item, idx === selected && styles.active].filter(Boolean).join(' ')}
            onMouseEnter={() => useSlashStore.setState({ selected: idx })}
            onClick={() => props.command(item)}
          >
            <span className={styles.icon}>{ICONS[item.icon]}</span>
            <span className={styles.text}>
              <span className={styles.label}>{item.label}</span>
              <span className={styles.hint}>{item.hint}</span>
            </span>
          </button>
        ))
      ) : (
        <div className={styles.empty}>Nenhum bloco encontrado</div>
      )}
    </div>,
    document.body,
  );
}
