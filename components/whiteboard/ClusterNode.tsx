'use client';

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { gradeLetter } from '@/lib/grade';
import { springLayout } from '@/lib/motion';
import type { PositionedCluster } from '@/lib/layout';

export type ClusterNodeData = { cluster: PositionedCluster; accent: string };

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-[0.09em]" style={{ color: 'var(--text-faint)' }}>
        {label}
      </span>
      <span className="tabular-nums text-[13px] font-semibold leading-none" style={{ color: tone ?? 'var(--text)' }}>
        {value}
      </span>
    </div>
  );
}

/**
 * A labelled region with a soft glowing halo in its reason's hue.
 *
 * The header is the point of the whole screen: count, win rate, total R and
 * average grade, live. If the FOMO cluster reads -8.4R, that number is in your
 * face every time the app opens.
 */
function ClusterNodeInner({ data }: NodeProps) {
  const { cluster, accent } = data as unknown as ClusterNodeData;
  const { stats } = cluster;

  const rTone = stats.totalR > 0 ? '134 239 172' : stats.totalR < 0 ? '248 113 113' : null;

  return (
    <motion.div
      layout
      transition={springLayout}
      style={{
        width: cluster.width,
        height: cluster.height,
        borderColor: `rgb(${accent} / 0.30)`,
        background: `radial-gradient(120% 90% at 50% 0%, rgb(${accent} / 0.10), rgb(${accent} / 0.03) 60%, transparent)`,
        boxShadow: `0 0 70px -12px rgb(${accent} / 0.35), inset 0 1px 0 rgb(${accent} / 0.22)`,
      }}
      className="pointer-events-none rounded-[30px] border backdrop-blur-[2px]"
    >
      <div className="flex items-end justify-between gap-5 px-7 pt-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full"
              style={{ background: `rgb(${accent})`, boxShadow: `0 0 10px rgb(${accent})` }} />
            <h2 className="truncate text-[14px] font-semibold tracking-tight" style={{ color: `rgb(${accent})` }}>
              {cluster.reason}
            </h2>
          </div>
        </div>

        <div className="flex shrink-0 items-end gap-4">
          <Stat label="Trades" value={String(stats.count)} />
          <Stat label="Win rate" value={stats.winRate == null ? '—' : `${Math.round(stats.winRate * 100)}%`} />
          <Stat
            label="Total R"
            value={`${stats.totalR > 0 ? '+' : ''}${stats.totalR.toFixed(1)}R`}
            tone={rTone ? `rgb(${rTone})` : undefined}
          />
          <Stat
            label="Avg grade"
            value={stats.avgGrade == null ? '—' : gradeLetter(Math.round(stats.avgGrade))}
          />
          {stats.passed > 0 && <Stat label="Passed" value={String(stats.passed)} />}
        </div>
      </div>
    </motion.div>
  );
}

export const ClusterNode = memo(ClusterNodeInner);
