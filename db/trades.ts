import 'server-only';
import crypto from 'node:crypto';
import type { SQLInputValue } from 'node:sqlite';
import { getDb } from './index';
import { deleteScreenshot } from './screenshots';
import type { SettleInput, Trade, TradeFilters, TradeInput } from '../lib/types';

type BoolColumn = (typeof BOOL_COLUMNS)[number];
type Row = Omit<Trade, BoolColumn> & Record<BoolColumn, number>;

const BOOL_COLUMNS = [
  'macro_time', 'macro_time_auto', 'sweep_before_entry', 'singular_gap', 'target_unswept', 'smt',
  'displacement', 'mss_confirmed', 'volume_imbalance', 'consequent_encroachment',
  'equal_highs_lows', 'retest_entry', 'news_window',
] as const;

function hydrate(row: Row): Trade {
  const trade = { ...row } as unknown as Trade;
  for (const col of BOOL_COLUMNS) trade[col] = Boolean(row[col]);
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
  return out;
}

const WRITABLE = [
  'date', 'instrument', 'direction', 'session', 'macro_time', 'macro_time_auto', 'reason',
  'setup_type', 'htf_bias', 'sweep_before_entry', 'singular_gap', 'target_unswept',
  'premium_discount', 'target_type', 'smt',
  'displacement', 'mss_confirmed', 'volume_imbalance', 'consequent_encroachment',
  'equal_highs_lows', 'retest_entry', 'news_window',
  'candle_strength', 'inversion_speed', 'risk_reward',
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
  if (filters.minGrade != null) { where.push('grade_total >= @minGrade'); params.minGrade = filters.minGrade; }
  if (filters.maxGrade != null) { where.push('grade_total <= @maxGrade'); params.maxGrade = filters.maxGrade; }

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
