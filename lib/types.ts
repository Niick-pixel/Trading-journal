import type {
  Account, Direction, HtfBias, Instrument, MistakeTag, Outcome, PremiumDiscount, Reason,
  Regrade, Session, SetupType, ShotSlot, SkipReason, TargetType, TradeStatus, Tri,
} from './domain';
import type { FlagKey } from './flags';
import type { GradeLetter } from './grade';

/** A trade as the app uses it: real booleans, derived grade attached. */
export interface Trade {
  id: string;
  date: string;
  instrument: Instrument;
  direction: Direction;
  session: Session;
  macro_time: boolean;
  macro_time_auto: boolean;
  reason: Reason;
  setup_type: SetupType;
  htf_bias: HtfBias;
  sweep_before_entry: boolean;
  singular_gap: boolean;
  target_unswept: boolean;
  displacement: boolean;
  mss_confirmed: boolean;
  volume_imbalance: boolean;
  consequent_encroachment: boolean;
  equal_highs_lows: boolean;
  retest_entry: boolean;
  news_window: boolean;
  premium_discount: PremiumDiscount;
  target_type: TargetType;
  smt: boolean;
  // The checklist. Generated columns below are derived from exactly these.
  chk_htf_bias: boolean;
  chk_killzone: boolean;
  chk_no_news: boolean;
  chk_sweep: boolean;
  chk_displacement_fvg: boolean;
  chk_targets_clear: boolean;
  chk_clean_path: boolean;
  chk_returned_to_fvg: boolean;
  chk_inversion_close: boolean;
  /** 0-100, computed by SQLite from the nine answers. Never written. */
  checklist_score: number;
  /** Both Phase 3 answers. Generated. */
  trigger_fired: boolean;
  grade_letter: GradeLetter;

  /**
   * What I said about my own discipline. Tri-state: null means the question
   * was never answered, which is different from "no" and must not be read as
   * "yes". Stats never use this directly — see lib/adherence.ts — it exists
   * only to measure the gap against what the checklist actually shows.
   */
  followed_rules: Tri;
  regrade: Regrade | null;
  /** The old single tag, kept so nothing written under the old taxonomy is lost. */
  mistake_tag: string | null;
  /** A bad trade usually has three. */
  mistake_tags: MistakeTag[];

  account: Account;
  account_label: string | null;

  status: TradeStatus;
  /** The score before the outcome was known. Stats read this, not the current one. */
  grade_at_entry: number | null;
  /** Logged in one shot after the fact. Hindsight grades cannot be pooled with pre-grades. */
  graded_post_hoc: boolean;

  /** Flag key -> why I dismissed it. See lib/flags.ts. */
  dismissed_flags: Record<string, string | null>;

  entry_price: number | null;
  take_profit: number | null;
  stop_loss: number | null;

  /** Execution, after the fact. All optional. */
  entry_time: string | null;
  exit_time: string | null;
  /** Worst excursion against the position, in R. Negative. */
  mae_r: number | null;
  /** Best excursion in favour, in R. */
  mfe_r: number | null;
  mae_points: number | null;
  mfe_points: number | null;
  /** If most losers touched +1R first, the problem is management, not selection. */
  reached_1r: boolean | null;

  /** 1-5, recorded before the outcome. Meaningless afterwards. */
  confidence_at_entry: number | null;

  /** What a passed setup would have paid. */
  would_be_r: number | null;

  playbook_id: string | null;

  /** Only meaningful when the outcome is 'Not taken'. */
  would_have_hit_tp: boolean | null;
  r_left_on_table: number | null;
  skip_reason: SkipReason | null;
  contracts: number | null;
  /** Never negative — P&L is risk x R, so a negative risk inverts every outcome. */
  risk_dollars: number | null;
  risk_percent: number | null;
  /** What the account actually did. Beats risk x R wherever it is set. */
  pnl_dollars: number | null;
  stop_points: number | null;
  outcome: Outcome;
  r_multiple: number | null;
  explanation: string;
  lesson: string | null;
  screenshot_path: string;
  position_x: number | null;
  position_y: number | null;
  /** Soft delete. Nothing leaves without a second, deliberate act. */
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** What the capture form sends. `id` and the generated columns are not yours to set. */
export type TradeInput = Omit<
  Trade,
  'id' | 'checklist_score' | 'trigger_fired' | 'grade_letter'
  | 'created_at' | 'updated_at' | 'position_x' | 'position_y'
  | 'deleted_at' | 'dismissed_flags'
>;

export interface TradeShot {
  id: string;
  trade_id: string;
  path: string;
  slot: ShotSlot;
  ordinal: number;
}

export interface TradePartial {
  id: string;
  trade_id: string;
  size: number | null;
  price: number | null;
  r: number | null;
  ordinal: number;
}

export interface Playbook {
  id: string;
  name: string;
  criteria: string | null;
  reference_screenshot: string | null;
  archived_at: string | null;
  created_at: string;
}

/**
 * One per trading day, independent of whether anything was traded.
 *
 * Mood and sleep are here as correlation data, not as a diary — the point is
 * to plot adherence against them and find out whether five hours of sleep is
 * what actually breaks the rules.
 */
export interface DailyReview {
  day: string;
  account: string | null;
  bias: string | null;
  bias_screenshot: string | null;
  planned_killzones: string | null;
  planned_levels: string | null;
  what_happened: string | null;
  bias_held: boolean | null;
  trades_planned: number | null;
  screen_minutes: number | null;
  sleep_hours: number | null;
  state_of_mind: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReview {
  week_start: string;
  summary: string | null;
  reviewed_ids: string[];
  created_at: string;
}

export interface BoardNote {
  id: string;
  body: string;
  x: number;
  y: number;
  color: string | null;
  created_at: string;
}

export interface BoardEdge {
  id: string;
  from_id: string;
  to_id: string;
  label: string | null;
  created_at: string;
}

/** Informational only. Nothing reads these to decide whether a save is allowed. */
export interface RiskLimits {
  max_trades_per_day: number;
  daily_loss_limit_r: number;
  max_risk_per_trade_pct: number;
}

/** One field changing on one trade, at one moment. */
export interface TradeEdit {
  id: number;
  trade_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export interface FlagDismissal {
  trade_id: string;
  flag: FlagKey;
  reason: string | null;
  dismissed_at: string;
}

/** What a bulk edit is allowed to touch. Deliberately narrow. */
export interface BulkPatch {
  reason?: Reason;
  account?: Account;
  account_label?: string | null;
  mistake_tags?: MistakeTag[];
  status?: TradeStatus;
}

/** The quick-settle path: outcome and R, without reopening the whole form. */
export interface SettleInput {
  outcome: Outcome;
  r_multiple: number | null;
}

export interface TradeFilters {
  from?: string;
  to?: string;
  outcomes?: Outcome[];
  reasons?: Reason[];
  sessions?: Session[];
  minGrade?: number;
  maxGrade?: number;
  accounts?: Account[];
  statuses?: TradeStatus[];
  /** 'live' (default) hides soft-deleted rows; 'trash' shows only those. */
  bin?: 'live' | 'trash' | 'all';
}

export const MIN_EXPLANATION = 80;
