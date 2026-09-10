import 'server-only';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, DB_PATH } from '../lib/paths';
import { migrate } from './migrate';

/**
 * SQLite comes from `node:sqlite`, built into Node itself.
 *
 * This used to be better-sqlite3, which is a native C++ addon. That meant a
 * prebuilt binary had to exist for your exact platform and Node ABI — and when
 * one doesn't, npm silently falls back to compiling from source, which on
 * Windows demands a full Visual Studio C++ toolchain. Using the runtime's own
 * SQLite removes that entire class of problem: no compiler, no prebuild
 * roulette, no rebuild step when Electron updates, and nothing to package.
 */
export type Db = DatabaseSync;

// One connection per process, cached across dev-server hot reloads.
const globalForDb = globalThis as unknown as { __signatureDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (globalForDb.__signatureDb) return globalForDb.__signatureDb;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);

  // WAL keeps reads from blocking the write that a capture does.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA synchronous = NORMAL');

  migrate(db);

  globalForDb.__signatureDb = db;
  return db;
}
