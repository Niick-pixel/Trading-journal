'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { press, spring, springSnappy, stagger } from '@/lib/motion';

interface SelectProps<T extends string> {
  value: T | null;
  onChange: (value: T) => void;
  options: readonly T[];
  placeholder?: string;
  /** 'r g b' triple — tints the glow and the selected option. */
  accent?: string;
  /** Optional per-option colour, e.g. reason hues. */
  accentFor?: (option: T) => string | undefined;
  disabled?: boolean;
  id?: string;
}

/**
 * A custom dropdown — rounded, blurred, spring-scaled open, options staggered.
 * Deliberately not a native <select>: those can't be blurred, animated, or
 * tinted per option.
 */
export function Select<T extends string>({
  value, onChange, options, placeholder = 'Select…', accent = 'var(--accent)', accentFor, disabled, id,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Click-away and Escape both close.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) setActive(Math.max(0, value ? options.indexOf(value) : 0));
  }, [open, value, options]);

  const commit = (option: T) => { onChange(option); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault(); setOpen(true); return;
    }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % options.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length); }
    else if (e.key === 'Enter') { e.preventDefault(); commit(options[active]); }
  };

  const glowing = open || hovered;
  const activeAccent = (value && accentFor?.(value)) || accent;

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        whileTap={disabled ? undefined : press}
        transition={spring}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        animate={{
          boxShadow: glowing
            ? `var(--shadow-card), 0 0 20px rgb(${activeAccent} / 0.30)`
            : 'var(--shadow-card), 0 0 0px rgb(0 0 0 / 0)',
          borderColor: glowing ? `rgb(${activeAccent} / 0.55)` : 'var(--glass-stroke)',
        }}
        className="glass flex w-full items-center justify-between gap-3 rounded-[14px] px-4 py-2.5
          text-left text-[13px] disabled:opacity-40"
        style={{ color: value ? 'var(--text)' : 'var(--text-faint)' }}
      >
        <span className="truncate">{value ?? placeholder}</span>
        <motion.svg
          width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden
          animate={{ rotate: open ? 180 : 0 }} transition={springSnappy}
          style={{ color: 'var(--text-faint)', flexShrink: 0 }}
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={spring}
            style={{ transformOrigin: 'top center', boxShadow: 'var(--shadow-panel)' }}
            className="glass absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-[18px] p-1.5"
          >
            {options.map((option, i) => {
              const optionAccent = accentFor?.(option) ?? accent;
              const selected = option === value;
              return (
                <motion.li
                  key={option}
                  role="option"
                  aria-selected={selected}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={stagger(i)}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => commit(option)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[11px] px-3 py-2 text-[13px]"
                  style={{
                    background: i === active ? `rgb(${optionAccent} / 0.16)` : 'transparent',
                    color: selected ? `rgb(${optionAccent})` : 'var(--text)',
                  }}
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{
                      background: selected ? `rgb(${optionAccent})` : 'transparent',
                      boxShadow: selected ? `0 0 8px rgb(${optionAccent} / 0.8)` : undefined,
                    }}
                  />
                  <span className="truncate">{option}</span>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
