import 'server-only';
import crypto from 'node:crypto';
import type { SQLInputValue } from 'node:sqlite';
import { getDb } from './index';
import { deleteScreenshot } from './screenshots';
import type { SettleInput, Trade, TradeFilters, TradeInput } from '../lib/types';

type BoolColumn = (typeof BOOL_COLUMNS)[number];
type ReadBoolColumn = (typeof GENERATED_BOOL_COLUMNS)[number];
type NullBoolColumn = (typeof NULLABLE_BOOL_COLUMNS)[number];

type Row =
  & Omit<Trade, BoolColumn | ReadBoolColumn | NullBoolColumn>
  & Record<BoolColumn | ReadBoolColumn, number>
  & Record<NullBoolColumn, number | null>;

/** Booleans that are always present and always written. */
const BOOL_COLUMNS = [
  'macro_time', 'macro_time_auto', 'sweep_before_entry', 'singular_gap', 'target_unswept', 'smt',
  'displacement', 'mss_confirmed', 'volume_imbalance', 'consequent_encroachment',
  'equal_highs_lows', 'retest_entry', 'news_window',
  'chk_htf_bias', 'chk_killzone', 'chk_no_news',
  'chk_sweep', 'chk_displacement_fvg', 'chk_targets_clear', 'chk_clean_path',
  'chk_returned_to_fvg', 'chk_inversion_close',
  'followed_rules',
] as const;

/** Derived by SQLite from the checklist. Read, never written. */
const GENERATED_BOOL_COLUMNS = ['trigger_fired'] as const;

/**
 * Booleans that are allowed to be unknown.
 *
 * "Would it have hit TP?" only has an answer for a setup you skipped, and
 * collapsing that null to 0 would quietly turn "I never checked" into "no" —
 * which is exactly the number the hesitation-cost panel reads.
 */
const NULLABLE_BOOL_COLUMNS = ['would_have_hit_tp'] as const;

function hydrate(row: Row): Trade {
  const trade = { ...row } as unknown as Trade;
  for (const col of BOOL_COLUMNS) trade[col] = Boolean(row[col]);
  for (const col of GENERATED_BOOL_COLUMNS) trade[col] = Boolean(row[col]);
  for (const col of NULLABLE_BOOL_COLUMNS) {
    trade[col] = row[col] == null ? null : Boolean(row[col]);
  }
  return trade;
}

/**
 * SQLite has no boolean type, so every flag goes in and comes out as 0/1.
 * node:sqlite only binds null, number, bigint, string and Uint8Array, so
 * undefined has to become null on the way in as well.
 */
function flatten(input: TradeInput): Record<string, SQLInputValue> {
  const out: Record<string, SQLInputValue> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = value === undefined ? null : (value as SQLInputValue);
  }
  for (const col of BOOL_COLUMNS) out[col] = input[col] ? 1 : 0;
  for (const col of NULLABLE_BOOL_COLUMNS) {
    out[col] = input[col] == null ? null : input[col] ? 1 : 0;
  }
  return out;
}

const WRITABLE = [
  'date', 'instrument', 'direction', 'session', 'macro_time', 'macro_time_auto', 'reason',
  'setup_type', 'htf_bias', 'sweep_before_entry', 'singular_gap', 'target_unswept',
  'premium_discount', 'target_type', 'smt',
  'displacement', 'mss_confirmed', 'volume_imbalance', 'consequent_encroachment',
  'equal_highs_lows', 'retest_entry', 'news_window',
  'chk_htf_bias', 'chk_killzone', 'chk_no_news',
  'chk_sweep', 'chk_displacement_fvg', 'chk_targets_clear', 'chk_clean_path',
  'chk_returned_to_fvg', 'chk_inversion_close',
  'followed_rules', 'regrade', 'mistake_tag',
  'entry_price', 'take_profit', 'stop_loss',
  'would_have_hit_tp', 'r_left_on_table', 'skip_reason',
  'contracts', 'risk_dollars', 'stop_points', 'outcome', 'r_multiple', 'explanation', 'lesson',
  'screenshot_path',
] as const;

