'use client';

import { motion } from 'framer-motion';
import { press, spring, springBouncy } from '@/lib/motion';

interface RubricSliderProps {
  label: string;
  hint?: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  accent?: string;
}

/**
 * A segmented slider: one tappable segment per score, with the filled bar
 * sliding on a spring. Discrete rubric scores deserve discrete controls — a
 * continuous range input would imply precision the rubric doesn't have.
 */
export function RubricSlider({ label, hint, value, max, onChange, accent = 'var(--accent)' }: RubricSliderProps) {
  const steps = Array.from({ length: max + 1 }, (_, i) => i);

  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] font-medium">{label}</div>
          {hint && <div className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>{hint}</div>}
        </div>
        <motion.span
          key={value}
          initial={{ scale: 0.7, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springBouncy}
          className="shrink-0 tabular-nums text-[13px] font-semibold"
          style={{ color: `rgb(${accent})` }}
        >
          {value}<span style={{ color: 'var(--text-faint)' }}>/{max}</span>
        </motion.span>
      </div>

      <div
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(max, value + 1)); }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, value - 1)); }
        }}
        className="flex gap-1.5 rounded-full outline-none focus-visible:ring-2"
        style={{ ['--tw-ring-color' as string]: `rgb(${accent} / 0.5)` }}
      >
        {steps.map((step) => {
          const filled = step <= value;
          return (
            <motion.button
              key={step}
              type="button"
              aria-label={`${label} ${step}`}
              onClick={() => onChange(step)}
              whileTap={press}
              animate={{
                background: filled ? `rgb(${accent} / ${0.35 + (step / max) * 0.55})` : 'var(--glass-fill)',
                boxShadow: filled ? `0 0 14px rgb(${accent} / 0.35)` : '0 0 0 rgb(0 0 0 / 0)',
              }}
              transition={spring}
              className="h-2.5 flex-1 rounded-full border"
              style={{ borderColor: filled ? 'transparent' : 'var(--glass-stroke)' }}
            />
          );
        })}
      </div>
    </div>
  );
}
