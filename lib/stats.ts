import { REASONS, TARGET_TYPES, isTaken, type Reason, type TargetType } from './domain';
import { GRADE_BUCKETS } from './grade';
import { isMacroTime } from './macro';
import type { Trade } from './types';

/**
 * The one rule that governs every number in this file: a 'Not taken' trade is
 * journalled and clustered, but it never touches R or win rate. You didn't risk
 * money, so it can't have made or lost any. It is reported as its own count.
 */
export interface Aggregate {
  /** Every trade in the group, passed ones included. */
  count: number;
  /** Trades actually taken — the denominator for winRate and totalR. */
  taken: number;
  /** Setups seen and deliberately not traded. */
  passed: number;
  wins: number;
  losses: number;
  breakeven: number;
  scratched: number;
  /** Wins / (wins + losses). Null when nothing has been settled yet. */
  winRate: number | null;
  totalR: number;
  avgR: number | null;
  /** Averaged across every trade in the group, passed ones included — a passed
   *  A+ setup is still evidence about how you grade. */
  avgGrade: number | null;
}

export function aggregate(trades: Trade[]): Aggregate {
  const taken = trades.filter((t) => isTaken(t.outcome));
  const wins = taken.filter((t) => t.outcome === 'Win').length;
  const losses = taken.filter((t) => t.outcome === 'Loss').length;
  const decided = wins + losses;
  const totalR = taken.reduce((sum, t) => sum + (t.r_multiple ?? 0), 0);

  return {
    count: trades.length,
    taken: taken.length,
    passed: trades.length - taken.length,
    wins,
    losses,
    breakeven: taken.filter((t) => t.outcome === 'Breakeven').length,
    scratched: taken.filter((t) => t.outcome === 'Scratched').length,
    winRate: decided ? wins / decided : null,
    totalR,
    avgR: taken.length ? totalR / taken.length : null,
    avgGrade: trades.length ? trades.reduce((s, t) => s + t.grade_total, 0) / trades.length : null,
  };
}

function groupBy<K extends string>(trades: Trade[], key: (t: Trade) => K, keys: readonly K[]) {
  const buckets = new Map<K, Trade[]>(keys.map((k) => [k, []]));
  for (const t of trades) buckets.get(key(t))?.push(t);
  return buckets;
}

export interface Group<K> {
  key: K;
  trades: Trade[];
  stats: Aggregate;
}

/** Clusters for the whiteboard. Empty reasons are dropped — no ghost regions. */
export function byReason(trades: Trade[]): Group<Reason>[] {
  return [...groupBy(trades, (t) => t.reason, REASONS)]
    .filter(([, ts]) => ts.length > 0)
    .map(([key, ts]) => ({ key, trades: ts, stats: aggregate(ts) }));
}

/** Sorted worst-first: the leak you most need to see goes at the top. */
export function rByReason(trades: Trade[]): Group<Reason>[] {
  return byReason(trades).sort((a, b) => a.stats.totalR - b.stats.totalR);
}

export function rByTargetType(trades: Trade[]): Group<TargetType>[] {
  return [...groupBy(trades, (t) => t.target_type, TARGET_TYPES)]
    .filter(([, ts]) => ts.length > 0)
    .map(([key, ts]) => ({ key, trades: ts, stats: aggregate(ts) }))
    .sort((a, b) => a.stats.totalR - b.stats.totalR);
}

/** Does the grading actually predict outcomes? */
export function byGradeBucket(trades: Trade[]): Group<string>[] {
  return GRADE_BUCKETS.map((bucket) => {
    const ts = trades.filter((t) => bucket.test(t.grade_total));
    return { key: bucket.label as string, trades: ts, stats: aggregate(ts) };
  }).filter((g) => g.trades.length > 0);
}

export function byMacroTime(trades: Trade[]): Group<'Inside macro' | 'Outside macro'>[] {
  const inside = trades.filter((t) => t.macro_time);
  const outside = trades.filter((t) => !t.macro_time);
  return [
    { key: 'Inside macro' as const, trades: inside, stats: aggregate(inside) },
    { key: 'Outside macro' as const, trades: outside, stats: aggregate(outside) },
  ].filter((g) => g.trades.length > 0);
}

/**
 * Repeating leaks: two trades that share a target type and both lost. These get
 * a dashed edge on the whiteboard so the pattern shows up as a physical line.
 */
export function leakPairs(trades: Trade[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const losses = trades.filter((t) => t.outcome === 'Loss');
  for (const targetType of TARGET_TYPES) {
    const group = losses.filter((t) => t.target_type === targetType);
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) pairs.push([group[i].id, group[j].id]);
    }
  }
  return pairs;
}

export { isMacroTime };
