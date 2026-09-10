'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background, BackgroundVariant, ReactFlow, ReactFlowProvider,
  type Edge, type Node, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { REASON_HUE } from '@/lib/domain';
import { computeLayout, hueToRgb, NODE_H, NODE_W } from '@/lib/layout';
import { spring } from '@/lib/motion';
import type { Trade } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { ClusterNode } from './ClusterNode';
import { DetailPanel } from './DetailPanel';
import { Toolbar, EMPTY_FILTERS, applyFilters, filtersActive, type Filters } from './Toolbar';
import { OUTCOME_COLOR, TradeNode } from './TradeNode';

const nodeTypes = { trade: TradeNode, cluster: ClusterNode };

function WhiteboardInner({ trades: initial }: { trades: Trade[] }) {
  const [trades, setTrades] = useState(initial);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/trades');
    if (res.ok) setTrades(await res.json());
  }, []);

  const visible = useMemo(() => trades.filter(applyFilters(filters)), [trades, filters]);
  const layout = useMemo(() => computeLayout(visible), [visible]);

  const onOpen = useCallback((id: string) => setOpenId(id), []);

  const nodes = useMemo<Node[]>(() => {
    const clusterNodes: Node[] = layout.clusters.map((cluster) => ({
      id: `cluster-${cluster.reason}`,
      type: 'cluster',
      position: { x: cluster.x, y: cluster.y },
      data: { cluster, accent: hueToRgb(REASON_HUE[cluster.reason]) },
      draggable: false,
      selectable: false,
      zIndex: 0,
      style: { width: cluster.width, height: cluster.height },
    }));

    const tradeNodes: Node[] = layout.nodes.map((n) => ({
      id: n.trade.id,
      type: 'trade',
      position: { x: n.x, y: n.y },
      data: { trade: n.trade, selected: openId === n.trade.id, onOpen },
      zIndex: 1,
      style: { width: NODE_W, height: NODE_H },
    }));

    return [...clusterNodes, ...tradeNodes];
  }, [layout, openId, onOpen]);

  const edges = useMemo<Edge[]>(() => {
    const within: Edge[] = layout.reasonEdges.map(([a, b]) => {
      const reason = layout.nodes.find((n) => n.trade.id === a)?.reason;
      const accent = reason ? hueToRgb(REASON_HUE[reason]) : '140 140 150';
      return {
        id: `r-${a}-${b}`,
        source: a, target: b, type: 'bezier', animated: true,
        style: { stroke: `rgb(${accent} / 0.42)`, strokeWidth: 1 },
        zIndex: 0,
      };
    });

    // The repeating leak: same target type, both lost. Deliberately loud.
    const leaks: Edge[] = layout.leakEdges.map(([a, b]) => ({
      id: `leak-${a}-${b}`,
      source: a, target: b, type: 'bezier', animated: false,
      style: {
        stroke: `rgb(${OUTCOME_COLOR.Loss} / 0.55)`,
        strokeWidth: 1.4,
        strokeDasharray: '5 5',
      },
      zIndex: 2,
    }));

    return [...within, ...leaks];
  }, [layout]);

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

  const recluster = useCallback(async () => {
    await fetch('/api/trades/positions', { method: 'DELETE' });
    await refresh();
  }, [refresh]);

  const open = openId ? trades.find((t) => t.id === openId) ?? null : null;
  const moved = trades.some((t) => t.position_x != null);

  if (trades.length === 0) {
    return (
      <div className="grid h-full place-items-center">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={spring} className="glass max-w-sm rounded-[24px] p-8 text-center"
        >
          <h2 className="text-[17px] font-semibold">Nothing on the board yet</h2>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            Log a trade and it will appear here, clustered with every other trade you took
            for the same reason.
          </p>
          <a href="/new" className="mt-6 inline-block">
            <Button variant="primary">Log your first trade</Button>
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        minZoom={0.12}
        maxZoom={2.2}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        selectionOnDrag={false}
        onPaneClick={() => setOpenId(null)}
        style={{ background: 'transparent' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="rgba(255,255,255,0.055)" />
      </ReactFlow>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
        <div className="pointer-events-auto flex max-w-full items-center gap-3">
          <Toolbar filters={filters} onChange={setFilters} shown={visible.length} total={trades.length} />
          {moved && !filtersActive(filters) && (
            <Button onClick={recluster} className="shrink-0">Re-cluster</Button>
          )}
        </div>
      </div>

      <DetailPanel trade={open} onClose={() => setOpenId(null)} onChanged={refresh} />
    </div>
  );
}

export function Whiteboard({ trades }: { trades: Trade[] }) {
  // ReactFlowProvider has to sit above anything calling its hooks.
  return (
    <ReactFlowProvider>
      <WhiteboardInner trades={trades} />
    </ReactFlowProvider>
  );
}
