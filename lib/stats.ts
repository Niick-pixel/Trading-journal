import {
  CHECKLIST_ITEMS, REASONS, SKIP_REASONS, TARGET_TYPES, isTaken,
  type ChecklistKey, type Reason, type SkipReason, type TargetType,
} from './domain';
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

/**
 * Money, derived rather than stored.
 *
 * A trade records what it risked and what it returned in R, so dollars are
 * risk_dollars x r_multiple. Trades with no risk recorded contribute nothing
 * to the money figures but still count everywhere else — which is why the
 * dollar totals carry their own `priced` count, so a half-filled journal
 * cannot quietly look like a small one.
 */
export interface Money {
  /** Trades that recorded both a risk and an R multiple. */
  priced: number;
  won: number;
  lost: number;
  net: number;
  totalRisked: number;
  biggestWin: number;
  biggestLoss: number;
}

export function money(trades: Trade[]): Money {
  let won = 0;
  let lost = 0;
  let totalRisked = 0;
  let priced = 0;
  let biggestWin = 0;
  let biggestLoss = 0;

  for (const t of trades) {
    if (!isTaken(t.outcome) || t.risk_dollars == null || t.r_multiple == null) continue;
    priced += 1;
    totalRisked += t.risk_dollars;
    const pnl = t.risk_dollars * t.r_multiple;
    if (pnl >= 0) {
      won += pnl;
      biggestWin = Math.max(biggestWin, pnl);
    } else {
      lost += Math.abs(pnl);
      biggestLoss = Math.max(biggestLoss, Math.abs(pnl));
    }
  }

  return { priced, won, lost, net: won - lost, totalRisked, biggestWin, biggestLoss };
}

export interface Edge {
  /** Sum of every positive R. */
  rWon: number;
  /** Sum of every negative R, as a positive number. */
  rLost: number;
  avgWinR: number | null;
  avgLossR: number | null;
  /** Average R per trade taken — the number that decides whether this works. */
  expectancy: number | null;
  /** Gross R won divided by gross R lost. Above 1 is a living. */
  profitFactor: number | null;
  bestR: number | null;
  worstR: number | null;
  longestWinStreak: number;
  longestLossStreak: number;
}

export function edge(trades: Trade[]): Edge {
  const taken = trades.filter((t) => isTaken(t.outcome) && t.r_multiple != null);
  const wins = taken.filter((t) => (t.r_multiple as number) > 0);
  const losses = taken.filter((t) => (t.r_multiple as number) < 0);

  const rWon = wins.reduce((sum, t) => sum + (t.r_multiple as number), 0);
  const rLost = Math.abs(losses.reduce((sum, t) => sum + (t.r_multiple as number), 0));

  // Streaks run in the order the trades happened, oldest first.
  const chronological = [...taken].sort((a, b) => a.date.localeCompare(b.date));
  let winStreak = 0;
  let lossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  for (const t of chronological) {
    if (t.outcome === 'Win') {
      winStreak += 1; lossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, winStreak);
    } else if (t.outcome === 'Loss') {
      lossStreak += 1; winStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, lossStreak);
    } else {
      winStreak = 0; lossStreak = 0;
    }
  }

  const rs = taken.map((t) => t.r_multiple as number);
  return {
    rWon,
    rLost,
    avgWinR: wins.length ? rWon / wins.length : null,
    avgLossR: losses.length ? rLost / losses.length : null,
    expectancy: taken.length ? (rWon - rLost) / taken.length : null,
    profitFactor: rLost > 0 ? rWon / rLost : null,
    bestR: rs.length ? Math.max(...rs) : null,
    worstR: rs.length ? Math.min(...rs) : null,
    longestWinStreak,
    longestLossStreak,
  };
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
    avgGrade: trades.length ? trades.reduce((s, t) => s + t.checklist_score, 0) / trades.length : null,
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
    const ts = trades.filter((t) => bucket.test(t.checklist_score));
    return { key: bucket.label as string, trades: ts, stats: aggregate(ts) };
  }).filter((g) => g.trades.length > 0);
}

