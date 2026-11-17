/**
 * Turns what people usually paste (share links) into a URL an <img> can display.
 * Returns null when the text is not a usable http(s) link.
 */
export function normalizeImageUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  // App-relative paths (bundled images, e.g. the tutorial project).
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  // Google Drive share links (file must be shared as "anyone with the link").
  if (url.hostname === 'drive.google.com' || url.hostname === 'docs.google.com') {
    const id = /\/file\/d\/([\w-]+)/.exec(url.pathname)?.[1] ?? url.searchParams.get('id');
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w2000`;
  }

  // Dropbox share links: ?dl=0 shows a web page; raw=1 serves the file itself.
  if (url.hostname.endsWith('dropbox.com')) {
    url.searchParams.delete('dl');
    url.searchParams.set('raw', '1');
    return url.toString();
  }

  return url.toString();
}
