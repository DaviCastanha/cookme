/**
 * Phone photos are often 4–12 MB. Before saving, large images are scaled down and re-encoded
 * as JPEG, so the caderno stays light on the device and in Drive. Small images, GIFs and
 * formats the browser cannot decode are kept as they are.
 */
const MAX_SIDE = 1800;
const QUALITY = 0.85;
const KEEP_BELOW = 600 * 1024;

export async function prepareImage(file: File): Promise<Blob> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml' || file.size < KEEP_BELOW) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function jpegName(name: string) {
  return name.replace(/\.[^.]+$/, '') + '.jpg';
}
