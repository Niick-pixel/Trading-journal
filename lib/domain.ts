// Every enum in the app. These lists mirror the CHECK constraints in
// db/migrations/001_init.sql — if you add a value here, add it there too.

export const INSTRUMENTS = ['NQ', 'MNQ', 'NAS100', 'Other'] as const;
export const DIRECTIONS = ['Long', 'Short'] as const;
export const SESSIONS = ['Asia', 'London', 'NY AM', 'NY Lunch', 'NY PM'] as const;

/** The spine of the whole app: why you took it, named before you rationalize. */
export const REASONS = [
  'Rules-based (A+ setup)',
  'Rules-based (B setup)',
  'FOMO',
  'Revenge',
  'Boredom',
  'Idea / hypothesis',
  'Following the market',
  'Following someone else',
  'Impatience (early entry)',
  'Hesitation (late entry)',
  'Overleveraged',
  'News reaction',
] as const;

export const SETUP_TYPES = ['iFVG', 'MSS + FVG', 'Order Block', 'Propulsion Block', 'Breaker', 'Other'] as const;
export const HTF_BIASES = ['With bias', 'Against bias', 'No bias defined'] as const;
export const PREMIUM_DISCOUNTS = ['Discount', 'Equilibrium', 'Premium'] as const;
export const TARGET_TYPES = [
  'Horizontal liquidity pool',
  'Opposing FVG',
  'Data wick',
  'Session high/low',
  'Diagonal trendline',
  'Other',
] as const;
export const OUTCOMES = ['Win', 'Loss', 'Breakeven', 'Scratched', 'Not taken'] as const;

export type Instrument = (typeof INSTRUMENTS)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type Session = (typeof SESSIONS)[number];
export type Reason = (typeof REASONS)[number];
export type SetupType = (typeof SETUP_TYPES)[number];
export type HtfBias = (typeof HTF_BIASES)[number];
export type PremiumDiscount = (typeof PREMIUM_DISCOUNTS)[number];
export type TargetType = (typeof TARGET_TYPES)[number];
export type Outcome = (typeof OUTCOMES)[number];

/** 'Not taken' rows are journalled but never priced — see lib/stats.ts. */
export const SETTLED_OUTCOMES = OUTCOMES.filter((o) => o !== 'Not taken');
export function isTaken(outcome: Outcome): boolean {
  return outcome !== 'Not taken';
}

/** Rubric ceilings, so the sliders and the CHECK constraints can't drift apart. */
export const RUBRIC = {
  candle_strength: { max: 4, label: 'Candle strength', hint: 'How decisively did the inverting candle close through the gap?' },
  inversion_speed: { max: 3, label: 'Inversion speed', hint: 'How fast did price invert and leave? Slow grinds score low.' },
  risk_reward: { max: 3, label: 'Risk / reward', hint: 'Distance to the target measured against the stop.' },
} as const;

export type RubricKey = keyof typeof RUBRIC;
export const RUBRIC_KEYS = Object.keys(RUBRIC) as RubricKey[];
/** 4 + 3 + 3 */
export const GRADE_MAX = RUBRIC_KEYS.reduce((sum, k) => sum + RUBRIC[k].max, 0);

/** Per-reason cluster identity. Hue drives the halo, the edges and the header. */
export const REASON_HUE: Record<Reason, number> = {
  'Rules-based (A+ setup)': 152, // mint-green — the standard
  'Rules-based (B setup)': 168,
  FOMO: 4, // red — the leak
  Revenge: 348,
  Boredom: 28, // amber
  'Idea / hypothesis': 268, // violet
  'Following the market': 210, // blue
  'Following someone else': 194,
  'Impatience (early entry)': 44,
  'Hesitation (late entry)': 62,
  Overleveraged: 320,
  'News reaction': 240,
};