export function createTrade(input: TradeInput): Trade {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO trades (id, ${WRITABLE.join(', ')})
     VALUES (@id, ${WRITABLE.map((c) => `@${c}`).join(', ')})`,
  ).run({ id, ...flatten(input) });
  return getTrade(id)!;
}

export function getTrade(id: string): Trade | null {
  const row = getDb().prepare('SELECT * FROM trades WHERE id = ?').get(id) as Row | undefined;
  return row ? hydrate(row) : null;
}

export function listTrades(filters: TradeFilters = {}): Trade[] {
  const where: string[] = [];
  const params: Record<string, SQLInputValue> = {};

  if (filters.from) { where.push('date >= @from'); params.from = filters.from; }
  if (filters.to) { where.push('date <= @to'); params.to = filters.to; }
  if (filters.minGrade != null) { where.push('checklist_score >= @minGrade'); params.minGrade = filters.minGrade; }
  if (filters.maxGrade != null) { where.push('checklist_score <= @maxGrade'); params.maxGrade = filters.maxGrade; }

  // IN-lists get positional placeholders; better-sqlite3 won't bind an array.
  const inList = (column: string, values: string[] | undefined, prefix: string) => {
    if (!values?.length) return;
    const keys = values.map((_, i) => `@${prefix}${i}`);
    where.push(`${column} IN (${keys.join(', ')})`);
    values.forEach((v, i) => { params[`${prefix}${i}`] = v; });
  };
  inList('outcome', filters.outcomes, 'outcome');
  inList('reason', filters.reasons, 'reason');
  inList('session', filters.sessions, 'session');

  const sql = `SELECT * FROM trades${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY date DESC`;
  return (getDb().prepare(sql).all(params) as Row[]).map(hydrate);
}

export function updateTrade(id: string, input: TradeInput): Trade | null {
  if (!getTrade(id)) return null;
  getDb()
    .prepare(`UPDATE trades SET ${WRITABLE.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`)
    .run({ id, ...flatten(input) });
  return getTrade(id);
}

/** Log at entry, settle later — the daily path. */
export function settleTrade(id: string, input: SettleInput): Trade | null {
  if (!getTrade(id)) return null;
  getDb()
    .prepare('UPDATE trades SET outcome = @outcome, r_multiple = @r_multiple WHERE id = @id')
    .run({ id, outcome: input.outcome, r_multiple: input.r_multiple });
  return getTrade(id);
}

/** null, null means "forget my manual placement and re-cluster me". */
export function setPosition(id: string, x: number | null, y: number | null): void {
  getDb().prepare('UPDATE trades SET position_x = @x, position_y = @y WHERE id = @id').run({ id, x, y });
}

/**
 * Writes positions for several trades at once.
 *
 * Used to pin trades the moment they first appear on the board. Without it a
 * trade only gets coordinates when it is dragged, so every reload re-derived
 * the layout and the whole board shuffled whenever a new trade was added.
 */
export function setPositions(entries: Array<{ id: string; x: number; y: number }>): void {
  if (entries.length === 0) return;
  const db = getDb();
  const stmt = db.prepare('UPDATE trades SET position_x = @x, position_y = @y WHERE id = @id');
  db.exec('BEGIN');
  try {
    for (const e of entries) stmt.run({ id: e.id, x: e.x, y: e.y });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function clearAllPositions(): void {
  getDb().exec('UPDATE trades SET position_x = NULL, position_y = NULL');
}

/** Removes the row and its screenshot file together. */
export function deleteTrade(id: string): boolean {
  const trade = getTrade(id);
  if (!trade) return false;
  getDb().prepare('DELETE FROM trades WHERE id = ?').run(id);
  deleteScreenshot(trade.screenshot_path);
  return true;
}
