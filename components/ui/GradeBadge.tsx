'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { GRADE_COLOR, gradeLetter, isBelowStandard, BELOW_STANDARD_PROMPT } from '@/lib/grade';
import { spring, springBouncy } from '@/lib/motion';

const AMBER = '251 191 36';

interface GradeBadgeProps {
  total: number;
  max: number;
  /** 'lg' is the live badge in the capture form; 'sm' rides in a node corner. */
  size?: 'sm' | 'md' | 'lg';
  /** Show the "below your standard" nudge when the total is <= 5. */
  showPrompt?: boolean;
}

/** Letter big, number small. Glows in its grade colour. */
export function GradeBadge({ total, max, size = 'md', showPrompt = false }: GradeBadgeProps) {
  const letter = gradeLetter(total);
  const below = isBelowStandard(total);
  // Below standard, the badge goes amber regardless of the letter's own colour.
  const color = below && showPrompt ? AMBER : GRADE_COLOR[letter];

  const dims = {
    sm: { box: 'size-9 rounded-[11px]', letter: 'text-[13px]', num: 'text-[8px]' },
    md: { box: 'size-12 rounded-[14px]', letter: 'text-lg', num: 'text-[9px]' },
    lg: { box: 'size-20 rounded-[20px]', letter: 'text-[34px]', num: 'text-[11px]' },
  }[size];

  return (
    <div className="flex items-center gap-3.5">
      <motion.div
        // Re-keying on the letter makes the badge pop each time the grade
        // actually changes, not on every slider tick.
        key={letter}
        initial={{ scale: 0.72 }}
        animate={{ scale: 1 }}
        transition={springBouncy}
        className={`glass grid shrink-0 place-items-center leading-none ${dims.box}`}
        style={{
          borderColor: `rgb(${color} / 0.5)`,
          boxShadow: `var(--shadow-card), 0 0 24px rgb(${color} / 0.35)`,
          color: `rgb(${color})`,
        }}
      >
        <span className={`font-semibold tracking-tight ${dims.letter}`}>{letter}</span>
        <span className={`mt-0.5 tabular-nums ${dims.num}`} style={{ color: 'var(--text-faint)' }}>
          {total}/{max}
        </span>
      </motion.div>

      <AnimatePresence>
        {showPrompt && below && (
          <motion.p
            initial={{ opacity: 0, x: -8, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.98 }}
            transition={spring}
            className="max-w-[19rem] text-[13px] font-medium leading-snug"
            style={{ color: `rgb(${AMBER})` }}
          >
            {BELOW_STANDARD_PROMPT}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
