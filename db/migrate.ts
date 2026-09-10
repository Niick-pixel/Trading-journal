import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, SCREENSHOTS_DIR } from '../lib/paths';

const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

/**
 * Applies any migration file that hasn't run yet, in filename order, each in
 * its own transaction. Runs on boot; a fresh checkout with no ./data gets a
 * complete database and nothing else — no seed data, by design.
 */
export function migrate(db: DatabaseSync): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map((r) => (r as { name: string }).name),
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const record = db.prepare('INSERT INTO schema_migrations (name) VALUES (?)');

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    // node:sqlite has no transaction() helper, so drive it by hand — and roll
    // back on failure so a half-applied migration can never be recorded.
    db.exec('BEGIN');
    try {
      db.exec(sql);
      record.run(file);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    console.log(`[signature] applied migration ${file}`);
  }
}
