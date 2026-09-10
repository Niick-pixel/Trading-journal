import 'server-only';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { DATA_DIR, DB_PATH } from '../lib/paths';
import { migrate } from './migrate';

// One connection per process, cached across dev-server hot reloads.
const globalForDb = globalThis as unknown as { __signatureDb?: Database.Database };

export function getDb(): Database.Database {
  if (globalForDb.__signatureDb) return globalForDb.__signatureDb;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);

  // WAL keeps reads from blocking the write that a capture does.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  migrate(db);

  globalForDb.__signatureDb = db;
  return db;
}
