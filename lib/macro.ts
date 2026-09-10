/**
 * Macro windows: :50-:10 and :20-:40 around the hour.
 * Derived from the entry timestamp, overridable by hand when the time logged
 * is approximate (see `macro_time_auto` in the schema).
 */

export type MacroWindow = ':50–:10' | ':20–:40';

export function macroWindowFor(date: Date | string): MacroWindow | null {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const m = d.getMinutes();
  if (m >= 50 || m <= 10) return ':50–:10';
  if (m >= 20 && m <= 40) return ':20–:40';
  return null;
}

export function isMacroTime(date: Date | string): boolean {
  return macroWindowFor(date) !== null;
}
