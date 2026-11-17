import { customAlphabet } from 'nanoid';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const nano = customAlphabet(alphabet, 12);

export type IdPrefix = 'project' | 'folder' | 'recipe' | 'b' | 'asset';

export function createId(prefix: IdPrefix): string {
  return `${prefix}_${nano()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
