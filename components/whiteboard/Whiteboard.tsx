'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background, BackgroundVariant, ReactFlow, ReactFlowProvider, ViewportPortal,
  type Edge, type Node, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnimatePresence, motion } from 'framer-motion';
import {
  computeLayout, reasonAccent, GROUP_LABELS, GROUP_MODES, NODE_H, NODE_W, type GroupMode,
} from '@/lib/layout';
import { spring, springBouncy } from '@/lib/motion';
import type { BoardEdge, BoardNote, Trade } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { usePreferences } from '@/components/shell/PreferencesProvider';
import { DENSITY_SCALE } from '@/lib/preferences';
import { BoardControls } from './BoardControls';
import { BoardTitle } from './BoardTitle';
import { ClusterNode } from './ClusterNode';
import { DetailPanel } from './DetailPanel';
import { Toolbar, EMPTY_FILTERS, applyFilters, filtersActive, type Filters } from './Toolbar';
import { BulkBar } from './BulkBar';
import { RiskBanner } from './RiskBanner';
import { StickyNotes } from './StickyNotes';
import { OUTCOME_COLOR, TradeNode } from './TradeNode';

const nodeTypes = { trade: TradeNode, cluster: ClusterNode, title: BoardTitle };

function WhiteboardInner({ trades: initial, readOnly = false }: { trades: Trade[]; readOnly?: boolean }) {
  const [trades, setTrades] = useState(initial);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);

  // An explicit mode rather than React Flow's own selection: on this board a
  // click already means "open this trade", and overloading it with
  // shift-to-select made both gestures unreliable.
  // The same clustering answers different questions: by mistake tag it shows
  // which error repeats, by month whether any of this is improving.
  const [groupMode, setGroupMode] = useState<GroupMode>('reason');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [board, setBoard] = useState<{ notes: BoardNote[]; edges: BoardEdge[] }>({ notes: [], edges: [] });
  const loadBoard = useCallback(async () => {
    const res = await fetch('/api/board');
    if (res.ok) setBoard(await res.json());
  }, []);
  useEffect(() => { loadBoard(); }, [loadBoard]);

  /** A note lands where the viewport is, not at the origin of a huge board. */
  const addNote = useCallback(async () => {
    await fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'note', body: '', x: 40, y: 40 }),
    });
    await loadBoard();
  }, [loadBoard]);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/trades');
    if (res.ok) setTrades(await res.json());
  }, []);

  const { prefs } = usePreferences();
  const scale = DENSITY_SCALE[prefs.boardDensity];

  const visible = useMemo(() => trades.filter(applyFilters(filters)), [trades, filters]);
  const layout = useMemo(() => computeLayout(visible, scale, groupMode), [visible, scale, groupMode]);

  const onOpen = useCallback((id: string) => {
    if (readOnly) return;
    if (selectMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      return;
    }
    setOpenId(id);
  }, [readOnly, selectMode]);

  const applyBulk = useCallback(async (patch: Record<string, unknown>) => {
    await fetch('/api/trades/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selectedIds], patch }),
    });
    await refresh();
  }, [selectedIds, refresh]);

  /**
   * A link the app could never have inferred — "same mistake as this one".
   * Two selected trades is the whole gesture.
   */
  const linkSelected = useCallback(async () => {
    const [from, to] = [...selectedIds];
    if (!from || !to) return;
    const label = window.prompt('Why are these two linked?', 'same mistake as this');
    if (label === null) return;
    await fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'edge', from_id: from, to_id: to, label }),
    });
    await loadBoard();
    setSelectedIds(new Set());
  }, [selectedIds, loadBoard]);

  const leaveSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const nodes = useMemo<Node[]>(() => {
    /*
      The root. Centred over the clusters and placed above the highest one, so
      it reads as the thing they all hang from rather than as another card.
    */
    const spanLeft = Math.min(...layout.clusters.map((c) => c.x), 0);
    const spanRight = Math.max(...layout.clusters.map((c) => c.x + c.width), 0);
    const topY = Math.min(...layout.clusters.map((c) => c.y), 0);

    const titleNode: Node[] = layout.clusters.length === 0 ? [] : [{
      id: 'board-title',
      type: 'title',
      position: { x: (spanLeft + spanRight) / 2 - 150, y: topY - 200 },
      data: {
        label: GROUP_LABELS[groupMode],
        sub: `${layout.clusters.length} group${layout.clusters.length === 1 ? '' : 's'} · ${visible.length} trade${visible.length === 1 ? '' : 's'}`,
      },
      draggable: false,
      selectable: false,
      zIndex: 1,
    }];

    const clusterNodes: Node[] = layout.clusters.map((cluster, index) => ({
      id: `cluster-${cluster.key}`,
      type: 'cluster',
      position: { x: cluster.x, y: cluster.y },
      data: { cluster, accent: cluster.accent, index },
      draggable: false,
      selectable: false,
      zIndex: 0,
      style: { width: cluster.width, height: cluster.height },
    }));

    const tradeNodes: Node[] = layout.nodes.map((n) => ({
      id: n.trade.id,
      type: 'trade',
      position: { x: n.x, y: n.y },
      data: {
        trade: n.trade,
        selected: selectMode ? selectedIds.has(n.trade.id) : openId === n.trade.id,
        onOpen,
        scale,
        dimPassed: prefs.dimPassed,
        selectMode,
      },
      zIndex: 1,
      // Only the grab handle moves a node. See TradeNode for why.
      dragHandle: '.signature-drag-handle',
      style: { width: NODE_W * scale, height: NODE_H * scale },
    }));

    return [...titleNode, ...clusterNodes, ...tradeNodes];
  }, [layout, openId, onOpen, scale, prefs.dimPassed, selectMode, selectedIds, groupMode, visible.length]);

  const edges = useMemo<Edge[]>(() => {
    const within: Edge[] = layout.reasonEdges.map(([a, b]) => {
      const reason = layout.nodes.find((n) => n.trade.id === a)?.reason;
      const accent = reason ? reasonAccent(reason) : '140 140 150';
      return {
        id: `r-${a}-${b}`,
        source: a, target: b, type: 'default', animated: false,
        // Dotted, in the cluster's own hue: these say "same reason", which is a
        // quieter statement than the repeating-leak edges below.
        style: {
          stroke: `rgb(${accent} / 0.55)`,
          strokeWidth: 1.2,
          strokeDasharray: '1 5',
          strokeLinecap: 'round',
        },
        zIndex: 0,
      };
    });

    // The repeating leak: same target type, both lost. Deliberately loud.
    const leaks: Edge[] = layout.leakEdges.map(([a, b]) => ({
      id: `leak-${a}-${b}`,
      source: a, target: b, type: 'default', animated: true,
      // Heavier, dashed and moving — a repeating leak should be the loudest
      // line on the board.
      style: {
        stroke: `rgb(${OUTCOME_COLOR.Loss} / 0.65)`,
        strokeWidth: 1.6,
        strokeDasharray: '6 4',
      },
      zIndex: 2,
    }));

    /*
      Links I drew by hand. Always shown and never filtered away with the
      derived ones: a connection I made deliberately is the most valuable line
      on this board precisely because the app could not have found it.
    */
    const manual: Edge[] = board.edges
      .filter((e) => visible.some((t) => t.id === e.from_id) && visible.some((t) => t.id === e.to_id))
      .map((e) => ({
        id: `m-${e.id}`,
        source: e.from_id, target: e.to_id, type: 'default',
        label: e.label ?? undefined,
        labelStyle: { fill: 'var(--text-dim)', fontSize: 10 },
        labelBgStyle: { fill: 'var(--bg-raised)' },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 6,
        style: { stroke: 'rgb(var(--accent) / 0.75)', strokeWidth: 2 },
      }));

    /*
      The branches. One line from the board title to each group, in that
      group's own hue, so the whole board reads as one tree instead of a field
      of unexplained islands.
    */
    const branches: Edge[] = layout.clusters.map((cluster) => ({
      id: `branch-${cluster.key}`,
      source: 'board-title',
      target: `cluster-${cluster.key}`,
      type: 'default',
      // Thicker than the derived edges: this is the board's skeleton, and it
      // has to read at the zoom where the whole board fits on screen.
      style: { stroke: `rgb(${cluster.accent} / 0.7)`, strokeWidth: 2.5 },
      zIndex: 0,
    }));

    return [
      ...branches,
      ...(prefs.showReasonEdges ? within : []),
      ...(prefs.showLeakEdges ? leaks : []),
      ...manual,
    ];
  }, [layout, prefs.showReasonEdges, prefs.showLeakEdges, board.edges, visible]);

  /*
    Persist a drag so a manual arrangement survives a reload — but only in the
    default grouping. A position is "where I put this card on my board", and my
    board is organised by reason; saving a drag made while grouped by setup
    would silently rewrite that arrangement from a view that was never meant to
    be permanent.
  */
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (groupMode !== 'reason') return;
    for (const change of changes) {
      if (change.type !== 'position' || change.dragging !== false || !change.position) continue;
      const { id, position } = change;
      setTrades((prev) => prev.map((t) =>
        t.id === id ? { ...t, position_x: position.x, position_y: position.y } : t));
      void fetch(`/api/trades/${id}/position`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: position.x, y: position.y }),
      });
    }
  }, [groupMode]);

  /**
   * Pin anything the layout just placed for the first time.
   *
   * A trade with no stored coordinates is positioned by the clustering
   * algorithm, which means its spot depends on every other trade on the board —
   * so adding one trade quietly rearranged all the others, and closing the app
   * lost the arrangement entirely. Writing the computed position back the first
   * time a trade is drawn makes the board stable: from then on it stays where
   * you last saw it until you re-order deliberately.
   *
   * Skipped while a filter is active, because that layout is a subset and
   * pinning it would bake a filtered arrangement into the whole board.
   */
  useEffect(() => {
    if (readOnly || filtersActive(filters)) return;
    const unpinned = layout.nodes.filter((n) => n.trade.position_x == null);
    if (unpinned.length === 0) return;

    const positions = unpinned.map((n) => ({ id: n.trade.id, x: n.x, y: n.y }));
    void fetch('/api/trades/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions }),
    }).then(() => {
      setTrades((prev) => prev.map((t) => {
        const pin = positions.find((pos) => pos.id === t.id);
        return pin ? { ...t, position_x: pin.x, position_y: pin.y } : t;
      }));
    });
  }, [layout, filters, readOnly]);

  const recluster = useCallback(async () => {
    await fetch('/api/trades/positions', { method: 'DELETE' });
    await refresh();
  }, [refresh]);

  const open = openId ? trades.find((t) => t.id === openId) ?? null : null;

  if (trades.length === 0) {
    return (
      <div className="grid h-full place-items-center">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={springBouncy} className="glass max-w-sm rounded-[28px] p-9 text-center"
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ ...springBouncy, delay: 0.08 }}
            className="mx-auto mb-5 grid size-12 place-items-center rounded-[16px]"
            style={{ background: 'var(--glass-fill-strong)', color: 'var(--text-faint)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="7" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="17.5" cy="15.5" r="3.2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9.6 9.8l5.4 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 2.4" />
            </svg>
          </motion.div>
          <h2 className="text-[17px] font-semibold tracking-tight">Nothing on the board yet</h2>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            Log a trade and it will appear here, clustered with every other trade you took
            for the same reason.
          </p>
          <a href="/new" className="mt-7 inline-block outline-none">
            <Button variant="primary" tabIndex={-1}>Log your first trade</Button>
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* In the layout, not floating over it. As an overlay this bar covered the
          top of whichever clusters happened to be nearest the top of the board,
          including their headers — which are the point of the screen. */}
      {!readOnly && (
        <div className="shrink-0 px-4 pb-2">
          <div className="mb-2 flex justify-center">
            <RiskBanner trades={trades} />
          </div>
          <Toolbar
            filters={filters}
            onChange={setFilters}
            shown={visible.length}
            total={trades.length}
            selectMode={selectMode}
            onToggleSelectMode={() => (selectMode ? leaveSelectMode() : setSelectMode(true))}
            groupMode={groupMode}
            onGroupMode={setGroupMode}
            onAddNote={addNote}
            onLinkSelected={selectedIds.size === 2 ? linkSelected : undefined}
          />
        </div>
      )}

      <div className="relative min-h-0 flex-1">
      {/* Bulk edit — the only practical way to backfill an account or a reason
          across a month of old entries. */}
      <AnimatePresence>
        {selectMode && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-6">
            <BulkBar count={selectedIds.size} onApply={applyBulk} onCancel={leaveSelectMode} />
          </div>
        )}
      </AnimatePresence>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        minZoom={0.12}
        maxZoom={2.2}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesDraggable={!readOnly}
        panOnDrag={!readOnly}
        zoomOnScroll={!readOnly}
        zoomOnDoubleClick={!readOnly}
        panOnScroll={!readOnly}
        selectionOnDrag={false}
        onPaneClick={() => setOpenId(null)}
        attributionPosition="bottom-center"
        style={{ background: 'transparent' }}
      >
        {prefs.showGrid && (
          <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="var(--board-dots)" />
        )}
        <ViewportPortal>
          <StickyNotes notes={board.notes} onChanged={loadBoard} />
        </ViewportPortal>
      </ReactFlow>

      {/* Filtering to nothing used to leave a blank canvas with no explanation. */}
      <AnimatePresence>
        {visible.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={spring}
            className="pointer-events-none absolute inset-0 grid place-items-center"
          >
            <div className="glass pointer-events-auto rounded-[24px] px-7 py-6 text-center">
              <p className="text-[14px] font-medium">No trades match these filters</p>
              <p className="mt-1.5 text-[12px]" style={{ color: 'var(--text-dim)' }}>
                {trades.length} trade{trades.length === 1 ? '' : 's'} are hidden.
              </p>
              <div className="mt-5">
                <Button onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom and layout, bottom-right — opposite the theme and settings
          cluster, and out of the way of the board itself. */}
      {!readOnly && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex justify-end">
          <BoardControls onRecluster={recluster} />
        </div>
      )}

      {!readOnly && <DetailPanel trade={open} onClose={() => setOpenId(null)} onChanged={refresh} />}
      </div>
    </div>
  );
}

export function Whiteboard({ trades, readOnly }: { trades: Trade[]; readOnly?: boolean }) {
  // ReactFlowProvider has to sit above anything calling its hooks.
  return (
    <ReactFlowProvider>
      <WhiteboardInner trades={trades} readOnly={readOnly} />
    </ReactFlowProvider>
  );
}
