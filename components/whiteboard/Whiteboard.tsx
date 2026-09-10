'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background, BackgroundVariant, ReactFlow, ReactFlowProvider,
  type Edge, type Node, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnimatePresence, motion } from 'framer-motion';
import { computeLayout, reasonAccent, NODE_H, NODE_W } from '@/lib/layout';
import { spring, springBouncy } from '@/lib/motion';
import type { Trade } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { usePreferences } from '@/components/shell/PreferencesProvider';
import { DENSITY_SCALE } from '@/lib/preferences';
import { BoardControls } from './BoardControls';
import { ClusterNode } from './ClusterNode';
import { DetailPanel } from './DetailPanel';
import { Toolbar, EMPTY_FILTERS, applyFilters, filtersActive, type Filters } from './Toolbar';
import { OUTCOME_COLOR, TradeNode } from './TradeNode';

const nodeTypes = { trade: TradeNode, cluster: ClusterNode };

function WhiteboardInner({ trades: initial, readOnly = false }: { trades: Trade[]; readOnly?: boolean }) {
  const [trades, setTrades] = useState(initial);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/trades');
    if (res.ok) setTrades(await res.json());
  }, []);

  const { prefs } = usePreferences();
  const scale = DENSITY_SCALE[prefs.boardDensity];

  const visible = useMemo(() => trades.filter(applyFilters(filters)), [trades, filters]);
  const layout = useMemo(() => computeLayout(visible, scale), [visible, scale]);

  const onOpen = useCallback((id: string) => { if (!readOnly) setOpenId(id); }, [readOnly]);

  const nodes = useMemo<Node[]>(() => {
    const clusterNodes: Node[] = layout.clusters.map((cluster, index) => ({
      id: `cluster-${cluster.reason}`,
      type: 'cluster',
      position: { x: cluster.x, y: cluster.y },
      data: { cluster, accent: reasonAccent(cluster.reason), index },
      draggable: false,
      selectable: false,
      zIndex: 0,
      style: { width: cluster.width, height: cluster.height },
    }));

    const tradeNodes: Node[] = layout.nodes.map((n) => ({
      id: n.trade.id,
      type: 'trade',
      position: { x: n.x, y: n.y },
      data: { trade: n.trade, selected: openId === n.trade.id, onOpen, scale, dimPassed: prefs.dimPassed },
      zIndex: 1,
      // Only the grab handle moves a node. See TradeNode for why.
      dragHandle: '.signature-drag-handle',
      style: { width: NODE_W * scale, height: NODE_H * scale },
    }));

    return [...clusterNodes, ...tradeNodes];
  }, [layout, openId, onOpen, scale, prefs.dimPassed]);

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

    return [
      ...(prefs.showReasonEdges ? within : []),
      ...(prefs.showLeakEdges ? leaks : []),
    ];
  }, [layout, prefs.showReasonEdges, prefs.showLeakEdges]);

  // Persist a drag so a manual arrangement survives a reload.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
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
  }, []);

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
          <Toolbar filters={filters} onChange={setFilters} shown={visible.length} total={trades.length} />
        </div>
      )}

      <div className="relative min-h-0 flex-1">
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
