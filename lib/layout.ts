import { aggregate, byReason, leakPairs } from './stats';
import { REASONS, type Reason } from './domain';
import { gradeLetter } from './grade';
import type { Trade } from './types';
import type { Aggregate } from './stats';

export const NODE_W = 208;
export const NODE_H = 152;

const GAP_X = 34;
const GAP_Y = 30;
const PAD = 30;
const HEADER_H = 96;
const CLUSTER_GAP = 76;
/** Clusters wrap onto a new row past this width. */
const BOARD_W = 2100;
/**
 * Floor for cluster width. With the header on two rows the label no longer
 * competes with the stats, so this only has to fit the stats row — which is why
 * it is narrower than it was when they shared a line.
 */
const MIN_CLUSTER_W = 430;

/**
 * A stable pseudo-random number in [0,1) derived from a trade id.
 *
 * The scatter inside a cluster has to look organic but must not move between
 * reloads — a whiteboard that reshuffles itself every time you open it is
 * useless for recognising your own patterns. Hashing the id gives both.
 */
function seeded(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * What the board groups by.
 *
 * Reason is the default and the reason this screen exists, but the same
 * clustering answers different questions: grouped by mistake tag it shows
 * which error repeats, by month it shows whether any of this is improving.
 */
export const GROUP_MODES = [
  'reason', 'mistake', 'grade', 'setup', 'target', 'month',
] as const;
export type GroupMode = (typeof GROUP_MODES)[number];

export const GROUP_LABELS: Record<GroupMode, string> = {
  reason: 'Reason',
  mistake: 'Mistake',
  grade: 'Grade',
  setup: 'Setup',
  target: 'Target',
  month: 'Month',
};

export interface PositionedTrade {
  trade: Trade;
  x: number;
  y: number;
  reason: Reason;
}

export interface PositionedCluster {
  /** The group's own label — a reason, a tag, a month. */
  key: string;
  /** Hue for the cluster. Reason keeps its identity colour; others cycle. */
  accent: string;
  reason: Reason;
  stats: Aggregate;
  x: number;
  y: number;
  width: number;
  height: number;
  trades: Trade[];
}

export interface BoardLayout {
  clusters: PositionedCluster[];
  nodes: PositionedTrade[];
  /** Chains through each reason cluster. */
  reasonEdges: Array<[string, string]>;
  /** Dashed cross-cluster edges: same target type, both lost. */
  leakEdges: Array<[string, string]>;
}

function clusterGrid(count: number, scale: number) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const w = NODE_W * scale;
  const h = NODE_H * scale;
  return {
    cols,
    rows,
    width: Math.max(MIN_CLUSTER_W, cols * w + (cols - 1) * GAP_X + PAD * 2),
    height: HEADER_H + rows * h + (rows - 1) * GAP_Y + PAD,
  };
}

/**
 * Lays clusters out worst-first — the reason costing you the most R lands
 * top-left, where you look first. That placement is the entire argument for
 * this screen existing.
 */
interface BoardGroup { key: string; reason: Reason; accent: string; stats: Aggregate; trades: Trade[] }

/**
 * Buckets the trades for whichever mode the board is in.
 *
 * A trade with three mistake tags appears in three clusters under 'mistake' —
 * that is correct and deliberate: the point of grouping by mistake is to see
 * every trade each error touched, not to force one label per trade.
 */
function groupsFor(trades: Trade[], mode: GroupMode): BoardGroup[] {
  if (mode === 'reason') {
    return byReason(trades)
      .sort((a, b) => a.stats.totalR - b.stats.totalR)
      .map((g) => ({
        key: g.key, reason: g.key, accent: reasonAccent(g.key), stats: g.stats, trades: g.trades,
      }));
  }

  const buckets = new Map<string, Trade[]>();
  const put = (key: string, t: Trade) => {
    const list = buckets.get(key) ?? [];
    list.push(t);
    buckets.set(key, list);
  };

  for (const t of trades) {
    if (mode === 'mistake') {
      if (t.mistake_tags.length === 0) put('No mistake tagged', t);
      else for (const tag of t.mistake_tags) put(tag, t);
    } else if (mode === 'grade') {
      put(gradeLetter(t.checklist_score), t);
    } else if (mode === 'setup') {
      put(t.setup_type, t);
    } else if (mode === 'target') {
      put(t.target_type, t);
    } else {
      put(t.date.slice(0, 7), t);
    }
  }

  return [...buckets]
    .map(([key, list], i) => ({
      key,
      // The nodes keep their own reason hue; the cluster takes a cycled one so
      // adjacent regions stay distinguishable.
      reason: list[0].reason,
      accent: `var(--reason-${i % 12})`,
      stats: aggregate(list),
      trades: list,
    }))
    .sort((a, b) => (mode === 'month' ? a.key.localeCompare(b.key) : a.stats.totalR - b.stats.totalR));
}

