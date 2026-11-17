'use client';

import { syncEngine } from '@/features/sync/syncEngine';
import { publicRecipeUrl } from './publicRecipe';

export function linkFor(fileId: string) {
  return publicRecipeUrl(window.location.origin, fileId);
}

/** Creates (or refreshes) the public copy and returns its link. */
export async function createPublicLink(recipeId: string): Promise<string> {
  return linkFor(await syncEngine.publish(recipeId));
}

export function removePublicLink(recipeId: string) {
  return syncEngine.unpublish(recipeId);
}

export async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/** System share sheet with the link (WhatsApp, Instagram…), or copy when there is none. */
export async function shareLink(title: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text: `Receita: ${title}`, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared';
    }
  }
  return (await copyLink(url)) ? 'copied' : 'failed';
}
