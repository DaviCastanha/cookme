/**
 * End-to-end sync test: two "devices" (separate IndexedDB databases and engines) talk to the
 * same in-memory fake of the /api/drive proxy.
 */
import crypto from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CookMeDB, setDbForTests } from '@/lib/db/database';
import { buildTutorialBundle } from '@/lib/mock/seed';
import * as repo from '@/lib/repository';
import { SyncEngine } from './syncEngine';

// ---------------------------------------------------------------- fake Drive

interface FakeFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  version: number;
  content: string;
  trashed: boolean;
}

class FakeDrive {
  files = new Map<string, FakeFile>();
  private seq = 0;

  private create(name: string, parent: string, mimeType: string, content = ''): FakeFile {
    const file = { id: `f${++this.seq}`, name, mimeType, parents: [parent], version: 1, content, trashed: false };
    this.files.set(file.id, file);
    return file;
  }

  meta = (f: FakeFile) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    version: String(f.version),
    md5Checksum: md5(f.content),
    modifiedTime: '',
  });

  /** Real Drive bumps `version` for server-side changes that do not touch the content. */
  bumpVersions() {
    for (const f of this.files.values()) f.version += 3;
  }

  findFolder(name: string, parent: string) {
    return [...this.files.values()].find(
      (f) => !f.trashed && f.name === name && f.parents[0] === parent && f.mimeType === 'application/vnd.google-apps.folder',
    );
  }

  /** Lists live files by logical path, e.g. "CookMe/cadernos/<id>/caderno.json". */
  paths(): string[] {
    const pathOf = (f: FakeFile): string => {
      const parent = this.files.get(f.parents[0]);
      return parent ? `${pathOf(parent)}/${f.name}` : f.name;
    };
    return [...this.files.values()].filter((f) => this.isLive(f) && !f.mimeType.includes('folder')).map(pathOf);
  }

  /** Like Drive: trashing a folder trashes everything inside it. */
  isLive(f: FakeFile): boolean {
    if (f.trashed) return false;
    const parent = this.files.get(f.parents[0]);
    return parent ? this.isLive(parent) : true;
  }

  fileAt(path: string) {
    return [...this.files.values()].find((f) => !f.trashed && this.paths().includes(path) && pathMatches(this, f, path));
  }

  async handle(url: URL, init: RequestInit = {}): Promise<Response> {
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const method = init.method ?? 'GET';
    const p = url.pathname;
    if (p === '/api/drive/root') {
      const f = this.findFolder('CookMe', 'root') ?? this.create('CookMe', 'root', 'application/vnd.google-apps.folder');
      return json({ id: f.id });
    }
    if (p === '/api/drive/folder') {
      const { name, parentId } = JSON.parse(String(init.body));
      const f = this.findFolder(name, parentId) ?? this.create(name, parentId, 'application/vnd.google-apps.folder');
      return json({ id: f.id });
    }
    if (p === '/api/drive/children') {
      const parent = url.searchParams.get('parentId');
      return json({ files: [...this.files.values()].filter((f) => !f.trashed && f.parents[0] === parent).map(this.meta) });
    }
    if (p.startsWith('/api/drive/files/')) {
      const f = this.files.get(decodeURIComponent(p.split('/').pop()!));
      if (!f || f.trashed) return json({ error: 'not found' }, 404);
      if (method === 'DELETE') {
        f.trashed = true;
        return json({ ok: true });
      }
      return new Response(f.content, { headers: { 'Content-Type': f.mimeType } });
    }
    if (p === '/api/drive/upload') {
      const q = url.searchParams;
      const body = init.body instanceof Blob ? await init.body.text() : String(init.body);
      const fileId = q.get('fileId');
      if (fileId) {
        const f = this.files.get(fileId);
        if (!f || f.trashed) return json({ error: 'not found' }, 404);
        const expected = q.get('ifMd5');
        if (expected && md5(f.content) !== expected && md5(f.content) !== md5(body)) {
          return json({ error: 'conflict', code: 'conflict', remote: this.meta(f) }, 409);
        }
        f.content = body;
        f.version++;
        return json(this.meta(f));
      }
      const mime = (init.headers as Record<string, string>)['Content-Type'];
      return json(this.meta(this.create(q.get('name')!, q.get('parentId')!, mime, body)));
    }
    return json({ error: 'unknown route' }, 404);
  }
}

const md5 = (text: string) => crypto.createHash('md5').update(text).digest('hex');

