/** Browser-side wrapper over the /api/drive proxy (tokens stay on the server). */

export interface RemoteFile {
  id: string;
  name: string;
  mimeType: string;
  version: string;
  md5Checksum?: string;
  modifiedTime: string;
}

export class SyncHttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public remote?: RemoteFile,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', ...init });
  } catch {
    throw new SyncHttpError('Sem conexão', 0, 'offline');
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; remote?: RemoteFile };
    throw new SyncHttpError(data.error ?? `Erro ${res.status}`, res.status, data.code ?? 'http', data.remote);
  }
  return res.json() as Promise<T>;
}

export const driveClient = {
  root: () => request<{ id: string }>('/api/drive/root', { method: 'POST' }),

  folder: (name: string, parentId: string) =>
    request<{ id: string }>('/api/drive/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId }),
    }),

  children: (parentId: string) =>
    request<{ files: RemoteFile[] }>(`/api/drive/children?parentId=${encodeURIComponent(parentId)}`).then((r) => r.files),

  async download(fileId: string): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`/api/drive/files/${encodeURIComponent(fileId)}`, { cache: 'no-store' });
    } catch {
      throw new SyncHttpError('Sem conexão', 0, 'offline');
    }
    if (!res.ok) throw new SyncHttpError(`Erro ${res.status}`, res.status, res.status === 401 ? 'auth' : 'http');
    return res;
  },

  upload: (opts: { parentId: string; name: string; fileId?: string; ifMd5?: string; body: Blob | string; mimeType: string }) => {
    const params = new URLSearchParams({ parentId: opts.parentId, name: opts.name });
    if (opts.fileId) params.set('fileId', opts.fileId);
    if (opts.ifMd5) params.set('ifMd5', opts.ifMd5);
    return request<RemoteFile>(`/api/drive/upload?${params}`, {
      method: 'PUT',
      headers: { 'Content-Type': opts.mimeType },
      body: opts.body,
    });
  },

  /** "Anyone with the link can view" on (public) or off. */
  share: (fileIds: string[], isPublic: boolean) =>
    request<{ ok: true }>('/api/drive/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds, public: isPublic }),
    }),

  trash: (fileId: string) => request<{ ok: true }>(`/api/drive/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }),
};
