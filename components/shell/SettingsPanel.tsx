'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { press, spring, springSoft } from '@/lib/motion';
import { Button } from '@/components/ui/Button';

interface Info {
  dataDir: string;
  trades: number;
  oldest: string | null;
}

/**
 * Deliberately small. The only setting that matters in a local-only app is
 * where your data is — so this tells you, and offers to open the folder.
 */
export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch('/api/settings').then((r) => r.json()).then(setInfo).catch(() => setInfo(null));
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={spring} onClick={onClose}
            className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.35)' }}
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={springSoft}
            style={{ transformOrigin: 'bottom left' }}
            className="glass absolute bottom-full left-0 z-50 mb-3 w-[22rem] rounded-[22px] p-5"
          >
            <h2 className="text-[14px] font-semibold tracking-tight">Settings</h2>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
                Your journal lives here
              </div>
              <p className="mt-1.5 break-all rounded-[12px] p-2.5 text-[11px] leading-relaxed"
                style={{ background: 'var(--glass-fill)', border: '1px solid var(--glass-stroke)' }}>
                {info?.dataDir ?? 'Loading…'}
              </p>
              <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
                Back up that one folder and you have backed up everything — the database
                and every chart screenshot.
              </p>
            </div>

            <div className="mt-4 flex items-baseline justify-between text-[12px]">
              <span style={{ color: 'var(--text-faint)' }}>Trades recorded</span>
              <span className="tabular-nums font-semibold">{info?.trades ?? '—'}</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {typeof window !== 'undefined' && window.signature?.isDesktop && (
                <Button onClick={() => window.signature?.openDataFolder()}>Open folder</Button>
              )}
              <Button
                onClick={async () => {
                  if (!info?.dataDir) return;
                  try {
                    await navigator.clipboard.writeText(info.dataDir);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1600);
                  } catch { /* clipboard blocked; the path is on screen anyway */ }
                }}
              >
                {copied ? 'Copied' : 'Copy path'}
              </Button>
              <Button onClick={onClose} className="ml-auto">Done</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** The bottom-left cluster: theme above settings, on every screen. */
export function BottomLeftControls({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-4 left-4 z-30 flex flex-col items-start gap-2">
        <SettingsPanel open={open} onClose={() => setOpen(false)} />
        {children}
        <motion.button
          type="button"
          onClick={() => setOpen((o) => !o)}
          whileTap={press}
          whileHover={{ y: -1 }}
          transition={spring}
          aria-label="Settings"
          title="Settings"
          className="glass grid size-[34px] place-items-center rounded-full"
          style={{ color: 'var(--text-dim)' }}
        >
          {/* Sliders, not a cog. A spoked circle sits directly above the sun of
              the theme toggle and reads as a second one. */}
          <motion.svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden
            animate={{ rotate: open ? 90 : 0 }} transition={spring}>
            <path d="M3 6h5M12 6h5M3 14h9M16 14h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="10" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="14" cy="14" r="2" stroke="currentColor" strokeWidth="1.6" />
          </motion.svg>
        </motion.button>
      </div>
    </>
  );
}
