// `npm run migrate` — applies migrations without booting Next.
import { getDb } from './index';
import { DB_PATH } from '../lib/paths';

getDb();
console.log(`[signature] database is up to date at ${DB_PATH}`);
