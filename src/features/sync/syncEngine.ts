'use client';

/**
 * Background sync between IndexedDB (source of truth on this device) and Google Drive.
 *
 * - Push: every local write enqueues the affected file; the queue is flushed shortly after.
 * - Pull: files changed in Drive (another device) are downloaded when there are no local
 *   pending changes for them.
 * - Conflicts: when Drive changed AND there are local changes, the local version wins and the
 *   Drive version is kept as a `*.conflict-<date>.json` copy next to it. Nothing is lost.
 */
import { getDb, type SyncQueueEntry, type SyncUnit } from '@/lib/db/database';
import { deleteProject, enqueue, onLocalWrite, saveRecipe } from '@/lib/repository';
import { getAssetIds } from '@/features/recipes/content';
import { PUBLIC_DIR, PUBLIC_FORMAT, type PublicRecipe } from '@/features/share/publicRecipe';
import { nowIso } from '@/lib/utils/id';
import { AppIndexFileSchema, SCHEMA_VERSION, type AppIndexFile } from '@/lib/schemas';
import { useStatusStore } from '@/stores/statusStore';
import { driveClient, SyncHttpError, type RemoteFile } from './driveClient';
import {
  applyRemoteUnit,
  locationKey,
  projectDirs,
  projectFileKey,
  RECIPES_DIR,
  ASSETS_DIR,
  serializeUnit,
  unitFromRemote,
  unitLocation,
} from './units';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const PUSH_DELAY = 1500;
const POLL_INTERVAL = 30_000;
const APP_INDEX_KEY = 'app-index.json';
const MAX_ATTEMPTS = 5;

export class SyncEngine {
  private running = false;
  private account: string | null = null;
  private activeProject: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private busy: Promise<void> | null = null;
  private cleanup: (() => void)[] = [];
  private childrenCache = new Map<string, RemoteFile[]>();

  private setSync = (...args: Parameters<ReturnType<typeof useStatusStore.getState>['setSync']>) =>
    useStatusStore.getState().setSync(...args);

  async start(account: string) {
    if (this.running && this.account === account) return;
    this.stop();
    const db = getDb();
    const previous = (await db.meta.get('driveAccount'))?.value;
    if (previous && previous !== account) {
      // Another Google account: forget file ids from the previous one.
      await db.driveFiles.clear();
      await db.meta.delete('driveRootId');
    }
    await db.meta.put({ key: 'driveAccount', value: account });
    this.account = account;
    this.running = true;

    const unsubscribe = onLocalWrite(() => this.schedule(PUSH_DELAY));
    const online = () => this.schedule(0);
    const offline = () => this.setSync('offline');
    // Phones resume tabs without reloading: sync as soon as the app is back on screen.
    let lastWake = 0;
    const wake = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastWake < 5000) return;
      lastWake = Date.now();
      this.schedule(0);
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    this.interval = setInterval(() => this.schedule(0), POLL_INTERVAL);
    this.cleanup = [
      unsubscribe,
      () => window.removeEventListener('online', online),
      () => window.removeEventListener('offline', offline),
      () => window.removeEventListener('focus', wake),
      () => document.removeEventListener('visibilitychange', wake),
    ];

