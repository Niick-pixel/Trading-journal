-- The journal stops asserting things I never said.
--
-- Three problems, one rebuild:
--
-- 1. followed_rules was NOT NULL DEFAULT 1. Every trade ever saved claimed full
--    rule adherence whether or not the question was answered. It becomes a
--    tri-state — NULL means unanswered — and every existing row is reset to
--    NULL, because none of them were answered deliberately.
-- 2. Nothing here is a gate. status, accounts, soft delete and the edit log all
--    describe what happened; none of them can refuse a save.
-- 3. risk_dollars accepted a negative number, and money() multiplies it by
--    r_multiple — so a -1.9R loss entered as "-1.57" became a +$2.98 win. Risk
--    is now constrained to be positive, and percentage risk has its own column
--    instead of being typed into the dollars one.

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

  -- Tri-state on purpose. NULL is "I did not answer", which is the honest
  -- state of every trade until I say otherwise, and is NOT the same as "no".
  followed_rules INTEGER CHECK (followed_rules IS NULL OR followed_rules IN (0,1)),

  regrade     TEXT CHECK (regrade IS NULL OR regrade IN ('A+','A','A-','B+','B','B-','C','F')),
  -- Legacy single tag, kept so nothing written under the old taxonomy is lost.
  mistake_tag TEXT,
  -- A bad trade usually has three. JSON array; the values are validated in
  -- lib/validate.ts against MISTAKE_TAGS, which SQLite cannot do for an array.
  mistake_tags TEXT CHECK (mistake_tags IS NULL OR json_valid(mistake_tags)),

  -- Backtest R and live R must never sum into the same number.
  account       TEXT NOT NULL DEFAULT 'Backtest (FX Replay)'
                CHECK (account IN ('Backtest (FX Replay)','Demo','Live')),
  account_label TEXT,

  -- Optional two-stage logging. 'Settled' is the default because logging a
  -- finished trade in one shot must stay the fast path.
  status TEXT NOT NULL DEFAULT 'Settled' CHECK (status IN ('Planned','Live','Settled')),
  -- The score as it stood before the outcome was known. Stats read this one.
  grade_at_entry INTEGER,
  -- True when the whole trade was logged after the fact, so hindsight-graded
  -- and pre-graded trades can never be pooled.
  graded_post_hoc INTEGER NOT NULL DEFAULT 1 CHECK (graded_post_hoc IN (0,1)),

  entry_price  REAL,
  take_profit  REAL,
  stop_loss    REAL,

  would_have_hit_tp INTEGER CHECK (would_have_hit_tp IS NULL OR would_have_hit_tp IN (0,1)),
  r_left_on_table   REAL,
  skip_reason       TEXT CHECK (skip_reason IS NULL OR skip_reason IN ('Fear','Rule','Distracted','Missed it')),

  contracts           INTEGER,
  -- Risk cannot be negative. It used to be able to, and since P&L is
  -- risk x R, a negative risk turned every loss into a win.
  risk_dollars        REAL    CHECK (risk_dollars IS NULL OR risk_dollars >= 0),
  risk_percent        REAL    CHECK (risk_percent IS NULL OR risk_percent >= 0),
  stop_points         REAL,
  outcome             TEXT    NOT NULL CHECK (outcome IN ('Win','Loss','Breakeven','Scratched','Not taken')),
  r_multiple          REAL,
  explanation         TEXT    NOT NULL CHECK (length(trim(explanation)) >= 80),
  lesson              TEXT,
  screenshot_path     TEXT    NOT NULL,
  position_x          REAL,
  position_y          REAL,
  -- Soft delete. Nothing leaves the journal without a second, deliberate act.
  deleted_at          TEXT,
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO trades_rebuilt (
  id, date, instrument, direction, session, macro_time, macro_time_auto, reason, setup_type,
  htf_bias, sweep_before_entry, singular_gap, target_unswept, premium_discount, target_type, smt,
  displacement, mss_confirmed, volume_imbalance, consequent_encroachment, equal_highs_lows,
  retest_entry, news_window,
  chk_htf_bias, chk_killzone, chk_no_news, chk_sweep, chk_displacement_fvg,
  chk_targets_clear, chk_clean_path, chk_returned_to_fvg, chk_inversion_close,
  followed_rules, regrade, mistake_tag, mistake_tags,
  grade_at_entry, graded_post_hoc,
  entry_price, take_profit, stop_loss,
  would_have_hit_tp, r_left_on_table, skip_reason,
  contracts, risk_dollars, stop_points, outcome, r_multiple, explanation, lesson,
  screenshot_path, position_x, position_y, created_at, updated_at
)
SELECT
  id, date, instrument, direction, session, macro_time, macro_time_auto, reason, setup_type,
  htf_bias, sweep_before_entry, singular_gap, target_unswept, premium_discount, target_type, smt,
  displacement, mss_confirmed, volume_imbalance, consequent_encroachment, equal_highs_lows,
  retest_entry, news_window,
  chk_htf_bias, chk_killzone, chk_no_news, chk_sweep, chk_displacement_fvg,
  chk_targets_clear, chk_clean_path, chk_returned_to_fvg, chk_inversion_close,
  -- Every existing answer is discarded. The form defaulted this to "yes", so a
  -- stored 1 is indistinguishable from never having been asked.
  NULL,
  regrade,
  mistake_tag,
  -- Carry the old single tag into the new list where it maps cleanly. Tags with
  -- no equivalent stay in mistake_tag alone rather than being invented into the
  -- new taxonomy.
  CASE mistake_tag
    WHEN 'Entered early' THEN json_array('Entered early')
    WHEN 'Entered late'  THEN json_array('Entered late')
    WHEN 'Cut early'     THEN json_array('Cut winner early')
    WHEN 'Moved stop'    THEN json_array('Moved stop')
    WHEN 'No trigger'    THEN json_array('No trigger')
    WHEN 'Oversized'     THEN json_array('Oversized')
    WHEN 'Clean'         THEN json_array()
    ELSE NULL
  END,
  -- Everything already in the journal was written after the fact.
  checklist_score, 1,
  entry_price, take_profit, stop_loss,
  would_have_hit_tp, r_left_on_table, skip_reason,
  contracts,
  -- A negative risk was a typo for a percentage, not a real number. Drop it
  -- rather than keep a value that inverts the P&L.
  CASE WHEN risk_dollars < 0 THEN NULL ELSE risk_dollars END,
  stop_points, outcome, r_multiple, explanation, lesson,
  screenshot_path, position_x, position_y, created_at, updated_at
