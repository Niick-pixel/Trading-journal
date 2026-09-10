import {
  DIRECTIONS, HTF_BIASES, INSTRUMENTS, OUTCOMES, PREMIUM_DISCOUNTS, REASONS, RUBRIC,
  SESSIONS, SETUP_TYPES, TARGET_TYPES,
} from './domain';
import { MIN_EXPLANATION, type TradeInput } from './types';

/**
 * Validates a trade payload before it reaches SQLite. The CHECK constraints in
 * the schema are the real backstop — this exists so the UI gets a sentence it
 * can show instead of a constraint name.
 */
export function parseTradeInput(raw: unknown): { ok: true; value: TradeInput } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Malformed trade payload.' };
  const t = raw as Record<string, unknown>;

  const oneOf = <T extends string>(field: string, allowed: readonly T[]): T | null => {
    const v = t[field];
    return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : null;
  };
  const bool = (field: string) => t[field] === true;
  const numOrNull = (field: string): number | null => {
    const v = t[field];
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const score = (field: keyof typeof RUBRIC): number | null => {
    const n = Number(t[field]);
    return Number.isInteger(n) && n >= 0 && n <= RUBRIC[field].max ? n : null;
  };

  const reason = oneOf('reason', REASONS);
  if (!reason) return { ok: false, error: 'A reason is required — name why you took the trade.' };

  const explanation = typeof t.explanation === 'string' ? t.explanation.trim() : '';
  if (explanation.length < MIN_EXPLANATION) {
    return { ok: false, error: `The explanation needs at least ${MIN_EXPLANATION} characters.` };
  }

  const screenshot_path = typeof t.screenshot_path === 'string' ? t.screenshot_path : '';
  if (!screenshot_path) return { ok: false, error: 'A screenshot is required.' };

  const instrument = oneOf('instrument', INSTRUMENTS);
  const direction = oneOf('direction', DIRECTIONS);
  const session = oneOf('session', SESSIONS);
  const setup_type = oneOf('setup_type', SETUP_TYPES);
  const htf_bias = oneOf('htf_bias', HTF_BIASES);
  const premium_discount = oneOf('premium_discount', PREMIUM_DISCOUNTS);
  const target_type = oneOf('target_type', TARGET_TYPES);
  const outcome = oneOf('outcome', OUTCOMES);

  const missing = Object.entries({
    instrument, direction, session, setup_type, htf_bias, premium_discount, target_type, outcome,
  }).filter(([, v]) => v === null).map(([k]) => k);
  if (missing.length) return { ok: false, error: `Invalid or missing: ${missing.join(', ')}.` };

  const candle_strength = score('candle_strength');
  const inversion_speed = score('inversion_speed');
  const risk_reward = score('risk_reward');
  if (candle_strength === null || inversion_speed === null || risk_reward === null) {
    return { ok: false, error: 'Grade scores are out of range.' };
  }

  const date = typeof t.date === 'string' && !Number.isNaN(new Date(t.date).getTime())
    ? t.date : null;
  if (!date) return { ok: false, error: 'Invalid date.' };

  return {
    ok: true,
    value: {
      date,
      instrument: instrument!, direction: direction!, session: session!,
      macro_time: bool('macro_time'), macro_time_auto: t.macro_time_auto !== false,
      reason, setup_type: setup_type!, htf_bias: htf_bias!,
      sweep_before_entry: bool('sweep_before_entry'),
      singular_gap: bool('singular_gap'),
      target_unswept: bool('target_unswept'),
      premium_discount: premium_discount!, target_type: target_type!, smt: bool('smt'),
      candle_strength, inversion_speed, risk_reward,
      contracts: numOrNull('contracts'),
      risk_dollars: numOrNull('risk_dollars'),
      stop_points: numOrNull('stop_points'),
      outcome: outcome!,
      r_multiple: numOrNull('r_multiple'),
      explanation,
      lesson: typeof t.lesson === 'string' && t.lesson.trim() ? t.lesson.trim() : null,
      screenshot_path,
    },
  };
}
