/** Lowercase and strip diacritics so "Bússola" matches "bussola". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Finds every occurrence of `needle` in `haystack` ignoring case and accents.
 * Returns offsets in the original string (NFD stripping keeps 1:1 offsets for composed input).
 */
export function findAll(haystack: string, needle: string): number[] {
  const h = normalizeKeepLength(haystack);
  const n = normalizeKeepLength(needle);
  if (!n) return [];
  const out: number[] = [];
  let from = 0;
  for (;;) {
    const idx = h.indexOf(n, from);
    if (idx === -1) break;
    out.push(idx);
    from = idx + n.length;
  }
  return out;
}

/** Like normalize(), but maps each char individually so string length (and offsets) are preserved. */
export function normalizeKeepLength(text: string): string {
  let out = '';
  for (const ch of text) {
    const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const lower = (base || ch).toLowerCase();
    // Guard against chars whose lowercase/base form changes length (e.g. "İ").
    out += lower.length === ch.length ? lower : ch;
  }
  return out;
}

/** Whole-word check around a match so "Ana" does not match "Anabela". */
export function isWordBoundary(text: string, start: number, length: number): boolean {
  const before = start > 0 ? text[start - 1] : ' ';
  const after = start + length < text.length ? text[start + length] : ' ';
  const word = /[\p{L}\p{N}_]/u;
  return !word.test(before) && !word.test(after);
}

/** Builds a short context snippet centered on a match. */
export function snippet(text: string, start: number, length: number, radius = 60) {
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, start + length + radius);
  let before = text.slice(from, start);
  let after = text.slice(start + length, to);
  if (from > 0) before = '…' + before.replace(/^\S*\s/, '');
  if (to < text.length) after = after.replace(/\s\S*$/, '') + '…';
  return { before, match: text.slice(start, start + length), after };
}

export function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'agora mesmo';
  if (diff < hour) return `há ${Math.floor(diff / minute)} min`;
  if (diff < day) return `há ${Math.floor(diff / hour)} h`;
  if (diff < 7 * day) return `há ${Math.floor(diff / day)} d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