FROM trades;

DROP TABLE trades;
ALTER TABLE trades_rebuilt RENAME TO trades;

CREATE INDEX idx_trades_date        ON trades(date DESC);
CREATE INDEX idx_trades_reason      ON trades(reason);
CREATE INDEX idx_trades_outcome     ON trades(outcome);
CREATE INDEX idx_trades_target_type ON trades(target_type);
CREATE INDEX idx_trades_grade       ON trades(checklist_score);
CREATE INDEX idx_trades_account     ON trades(account);
CREATE INDEX idx_trades_status      ON trades(status);
CREATE INDEX idx_trades_deleted     ON trades(deleted_at);

CREATE TRIGGER trades_touch_updated_at
AFTER UPDATE ON trades FOR EACH ROW
BEGIN
  UPDATE trades SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = OLD.id;
END;

-- Not to police me. So I can see whether I quietly upgrade a trade days later.
CREATE TABLE trade_edits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id   TEXT NOT NULL,
  field      TEXT NOT NULL,
  old_value  TEXT,
  new_value  TEXT,
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_trade_edits_trade ON trade_edits(trade_id, changed_at DESC);

-- Sometimes the contradiction is real and I know why. Dismissing says why.
CREATE TABLE flag_dismissals (
  trade_id     TEXT NOT NULL,
  flag         TEXT NOT NULL,
  reason       TEXT,
  dismissed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (trade_id, flag)
);
