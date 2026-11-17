/** Thin Google Drive v3 REST client. Server-only: called from /api/drive route handlers. */
import crypto from 'node:crypto';

const md5 = (body: ArrayBuffer) => crypto.createHash('md5').update(Buffer.from(body)).digest('hex');

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FIELDS = 'id,name,mimeType,version,md5Checksum,modifiedTime,size,parents';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  version: string;
  /** Content fingerprint. Unlike `version`, it only changes when the content changes. */
  md5Checksum?: string;
  modifiedTime: string;
  size?: string;
}

export class DriveError extends Error {
  constructor(
    message: string,
    public status: number,
    public remote?: DriveFile,
  ) {
    super(message);
  }
}

async function call<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new DriveError(`Drive ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export async function findOrCreateFolder(token: string, name: string, parentId: string): Promise<DriveFile> {
  const query = `name='${q(name)}' and mimeType='${FOLDER_MIME}' and '${q(parentId)}' in parents and trashed=false`;
  const found = await call<{ files: DriveFile[] }>(
    token,
    `${API}/files?${new URLSearchParams({ q: query, fields: `files(${FIELDS})`, spaces: 'drive', pageSize: '10' })}`,
  );
  if (found.files[0]) return found.files[0];
  return call<DriveFile>(token, `${API}/files?fields=${FIELDS}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
}

export async function listChildren(token: string, parentId: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${q(parentId)}' in parents and trashed=false`,
      fields: `nextPageToken,files(${FIELDS})`,
      spaces: 'drive',
      pageSize: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const page = await call<{ files: DriveFile[]; nextPageToken?: string }>(token, `${API}/files?${params}`);
    out.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

export function getMeta(token: string, fileId: string) {
  return call<DriveFile>(token, `${API}/files/${encodeURIComponent(fileId)}?fields=${FIELDS}`);
}

export async function download(token: string, fileId: string): Promise<Response> {
  const res = await fetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new DriveError(`Drive ${res.status}`, res.status);
  return res;
}

/**
 * Creates or replaces a file. With `ifMd5`, refuses to overwrite a file whose content changed
 * in Drive since the client last saw it (basic optimistic concurrency).
 *
 * Content checksums are compared instead of Drive's `version`: Drive bumps `version` on any
 * server-side change (even ones that do not touch the content), which caused false conflicts.
 * Uploading content identical to what is already there is never a conflict.
 */
export async function upload(
  token: string,
  opts: { fileId?: string; parentId: string; name: string; mimeType: string; body: ArrayBuffer; ifMd5?: string },
): Promise<DriveFile> {
  if (opts.fileId && opts.ifMd5) {
    const current = await getMeta(token, opts.fileId);
    const remote = current.md5Checksum;
    if (remote && remote !== opts.ifMd5 && remote !== md5(opts.body)) {
      throw new DriveError('Conflito de edição', 409, current);
    }
  }
  const boundary = `sf${Math.random().toString(36).slice(2)}`;
  const metadata = opts.fileId ? { name: opts.name } : { name: opts.name, parents: [opts.parentId] };
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: ${opts.mimeType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([head, Buffer.from(opts.body), tail]);
  const url = opts.fileId
    ? `${UPLOAD}/files/${encodeURIComponent(opts.fileId)}?uploadType=multipart&fields=${FIELDS}`
    : `${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`;
  return call<DriveFile>(token, url, {
    method: opts.fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

/** Moves to the Drive trash (recoverable by the user) instead of deleting permanently. */
export function trash(token: string, fileId: string) {
  return call<DriveFile>(token, `${API}/files/${encodeURIComponent(fileId)}?fields=${FIELDS}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

/**
 * Turns "anyone with the link can view" on or off for a file. Only files CookMe created can be
 * changed (drive.file scope), which is exactly the public copy of a recipe and its photos.
 */
export async function setPublic(token: string, fileId: string, isPublic: boolean) {
  const base = `${API}/files/${encodeURIComponent(fileId)}/permissions`;
  if (isPublic) {
    await call(token, `${base}?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'anyone', role: 'reader', allowFileDiscovery: false }),
    });
    return;
  }
  try {
    await call(token, `${base}/anyoneWithLink`, { method: 'DELETE' });
  } catch (error) {
    if (!(error instanceof DriveError && error.status === 404)) throw error;
  }
}
