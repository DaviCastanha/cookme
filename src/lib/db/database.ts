import Dexie, { type EntityTable } from 'dexie';
import type { Asset, ExplorerItem, Project, Recipe } from '@/lib/schemas';

/** A unit of data that maps 1:1 to a file in Drive (see features/sync/units.ts). */
export type SyncUnit = 'project' | 'explorer' | 'assets' | `recipe:${string}` | `asset:${string}`;

export interface SyncQueueEntry {
  /** `${projectId}|${unit}` — one pending entry per file, later writes overwrite earlier ones. */
  key: string;
  projectId: string;
  unit: SyncUnit;
  op: 'put' | 'delete';
  queuedAt: number;
  attempts: number;
}

export interface DriveFileRecord {
  /** Logical path, e.g. `cadernos/<pid>/receitas/<id>.json`. */
  path: string;
  fileId: string;
  /** Drive `version` of the file the last time we read or wrote it. */
  version: string;
  /** Content checksum the last time we read or wrote it (used for conflict detection). */
  md5?: string;
}

export interface AssetBlob {
  id: string;
  blob: Blob;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class CookMeDB extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  items!: EntityTable<ExplorerItem, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  assets!: EntityTable<Asset, 'id'>;
  assetBlobs!: EntityTable<AssetBlob, 'id'>;
  syncQueue!: EntityTable<SyncQueueEntry, 'key'>;
  driveFiles!: EntityTable<DriveFileRecord, 'path'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor(name = 'cookme') {
    super(name);
    this.version(1).stores({
      projects: 'id, updatedAt',
      items: 'id, projectId, parentId',
      recipes: 'id, projectId',
      assets: 'id, projectId',
      assetBlobs: 'id',
      syncQueue: 'key, projectId, queuedAt',
      driveFiles: 'path',
      meta: 'key',
    });
  }
}

/**
 * One local database per Google account (plus one for local-only mode), so two people using
 * the same browser never see — or sync — each other's cadernos.
 */
const instances = new Map<string, CookMeDB>();
let activeName = 'cookme';
let override: CookMeDB | null = null;

export function dbNameFor(account: string | null) {
  return account ? `cookme:${account.toLowerCase()}` : 'cookme';
}

/** Must be called before rendering any data for an account (see AuthGate). */
export function setActiveAccount(account: string | null) {
  activeName = dbNameFor(account);
}

export function getDb(): CookMeDB {
  if (override) return override;
  let db = instances.get(activeName);
  if (!db) {
    db = new CookMeDB(activeName);
    instances.set(activeName, db);
  }
  return db;
}

/** Test helper: point the app at a fresh database. */
export function setDbForTests(db: CookMeDB) {
  override = db;
}
