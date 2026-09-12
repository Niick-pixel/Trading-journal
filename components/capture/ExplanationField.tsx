'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { useGlowState } from '@/components/ui/Field';
import { MIN_EXPLANATION } from '@/lib/types';

interface ExplanationFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** An optional field drops the counter and the minimum. */
  required?: boolean;
  /** The floor this particular field has to clear. */
  minChars?: number;
  minRows?: number;
}

/** Auto-growing textarea with a character counter that earns its keep. */
export function ExplanationField({
  value, onChange, placeholder, required = true, minChars = MIN_EXPLANATION, minRows = 4,
}: ExplanationFieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const glow = useGlowState();

  // Grow to fit content. Reset to auto first or the box can only ever get taller.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const length = value.trim().length;
  const remaining = minChars - length;
  const met = remaining <= 0;

  return (
    <div>
      <motion.div
        className="glass overflow-hidden rounded-[18px]"
        animate={glow.animate}
        transition={glow.transition}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={minRows}
          {...glow.handlers}
          className="w-full resize-none bg-transparent px-4 py-3.5 text-[13px] leading-relaxed outline-none
            placeholder:text-[color:var(--text-faint)]"
          style={{ color: 'var(--text)' }}
        />
      </motion.div>

      {required && (
        <div className="mt-2 flex items-center justify-between gap-4 text-[11px] tabular-nums">
          <motion.span
            animate={{ color: met ? 'var(--text-faint)' : 'rgb(var(--amber))' }}
            transition={spring}
          >
            {met ? 'Minimum met' : `${remaining} more character${remaining === 1 ? '' : 's'}`}
          </motion.span>
          <span style={{ color: 'var(--text-faint)' }}>{length} / {minChars}</span>
        </div>
      )}
    </div>
  );
}
