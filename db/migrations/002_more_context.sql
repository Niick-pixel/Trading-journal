-- More context on what the setup actually looked like.
--
-- The first four flags covered the sweep, the gap, the target and SMT. These
-- add the rest of the things worth being honest about after the fact: whether
-- price actually displaced, whether structure had shifted, whether you took the
-- retest or grabbed it immediately, and whether news was in the way.
--
-- All default to 0, so every trade already recorded stays valid and simply
-- reads as "not noted".

ALTER TABLE trades ADD COLUMN displacement            INTEGER NOT NULL DEFAULT 0 CHECK (displacement            IN (0,1));
ALTER TABLE trades ADD COLUMN mss_confirmed           INTEGER NOT NULL DEFAULT 0 CHECK (mss_confirmed           IN (0,1));
ALTER TABLE trades ADD COLUMN volume_imbalance        INTEGER NOT NULL DEFAULT 0 CHECK (volume_imbalance        IN (0,1));
ALTER TABLE trades ADD COLUMN consequent_encroachment INTEGER NOT NULL DEFAULT 0 CHECK (consequent_encroachment IN (0,1));
ALTER TABLE trades ADD COLUMN equal_highs_lows        INTEGER NOT NULL DEFAULT 0 CHECK (equal_highs_lows        IN (0,1));
ALTER TABLE trades ADD COLUMN retest_entry            INTEGER NOT NULL DEFAULT 0 CHECK (retest_entry            IN (0,1));
ALTER TABLE trades ADD COLUMN news_window             INTEGER NOT NULL DEFAULT 0 CHECK (news_window             IN (0,1));
