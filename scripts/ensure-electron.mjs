// Makes sure the Electron binary is actually on disk before launching.
//
// `npm install electron` normally downloads it from a postinstall hook, but
// that hook doesn't always run — some registry proxies and corporate mirrors
// strip install scripts, and `npm ci --ignore-scripts` skips them by design.
// When it's missing, `npm run desktop` fails with a cryptic message about
// deleting node_modules. This checks, repairs, and gets out of the way.

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronDir = path.join(root, 'node_modules', 'electron');
const pathFile = path.join(electronDir, 'path.txt');

if (!existsSync(electronDir)) {
  console.error('[signature] electron is not installed. Run `npm install` first.');
  process.exit(1);
}

// electron writes path.txt during its install; the binary sits beside dist/.
const binary = existsSync(pathFile)
  ? path.join(electronDir, 'dist', readFileSync(pathFile, 'utf8').trim())
  : null;

if (binary && existsSync(binary)) process.exit(0);

console.log('[signature] Electron binary missing — downloading it now (~230 MB, one time)…');
try {
  execFileSync(process.execPath, ['install.js'], { cwd: electronDir, stdio: 'inherit' });
} catch {
  console.error('[signature] Could not download Electron. Check your network, then re-run `npm run desktop`.');
  console.error('[signature] In the meantime `npm run dev` serves the same app in a browser tab.');
  process.exit(1);
}