    this.setSync('syncing', { message: null });
    this.run(() => this.initialSync());
  }

  stop() {
    this.running = false;
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    if (this.timer) clearTimeout(this.timer);
    if (this.interval) clearInterval(this.interval);
    this.timer = this.interval = null;
    this.setSync('disabled', { pending: 0, message: null });
    useStatusStore.getState().setFirstSyncDone(false);
  }

  get isRunning() {
    return this.running;
  }

  setActiveProject(projectId: string | null) {
    this.activeProject = projectId;
    if (this.running && projectId) this.schedule(0);
  }

  // ------------------------------------------------------------------ public links

  /**
   * Creates (or updates) the public copy of a recipe and returns its Drive file id. Pending
   * changes are uploaded first, so every photo already has a Drive file to share.
   */
  publish(recipeId: string): Promise<string> {
    if (!this.running) return Promise.reject(new Error('Entre com o Google para criar links públicos.'));
    return this.exclusive(async () => {
      await this.flush();
      return this.publishSnapshot(recipeId);
    });
  }

  /** Turns the public link off: the public copy goes to the trash and the photos become private again. */
  unpublish(recipeId: string): Promise<void> {
    if (!this.running) return Promise.reject(new Error('Entre com o Google para mudar o link público.'));
    return this.exclusive(async () => {
      const db = getDb();
      const recipe = await db.recipes.get(recipeId);
      if (!recipe?.publicFileId) return;
      await driveClient.trash(recipe.publicFileId).catch(ignoreNotFound);
      const shared = ((await db.meta.get(`public:${recipeId}`))?.value as string[] | undefined) ?? [];
      const others = shared.filter((id) => id !== recipe.publicFileId);
      if (others.length) await driveClient.share(others, false).catch(ignoreNotFound);
      await db.meta.delete(`public:${recipeId}`);
      await saveRecipe(recipeId, { publicFileId: null });
    });
  }

  private async publishSnapshot(recipeId: string): Promise<string> {
    const db = getDb();
    const [recipe, item] = await Promise.all([db.recipes.get(recipeId), db.items.get(recipeId)]);
    if (!recipe || !item) throw new Error('Receita não encontrada.');

    // Drive file of every photo/audio the recipe uses.
    const files: Record<string, string> = {};
    const mimeTypes: Record<string, string> = {};
    const assetIds = [...new Set([...(recipe.coverAssetId ? [recipe.coverAssetId] : []), ...getAssetIds(recipe.content)])];
    for (const id of assetIds) {
      const asset = await db.assets.get(id);
      if (!asset) continue;
      const record = await db.driveFiles.get(locationKey(unitLocation(recipe.projectId, `asset:${id}`, asset.mimeType)));
      if (!record) continue;
      files[id] = record.fileId;
      mimeTypes[id] = asset.mimeType;
    }

    const snapshot: PublicRecipe = {
      format: PUBLIC_FORMAT,
      version: 1,
      publishedAt: nowIso(),
      name: item.name,
      icon: item.icon,
      color: item.color,
      time: recipe.time,
      servings: recipe.servings,
      coverAssetId: recipe.coverAssetId,
      coverUrl: recipe.coverUrl,
      content: recipe.content,
      files,
      mimeTypes,
    };
    const parentId = await this.folderId([...projectDirs(recipe.projectId), PUBLIC_DIR]);
    const upload = (fileId?: string) =>
      driveClient.upload({ parentId, name: `${recipeId}.json`, fileId, body: JSON.stringify(snapshot), mimeType: 'application/json' });
    let result: RemoteFile;
    try {
      result = await upload(recipe.publicFileId ?? undefined);
    } catch (error) {
      if (!(error instanceof SyncHttpError && error.status === 404 && recipe.publicFileId)) throw error;
      result = await upload(); // The public copy was removed in Drive: make a new one.
    }

    // Share only what is not shared yet (each call is a request to Google).
    const key = `public:${recipeId}`;
    const shared = new Set(((await db.meta.get(key))?.value as string[] | undefined) ?? []);
    const toShare = [result.id, ...Object.values(files)].filter((id) => !shared.has(id));
    if (toShare.length) {
      await driveClient.share(toShare, true);
      toShare.forEach((id) => shared.add(id));
      await db.meta.put({ key, value: [...shared] });
    }
    if (recipe.publicFileId !== result.id) await saveRecipe(recipeId, { publicFileId: result.id });
    return result.id;
  }

  /** Like `run`, but hands back the result (or the error) to the caller. */
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = (this.busy ?? Promise.resolve()).then(work);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.busy = tail;
    void tail.then(() => {
      if (this.busy === tail) this.busy = null;
    });
    return result;
  }

  /** Push pending changes, then pull the open project. */
  syncNow() {
    return this.run(() => this.tick());
  }

  private schedule(delay: number) {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(() => this.tick()), delay);
  }

  /** Serializes all sync work so pushes and pulls never interleave. */
  private run(work: () => Promise<void>): Promise<void> {
    const next = (this.busy ?? Promise.resolve()).then(async () => {
      if (!this.running) return;
      try {
        await work();
      } catch (error) {
        this.handleError(error);
      }
    });
    this.busy = next.finally(() => {
      if (this.busy === next) this.busy = null;
    });
    return next;
  }

  private handleError(error: unknown) {
    if (error instanceof SyncHttpError) {
      if (error.code === 'offline') return this.setSync('offline');
      if (error.code === 'auth' || error.status === 401 || error.status === 403) {
        return this.setSync('error', { message: 'Reconecte o Google Drive nas configurações.' });
      }
    }
    console.error('[sync]', error);
    this.setSync('error', { message: error instanceof Error ? error.message : 'Falha ao sincronizar.' });
  }

  private async tick() {
    if (!navigator.onLine) return this.setSync('offline');
    this.childrenCache.clear();
    await this.flush();
    const index = await this.readAppIndex();
    await this.applyRemoteDeletions(index);
    const pulled = await this.pullRemoteChanges(index);
    // Never pull a project that is not here (e.g. just deleted): pulling would recreate its folder.
    if (this.activeProject && !pulled.has(this.activeProject) && (await getDb().projects.get(this.activeProject))) {
      await this.pull(this.activeProject);
    }
    const pending = await getDb().syncQueue.count();
    this.setSync(pending ? 'idle' : 'synced', { pending, lastSyncedAt: Date.now(), message: null });
  }

  /**
   * First run on this device/account: download projects that exist in Drive but were never
   * synced here, and queue a full upload of local projects Drive does not know yet.
   */
  private async initialSync() {
    const db = getDb();
    const remote = await this.readAppIndex();
    const remoteIds = new Set(remote?.projects.filter((p) => !p.deleted).map((p) => p.id) ?? []);
    const localIds = new Set(await db.projects.toCollection().primaryKeys());
    for (const project of await db.projects.toArray()) {
      const synced = await db.driveFiles.get(projectFileKey(project.id));
      if (synced) continue;
      if (remoteIds.has(project.id)) await this.pull(project.id);
      else await this.enqueueFullProject(project.id);
    }
    // New device: bring every project from Drive, so the person finds their work after login.
    const deleted = new Set(((await db.meta.get('deletedProjects'))?.value as string[] | undefined) ?? []);
    for (const id of remoteIds) {
      if (!localIds.has(id) && !deleted.has(id)) await this.pull(id);
    }
    await this.tick();
    useStatusStore.getState().setFirstSyncDone(true);
  }

  // ------------------------------------------------------------------ folders

  private async rootId(): Promise<string> {
    const db = getDb();
    const cached = (await db.meta.get('driveRootId'))?.value as string | undefined;
    if (cached) return cached;
    const { id } = await driveClient.root();
    await db.meta.put({ key: 'driveRootId', value: id });
    return id;
  }

  private async folderId(dirs: string[]): Promise<string> {
    const db = getDb();
    let parent = await this.rootId();
    for (let i = 0; i < dirs.length; i++) {
      const key = `dir:${dirs.slice(0, i + 1).join('/')}`;
      const cached = await db.driveFiles.get(key);
      if (cached) {
        parent = cached.fileId;
        continue;
      }
      const { id } = await driveClient.folder(dirs[i], parent);
      await db.driveFiles.put({ path: key, fileId: id, version: '' });
      parent = id;
    }
    return parent;
  }

  private async children(folderId: string) {
    const cached = this.childrenCache.get(folderId);
    if (cached) return cached;
    const files = await driveClient.children(folderId);
    this.childrenCache.set(folderId, files);
    return files;
  }

  // ------------------------------------------------------------------ push

  private async enqueueFullProject(projectId: string) {
    const db = getDb();
    const units: SyncUnit[] = ['project', 'explorer', 'assets'];
    const [recipes, assets] = await Promise.all([
      db.recipes.where('projectId').equals(projectId).primaryKeys(),
      db.assets.where('projectId').equals(projectId).primaryKeys(),
    ]);
    units.push(...recipes.map((id) => `recipe:${id}` as const));
    units.push(...assets.map((id) => `asset:${id}` as const));
    for (const unit of units) await enqueue(projectId, unit);
  }

  private async flush() {
    const db = getDb();
    const entries = await db.syncQueue.orderBy('queuedAt').toArray();
    if (!entries.length) return;
    this.setSync('syncing', { pending: entries.length });

    let indexDirty = false;
    let remaining = entries.length;
    const pushedRecipes = new Set<string>();
    for (const entry of entries) {
      if (!this.running) return;
      try {
        await this.pushEntry(entry);
      } catch (error) {
        const fatal = error instanceof SyncHttpError && (error.code === 'offline' || error.code === 'auth' || error.status === 429);
        if (fatal || entry.attempts + 1 < MAX_ATTEMPTS) {
          await db.syncQueue.update(entry.key, { attempts: entry.attempts + 1 });
          throw error;
        }
        // A file that keeps failing must not block the rest of the queue forever.
        await db.syncQueue.delete(entry.key);
        useStatusStore.getState().toast(`Não foi possível sincronizar um arquivo (${entry.unit}).`, 'error');
        continue;
      }
      if (entry.unit === 'project') indexDirty = true;
      if (entry.unit.startsWith('recipe:') && entry.op === 'put') pushedRecipes.add(entry.unit.slice(7));
      // Only drop the entry if no newer write replaced it while uploading.
      const current = await db.syncQueue.get(entry.key);
      if (current && current.queuedAt === entry.queuedAt) await db.syncQueue.delete(entry.key);
      this.setSync('syncing', { pending: --remaining });
    }
    if (indexDirty) await this.writeAppIndex();
    await this.refreshPublicCopies(pushedRecipes);
  }

  /** Recipes with a public link: their public copy follows every edit. */
  private async refreshPublicCopies(recipeIds: Set<string>) {
    for (const id of recipeIds) {
      const recipe = await getDb().recipes.get(id);
      if (!recipe?.publicFileId) continue;
      try {
        await this.publishSnapshot(id);
      } catch (error) {
        console.error('[sync] public copy', error);
      }
    }
  }

  private async pushEntry(entry: SyncQueueEntry) {
    const db = getDb();
    const { projectId, unit } = entry;

    if (unit === 'project' && entry.op === 'delete') {
      const dir = projectDirs(projectId).join('/');
      const folder = await db.driveFiles.get(`dir:${dir}`);
      if (folder) await driveClient.trash(folder.fileId).catch(ignoreNotFound);
      await db.driveFiles.filter((r) => r.path.includes(dir)).delete();
      const deleted = ((await db.meta.get('deletedProjects'))?.value as string[] | undefined) ?? [];
      await db.meta.put({ key: 'deletedProjects', value: [...new Set([...deleted, projectId])] });
      return;
    }

    if (unit.startsWith('public:')) {
      // The public copy of a deleted recipe.
      await driveClient.trash(unit.slice(7)).catch(ignoreNotFound);
      return;
    }

    if (entry.op === 'delete') {
      const key = locationKey(unitLocation(projectId, unit));
      const record = await db.driveFiles.get(key);
      if (record) await driveClient.trash(record.fileId).catch(ignoreNotFound);
      await db.driveFiles.delete(key);
      return;
    }

    const data = await serializeUnit(projectId, unit);
    if (!data) return; // Deleted locally after being queued.
    const loc = unitLocation(projectId, unit, data.mimeType);
    const key = locationKey(loc);
    const parentId = await this.folderId(loc.dirs);
    let record = await db.driveFiles.get(key);
    if (!record) {
      // Avoid duplicates: a file with this name may already exist (e.g. uploaded by another device).
      const existing = (await this.children(parentId)).find((f) => f.name === loc.name && f.mimeType !== FOLDER_MIME);
      if (existing) record = { path: key, fileId: existing.id, version: existing.version, md5: existing.md5Checksum };
    }

    const uploadWith = (fileId?: string, ifMd5?: string) =>
      driveClient.upload({ parentId, name: loc.name, fileId, ifMd5, body: data.body, mimeType: data.mimeType });

    let result: RemoteFile;
    try {
      result = await uploadWith(record?.fileId, record?.md5);
    } catch (error) {
      if (error instanceof SyncHttpError && error.status === 409 && record) {
        await this.keepConflictCopy(parentId, loc.name, record.fileId);
        result = await uploadWith(record.fileId, error.remote?.md5Checksum);
        useStatusStore
          .getState()
          .toast('Conflito de edição resolvido: a versão do Drive foi guardada como cópia “.conflict”.', 'info');
      } else if (error instanceof SyncHttpError && error.status === 404) {
        // File removed in Drive: recreate it.
        result = await uploadWith();
      } else {
        throw error;
      }
    }
    await db.driveFiles.put({ path: key, fileId: result.id, version: result.version, md5: result.md5Checksum });
  }

  private async keepConflictCopy(parentId: string, name: string, fileId: string) {
    const res = await driveClient.download(fileId);
    const blob = await res.blob();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const copyName = name.replace(/(\.[a-z0-9]+)$/i, `.conflict-${stamp}$1`);
    await driveClient.upload({ parentId, name: copyName, body: blob, mimeType: blob.type || 'application/json' });
  }

  // ------------------------------------------------------------------ app index

  private async readAppIndex(): Promise<AppIndexFile | null> {
    const db = getDb();
    const root = await this.rootId();
    const file = (await this.children(root)).find((f) => f.name === APP_INDEX_KEY);
    if (!file) return null;
    const data = await (await driveClient.download(file.id)).json();
    await db.driveFiles.put({ path: APP_INDEX_KEY, fileId: file.id, version: file.version, md5: file.md5Checksum });
    const parsed = AppIndexFileSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  }

  private async writeAppIndex() {
    const db = getDb();
    this.childrenCache.clear();
    const remote = await this.readAppIndex();
    const deleted = new Set(((await db.meta.get('deletedProjects'))?.value as string[] | undefined) ?? []);
    const local = await db.projects.toArray();
    const byId = new Map<string, AppIndexFile['projects'][number]>();
    for (const p of remote?.projects ?? []) if (!deleted.has(p.id)) byId.set(p.id, p);
    for (const p of local) byId.set(p.id, { id: p.id, name: p.name, updatedAt: p.updatedAt });
    for (const id of deleted) byId.set(id, { id, name: '', updatedAt: new Date().toISOString(), deleted: true });
    const index: AppIndexFile = { schemaVersion: SCHEMA_VERSION, projects: [...byId.values()] };
    const record = await db.driveFiles.get(APP_INDEX_KEY);
    const result = await driveClient.upload({
      parentId: await this.rootId(),
      name: APP_INDEX_KEY,
      fileId: record?.fileId,
      body: JSON.stringify(index, null, 1),
      mimeType: 'application/json',
    });
    await db.driveFiles.put({ path: APP_INDEX_KEY, fileId: result.id, version: result.version, md5: result.md5Checksum });
  }

  // ------------------------------------------------------------------ pull

  /** Downloads files of a caderno that changed in Drive since this device last saw them. */
  private async pull(projectId: string) {
    const db = getDb();
    const dirs = projectDirs(projectId);
    const projectDir = await this.folderId(dirs);
    const top = await this.children(projectDir);
    const sub = (name: string) => top.find((f) => f.name === name && f.mimeType === FOLDER_MIME);
    const remote: { unit: SyncUnit; file: RemoteFile }[] = [];

    for (const f of top) {
      const unit = f.mimeType === FOLDER_MIME ? null : unitFromRemote('root', f.name);
      if (unit) remote.push({ unit, file: f });
    }
    const recipesFolder = sub(RECIPES_DIR);
    if (recipesFolder) {
      await db.driveFiles.put({ path: `dir:${[...dirs, RECIPES_DIR].join('/')}`, fileId: recipesFolder.id, version: '' });
      for (const f of await this.children(recipesFolder.id)) {
        if (f.name.includes('.conflict-')) continue;
        const unit = unitFromRemote(RECIPES_DIR, f.name);
        if (unit) remote.push({ unit, file: f });
      }
    }
    if (!remote.length) return;

    const pending = new Set((await db.syncQueue.where('projectId').equals(projectId).toArray()).map((e) => e.unit));
    for (const { unit, file } of remote) {
      const key = locationKey(unitLocation(projectId, unit));
      const record = await db.driveFiles.get(key);
      if (pending.has(unit) || (record && sameContent(record, file))) continue;
      const data = await (await driveClient.download(file.id)).json();
      await applyRemoteUnit(projectId, unit, data);
      await db.driveFiles.put({ path: key, fileId: file.id, version: file.version, md5: file.md5Checksum });
    }

    // Recipes deleted on another device.
    const remoteKeys = new Set(remote.map((r) => locationKey(unitLocation(projectId, r.unit))));
    const prefix = `${[...dirs, RECIPES_DIR].join('/')}/`;
    const stale = await db.driveFiles.filter((r) => r.path.startsWith(prefix) && !remoteKeys.has(r.path)).toArray();
    for (const rec of stale) {
      const id = rec.path.split('/').pop()!.replace(/\.json$/, '');
      if (pending.has(`recipe:${id}`)) continue;
      await db.recipes.delete(id);
      await db.driveFiles.delete(rec.path);
    }

    await this.pullMissingAssets(projectId, sub(ASSETS_DIR));
  }

  private async pullMissingAssets(projectId: string, assetsFolder: RemoteFile | undefined) {
    if (!assetsFolder) return;
    const db = getDb();
    const assets = await db.assets.where('projectId').equals(projectId).toArray();
    const missing = [];
    for (const a of assets) if (!(await db.assetBlobs.get(a.id))) missing.push(a);
    if (!missing.length) return;
    const kinds = await this.children(assetsFolder.id);
    for (const asset of missing) {
      const loc = unitLocation(projectId, `asset:${asset.id}`, asset.mimeType);
      const kindFolder = kinds.find((k) => k.name === loc.dirs.at(-1));
      if (!kindFolder) continue;
      const file = (await this.children(kindFolder.id)).find((f) => f.name === loc.name);
      if (!file) continue;
      const blob = await (await driveClient.download(file.id)).blob();
      await db.assetBlobs.put({ id: asset.id, blob });
      await db.driveFiles.put({ path: locationKey(loc), fileId: file.id, version: file.version, md5: file.md5Checksum });
    }
  }

  /**
   * Projects created or changed on another device (per app-index.json) are downloaded, even
   * when they are not open here. Returns the ids pulled.
   */
  private async pullRemoteChanges(index: AppIndexFile | null) {
    const db = getDb();
    const pulled = new Set<string>();
    const deleted = new Set(((await db.meta.get('deletedProjects'))?.value as string[] | undefined) ?? []);
    for (const remote of index?.projects ?? []) {
      if (remote.deleted || deleted.has(remote.id)) continue;
      const local = await db.projects.get(remote.id);
      if (local && remote.updatedAt <= local.updatedAt) continue;
      await this.pull(remote.id);
      pulled.add(remote.id);
    }
    return pulled;
  }

  /** Cadernos deleted on another device disappear here too (unless edited here meanwhile). */
  private async applyRemoteDeletions(index: AppIndexFile | null) {
    const db = getDb();
    for (const p of index?.projects ?? []) {
      if (!p.deleted || !(await db.projects.get(p.id))) continue;
      const pending = await db.syncQueue.where('projectId').equals(p.id).count();
      if (!pending) await deleteProject(p.id);
    }
  }
}

/** Whether the remote file still has the content this device last saw. */
function sameContent(record: { version: string; md5?: string }, file: RemoteFile) {
  if (record.md5 && file.md5Checksum) return record.md5 === file.md5Checksum;
  return record.version === file.version;
}

function ignoreNotFound(error: unknown) {
  if (error instanceof SyncHttpError && error.status === 404) return;
  throw error;
}

export const syncEngine = new SyncEngine();
