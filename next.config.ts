import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — it must stay external to the bundle.
  serverExternalPackages: ['better-sqlite3'],

  // The Electron shell loads the app over 127.0.0.1 while Next's dev server
  // binds localhost, so HMR is cross-origin by Next's reckoning. Allow it, or
  // the desktop window silently loses hot reload.
  allowedDevOrigins: ['127.0.0.1'],

  // You asked for no telemetry. Next also collects its own, anonymously —
  // NEXT_TELEMETRY_DISABLED in .env.local turns that off as well.
  agentRules: false,
};

export default nextConfig;
