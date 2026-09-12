'use client';

import { motion } from 'framer-motion';
import { CHECKLIST_PHASES, TAKE_IT_THRESHOLD, type ChecklistKey } from '@/lib/domain';
import { press, spring, springBouncy } from '@/lib/motion';

interface ChecklistProps {
  answers: Record<ChecklistKey, boolean>;
  onChange: (key: ChecklistKey, value: boolean) => void;
  accent?: string;
}

/**
 * The plan's checklist, weighted exactly as written.
 *
 * Each row carries its own point value because the weights are the argument:
 * a clear sweep is worth four times a clean path, and seeing that while
 * answering is the difference between scoring a trade and rationalising one.
 */
export function Checklist({ answers, onChange, accent = 'var(--accent)' }: ChecklistProps) {
  return (
    <div className="space-y-5 xl:grid xl:grid-cols-3 xl:items-start xl:gap-6 xl:space-y-0">
      {CHECKLIST_PHASES.map((phase) => {
        const earned = phase.items.reduce((sum, i) => sum + (answers[i.key] ? i.points : 0), 0);
        const possible = phase.items.reduce((sum, i) => sum + i.points, 0);

        return (
          <div key={phase.phase}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.07em]"
                style={{ color: 'var(--text-faint)' }}>
                {phase.phase}
              </span>
              <motion.span
                key={earned}
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={springBouncy}
                className="tabular-nums text-[11px] font-semibold"
                style={{ color: earned === possible ? `rgb(${accent})` : 'var(--text-faint)' }}
              >
                {earned}/{possible}
              </motion.span>
            </div>

            {phase.note && (
              <p className="mb-2.5 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
                {phase.note}
              </p>
            )}

            <div className="space-y-1.5">
              {phase.items.map((item) => {
                const on = answers[item.key];
                return (
                  <motion.button
                    key={item.key}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => onChange(item.key, !on)}
                    whileTap={press}
                    animate={{
                      borderColor: on ? `rgb(${accent} / 0.55)` : 'var(--glass-stroke)',
                      background: on ? `rgb(${accent} / 0.10)` : 'var(--glass-fill)',
                      boxShadow: on ? `0 0 18px rgb(${accent} / 0.20)` : '0 0 0 rgb(0 0 0 / 0)',
                    }}
                    transition={spring}
                    className="flex w-full items-start gap-3 rounded-[14px] border px-3.5 py-2.5 text-left"
                  >
                    <span className="relative mt-0.5 grid size-[17px] shrink-0 place-items-center">
                      <motion.span
                        className="absolute inset-0 rounded-[5px]"
                        animate={{
                          background: on ? `rgb(${accent} / 0.22)` : 'var(--glass-fill-strong)',
                          scale: on ? 1 : 0.88,
                        }}
                        transition={springBouncy}
                      />
                      <motion.svg
                        width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden className="relative"
                        style={{ color: `rgb(${accent})` }}
                        animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }}
                        transition={springBouncy}
                      >
                        <path d="M1 4.6L4 7.5L10 1.5" stroke="currentColor" strokeWidth="1.9"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </motion.svg>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium leading-snug"
                        style={{ color: on ? 'var(--text)' : 'var(--text-dim)' }}>
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
                          {item.hint}
                        </span>
                      )}
                    </span>

                    <span className="shrink-0 tabular-nums text-[11px] font-semibold"
                      style={{ color: on ? `rgb(${accent})` : 'var(--text-faint)' }}>
                      {item.points}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="text-[11px] leading-relaxed xl:col-span-3" style={{ color: 'var(--text-faint)' }}>
        Phase 3 must fire for an entry to exist. At {TAKE_IT_THRESHOLD} or more with the trigger
        fired, taking it is the rule — hesitating is a rule break, same as oversizing.
      </p>
    </div>
  );
}
