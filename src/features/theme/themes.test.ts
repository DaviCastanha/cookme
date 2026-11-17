import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME_ID, getTheme, THEME_STORAGE_KEY, THEMES, themeBootScript } from './themes';

const stylesDir = join(__dirname, '../../styles');
const tokens = readFileSync(join(stylesDir, '_tokens.scss'), 'utf8');
const themes = readFileSync(join(stylesDir, '_themes.scss'), 'utf8');

function block(source: string, opener: string): string {
  const start = source.indexOf(opener);
  if (start < 0) return '';
  return source.slice(start, source.indexOf('\n}', start));
}

function bgOf(css: string): string | undefined {
  return /--color-bg:\s*(#[0-9a-f]{6})/i.exec(css)?.[1].toLowerCase();
}

describe('themes', () => {
  it('has unique ids and Terracota as the default', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    expect(DEFAULT_THEME_ID).toBe('terracota');
    expect(getTheme('não existe').id).toBe('terracota');
    expect(getTheme(null).id).toBe('terracota');
  });

  it('has a CSS block for every theme, with the same background as the list', () => {
    for (const theme of THEMES) {
      const css = block(themes, `[data-theme='${theme.id}'] {`);
      expect(css, theme.id).toContain('@include tokens.theme-defaults;');
      // Terracota is the defaults themselves.
      const bg = bgOf(css) ?? bgOf(block(tokens, '@mixin theme-defaults {'));
      expect(bg, theme.id).toBe(theme.bg.toLowerCase());
      expect(css.includes('color-scheme: dark'), theme.id).toBe(theme.dark);
    }
  });

  it('has no CSS block for a theme missing from the list', () => {
    const ids = [...themes.matchAll(/\[data-theme='([a-z]+)'\]/g)].map((m) => m[1]);
    expect(new Set(ids)).toEqual(new Set(THEMES.map((t) => t.id)));
  });

  it('boot script applies a saved theme and ignores unknown or missing values', () => {
    const run = (saved: string | null) => {
      const attrs: Record<string, string> = {};
      const meta: Record<string, string> = {};
      const env = {
        localStorage: { getItem: (key: string) => (key === THEME_STORAGE_KEY ? saved : null) },
        document: {
          documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
          querySelector: () => ({ setAttribute: (k: string, v: string) => (meta[k] = v) }),
        },
      };
      new Function('localStorage', 'document', themeBootScript())(env.localStorage, env.document);
      return { theme: attrs['data-theme'], color: meta.content };
    };
    expect(run('cafe')).toEqual({ theme: 'cafe', color: '#1d1714' });
    expect(run('hacker')).toEqual({ theme: undefined, color: undefined });
    expect(run(null)).toEqual({ theme: undefined, color: undefined });
  });
});