function pathMatches(drive: FakeDrive, file: FakeFile, path: string) {
  const parts: string[] = [];
  let current: FakeFile | undefined = file;
  while (current) {
    parts.unshift(current.name);
    current = drive.files.get(current.parents[0]);
  }
  return parts.join('/') === path;
}

// ---------------------------------------------------------------- devices

interface Device {
  db: CookMeDB;
  engine: SyncEngine;
}

function device(name: string): Device {
  const db = new CookMeDB(`${name}-${Math.random()}`);
  const engine = new SyncEngine();
  // Tests drive syncing explicitly; no background timers.
  (engine as unknown as { schedule: () => void }).schedule = () => {};
  return { db, engine };
}

/** Runs `fn` with the device's database as the active one. */
async function on<T>(d: Device, fn: () => Promise<T>): Promise<T> {
  setDbForTests(d.db);
  return fn();
}

async function sync(d: Device) {
  await on(d, () => d.engine.syncNow());
}

let drive: FakeDrive;
const devices: Device[] = [];

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.window = { addEventListener() {}, removeEventListener() {} };
  g.document = { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' };
  Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
  g.fetch = (input: string | URL, init?: RequestInit) => drive.handle(new URL(String(input), 'http://local'), init);
});

afterEach(() => {
  devices.splice(0).forEach((d) => d.engine.stop());
});

async function startDevice(name: string, seed?: (d: Device) => Promise<void>) {
  const d = device(name);
  devices.push(d);
  if (seed) await on(d, () => seed(d));
  await on(d, () => d.engine.start('cozinheira@example.com'));
  await sync(d);
  return d;
}

const demo = buildTutorialBundle();
const PID = demo.project.id;
const ROOT = `CookMe/cadernos/${PID}`;
const BOLO = 'recipe_tut_bolo_cenoura';
const text = (t: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });

