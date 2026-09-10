import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Signature',
  description: 'Local-only iFVG trade journal.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
