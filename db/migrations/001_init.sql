-- Signature — initial schema.
-- One table. Enums are enforced by CHECK constraints so the database stays
-- truthful even if something writes to it outside the app. The TypeScript
-- enums in lib/domain.ts are generated from the same lists by hand — keep
-- the two in sync or the insert will simply be rejected.

CREATE TABLE trades (
  id                  TEXT    PRIMARY KEY,

  -- when & where -----------------------------------------------------------
  date                TEXT    NOT NULL,               -- ISO 8601, local-naive
  instrument          TEXT    NOT NULL CHECK (instrument IN ('NQ','MNQ','NAS100','Other')),
  direction           TEXT    NOT NULL CHECK (direction IN ('Long','Short')),
  session             TEXT    NOT NULL CHECK (session IN ('Asia','London','NY AM','NY Lunch','NY PM')),

  -- macro window. macro_time is the effective answer; macro_time_auto records
  -- whether it is still the value derived from `date` (:50-:10 / :20-:40) or
  -- whether it was overridden by hand.
  macro_time          INTEGER NOT NULL DEFAULT 0 CHECK (macro_time IN (0,1)),
  macro_time_auto     INTEGER NOT NULL DEFAULT 1 CHECK (macro_time_auto IN (0,1)),

  -- the spine ---------------------------------------------------------------
  reason              TEXT    NOT NULL CHECK (reason IN (
                        'Rules-based (A+ setup)','Rules-based (B setup)','FOMO','Revenge',
                        'Boredom','Idea / hypothesis','Following the market','Following someone else',
                        'Impatience (early entry)','Hesitation (late entry)','Overleveraged','News reaction')),

  -- model context -----------------------------------------------------------
  setup_type          TEXT    NOT NULL CHECK (setup_type IN ('iFVG','MSS + FVG','Order Block','Propulsion Block','Breaker','Other')),
  htf_bias            TEXT    NOT NULL CHECK (htf_bias IN ('With bias','Against bias','No bias defined')),
  sweep_before_entry  INTEGER NOT NULL DEFAULT 0 CHECK (sweep_before_entry IN (0,1)),
  singular_gap        INTEGER NOT NULL DEFAULT 0 CHECK (singular_gap IN (0,1)),        -- Rule 1
  target_unswept      INTEGER NOT NULL DEFAULT 0 CHECK (target_unswept IN (0,1)),      -- Rule 4
  premium_discount    TEXT    NOT NULL CHECK (premium_discount IN ('Discount','Equilibrium','Premium')),
  target_type         TEXT    NOT NULL CHECK (target_type IN (
                        'Horizontal liquidity pool','Opposing FVG','Data wick','Session high/low',
                        'Diagonal trendline','Other')),
  smt                 INTEGER NOT NULL DEFAULT 0 CHECK (smt IN (0,1)),

  -- grading (Dodgy rubric) ---------------------------------------------------
  candle_strength     INTEGER NOT NULL CHECK (candle_strength BETWEEN 0 AND 4),
  inversion_speed     INTEGER NOT NULL CHECK (inversion_speed BETWEEN 0 AND 3),
  risk_reward         INTEGER NOT NULL CHECK (risk_reward     BETWEEN 0 AND 3),

  -- derived, never written by the app
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

  -- execution ----------------------------------------------------------------
  contracts           INTEGER,
  risk_dollars        REAL,
  stop_points         REAL,
  outcome             TEXT    NOT NULL CHECK (outcome IN ('Win','Loss','Breakeven','Scratched','Not taken')),
  r_multiple          REAL,                            -- null until settled

  -- the writing ---------------------------------------------------------------
  explanation         TEXT    NOT NULL CHECK (length(trim(explanation)) >= 80),
  lesson              TEXT,

  -- the image. A path relative to ./data/screenshots — never bytes.
  screenshot_path     TEXT    NOT NULL,

  -- whiteboard: null means "let the auto reason-cluster layout place me".
  position_x          REAL,
  position_y          REAL,

  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_trades_date        ON trades(date DESC);
CREATE INDEX idx_trades_reason      ON trades(reason);
CREATE INDEX idx_trades_outcome     ON trades(outcome);
CREATE INDEX idx_trades_target_type ON trades(target_type);
CREATE INDEX idx_trades_grade       ON trades(grade_total);

-- Keep updated_at honest without the app having to remember.
CREATE TRIGGER trades_touch_updated_at
AFTER UPDATE ON trades FOR EACH ROW
BEGIN
  UPDATE trades SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = OLD.id;
END;
