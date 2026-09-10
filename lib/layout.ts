import { byReason, leakPairs, type Group } from './stats';
import { REASONS, type Reason } from './domain';
import type { Trade } from './types';
import type { Aggregate } from './stats';

export const NODE_W = 208;
export const NODE_H = 152;

const GAP_X = 34;
const GAP_Y = 30;
const PAD = 30;
const HEADER_H = 68;
const CLUSTER_GAP = 76;
/** Clusters wrap onto a new row past this width. */
const BOARD_W = 2100;
/**
 * A one-trade cluster is only ~268px wide, which squeezes the reason label out
 * of its own header — and the label is the thing you are meant to read. Floor
 * the width at what the header actually needs.
 */
const MIN_CLUSTER_W = 480;

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

export interface PositionedTrade {
  trade: Trade;
  x: number;
  y: number;
  reason: Reason;
}

export interface PositionedCluster {
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

function clusterGrid(count: number) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  return {
    cols,
    rows,
    width: Math.max(MIN_CLUSTER_W, cols * NODE_W + (cols - 1) * GAP_X + PAD * 2),
    height: HEADER_H + rows * NODE_H + (rows - 1) * GAP_Y + PAD,
  };
}

/**
 * Lays clusters out worst-first — the reason costing you the most R lands
 * top-left, where you look first. That placement is the entire argument for
 * this screen existing.
 */
export function computeLayout(trades: Trade[]): BoardLayout {
  const groups: Group<Reason>[] = byReason(trades).sort((a, b) => a.stats.totalR - b.stats.totalR);

  const clusters: PositionedCluster[] = [];
  const nodes: PositionedTrade[] = [];
  const reasonEdges: Array<[string, string]> = [];

  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const group of groups) {
    const grid = clusterGrid(group.trades.length);

    // Wrap to the next row when this cluster would overflow the board width.
    if (cursorX > 0 && cursorX + grid.width > BOARD_W) {
      cursorX = 0;
      cursorY += rowHeight + CLUSTER_GAP;
      rowHeight = 0;
    }

    clusters.push({
      reason: group.key,
      stats: group.stats,
      x: cursorX,
      y: cursorY,
      width: grid.width,
      height: grid.height,
      trades: group.trades,
    });

    // Newest first, so the most recent trade sits top-left inside its cluster.
    const ordered = [...group.trades].sort((a, b) => b.date.localeCompare(a.date));

    ordered.forEach((trade, i) => {
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      // A loose organic scatter, not a rigid grid — but deterministic.
      const jitterX = (seeded(trade.id, 1) - 0.5) * 26;
      const jitterY = (seeded(trade.id, 2) - 0.5) * 22;

      nodes.push({
        trade,
        reason: group.key,
        // A manual drag wins over the computed position.
        x: trade.position_x ?? cursorX + PAD + col * (NODE_W + GAP_X) + jitterX,
        y: trade.position_y ?? cursorY + HEADER_H + row * (NODE_H + GAP_Y) + jitterY,
      });

      if (i > 0) reasonEdges.push([ordered[i - 1].id, trade.id]);
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
