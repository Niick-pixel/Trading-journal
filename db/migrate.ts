import fs from 'node:fs';
import path from 'node:path';
import type BetterSqlite3 from 'better-sqlite3';
import { DATA_DIR, SCREENSHOTS_DIR } from '../lib/paths';

const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

/**
 * Applies any migration file that hasn't run yet, in filename order, each in
 * its own transaction. Runs on boot; a fresh checkout with no ./data gets a
 * complete database and nothing else — no seed data, by design.
 */
export function migrate(db: BetterSqlite3.Database): void {
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
    db.transaction(() => {
      db.exec(sql);
      record.run(file);
    })();
    console.log(`[signature] applied migration ${file}`);
  }
}
