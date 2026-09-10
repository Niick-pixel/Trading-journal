// Signature runs in its own window. The renderer is a Next.js server that this
// process starts and owns — nothing is ever served to an outside browser, and
// the server dies with the window.

const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

const isDev = !app.isPackaged;
const ROOT = path.join(__dirname, '..');

/** Chrome's window ground, so the frame never flashes white before React paints. */
const SHELL_BG = '#0a0a0c';

let nextServer = null;
let mainWindow = null;

/** Ask the OS for a free port so two copies never fight over 3000. */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(port, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error(`Next.js did not start on port ${port} within ${timeoutMs / 1000}s`));
        else setTimeout(attempt, 150);
      });
    };
    attempt();
  });
}

/**
 * Resolve a Node binary to run the Next server with.
 *
 * This matters more than it looks: better-sqlite3 is a native module compiled
 * against system Node's ABI. Electron bundles its own Node at a different ABI,
 * so running the server under ELECTRON_RUN_AS_NODE would demand an
 * electron-rebuild step for every Electron upgrade. The database is only ever
 * touched by the Next server process, never by Electron's main or renderer —
 * so we spawn that process with real Node and the ABI problem disappears.
 */
function resolveNode() {
  const candidates = process.platform === 'win32' ? ['node.exe', 'node'] : ['node'];
  for (const candidate of candidates) {
    const found = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (!found.error) return candidate;
  }
  return null;
}

function startNext(port) {
  const bin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  const node = resolveNode();

  // Falling back to Electron-as-Node keeps the app launchable, but the native
  // sqlite binding will only load if it was rebuilt for Electron's ABI.
  const command = node ?? process.execPath;
  const env = { ...process.env, NODE_ENV: isDev ? 'development' : 'production' };
  if (!node) env.ELECTRON_RUN_AS_NODE = '1';

  nextServer = spawn(command, [bin, isDev ? 'dev' : 'start', '-p', String(port)], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  nextServer.stdout.on('data', (d) => process.stdout.write(`[next] ${d}`));
  nextServer.stderr.on('data', (d) => process.stderr.write(`[next] ${d}`));
  nextServer.on('exit', (code) => {
    nextServer = null;
    // If the server dies while the window is open, the app is useless — say so.
    if (code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox('Signature stopped', `The local server exited with code ${code}. Restart the app.`);
    }
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: SHELL_BG,
    // Let the glass surfaces run to the edge; the traffic lights float over them.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay: process.platform === 'darwin'
      ? undefined
      : { color: SHELL_BG, symbolColor: '#8b8b93', height: 44 },
    trafficLightPosition: process.platform === 'darwin' ? { x: 18, y: 20 } : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  // No white flash: wait until the first frame is actually ready.
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Any real link opens in the user's browser, not inside the app frame.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Trade', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('signature:navigate', '/new') },
        { label: 'Whiteboard', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.webContents.send('signature:navigate', '/') },
        { label: 'Stats', accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.webContents.send('signature:navigate', '/stats') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    // Paste must stay wired up — pasting a chart out of TradingView is the
    // primary way trades get into this app.
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]));
}

// One window, one instance. A second launch focuses the first.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const port = await freePort();
    startNext(port);
    try {
      await waitForServer(port);
    } catch (err) {
      dialog.showErrorBox('Signature could not start', String(err.message));
      app.quit();
      return;
    }
    buildMenu();
    createWindow(port);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
    });
  });

  app.on('window-all-closed', () => app.quit());
  // The server is ours; never leave it running after the window is gone.
  app.on('before-quit', () => nextServer?.kill());
  process.on('exit', () => nextServer?.kill());
}
