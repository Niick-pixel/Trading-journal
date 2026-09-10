'use client';

import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';

const WIN = 'var(--outcome-win)';
const LOSS = 'var(--outcome-loss)';

export interface BarRow {
  label: string;
  /** The number the bar length is drawn from. */
  value: number;
  /** What to print at the end of the bar. */
  display: string;
  /** Secondary text, e.g. trade count. */
  meta?: string;
  accent?: string;
  /** Draws a ring around the row — used for Diagonal trendline. */
  highlight?: boolean;
}

/**
 * A signed horizontal bar chart with a zero line down the middle. Losses run
 * left, wins run right, so a column of leaks is legible at a glance without
 * reading a single number.
 */
export function SignedBars({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));

  return (
    <div className="space-y-2.5">
      {rows.map((row, i) => {
        const negative = row.value < 0;
        const width = (Math.abs(row.value) / max) * 50;
        const accent = row.accent ?? (negative ? LOSS : WIN);

        return (
          <div
            key={row.label}
            className="relative rounded-[12px] px-2 py-1.5"
            style={row.highlight
              ? { background: 'rgb(var(--accent) / 0.09)', boxShadow: 'inset 0 0 0 1px rgb(var(--accent) / 0.35)' }
              : undefined}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[12px]" style={{ color: row.highlight ? 'rgb(var(--accent))' : 'var(--text)' }}>
                {row.label}
              </span>
              <span className="shrink-0 tabular-nums text-[12px] font-semibold" style={{ color: `rgb(${accent})` }}>
                {row.display}
                {row.meta && <span className="ml-1.5 font-normal" style={{ color: 'var(--text-faint)' }}>{row.meta}</span>}
              </span>
            </div>

            <div className="relative h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--glass-fill)' }}>
              {/* The zero line sits dead centre; bars grow out from it. */}
              <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: 'var(--glass-stroke)' }} />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ ...spring, delay: i * 0.03 }}
                className="absolute inset-y-0 rounded-full"
                style={{
                  background: `rgb(${accent} / 0.85)`,
                  boxShadow: `0 0 10px rgb(${accent} / 0.5)`,
                  ...(negative ? { right: '50%' } : { left: '50%' }),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Unsigned 0-100% bars, for win rates. */
export function RateBars({ rows }: { rows: BarRow[] }) {
  return (
    <div className="space-y-2.5">
      {rows.map((row, i) => (
        <div key={row.label} className="px-2 py-1.5">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-[12px]">{row.label}</span>
            <span className="shrink-0 tabular-nums text-[12px] font-semibold"
              style={{ color: `rgb(${row.accent ?? WIN})` }}>
              {row.display}
              {row.meta && <span className="ml-1.5 font-normal" style={{ color: 'var(--text-faint)' }}>{row.meta}</span>}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--glass-fill)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(100, row.value))}%` }}
              transition={{ ...spring, delay: i * 0.03 }}
              className="h-full rounded-full"
              style={{
                background: `rgb(${row.accent ?? WIN} / 0.85)`,
                boxShadow: `0 0 10px rgb(${row.accent ?? WIN} / 0.5)`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="glass rounded-[24px] p-6"
    >
      <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
      {note && <p className="mb-4 mt-1 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>{note}</p>}
      <div className={note ? '' : 'mt-4'}>{children}</div>
    </motion.section>
  );
}
