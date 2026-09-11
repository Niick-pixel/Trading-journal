-- Everything that turns a record of trades into something to train against.
--
-- All additive: new nullable columns and new tables, no table rebuild. SQLite
-- allows CHECK constraints on ALTER TABLE ADD COLUMN, so the schema still
-- enforces the vocabulary without the risk of copying 40 columns again.
--
-- Nothing added here can block a save. Every column is nullable and every
-- table is optional — a trade logged in ten seconds still writes cleanly.

-- ---------------------------------------------------------------- execution
-- How far it went against me before it worked, and how far in my favour
-- before it turned. The fastest way to learn whether the stop is too tight or
-- the target too greedy, which no amount of win-rate tells you.
ALTER TABLE trades ADD COLUMN entry_time TEXT;
ALTER TABLE trades ADD COLUMN exit_time  TEXT;
ALTER TABLE trades ADD COLUMN mae_r      REAL;
ALTER TABLE trades ADD COLUMN mfe_r      REAL;
ALTER TABLE trades ADD COLUMN mae_points REAL;
ALTER TABLE trades ADD COLUMN mfe_points REAL;
-- If most losers touched +1R first, the problem is management, not selection.
ALTER TABLE trades ADD COLUMN reached_1r INTEGER CHECK (reached_1r IS NULL OR reached_1r IN (0,1));

-- ------------------------------------------------------------- calibration
-- Recorded before the outcome is known, or it measures nothing. If the 5s do
-- not beat the 2s, the read is noise and size stays flat until it isn't.
ALTER TABLE trades ADD COLUMN confidence_at_entry INTEGER
  CHECK (confidence_at_entry IS NULL OR confidence_at_entry BETWEEN 1 AND 5);

-- ------------------------------------------------------------ passed setups
-- What it would have paid if taken. Distinct from r_left_on_table, which is
-- what hesitating actually cost after the fact.
ALTER TABLE trades ADD COLUMN would_be_r REAL;

-- ---------------------------------------------------------------- playbook
ALTER TABLE trades ADD COLUMN playbook_id TEXT;

CREATE TABLE playbooks (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  criteria     TEXT,
  reference_screenshot TEXT,
  archived_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_trades_playbook ON trades(playbook_id);

-- ------------------------------------------------------------- screenshots
-- One image is not a trade. Ordered, labelled slots; the first is the one the
-- capture form already requires, the rest are optional so logging stays fast.
CREATE TABLE trade_screenshots (
  id       TEXT PRIMARY KEY,
  trade_id TEXT NOT NULL,
  path     TEXT NOT NULL,
  slot     TEXT NOT NULL CHECK (slot IN ('HTF context','Entry','Result','Other')),
  ordinal  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_shots_trade ON trade_screenshots(trade_id, ordinal);

-- The existing single screenshot becomes the first Entry slot, so nothing has
-- to be re-attached by hand.
INSERT INTO trade_screenshots (id, trade_id, path, slot, ordinal)
SELECT lower(hex(randomblob(16))), id, screenshot_path, 'Entry', 0 FROM trades;

-- ----------------------------------------------------------- partial exits
CREATE TABLE trade_partials (
  id       TEXT PRIMARY KEY,
  trade_id TEXT NOT NULL,
  size     REAL,
  price    REAL,
  r        REAL,
  ordinal  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_partials_trade ON trade_partials(trade_id, ordinal);

-- ------------------------------------------------------------ daily review
-- One per trading day, independent of whether anything was traded. Correlation
-- data, not therapy: mood and sleep are here to be plotted against adherence.
CREATE TABLE daily_reviews (
  day              TEXT PRIMARY KEY,          -- YYYY-MM-DD
  account          TEXT,
  bias             TEXT,
  bias_screenshot  TEXT,
  planned_killzones TEXT,
  planned_levels   TEXT,
  what_happened    TEXT,
  bias_held        INTEGER CHECK (bias_held IS NULL OR bias_held IN (0,1)),
  trades_planned   INTEGER,
  screen_minutes   INTEGER,
  sleep_hours      REAL,
  state_of_mind    INTEGER CHECK (state_of_mind IS NULL OR state_of_mind BETWEEN 1 AND 5),
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ----------------------------------------------------------- weekly review
CREATE TABLE weekly_reviews (
  week_start TEXT PRIMARY KEY,                -- Monday, YYYY-MM-DD
  summary    TEXT,
  reviewed_ids TEXT,                          -- JSON array of trade ids
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- --------------------------------------------------------------- the board
-- Conclusions should live next to the cluster that produced them.
CREATE TABLE board_notes (
  id        TEXT PRIMARY KEY,
  body      TEXT NOT NULL DEFAULT '',
  x         REAL NOT NULL DEFAULT 0,
  y         REAL NOT NULL DEFAULT 0,
  color     TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- "Same mistake as this one" — a link the app could never have inferred.
CREATE TABLE board_edges (
  id       TEXT PRIMARY KEY,
  from_id  TEXT NOT NULL,
  to_id    TEXT NOT NULL,
  label    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_board_edges_from ON board_edges(from_id);

-- ------------------------------------------------------------ risk limits
-- Informational, always. These surface as a counter and a banner; nothing in
-- the app reads them to decide whether a save is allowed.
CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO app_settings (key, value) VALUES
  ('max_trades_per_day', '2'),
  ('daily_loss_limit_r', '2'),
  ('max_risk_per_trade_pct', '1');
