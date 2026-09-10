-- Widen the setup_type vocabulary to the iFVG / ICT family.
--
-- SQLite cannot alter a CHECK constraint in place, so the table is rebuilt:
-- create the new shape, copy every row, drop the old, rename. The generated
-- grade columns are recomputed on insert rather than copied, which is why they
-- are absent from the column list below. migrate() already wraps this file in a
-- transaction, so there is deliberately no BEGIN/COMMIT here.

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

  candle_strength     INTEGER NOT NULL CHECK (candle_strength BETWEEN 0 AND 4),
  inversion_speed     INTEGER NOT NULL CHECK (inversion_speed BETWEEN 0 AND 3),
  risk_reward         INTEGER NOT NULL CHECK (risk_reward     BETWEEN 0 AND 3),

  grade_total  INTEGER GENERATED ALWAYS AS (candle_strength + inversion_speed + risk_reward) STORED,
  grade_letter TEXT    GENERATED ALWAYS AS (
                  CASE
                    WHEN candle_strength + inversion_speed + risk_reward >= 9 THEN 'A+'
                    WHEN candle_strength + inversion_speed + risk_reward  = 8 THEN 'A'
                    WHEN candle_strength + inversion_speed + risk_reward  = 7 THEN 'B+'
                    WHEN candle_strength + inversion_speed + risk_reward  = 6 THEN 'B'
                    WHEN candle_strength + inversion_speed + risk_reward  = 5 THEN 'C'
                    ELSE 'F'
                  END) STORED,

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

INSERT INTO trades_rebuilt (
  id, date, instrument, direction, session, macro_time, macro_time_auto, reason, setup_type,
  htf_bias, sweep_before_entry, singular_gap, target_unswept, premium_discount, target_type, smt,
  displacement, mss_confirmed, volume_imbalance, consequent_encroachment, equal_highs_lows,
  retest_entry, news_window,
  candle_strength, inversion_speed, risk_reward,
  contracts, risk_dollars, stop_points, outcome, r_multiple, explanation, lesson,
  screenshot_path, position_x, position_y, created_at, updated_at
)
SELECT
  id, date, instrument, direction, session, macro_time, macro_time_auto, reason, setup_type,
  htf_bias, sweep_before_entry, singular_gap, target_unswept, premium_discount, target_type, smt,
  displacement, mss_confirmed, volume_imbalance, consequent_encroachment, equal_highs_lows,
  retest_entry, news_window,
  candle_strength, inversion_speed, risk_reward,
  contracts, risk_dollars, stop_points, outcome, r_multiple, explanation, lesson,
  screenshot_path, position_x, position_y, created_at, updated_at
FROM trades;

DROP TABLE trades;
ALTER TABLE trades_rebuilt RENAME TO trades;

-- Dropping the old table took its indexes and trigger with it.
CREATE INDEX idx_trades_date        ON trades(date DESC);
CREATE INDEX idx_trades_reason      ON trades(reason);
CREATE INDEX idx_trades_outcome     ON trades(outcome);
CREATE INDEX idx_trades_target_type ON trades(target_type);
CREATE INDEX idx_trades_grade       ON trades(grade_total);

CREATE TRIGGER trades_touch_updated_at
AFTER UPDATE ON trades FOR EACH ROW
BEGIN
  UPDATE trades SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = OLD.id;
END;