describe('Drive sync', () => {
  it('uploads a local caderno with the documented file layout', async () => {
    drive = new FakeDrive();
    await startDevice('a', () => repo.importBundle(demo, { enqueueSync: false }));
    const paths = drive.paths();
    expect(paths).toContain('CookMe/app-index.json');
    expect(paths).toContain(`${ROOT}/caderno.json`);
    expect(paths).toContain(`${ROOT}/pastas.json`);
    expect(paths).toContain(`${ROOT}/arquivos.json`);
    expect(paths).toContain(`${ROOT}/receitas/${BOLO}.json`);
    expect(paths.some((p) => p.includes('search-index'))).toBe(false);
    const index = JSON.parse(drive.fileAt('CookMe/app-index.json')!.content);
    expect(index.projects).toEqual([expect.objectContaining({ id: PID, name: 'Caderno de exemplo' })]);
  });

  it('uploads photos and downloads them on another device', async () => {
    drive = new FakeDrive();
    let assetId = '';
    await startDevice('a', async () => {
      await repo.importBundle(demo, { enqueueSync: false });
      const asset = await repo.addAsset(PID, new Blob(['fake-jpeg'], { type: 'image/jpeg' }), 'bolo.jpg');
      assetId = asset.id;
      await repo.saveRecipe(BOLO, { coverAssetId: asset.id });
    });
    expect(drive.paths()).toContain(`${ROOT}/arquivos/fotos/${assetId}.jpg`);
    const b = await startDevice('b');
    expect((await on(b, () => repo.getRecipe(BOLO)))?.coverAssetId).toBe(assetId);
    const blob = await on(b, () => repo.getAssetBlob(assetId));
    expect(blob && (await blob.text())).toBe('fake-jpeg');
  });

  it('downloads cadernos on a new device and propagates edits both ways', async () => {
    drive = new FakeDrive();
    const a = await startDevice('a', () => repo.importBundle(demo, { enqueueSync: false }));
    const b = await startDevice('b');

    // Logging in on a new device brings the cadernos from Drive automatically.
    expect(await on(b, () => repo.listItems(PID))).toHaveLength(demo.items.length);
    expect((await on(b, () => repo.getRecipe(BOLO)))?.time).toBe('1h10');

    // B edits a recipe → A pulls it.
    await on(b, () => repo.saveRecipe(BOLO, { time: '1h' }));
    await sync(b);
    on(a, async () => a.engine.setActiveProject(PID));
    await sync(a);
    expect((await on(a, () => repo.getRecipe(BOLO)))?.time).toBe('1h');

    // A deletes a recipe → B removes it on pull.
    await on(a, () => repo.deleteItem('recipe_tut_brigadeiro'));
    await sync(a);
    on(b, async () => b.engine.setActiveProject(PID));
    await sync(b);
    expect(await on(b, () => repo.getRecipe('recipe_tut_brigadeiro'))).toBeUndefined();
    expect((await on(b, () => repo.listItems(PID))).some((i) => i.id === 'recipe_tut_brigadeiro')).toBe(false);
  });

  it('brings cadernos created on another device to a device that is already open', async () => {
    drive = new FakeDrive();
    const a = await startDevice('a', () => repo.importBundle(demo, { enqueueSync: false }));
    const b = await startDevice('b');
    const created = await on(a, () => repo.createProject('Criado no computador'));
    await sync(a);
    // No restart on B: a regular sync cycle must be enough.
    await sync(b);
    expect((await on(b, () => repo.getProject(created.id)))?.name).toBe('Criado no computador');
    expect((await on(b, () => repo.listItems(created.id))).length).toBeGreaterThan(0);
  });

  it('updates cadernos that are not open on the other device', async () => {
    drive = new FakeDrive();
    const a = await startDevice('a', () => repo.importBundle(demo, { enqueueSync: false }));
    const b = await startDevice('b');
    await on(a, () => repo.saveRecipe(BOLO, { servings: '16 fatias' }));
    await on(a, () => repo.renameProject(PID, 'Exemplo renomeado'));
    await sync(a);
    await sync(b); // B has no caderno open.
    expect((await on(b, () => repo.getRecipe(BOLO)))?.servings).toBe('16 fatias');
    expect((await on(b, () => repo.getProject(PID)))?.name).toBe('Exemplo renomeado');
  });

  it('does not report a conflict when Drive only bumps the version number', async () => {
    drive = new FakeDrive();
    const a = await startDevice('a', () => repo.importBundle(demo, { enqueueSync: false }));
    for (const t of ['primeira', 'segunda', 'terceira']) {
      await on(a, () => repo.saveRecipeContent(BOLO, text(t)));
      drive.bumpVersions();
      await sync(a);
    }
    expect(drive.paths().some((p) => p.includes('.conflict-'))).toBe(false);
    expect(drive.fileAt(`${ROOT}/receitas/${BOLO}.json`)!.content).toContain('terceira');
  });

  it('resolves a concurrent edit by keeping a conflict copy of the Drive version', async () => {
    drive = new FakeDrive();
    const a = await startDevice('a', () => repo.importBundle(demo, { enqueueSync: false }));
    const b = await startDevice('b');

    // Both edit the same recipe before syncing.
    await on(a, () => repo.saveRecipeContent(BOLO, text('versão A')));
    await on(b, () => repo.saveRecipeContent(BOLO, text('versão B')));
    await sync(b);
    await sync(a);

    const folder = `${ROOT}/receitas/`;
    const main = JSON.parse(drive.fileAt(`${folder}${BOLO}.json`)!.content);
    expect(JSON.stringify(main.content)).toContain('versão A');
    const copies = drive.paths().filter((p) => p.startsWith(`${folder}${BOLO}.conflict-`));
    expect(copies).toHaveLength(1);
    expect(drive.fileAt(copies[0])!.content).toContain('versão B');
  });

  it('propagates a caderno deletion to other devices', async () => {
    drive = new FakeDrive();
    const a = await startDevice('a', () => repo.importBundle(demo, { enqueueSync: false }));
    const b = await startDevice('b');
    expect(await on(b, () => repo.getProject(PID))).toBeDefined();
    await on(a, () => repo.deleteProject(PID));
    await sync(a);
    await sync(b);
    expect(await on(b, () => repo.getProject(PID))).toBeUndefined();
    await sync(b);
    expect(drive.paths().some((p) => p.includes(`cadernos/${PID}/`))).toBe(false);
  });

  it('moves a deleted caderno folder to the trash and marks it deleted in the index', async () => {
    drive = new FakeDrive();
    const a = await startDevice('a', () => repo.importBundle(demo, { enqueueSync: false }));
    await on(a, () => repo.deleteProject(PID));
    await sync(a);
    expect(drive.paths().some((p) => p.includes(`cadernos/${PID}/`))).toBe(false);
    const index = JSON.parse(drive.fileAt('CookMe/app-index.json')!.content);
    expect(index.projects.find((p: { id: string }) => p.id === PID)?.deleted).toBe(true);
  });
});
