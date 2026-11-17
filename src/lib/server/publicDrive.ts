/**
 * Reads files that their owner shared as "anyone with the link" (public recipe pages). No user
 * token is involved: with GOOGLE_API_KEY the official Drive API is used; without it, Google's
 * public download endpoint.
 */
import { PublicRecipeSchema, type PublicRecipe } from '@/features/share/publicRecipe';

const API = 'https://www.googleapis.com/drive/v3';
/** Public pages refresh at most every minute (edits show up shortly after saving). */
const REVALIDATE = 60;

/** Drive file ids are long base64url-ish strings; anything else is not worth a request. */
export function isDriveId(id: string) {
  return /^[A-Za-z0-9_-]{20,100}$/.test(id);
}

export async function fetchPublicFile(fileId: string, init: { revalidate?: number } = {}): Promise<Response | null> {
  if (!isDriveId(fileId)) return null;
  const key = process.env.GOOGLE_API_KEY;
  const url = key
    ? `${API}/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(key)}`
    : `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
  try {
    // Photos and audio (revalidate 0) skip Next's data cache (2 MB limit); the CDN caches the response instead.
    const res = await fetch(url, init.revalidate === 0 ? { cache: 'no-store' } : { next: { revalidate: init.revalidate ?? REVALIDATE } });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

/** The public copy of a recipe, or null when the link was turned off or never existed. */
export async function fetchPublicRecipe(fileId: string): Promise<PublicRecipe | null> {
  const res = await fetchPublicFile(fileId);
  if (!res) return null;
  try {
    const parsed = PublicRecipeSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
