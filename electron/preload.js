const { contextBridge, ipcRenderer } = require('electron');

// The renderer gets exactly two things: a way to know it is running in the
// desktop shell (so the UI can inset for the title bar), and menu navigation.
contextBridge.exposeInMainWorld('signature', {
  isDesktop: true,
  platform: process.platform,
  /** Repaints the window-button strip when the theme changes. */
  setTitleBarTheme: (theme) => ipcRenderer.send('signature:titlebar-theme', theme),
  /** Opens the journal folder in the OS file browser. */
  openDataFolder: () => ipcRenderer.invoke('signature:open-data-folder'),
  onNavigate: (handler) => {
    const listener = (_event, route) => handler(route);
    ipcRenderer.on('signature:navigate', listener);
    return () => ipcRenderer.off('signature:navigate', listener);
  },
});
