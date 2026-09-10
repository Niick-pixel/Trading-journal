export function Field({
  label, hint, children, className = '',
}: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.07em]"
        style={{ color: 'var(--text-faint)' }}>
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px]" style={{ color: 'var(--text-faint)' }}>{hint}</span>}
    </label>
  );
}

/** A plain glass input, used for the numeric execution fields. */
export function Input({ className = '', ...rest }: React.ComponentProps<'input'>) {
  return (
    <input
      {...rest}
      className={`glass w-full rounded-[14px] px-4 py-2.5 text-[13px] outline-none
        placeholder:text-[color:var(--text-faint)] focus:border-[rgb(var(--accent)/0.5)] ${className}`}
      style={{ color: 'var(--text)' }}
    />
  );
}
