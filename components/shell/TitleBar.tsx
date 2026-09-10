'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';

const TABS = [
  { href: '/', label: 'Whiteboard' },
  { href: '/stats', label: 'Stats' },
] as const;

/**
 * The window's own chrome. Electron hides the native title bar so the glass can
 * run to the edge, which means this strip has to provide the drag region — and
 * on macOS, leave room for the traffic lights.
 */
export function TitleBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [platform, setPlatform] = useState<string | null>(null);

  useEffect(() => {
    setPlatform(window.signature?.platform ?? null);
    // Menu items (Cmd+N and friends) navigate through the preload bridge.
    return window.signature?.onNavigate((route) => router.push(route));
  }, [router]);

  const isMac = platform === 'darwin';

  return (
    <header
      className="titlebar-drag flex h-11 shrink-0 items-center justify-between gap-4 px-4"
      style={{ paddingLeft: isMac ? 88 : 16 }}
    >
      <nav className="flex items-center gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link key={tab.href} href={tab.href} className="relative rounded-full px-3.5 py-1.5 text-[12px] font-medium"
              style={{ color: active ? 'var(--text)' : 'var(--text-faint)' }}>
              {active && (
                <motion.span
                  layoutId="titlebar-tab"
                  transition={spring}
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'var(--glass-fill-strong)', border: '1px solid var(--glass-stroke)' }}
                />
              )}
              <span className="relative">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <motion.div whileTap={press} transition={spring}>
        <Link
          href="/new"
          className="glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium"
          style={{ color: 'var(--text)' }}
        >
          <span className="text-[13px] leading-none">+</span> New trade
        </Link>
      </motion.div>
    </header>
  );
}
