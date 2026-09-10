// Signature runs in its own window. The renderer is a Next.js server that this
// process starts and owns — nothing is ever served to an outside browser, and
// the server dies with the window.

const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

const isDev = !app.isPackaged;
const ROOT = path.join(__dirname, '..');

/**
 * Where the journal lives.
 *
 * Running from source it is ./data, beside the code. In a packaged build it
 * sits next to the executable, which is what makes the portable build actually
 * portable: copy Signature.exe onto a USB stick, and its data/ folder travels
 * with it. Nothing is written to AppData or the registry.
 */
function resolveDataDir() {
  if (!app.isPackaged) return path.join(ROOT, 'data');

  // A portable build is a self-extracting archive: it unpacks itself into a
  // temp folder and runs from there, so process.execPath points at %TEMP%,
  // not at the executable the user actually double-clicked. Writing the
  // journal there means it is thrown away when the temp folder is cleaned.
  // electron-builder exports the real location for exactly this reason.
  const beside = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  const candidate = path.join(beside, 'data');

  // Beside the executable is only the right answer if it is actually writable.
  // Dropped into Program Files, or onto a read-only volume, it is not — and a
  // journal that silently fails to save is worse than one in an unexpected
  // place. Fall back to the per-user application data directory and say so.
  try {
    fs.mkdirSync(candidate, { recursive: true });
    fs.accessSync(candidate, fs.constants.W_OK);
    return candidate;
  } catch {
    const fallback = path.join(app.getPath('userData'), 'data');
    fs.mkdirSync(fallback, { recursive: true });
    console.warn(`[signature] ${candidate} is not writable; using ${fallback}`);
    return fallback;
  }
}

const DATA_DIR = resolveDataDir();

/** In a packaged build the app is unpacked under resources/app. */
const APP_DIR = app.isPackaged ? path.join(process.resourcesPath, 'app') : ROOT;

/** The window ground. Signature defaults to light, so the frame must too —
 *  otherwise the shell flashes black before React paints. */
const SHELL_BG = '#ececed';

let nextServer = null;
let mainWindow = null;
/** Last few lines of server output, so a startup failure can explain itself. */
let serverLog = [];
let serverExited = null;

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
      // If the server has already died there is nothing to wait for. Without
      // this the app hangs for the full timeout and then reports a timeout,
      // hiding the real reason (most often: a `npm run dev` server is already
      // running against this directory, which Next refuses to duplicate).
      if (serverExited !== null) {
        reject(new Error(serverLog.join('').trim() || `The local server exited with code ${serverExited}.`));
        return;
      }
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

function startNext(port) {
  // In development Next runs from its CLI; a packaged build runs the standalone
  // server that `next build` emits, which carries only the dependencies it
  // actually needs.
  const entry = app.isPackaged
    ? path.join(APP_DIR, '.next', 'standalone', 'server.js')
    : path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');

  const args = app.isPackaged ? [entry] : [entry, 'dev', '-p', String(port)];

  // Run the server on Electron's own bundled Node (24.x), not a system install.
  //
  // This used to shell out to whatever `node` was on PATH, because the database
  // was a native addon compiled against system Node's ABI. Now that SQLite comes
  // from node:sqlite — built into the runtime — that constraint is gone, and
  // using Electron's Node means the app depends on nothing outside its own
  // folder. That is what makes a portable build possible.
  nextServer = spawn(process.execPath, args, {
    cwd: app.isPackaged ? path.join(APP_DIR, '.next', 'standalone') : ROOT,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: isDev ? 'development' : 'production',
      // process.cwd() means nothing in a packaged app, so hand the server its
      // paths explicitly rather than letting it guess.
      SIGNATURE_DATA_DIR: DATA_DIR,
      SIGNATURE_MIGRATIONS_DIR: path.join(APP_DIR, 'db', 'migrations'),
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Keep the tail of the server's output so a startup failure can explain itself.
  const record = (d) => {
    serverLog.push(String(d));
    if (serverLog.length > 40) serverLog.shift();
  };

  nextServer.stdout.on('data', (d) => { record(d); process.stdout.write(`[next] ${d}`); });
  nextServer.stderr.on('data', (d) => { record(d); process.stderr.write(`[next] ${d}`); });
  nextServer.on('exit', (code) => {
    nextServer = null;
    serverExited = code;
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
      : { ...TITLE_BAR.light, height: 44 },
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

/**
 * Windows and Linux draw their window buttons onto a strip we colour ourselves.
 * Set once at creation it stays light forever, so switching the app to dark
 * left a white slab in the corner. The renderer tells us when the theme flips.
 */
const TITLE_BAR = {
  light: { color: '#ececed', symbolColor: '#5c5c66' },
  dark: { color: '#08080b', symbolColor: '#8b8b93' },
};

ipcMain.on('signature:titlebar-theme', (_event, theme) => {
  if (process.platform === 'darwin' || !mainWindow || mainWindow.isDestroyed()) return;
  const palette = TITLE_BAR[theme === 'dark' ? 'dark' : 'light'];
  try {
    mainWindow.setTitleBarOverlay({ ...palette, height: 44 });
  } catch {
    /* not every platform supports a title bar overlay */
  }
});

// The Settings panel offers to reveal the journal folder; only the main
// process can talk to the OS file browser.
ipcMain.handle('signature:open-data-folder', async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  await shell.openPath(DATA_DIR);
  return DATA_DIR;
});

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
