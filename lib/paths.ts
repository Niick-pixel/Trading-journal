import path from 'node:path';

/**
 * Everything Signature owns lives under ./data. Back up that one directory and
 * you have backed up the entire journal.
 */
export const DATA_DIR = path.join(process.cwd(), 'data');
export const DB_PATH = path.join(DATA_DIR, 'journal.db');
export const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');