/** Generic grouping by any string field, dropping empty buckets. */
export function groupByField<K extends string>(
  trades: Trade[],
  key: (t: Trade) => K,
  keys: readonly K[],
): Group<K>[] {
  return [...groupBy(trades, key, keys)]
    .filter(([, ts]) => ts.length > 0)
    .map(([k, ts]) => ({ key: k, trades: ts, stats: aggregate(ts) }));
}

/**
 * What is actually costing you: reasons ranked by total R lost, counting only
 * the losing trades. Distinct from "R by reason", which nets wins against
 * losses and can hide a reason that both makes and loses a great deal.
 */
export function losingReasons(trades: Trade[]): Array<{ reason: Reason; losses: number; rLost: number }> {
  const out = new Map<Reason, { losses: number; rLost: number }>();
  for (const t of trades) {
    if (t.outcome !== 'Loss') continue;
    const entry = out.get(t.reason) ?? { losses: 0, rLost: 0 };
    entry.losses += 1;
    entry.rLost += Math.abs(t.r_multiple ?? 0);
    out.set(t.reason, entry);
  }
  return [...out]
    .map(([reason, v]) => ({ reason, ...v }))
    .sort((a, b) => b.rLost - a.rLost || b.losses - a.losses);
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

/* ------------------------------------------------------------------ *
 * The plan's own questions.
 *
 * Everything above measures the market. These measure you: whether you
 * followed the rules, whether you graded honestly, and what the setups you
 * talked yourself out of would have paid.
 * ------------------------------------------------------------------ */

/**
 * Rule-following against rule-breaking, in R.
 *
 * The plan's premise is that the edge is in the rules rather than in the
 * picks. If broken-rule trades net positive, that premise is being tested by
 * the market and needs an answer — not ignored because the money was good.
 */
export interface Discipline {
  followed: Aggregate;
  broken: Aggregate;
  /** R given up by the trades where a rule was broken. Negative is a cost. */
  costOfBreaking: number;
  /** Taken without both Phase 3 answers — entries the plan says don't exist. */
  untriggered: Aggregate;
}

export function discipline(trades: Trade[]): Discipline {
  const followed = trades.filter((t) => t.followed_rules);
  const broken = trades.filter((t) => !t.followed_rules);
  const untriggered = trades.filter((t) => isTaken(t.outcome) && !t.trigger_fired);

  return {
    followed: aggregate(followed),
    broken: aggregate(broken),
    costOfBreaking: aggregate(broken).totalR,
    untriggered: aggregate(untriggered),
  };
}

/**
 * Letters on one scale, so the grade given at entry and the re-grade given
 * after the close can be compared. The entry grade only ever produces A+, A,
 * B, C or F; the re-grade is allowed the finer steps in between.
 */
const GRADE_RANK: Record<string, number> = {
  'A+': 8, A: 7, 'A-': 6, 'B+': 5, B: 4, 'B-': 3, C: 2, F: 1,
};

/**
 * Grade inflation: did you talk the setup up before the entry?
 *
 * A trade re-graded below the score the checklist gave it means the boxes were
 * ticked to reach a number rather than because they were true. One is a bad
 * day; a pattern of it means the checklist is being used as permission.
 */
export interface GradeHonesty {
  /** Trades that have been re-graded at all. */
  regraded: number;
  /** Re-graded below the entry grade — the checklist was flattered. */
  inflated: number;
  /** Re-graded above it. */
  understated: number;
  matched: number;
  /** Average letters of drop, over the re-graded trades. Positive is inflation. */
  averageDrop: number | null;
  /** The worst offenders, most-inflated first. */
  worst: Array<{ trade: Trade; from: string; to: string; drop: number }>;
}

export function gradeHonesty(trades: Trade[]): GradeHonesty {
  const regraded = trades.filter((t) => t.regrade != null);
  const scored = regraded.map((t) => {
    const from = t.grade_letter;
    const to = t.regrade as string;
    return { trade: t, from, to, drop: (GRADE_RANK[from] ?? 0) - (GRADE_RANK[to] ?? 0) };
  });

  return {
    regraded: regraded.length,
    inflated: scored.filter((s) => s.drop > 0).length,
    understated: scored.filter((s) => s.drop < 0).length,
    matched: scored.filter((s) => s.drop === 0).length,
    averageDrop: scored.length ? scored.reduce((sum, s) => sum + s.drop, 0) / scored.length : null,
    worst: scored.filter((s) => s.drop > 0).sort((a, b) => b.drop - a.drop).slice(0, 5),
  };
}

/**
 * What hesitation cost.
 *
 * A skipped setup that would have won is a real loss that never appears in the
 * P&L, which is exactly why it goes unexamined. `rLeft` only counts the ones
 * you went back and confirmed — a guess here would make the number worthless.
 */
export interface Hesitation {
  /** Setups marked 'Not taken'. */
  skipped: number;
  /** Of those, the ones you actually went back and checked. */
  checked: number;
  wouldHaveWon: number;
  wouldHaveLost: number;
  /** Total R the confirmed winners would have paid. */
  rLeft: number;
  /** R the confirmed losers saved you by being skipped. */
  rAvoided: number;
  /** Skips grouped by the real reason, costliest first. */
  byReason: Array<{ reason: SkipReason; count: number; rLeft: number }>;
}

export function hesitation(trades: Trade[]): Hesitation {
  const skipped = trades.filter((t) => t.outcome === 'Not taken');
  const checked = skipped.filter((t) => t.would_have_hit_tp != null);
  const won = checked.filter((t) => t.would_have_hit_tp === true);
  const lost = checked.filter((t) => t.would_have_hit_tp === false);

  const byReason = SKIP_REASONS.map((reason) => {
    const group = skipped.filter((t) => t.skip_reason === reason);
    return {
      reason,
      count: group.length,
      rLeft: group
        .filter((t) => t.would_have_hit_tp === true)
        .reduce((sum, t) => sum + (t.r_left_on_table ?? 0), 0),
    };
  })
    .filter((g) => g.count > 0)
    .sort((a, b) => b.rLeft - a.rLeft || b.count - a.count);

  return {
    skipped: skipped.length,
    checked: checked.length,
    wouldHaveWon: won.length,
    wouldHaveLost: lost.length,
    rLeft: won.reduce((sum, t) => sum + (t.r_left_on_table ?? 0), 0),
    rAvoided: lost.reduce((sum, t) => sum + Math.abs(t.r_left_on_table ?? 0), 0),
    byReason,
  };
}

/**
 * Is each checklist item earning its weight?
 *
 * For every item, the R per trade taken with it ticked against the R per trade
 * taken without. A large positive lift on a 5-point item, or none at all on a
 * 20-point one, is an argument that the weights are wrong — which is a thing
 * the plan should be allowed to learn.
 */
export interface ItemEdge {
  key: ChecklistKey;
  label: string;
  points: number;
  withCount: number;
  withoutCount: number;
  withAvgR: number | null;
  withoutAvgR: number | null;
  /** withAvgR − withoutAvgR. Null until both sides have a trade. */
  lift: number | null;
}

export function checklistEdge(trades: Trade[]): ItemEdge[] {
  const taken = trades.filter((t) => isTaken(t.outcome) && t.r_multiple != null);
  const avg = (ts: Trade[]) =>
    ts.length ? ts.reduce((sum, t) => sum + (t.r_multiple as number), 0) / ts.length : null;

  return CHECKLIST_ITEMS.map((item) => {
    const on = taken.filter((t) => t[item.key]);
    const off = taken.filter((t) => !t[item.key]);
    const withAvgR = avg(on);
    const withoutAvgR = avg(off);
    return {
      key: item.key,
      label: item.label,
      points: item.points,
      withCount: on.length,
      withoutCount: off.length,
      withAvgR,
      withoutAvgR,
      lift: withAvgR != null && withoutAvgR != null ? withAvgR - withoutAvgR : null,
    };
  });
}
