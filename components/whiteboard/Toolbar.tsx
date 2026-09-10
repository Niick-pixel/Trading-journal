'use client';

import { motion } from 'framer-motion';
import { OUTCOMES, SESSIONS, type Outcome, type Session } from '@/lib/domain';
import { GRADE_MAX } from '@/lib/grade';
import { press, spring } from '@/lib/motion';
import { OUTCOME_COLOR } from './TradeNode';

export interface Filters {
  from: string;
  to: string;
  outcomes: Outcome[];
  sessions: Session[];
  minGrade: number;
}

export const EMPTY_FILTERS: Filters = { from: '', to: '', outcomes: [], sessions: [], minGrade: 0 };

export function filtersActive(f: Filters): boolean {
  return Boolean(f.from || f.to || f.outcomes.length || f.sessions.length || f.minGrade > 0);
}

/** Filtering never removes a node — it re-runs the layout so positions animate. */
export function applyFilters(filters: Filters) {
  return (t: { date: string; outcome: Outcome; session: Session; grade_total: number }) => {
    if (filters.from && t.date < filters.from) return false;
    if (filters.to && t.date > `${filters.to}T23:59`) return false;
    if (filters.outcomes.length && !filters.outcomes.includes(t.outcome)) return false;
    if (filters.sessions.length && !filters.sessions.includes(t.session)) return false;
    if (t.grade_total < filters.minGrade) return false;
    return true;
  };
}

function Chip({
  label, active, accent = 'var(--accent)', onClick,
}: { label: string; active: boolean; accent?: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={press}
      animate={{
        background: active ? `rgb(${accent} / 0.18)` : 'transparent',
        borderColor: active ? `rgb(${accent} / 0.55)` : 'var(--glass-stroke)',
        color: active ? `rgb(${accent})` : 'var(--text-dim)',
      }}
      transition={spring}
      className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
    >
      {label}
    </motion.button>
  );
}

export function Toolbar({
  filters, onChange, shown, total,
}: { filters: Filters; onChange: (next: Filters) => void; shown: number; total: number }) {
  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <motion.div
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring}
      className="glass pointer-events-auto flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-[20px] px-4 py-2.5"
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>Outcome</span>
        {OUTCOMES.map((o) => (
          <Chip key={o} label={o === 'Not taken' ? 'Passed' : o} accent={OUTCOME_COLOR[o]}
            active={filters.outcomes.includes(o)}
            onClick={() => onChange({ ...filters, outcomes: toggle(filters.outcomes, o) })} />
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>Session</span>
        {SESSIONS.map((s) => (
          <Chip key={s} label={s} active={filters.sessions.includes(s)}
            onClick={() => onChange({ ...filters, sessions: toggle(filters.sessions, s) })} />
        ))}
      </div>

      <label className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
          Grade ≥ <span className="tabular-nums" style={{ color: 'var(--text-dim)' }}>{filters.minGrade}</span>
        </span>
        <input
          type="range" min={0} max={GRADE_MAX} value={filters.minGrade}
          onChange={(e) => onChange({ ...filters, minGrade: Number(e.target.value) })}
          className="w-20 accent-[rgb(var(--accent))]"
        />
      </label>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>Dates</span>
        <input type="date" value={filters.from} onChange={(e) => onChange({ ...filters, from: e.target.value })}
          className="rounded-lg border px-2 py-1 text-[11px]"
          style={{ borderColor: 'var(--glass-stroke)', background: 'transparent', color: 'var(--text-dim)' }} />
        <input type="date" value={filters.to} onChange={(e) => onChange({ ...filters, to: e.target.value })}
          className="rounded-lg border px-2 py-1 text-[11px]"
          style={{ borderColor: 'var(--glass-stroke)', background: 'transparent', color: 'var(--text-dim)' }} />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="tabular-nums text-[11px]" style={{ color: 'var(--text-faint)' }}>
          {shown === total ? `${total} trades` : `${shown} of ${total}`}
        </span>
        {filtersActive(filters) && (
          <motion.button
            type="button" onClick={() => onChange(EMPTY_FILTERS)} whileTap={press} transition={spring}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-full border px-2.5 py-1 text-[11px]"
            style={{ borderColor: 'var(--glass-stroke)', color: 'var(--text-dim)' }}
          >
            Clear
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
