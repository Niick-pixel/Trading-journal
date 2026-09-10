'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { press, spring, springBouncy } from '@/lib/motion';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'signature:theme';

/**
 * Light is the default and the app never follows the OS setting — dark is
 * something you have to ask for. The choice is stored per machine.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) ?? 'light';
    setTheme(current);
    // The window-button strip is painted by the shell, not by CSS.
    window.signature?.setTitleBarTheme(current);
  }, []);

  const flip = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    window.signature?.setTitleBarTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private window — the choice just won't stick */
    }
  };

  const dark = theme === 'dark';

  return (
    <motion.button
      type="button"
      onClick={flip}
      whileTap={press}
      whileHover={{ y: -1 }}
      transition={spring}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="glass grid size-[34px] place-items-center rounded-full"
      style={{ color: 'var(--text-dim)' }}
    >
      <motion.svg
        key={theme}
        width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
        initial={{ scale: 0.5, rotate: -60, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={springBouncy}
      >
        {dark ? (
          <path d="M13.2 9.6A5.6 5.6 0 016.4 2.8a5.6 5.6 0 106.8 6.8z"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        ) : (
          <>
            <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2L3.1 3.1"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </>
        )}
      </motion.svg>
    </motion.button>
  );
}
