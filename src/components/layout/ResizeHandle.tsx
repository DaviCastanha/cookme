'use client';

import { useRef } from 'react';
import { PANEL_LIMITS, useWorkspaceStore } from '@/stores/workspaceStore';
import styles from './ResizeHandle.module.scss';

/** Drag to resize the recipe list; double-click hides it. Arrow keys resize for keyboard users. */
export function ResizeHandle() {
  const width = useWorkspaceStore((s) => s.leftWidth);
  const setWidth = useWorkspaceStore((s) => s.setPanelWidth);
  const togglePanel = useWorkspaceStore((s) => s.togglePanel);
  const start = useRef<{ x: number; width: number } | null>(null);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar lista de receitas"
      aria-valuemin={PANEL_LIMITS.min}
      aria-valuemax={PANEL_LIMITS.max}
      aria-valuenow={width}
      tabIndex={0}
      className={styles.handle}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, width };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        setWidth(start.current.width + e.clientX - start.current.x);
      }}
      onPointerUp={() => {
        start.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }}
      onDoubleClick={() => togglePanel(true)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 40 : 12;
        if (e.key === 'ArrowLeft') setWidth(width - step);
        if (e.key === 'ArrowRight') setWidth(width + step);
      }}
    />
  );
}
