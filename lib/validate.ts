import {
  ACCOUNTS, CHECKLIST_KEYS, CONTEXT_FLAGS, DIRECTIONS, HTF_BIASES, INSTRUMENTS, MISTAKE_TAGS,
  OUTCOMES, PREMIUM_DISCOUNTS, REASONS, REGRADES, SESSIONS, SETUP_TYPES, SKIP_REASONS,
  TARGET_TYPES, TRADE_STATUSES,
  type ChecklistKey, type ContextFlag, type MistakeTag, type Tri,
} from './domain';
import { MIN_EXPLANATION, MIN_LESSON, type TradeInput } from './types';

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
  /**
   * Tri-state. Anything that is not an explicit true or false is unanswered —
   * which is the honest reading of a payload from an older client that never
   * had the question, and of a form the user did not touch.
   */
  const tri = (field: string): Tri => {
    const v = t[field];
    return v === true || v === false ? v : null;
  };
  const numOrNull = (field: string): number | null => {
    const v = t[field];
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const clamp = (n: number | null, lo: number, hi: number): number | null =>
    n == null ? null : Math.min(hi, Math.max(lo, Math.round(n)));

  /** Risk is a magnitude. A negative one silently turns every loss into a win. */
  const positiveOrNull = (field: string): number | null => {
    const n = numOrNull(field);
    return n == null || n < 0 ? null : n;
  };

  const reason = oneOf('reason', REASONS);
  if (!reason) return { ok: false, error: 'A reason is required — name why you took the trade.' };

  const explanation = typeof t.explanation === 'string' ? t.explanation.trim() : '';
  if (explanation.length < MIN_EXPLANATION) {
    return { ok: false, error: `The explanation needs at least ${MIN_EXPLANATION} characters.` };
  }

  /*
    A lesson is required once the trade has a result to learn from. Planned
    entries are exempt: there is nothing to conclude yet, and a forced
    conclusion about a trade that has not happened is worse than none.
  */
  const lesson = typeof t.lesson === 'string' ? t.lesson.trim() : '';
  const planned = t.status === 'Planned';
  if (!planned && lesson.length < MIN_LESSON) {
    return {
      ok: false,
      error: `The lesson needs at least ${MIN_LESSON} characters — what would you do differently?`,
    };
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
      // Every context flag, read the same way. Anything absent is simply false,
      // which is what an older client or an older row means by omitting it.
      ...(Object.fromEntries(CONTEXT_FLAGS.map((f) => [f, bool(f)])) as Record<ContextFlag, boolean>),
      premium_discount: premium_discount!, target_type: target_type!,
      // Every checklist answer, read the same way; absent means false, which is
      // what an older client or an unanswered box means.
      ...(Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, bool(k)])) as Record<ChecklistKey, boolean>),
      followed_rules: tri('followed_rules'),
      regrade: oneOf('regrade', REGRADES),
      // Legacy single tag. Nothing writes it any more; it is preserved so the
      // values saved under the old taxonomy are not silently erased on edit.
      mistake_tag: typeof t.mistake_tag === 'string' ? t.mistake_tag : null,
      mistake_tags: Array.isArray(t.mistake_tags)
        ? (t.mistake_tags.filter(
            (v): v is MistakeTag => typeof v === 'string' && (MISTAKE_TAGS as readonly string[]).includes(v),
          ))
        : [],
      account: oneOf('account', ACCOUNTS) ?? 'Backtest (FX Replay)',
      account_label: typeof t.account_label === 'string' && t.account_label.trim()
        ? t.account_label.trim() : null,
      status: oneOf('status', TRADE_STATUSES) ?? 'Settled',
      grade_at_entry: numOrNull('grade_at_entry'),
      // Absent means it was written in one shot, after the fact — which is what
      // every trade logged from the plain form is.
      graded_post_hoc: t.graded_post_hoc !== false,
      entry_price: numOrNull('entry_price'),
      take_profit: numOrNull('take_profit'),
      stop_loss: numOrNull('stop_loss'),
      would_have_hit_tp: t.would_have_hit_tp == null ? null : t.would_have_hit_tp === true,
      r_left_on_table: numOrNull('r_left_on_table'),
      skip_reason: oneOf('skip_reason', SKIP_REASONS),
      entry_time: typeof t.entry_time === 'string' && t.entry_time ? t.entry_time : null,
      exit_time: typeof t.exit_time === 'string' && t.exit_time ? t.exit_time : null,
      mae_r: numOrNull('mae_r'),
      mfe_r: numOrNull('mfe_r'),
      mae_points: numOrNull('mae_points'),
      mfe_points: numOrNull('mfe_points'),
      reached_1r: t.reached_1r == null ? null : t.reached_1r === true,
      // Only meaningful before the outcome was known, so it is clamped rather
      // than rejected — an out-of-range value is a bug, not a reason to refuse
      // to save the trade it belongs to.
      confidence_at_entry: clamp(numOrNull('confidence_at_entry'), 1, 5),
      would_be_r: numOrNull('would_be_r'),
      playbook_id: typeof t.playbook_id === 'string' && t.playbook_id ? t.playbook_id : null,
      contracts: numOrNull('contracts'),
      // Clamped, not rejected — nothing here is allowed to refuse a save. A
      // negative risk is a typo for a percentage, and keeping it would invert
      // the P&L, so it is dropped rather than stored.
      risk_dollars: positiveOrNull('risk_dollars'),
      risk_percent: positiveOrNull('risk_percent'),
      // Signed, unlike risk: a loss is a negative number here.
      pnl_dollars: numOrNull('pnl_dollars'),
      stop_points: numOrNull('stop_points'),
      outcome: outcome!,
      r_multiple: numOrNull('r_multiple'),
      explanation,
      lesson: lesson || null,
      screenshot_path,
    },
  };
}
