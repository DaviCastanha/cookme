'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';
import styles from './Modal.module.scss';

/**
 * Open dialogs, in the order they were opened. The last one is drawn on top and is the only
 * one that reacts to Esc/Tab (e.g. the transcription setup opened over the recorder).
 */
const openStack: symbol[] = [];

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Position near the top (search) instead of centered. */
  placement?: 'center' | 'top';
  /** Hide the default header (custom layouts like the search box). */
  bare?: boolean;
  labelledBy?: string;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  placement = 'center',
  bare,
  labelledBy,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // The visible title names the dialog for assistive tech, unless a custom label id is given.
  const autoId = useId();
  const titleId = labelledBy ?? (title && !bare ? autoId : undefined);
  const restoreFocus = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without re-running the focus effect on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [layer, setLayer] = useState(0);
  const layerToken = useRef<symbol | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const token = Symbol('modal');
    openStack.push(token);
    setLayer(openStack.length);
    layerToken.current = token;
    return () => {
      const idx = openStack.indexOf(token);
      if (idx !== -1) openStack.splice(idx, 1);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>('[data-autofocus], input, textarea, button:not([data-modal-close])');
    focusable?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== layerToken.current) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
      if (e.key === 'Tab' && panel) {
        const nodes = [...panel.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter(
          (n) => !n.hasAttribute('disabled'),
        );
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={[styles.root, styles[placement]].join(' ')} style={{ zIndex: `calc(var(--z-modal) + ${layer})` }}>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[styles.panel, styles[size], className].filter(Boolean).join(' ')}
      >
        {!bare && (
          <header className={styles.header}>
            <h2 className={styles.title} id={titleId}>
              {title}
            </h2>
            <IconButton label="Fechar" onClick={onClose} data-modal-close size="sm">
              <X size={16} />
            </IconButton>
          </header>
        )}
        <div className={bare ? undefined : styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
