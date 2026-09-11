-- Replace the invented grading rubric with the actual checklist.
--
-- The first schema scored a trade 0-10 across three made-up axes. The real plan
-- is a weighted 100-point checklist in three phases, where Phase 3 must fire for
-- an entry to exist at all and a score of 70 or more is a commitment to take it.
-- The score, the letter and whether the trigger fired are all derived in SQLite
-- from the nine answers, so they can never disagree with them.
--
-- This also adds the columns the plan's own Trades and Missed Trades sheets
-- carry: the honest re-grade after the close, whether every rule was followed,
-- the mistake tag, and — for setups skipped — what hesitating actually cost.
--
-- SQLite cannot alter a CHECK constraint or a generated column in place, so the
-- table is rebuilt. migrate() wraps this file in a transaction already.

CREATE TABLE trades_rebuilt (
  id                  TEXT    PRIMARY KEY,
  date                TEXT    NOT NULL,
  instrument          TEXT    NOT NULL CHECK (instrument IN ('NQ','MNQ','NAS100','Other')),
  direction           TEXT    NOT NULL CHECK (direction IN ('Long','Short')),
  session             TEXT    NOT NULL CHECK (session IN ('Asia','London','NY AM','NY Lunch','NY PM')),
  macro_time          INTEGER NOT NULL DEFAULT 0 CHECK (macro_time IN (0,1)),
  macro_time_auto     INTEGER NOT NULL DEFAULT 1 CHECK (macro_time_auto IN (0,1)),
  reason              TEXT    NOT NULL CHECK (reason IN (
                        'Rules-based (A+ setup)','Rules-based (B setup)','FOMO','Revenge',
                        'Boredom','Idea / hypothesis','Following the market','Following someone else',
                        'Impatience (early entry)','Hesitation (late entry)','Overleveraged','News reaction')),
  setup_type          TEXT    NOT NULL CHECK (setup_type IN (
                        'iFVG','Double iFVG','iFVG + SMT','MSS + FVG','CISD',
                        'Order Block','Breaker','Unicorn (Breaker + FVG)','Propulsion Block',
                        'Mitigation Block','Rejection Block','Liquidity Void',
                        'Balanced Price Range','Turtle Soup','Silver Bullet','Other')),
  htf_bias            TEXT    NOT NULL CHECK (htf_bias IN ('With bias','Against bias','No bias defined')),
  sweep_before_entry  INTEGER NOT NULL DEFAULT 0 CHECK (sweep_before_entry IN (0,1)),
  singular_gap        INTEGER NOT NULL DEFAULT 0 CHECK (singular_gap IN (0,1)),
  target_unswept      INTEGER NOT NULL DEFAULT 0 CHECK (target_unswept IN (0,1)),
  premium_discount    TEXT    NOT NULL CHECK (premium_discount IN ('Discount','Equilibrium','Premium')),
  target_type         TEXT    NOT NULL CHECK (target_type IN (
                        'Horizontal liquidity pool','Opposing FVG','Data wick','Session high/low',
                        'Diagonal trendline','Other')),
  smt                 INTEGER NOT NULL DEFAULT 0 CHECK (smt IN (0,1)),
  displacement            INTEGER NOT NULL DEFAULT 0 CHECK (displacement            IN (0,1)),
  mss_confirmed           INTEGER NOT NULL DEFAULT 0 CHECK (mss_confirmed           IN (0,1)),
  volume_imbalance        INTEGER NOT NULL DEFAULT 0 CHECK (volume_imbalance        IN (0,1)),
  consequent_encroachment INTEGER NOT NULL DEFAULT 0 CHECK (consequent_encroachment IN (0,1)),
  equal_highs_lows        INTEGER NOT NULL DEFAULT 0 CHECK (equal_highs_lows        IN (0,1)),
  retest_entry            INTEGER NOT NULL DEFAULT 0 CHECK (retest_entry            IN (0,1)),
  news_window             INTEGER NOT NULL DEFAULT 0 CHECK (news_window             IN (0,1)),

  -- The checklist. Weights are the plan's, not mine.
  chk_htf_bias         INTEGER NOT NULL DEFAULT 0 CHECK (chk_htf_bias         IN (0,1)),  -- 10
  chk_killzone         INTEGER NOT NULL DEFAULT 0 CHECK (chk_killzone         IN (0,1)),  -- 10
  chk_no_news          INTEGER NOT NULL DEFAULT 0 CHECK (chk_no_news          IN (0,1)),  --  5
  chk_sweep            INTEGER NOT NULL DEFAULT 0 CHECK (chk_sweep            IN (0,1)),  -- 20
  chk_displacement_fvg INTEGER NOT NULL DEFAULT 0 CHECK (chk_displacement_fvg IN (0,1)),  -- 15
  chk_targets_clear    INTEGER NOT NULL DEFAULT 0 CHECK (chk_targets_clear    IN (0,1)),  -- 15
  chk_clean_path       INTEGER NOT NULL DEFAULT 0 CHECK (chk_clean_path       IN (0,1)),  --  5
  chk_returned_to_fvg  INTEGER NOT NULL DEFAULT 0 CHECK (chk_returned_to_fvg  IN (0,1)),  --  5
  chk_inversion_close  INTEGER NOT NULL DEFAULT 0 CHECK (chk_inversion_close  IN (0,1)),  -- 15

  checklist_score INTEGER GENERATED ALWAYS AS (
      chk_htf_bias * 10 + chk_killzone * 10 + chk_no_news * 5
    + chk_sweep * 20 + chk_displacement_fvg * 15 + chk_targets_clear * 15 + chk_clean_path * 5
    + chk_returned_to_fvg * 5 + chk_inversion_close * 15
  ) STORED,

  -- "Phase 3 must fire for an entry to exist." Both halves, or there is no trade.
  trigger_fired INTEGER GENERATED ALWAYS AS (
    CASE WHEN chk_returned_to_fvg = 1 AND chk_inversion_close = 1 THEN 1 ELSE 0 END
  ) STORED,

  grade_letter TEXT GENERATED ALWAYS AS (
    CASE
      WHEN (chk_htf_bias*10 + chk_killzone*10 + chk_no_news*5 + chk_sweep*20
          + chk_displacement_fvg*15 + chk_targets_clear*15 + chk_clean_path*5
          + chk_returned_to_fvg*5 + chk_inversion_close*15) >= 90 THEN 'A+'
      WHEN (chk_htf_bias*10 + chk_killzone*10 + chk_no_news*5 + chk_sweep*20
          + chk_displacement_fvg*15 + chk_targets_clear*15 + chk_clean_path*5
          + chk_returned_to_fvg*5 + chk_inversion_close*15) >= 80 THEN 'A'
      WHEN (chk_htf_bias*10 + chk_killzone*10 + chk_no_news*5 + chk_sweep*20
          + chk_displacement_fvg*15 + chk_targets_clear*15 + chk_clean_path*5
          + chk_returned_to_fvg*5 + chk_inversion_close*15) >= 70 THEN 'B'
      WHEN (chk_htf_bias*10 + chk_killzone*10 + chk_no_news*5 + chk_sweep*20
          + chk_displacement_fvg*15 + chk_targets_clear*15 + chk_clean_path*5
          + chk_returned_to_fvg*5 + chk_inversion_close*15) >= 50 THEN 'C'
      ELSE 'F'
    END
  ) STORED,

  -- Discipline, straight from the plan's Trades sheet.
  followed_rules INTEGER NOT NULL DEFAULT 1 CHECK (followed_rules IN (0,1)),
  regrade        TEXT CHECK (regrade IS NULL OR regrade IN ('A+','A','A-','B+','B','B-','C','F')),
  mistake_tag    TEXT CHECK (mistake_tag IS NULL OR mistake_tag IN (
                   'Clean','Entered early','Entered late','Cut early','Moved stop','No trigger',
                   'Rule break','Oversized','Pattern trading','Market rejection')),

  -- Prices, so a trade can be reconstructed rather than only remembered.
  entry_price  REAL,
  take_profit  REAL,
  stop_loss    REAL,

  -- For setups skipped: what hesitating actually cost.
  would_have_hit_tp INTEGER CHECK (would_have_hit_tp IS NULL OR would_have_hit_tp IN (0,1)),
  r_left_on_table   REAL,
  skip_reason       TEXT CHECK (skip_reason IS NULL OR skip_reason IN ('Fear','Rule','Distracted','Missed it')),

  contracts           INTEGER,
  risk_dollars        REAL,
  stop_points         REAL,
  outcome             TEXT    NOT NULL CHECK (outcome IN ('Win','Loss','Breakeven','Scratched','Not taken')),
  r_multiple          REAL,
  explanation         TEXT    NOT NULL CHECK (length(trim(explanation)) >= 80),
  lesson              TEXT,
  screenshot_path     TEXT    NOT NULL,
  position_x          REAL,
  position_y          REAL,
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Carry the old rubric across as its nearest checklist equivalent, so existing
-- trades keep a meaningful score instead of dropping to zero. The old flags map
-- onto the phases they actually described.
INSERT INTO trades_rebuilt (
  id, date, instrument, direction, session, macro_time, macro_time_auto, reason, setup_type,
  htf_bias, sweep_before_entry, singular_gap, target_unswept, premium_discount, target_type, smt,
  displacement, mss_confirmed, volume_imbalance, consequent_encroachment, equal_highs_lows,
  retest_entry, news_window,
  chk_htf_bias, chk_killzone, chk_no_news, chk_sweep, chk_displacement_fvg,
  chk_targets_clear, chk_clean_path, chk_returned_to_fvg, chk_inversion_close,
  contracts, risk_dollars, stop_points, outcome, r_multiple, explanation, lesson,
  screenshot_path, position_x, position_y, created_at, updated_at
)
SELECT
  id, date, instrument, direction, session, macro_time, macro_time_auto, reason, setup_type,
  htf_bias, sweep_before_entry, singular_gap, target_unswept, premium_discount, target_type, smt,
  displacement, mss_confirmed, volume_imbalance, consequent_encroachment, equal_highs_lows,
  retest_entry, news_window,
  CASE WHEN htf_bias = 'With bias' THEN 1 ELSE 0 END,
  macro_time,
  CASE WHEN news_window = 1 THEN 0 ELSE 1 END,
  sweep_before_entry,
  displacement,
  target_unswept,
  singular_gap,
  retest_entry,
  CASE WHEN candle_strength >= 3 THEN 1 ELSE 0 END,
  contracts, risk_dollars, stop_points, outcome, r_multiple, explanation, lesson,
  screenshot_path, position_x, position_y, created_at, updated_at
FROM trades;

DROP TABLE trades;
ALTER TABLE trades_rebuilt RENAME TO trades;

CREATE INDEX idx_trades_date        ON trades(date DESC);
CREATE INDEX idx_trades_reason      ON trades(reason);
CREATE INDEX idx_trades_outcome     ON trades(outcome);
CREATE INDEX idx_trades_target_type ON trades(target_type);
CREATE INDEX idx_trades_grade       ON trades(checklist_score);

CREATE TRIGGER trades_touch_updated_at
AFTER UPDATE ON trades FOR EACH ROW
BEGIN
  UPDATE trades SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = OLD.id;
END;
