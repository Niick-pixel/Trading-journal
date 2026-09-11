'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { GRADE_COLOR, gradeLetter } from '@/lib/grade';
import { spring, springLayout } from '@/lib/motion';
import { NODE_H, NODE_W } from '@/lib/layout';
import type { Outcome } from '@/lib/domain';
import type { Trade } from '@/lib/types';

/** Border colour carries the outcome. Nothing else on the card does. */
export const OUTCOME_COLOR: Record<Outcome, string> = {
  Win: 'var(--outcome-win)',
  Loss: 'var(--outcome-loss)',
  Breakeven: 'var(--outcome-neutral)',
  Scratched: 'var(--outcome-neutral)',
  'Not taken': 'var(--outcome-passed)',
};

export type TradeNodeData = {
  trade: Trade;
  selected: boolean;
  onOpen: (id: string) => void;
  scale: number;
  dimPassed: boolean;
};

function TradeNodeInner({ data }: NodeProps) {
  const { trade, selected, onOpen, scale = 1, dimPassed = true } = data as unknown as TradeNodeData;
  const outcome = OUTCOME_COLOR[trade.outcome];
  const grade = GRADE_COLOR[gradeLetter(trade.checklist_score)];
  const passed = trade.outcome === 'Not taken';

  return (
    <motion.div
      layout
      layoutId={`trade-${trade.id}`}
      transition={springLayout}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => onOpen(trade.id)}
      style={{
        width: NODE_W * scale,
        height: NODE_H * scale,
        borderColor: `rgb(${outcome} / ${passed ? 0.35 : 0.65})`,
        boxShadow: selected
          ? `var(--shadow-panel), 0 0 34px rgb(${outcome} / 0.5)`
          : `var(--shadow-card), 0 0 16px rgb(${outcome} / 0.16)`,
        opacity: passed && dimPassed ? 0.62 : 1,
      }}
      className="group glass relative cursor-pointer overflow-hidden rounded-[18px]"
    >
      {/* React Flow needs handles to anchor edges, but they must not be seen. */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />

      {/*
        The only place the card can be dragged from.
        With the whole card draggable, opening a trade and nudging it out of its
        cluster were the same gesture, and the board drifted just from being
        read. Clicking anywhere still opens the detail panel; moving it takes a
        deliberate grab here.
      */}
      <div
        className="signature-drag-handle absolute left-1.5 top-1.5 z-10 grid size-6 cursor-grab
          place-items-center rounded-[8px] opacity-0 transition-opacity active:cursor-grabbing
          group-hover:opacity-100"
        title="Drag to move"
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'rgba(10,10,12,0.55)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.16)',
        }}
      >
        <svg width="9" height="11" viewBox="0 0 9 11" fill="none" aria-hidden>
          <g fill="rgba(255,255,255,0.75)">
            <circle cx="2" cy="1.6" r="1" /><circle cx="7" cy="1.6" r="1" />
            <circle cx="2" cy="5.5" r="1" /><circle cx="7" cy="5.5" r="1" />
            <circle cx="2" cy="9.4" r="1" /><circle cx="7" cy="9.4" r="1" />
          </g>
        </svg>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/screenshots/${trade.screenshot_path}`}
        alt=""
        draggable={false}
        className="absolute inset-0 size-full object-cover"
        style={{ filter: passed && dimPassed ? 'grayscale(0.55) brightness(0.72)' : 'brightness(0.86)' }}
      />

      {/* A scrim so the corner chips stay legible over any chart. Fixed black
          regardless of theme on purpose: it sits over the screenshot, not over
          the page, and chart images are dark in both themes. */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.12) 46%, rgba(0,0,0,0.34) 100%)' }} />

      <div
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-[9px] text-[11px] font-semibold leading-none"
        style={{
          color: `rgb(${grade})`,
          background: 'rgba(10,10,12,0.6)',
          backdropFilter: 'blur(8px)',
          border: `1px solid rgb(${grade} / 0.45)`,
          boxShadow: `0 0 12px rgb(${grade} / 0.35)`,
        }}
      >
        {gradeLetter(trade.checklist_score)}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
        <div className="flex items-center gap-1.5">
          <motion.span
            transition={spring}
            className="grid size-[18px] place-items-center rounded-full text-[10px] leading-none"
            style={{
              color: `rgb(${outcome})`,
              background: `rgb(${outcome} / 0.18)`,
              border: `1px solid rgb(${outcome} / 0.4)`,
            }}
          >
            {trade.direction === 'Long' ? '▲' : '▼'}
          </motion.span>
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.72)' }}>
            {trade.instrument}
          </span>
        </div>

        <span className="tabular-nums text-[13px] font-semibold leading-none" style={{ color: `rgb(${outcome})` }}>
          {passed
            ? 'passed'
            : trade.r_multiple == null
              ? 'open'
              : `${trade.r_multiple > 0 ? '+' : ''}${trade.r_multiple.toFixed(1)}R`}
        </span>
      </div>
    </motion.div>
  );
}

export const TradeNode = memo(TradeNodeInner);
