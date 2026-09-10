'use client';

import { motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';

type Variant = 'primary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'text-[color:var(--bg)]',
  ghost: 'text-[color:var(--text)]',
  danger: 'text-[rgb(248_113_113)]',
};

export function Button({
  variant = 'ghost',
  accent = 'var(--accent)',
  className = '',
  children,
  ...rest
}: React.ComponentProps<typeof motion.button> & { variant?: Variant; accent?: string }) {
  const isPrimary = variant === 'primary';
  return (
    <motion.button
      type="button"
      whileTap={press}
      whileHover={{ y: -1 }}
      transition={spring}
      className={`relative select-none rounded-[14px] px-5 py-2.5 text-[13px] font-medium
        disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      style={{
        background: isPrimary ? `rgb(${accent})` : 'var(--glass-fill)',
        border: `1px solid ${isPrimary ? 'transparent' : 'var(--glass-stroke)'}`,
        backdropFilter: isPrimary ? undefined : 'var(--glass-blur)',
        boxShadow: isPrimary ? `0 8px 24px -8px rgb(${accent} / 0.6)` : 'var(--shadow-card)',
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
