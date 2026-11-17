/**
 * Hands a file to the system share sheet (WhatsApp, Instagram, e-mail…) when the browser can,
 * otherwise downloads it.
 */
export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded';

export async function shareOrDownload(files: File[], title: string): Promise<ShareOutcome> {
  for (const file of files) {
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
        // NotAllowedError (e.g. lost user activation after a slow render): fall back to download.
        break;
      }
    }
  }
  downloadBlob(files[0].name, files[0]);
  return 'downloaded';
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Bolo de cenoura!" → "bolo-de-cenoura" */
export function slugify(name: string, fallback = 'receita') {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || fallback
  );
}
