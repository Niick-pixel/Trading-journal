'use client';

import { motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';
import { MISTAKE_TAGS, type MistakeTag } from '@/lib/domain';

interface TagPickerProps {
  value: MistakeTag[];
  onChange: (v: MistakeTag[]) => void;
}

/**
 * Multi-select, because a bad trade usually has three.
 *
 * A single dropdown forced one mistake to stand for the whole story — "entered
 * late" and "chased" and "oversized" are one event, and picking one of them
 * throws the other two away along with the pattern they would have shown.
 */
export function TagPicker({ value, onChange }: TagPickerProps) {
  const toggle = (tag: MistakeTag) =>
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);

  return (
    <div className="flex flex-wrap gap-2">
      {MISTAKE_TAGS.map((tag) => {
        const on = value.includes(tag);
        return (
          <motion.button
            key={tag}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(tag)}
            whileTap={press}
            animate={{
              borderColor: on ? 'rgb(var(--outcome-loss) / 0.55)' : 'var(--glass-stroke)',
              background: on ? 'rgb(var(--outcome-loss) / 0.12)' : 'var(--glass-fill)',
              boxShadow: on ? '0 0 14px rgb(var(--outcome-loss) / 0.20)' : '0 0 0 rgb(0 0 0 / 0)',
            }}
            transition={spring}
            className="rounded-full border px-3 py-1.5 text-[12px] font-medium"
            style={{ color: on ? 'rgb(var(--outcome-loss))' : 'var(--text-dim)' }}
          >
            {tag}
          </motion.button>
        );
      })}
    </div>
  );
}
