/**
 * Color themes. The colors themselves live in `styles/_themes.scss` (one `[data-theme]` block per
 * theme, overriding the tokens of `_tokens.scss`); this list drives the picker, the inline script that
 * applies the saved theme before the first paint and the browser's `theme-color`.
 *
 * The choice is per device (localStorage), like the panel width.
 */

export const THEME_STORAGE_KEY = 'cookme:theme';

export interface Theme {
  id: string;
  name: string;
  description: string;
  /** Page background, mirrored here for `<meta name="theme-color">` (a test checks it matches the SCSS). */
  bg: string;
  dark: boolean;
}

export const THEMES: readonly Theme[] = [
  {
    id: 'terracota',
    name: 'Terracota',
    description: 'Papel creme e panela de barro. O tema original.',
    bg: '#faf6f0',
    dark: false,
  },
  {
    id: 'vintage',
    name: 'Vintage',
    description: 'Papel manteiga e esmaltado verde-água, como a cozinha da vó.',
    bg: '#f5eedb',
    dark: false,
  },
  {
    id: 'moderna',
    name: 'Moderna',
    description: 'Branco, grafite e cantos retos. Limpa como bancada de inox.',
    bg: '#f5f5f3',
    dark: false,
  },
  {
    id: 'azulejo',
    name: 'Azulejo',
    description: 'Louça branca e azul-cobalto.',
    bg: '#f4f6fa',
    dark: false,
  },
  {
    id: 'toscana',
    name: 'Toscana',
    description: 'Linho cru e azeite: verde-oliva com toque de ervas.',
    bg: '#f3f1e7',
    dark: false,
  },
  {
    id: 'confeitaria',
    name: 'Confeitaria',
    description: 'Rosa de glacê e framboesa.',
    bg: '#fbf3f2',
    dark: false,
  },
  {
    id: 'cafe',
    name: 'Café',
    description: 'Escuro: espresso e cobre. Bom para cozinhar à noite.',
    bg: '#1d1714',
    dark: true,
  },
];

export const DEFAULT_THEME_ID = THEMES[0].id;

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

/**
 * Runs in `<head>` while the HTML is parsed, before the first paint: applies the saved theme so the
 * page never flashes the default colors. Must stay self-contained (no imports at runtime).
 */
export function themeBootScript(): string {
  const bgById = Object.fromEntries(THEMES.map((theme) => [theme.id, theme.bg]));
  return `(function(){try{var m=${JSON.stringify(bgById)};var t=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
  )});if(!t||!m[t])return;document.documentElement.setAttribute("data-theme",t);var c=document.querySelector('meta[name="theme-color"]');if(c)c.setAttribute("content",m[t])}catch(e){}})()`;
}
