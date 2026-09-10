export {};

declare global {
  interface Window {
    /** Injected by electron/preload.js. Absent when running in a browser. */
    signature?: {
      isDesktop: true;
      platform: NodeJS.Platform;
      setTitleBarTheme: (theme: 'light' | 'dark') => void;
      openDataFolder: () => Promise<string>;
      onNavigate: (handler: (route: string) => void) => () => void;
    };
  }
}
