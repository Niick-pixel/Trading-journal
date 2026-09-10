import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths';

/**
 * Appends a failure to data/errors.log.
 *
 * A packaged desktop app has no terminal to print to, so when something breaks
 * the only evidence is whatever the UI happens to show. That was one generic
 * sentence, which made a real bug unnecessarily hard to diagnose. Now every
 * server-side failure leaves a dated line on disk, next to the journal.
 */
export function logError(where: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && error.stack ? `\n${error.stack}` : '';
  const line = `[${new Date().toISOString()}] ${where}: ${message}${stack}\n\n`;

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(path.join(DATA_DIR, 'errors.log'), line);
  } catch {
    /* logging must never be the thing that breaks the request */
  }

  console.error(`[signature] ${where}:`, error);
  return message;
}
