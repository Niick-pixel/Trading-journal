export {};

declare global {
  interface Window {
    /** Injected by electron/preload.js. Absent when running in a browser. */
    signature?: {
      isDesktop: true;
      platform: NodeJS.Platform;
      onNavigate: (handler: (route: string) => void) => () => void;
    };
  }
}
