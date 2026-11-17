'use client';

import { Check } from 'lucide-react';
import { useThemeStore } from '@/features/theme/themeStore';
import { THEMES } from '@/features/theme/themes';
import styles from './ThemePicker.module.scss';

const PREVIEW_DOTS = ['tomato', 'saffron', 'basil', 'blueberry'];

/** Theme cards; each preview is rendered with its own `data-theme`, so it shows the real colors. */
export function ThemePicker() {
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className={styles.grid} role="radiogroup" aria-label="Tema de cores">
      {THEMES.map((theme) => {
        const selected = theme.id === themeId;
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`${styles.card} ${selected ? styles.selected : ''}`}
            onClick={() => setTheme(theme.id)}
          >
            <span className={styles.preview} data-theme={theme.id} aria-hidden>
              <span className={styles.side}>
                {PREVIEW_DOTS.map((color) => (
                  <span key={color} className={styles.row}>
                    <span className={styles.dot} style={{ background: `var(--palette-${color})` }} />
                    <span className={styles.line} />
                  </span>
                ))}
              </span>
              <span className={styles.main}>
                <span className={styles.title}>Bolo</span>
                <span className={styles.text} />
                <span className={styles.text} data-short />
                <span className={styles.pill} />
              </span>
              {selected && (
                <span className={styles.check}>
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </span>
            <span className={styles.name}>{theme.name}</span>
            <span className={styles.description}>{theme.description}</span>
          </button>
        );
      })}
    </div>
  );
}
