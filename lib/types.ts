import type {
  Direction, HtfBias, Instrument, MistakeTag, Outcome, PremiumDiscount, Reason, Regrade,
  Session, SetupType, SkipReason, TargetType,
} from './domain';
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

  /** Discipline and honesty, recorded after the close. */
  followed_rules: boolean;
  regrade: Regrade | null;
  mistake_tag: MistakeTag | null;

  entry_price: number | null;
  take_profit: number | null;
  stop_loss: number | null;

  /** Only meaningful when the outcome is 'Not taken'. */
  would_have_hit_tp: boolean | null;
  r_left_on_table: number | null;
  skip_reason: SkipReason | null;
  contracts: number | null;
  risk_dollars: number | null;
  stop_points: number | null;
  outcome: Outcome;
  r_multiple: number | null;
  explanation: string;
  lesson: string | null;
  screenshot_path: string;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
  updated_at: string;
}

/** What the capture form sends. `id` and the generated columns are not yours to set. */
export type TradeInput = Omit<
  Trade,
  'id' | 'checklist_score' | 'trigger_fired' | 'grade_letter'
  | 'created_at' | 'updated_at' | 'position_x' | 'position_y'
>;

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
}

export const MIN_EXPLANATION = 80;
