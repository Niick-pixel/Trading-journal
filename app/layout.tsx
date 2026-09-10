import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Signature',
  description: 'Local-only iFVG trade journal.',
};

/**
 * Applied before first paint so a dark-mode user never sees a white flash (and,
 * far more importantly here, a light-mode user never sees a dark one).
 * Light is the default; the OS setting is deliberately ignored.
 */
const THEME_BOOTSTRAP = `
try {
  if (localStorage.getItem('signature:theme') === 'dark') {
    document.documentElement.dataset.theme = 'dark';
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The bootstrap script below sets data-theme before React hydrates, which
    // is by definition a server/client mismatch on this one element.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