export function computeLayout(trades: Trade[], scale = 1, mode: GroupMode = 'reason'): BoardLayout {
  const groups = groupsFor(trades, mode);

  const clusters: PositionedCluster[] = [];
  const nodes: PositionedTrade[] = [];
  const reasonEdges: Array<[string, string]> = [];

  const nodeW = NODE_W * scale;
  const nodeH = NODE_H * scale;

  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const group of groups) {
    const grid = clusterGrid(group.trades.length, scale);

    // Wrap to the next row when this cluster would overflow the board width.
    if (cursorX > 0 && cursorX + grid.width > BOARD_W) {
      cursorX = 0;
      cursorY += rowHeight + CLUSTER_GAP;
      rowHeight = 0;
    }

    // Newest first, so the most recent trade sits top-left inside its cluster.
    const ordered = [...group.trades].sort((a, b) => b.date.localeCompare(a.date));
    const placed: PositionedTrade[] = [];

    ordered.forEach((trade, i) => {
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      // A loose organic scatter, not a rigid grid — but deterministic.
      const jitterX = (seeded(trade.id, 1) - 0.5) * 26;
      const jitterY = (seeded(trade.id, 2) - 0.5) * 22;

      placed.push({
        trade,
        reason: trade.reason,
        // A stored position always wins: once a trade has been drawn it keeps
        // its spot, so adding a later trade never rearranges the board.
        x: trade.position_x ?? cursorX + PAD + col * (nodeW + GAP_X) + jitterX,
        y: trade.position_y ?? cursorY + HEADER_H + row * (nodeH + GAP_Y) + jitterY,
      });

      if (i > 0) reasonEdges.push([ordered[i - 1].id, trade.id]);
    });

    nodes.push(...placed);

    /*
      The region is drawn around where the nodes actually ended up, not around
      where the grid would have put them. Once positions are pinned — or a card
      is dragged — a region derived from the grid no longer contains its own
      trades, which looked like a rendering fault.
    */
    const minX = Math.min(...placed.map((n) => n.x));
    const minY = Math.min(...placed.map((n) => n.y));
    const maxX = Math.max(...placed.map((n) => n.x + nodeW));
    const maxY = Math.max(...placed.map((n) => n.y + nodeH));

    const x = minX - PAD;
    const y = minY - HEADER_H;
    const width = Math.max(MIN_CLUSTER_W, maxX - minX + PAD * 2);
    const height = maxY - minY + HEADER_H + PAD;

    clusters.push({
      key: group.key, accent: group.accent, reason: group.reason,
      stats: group.stats, x, y, width, height, trades: group.trades,
    });

    cursorX += grid.width + CLUSTER_GAP;
    rowHeight = Math.max(rowHeight, grid.height);
  }

  return { clusters, nodes, reasonEdges, leakEdges: leakChains(trades) };
}

/**
 * Repeating leaks. leakPairs() returns every pair, which becomes a hairball on
 * a group of any size — chaining them by date keeps the line visible while
 * still linking every trade in the group.
 */
function leakChains(trades: Trade[]): Array<[string, string]> {
  const pairs = leakPairs(trades);
  if (pairs.length === 0) return [];

  const byTarget = new Map<string, Trade[]>();
  for (const t of trades) {
    if (t.outcome !== 'Loss') continue;
    const list = byTarget.get(t.target_type) ?? [];
    list.push(t);
    byTarget.set(t.target_type, list);
  }

  const chains: Array<[string, string]> = [];
  for (const group of byTarget.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < ordered.length; i++) chains.push([ordered[i - 1].id, ordered[i].id]);
  }
  return chains;
}

/**
 * The colour for a reason cluster, as a CSS variable reference.
 *
 * Indexed off REASONS rather than computed from the hue angle, because the same
 * hue needs a different lightness per theme and a server component has no way to
 * know which theme is active. app/globals.css defines --reason-0..11 twice.
 */
export function reasonAccent(reason: Reason): string {
  const index = REASONS.indexOf(reason);
  return `var(--reason-${index < 0 ? 0 : index})`;
}
