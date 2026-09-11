'use client';

import { useState } from 'react';
import type { HistogramBin } from '@/lib/stats';

/**
 * The shape of the R distribution.
 *
 * Win rate and average R both hide the shape: the same two numbers describe a
 * steady grind and a single outlier carrying fifty small losses. The bars are
 * coloured by sign, but the sign is already carried by position on the axis,
 * so nothing here depends on telling red from green.
 */
export function Histogram({ bins }: { bins: HistogramBin[] }) {
  const [hover, setHover] = useState<string | null>(null);

  if (bins.length === 0) {
    return <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>Nothing settled yet.</p>;
  }

  const max = Math.max(...bins.map((b) => b.count));

  return (
    <div className="flex items-end gap-1.5" style={{ height: 150 }}>
      {bins.map((bin) => {
        const losing = bin.to <= 0;
        const color = losing ? 'var(--outcome-loss)' : 'var(--outcome-win)';
        const h = Math.max(3, (bin.count / max) * 108);
        const on = hover === bin.label;
        return (
          <div
            key={bin.label}
            className="flex flex-1 flex-col items-center justify-end gap-1.5"
            onMouseEnter={() => setHover(bin.label)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="tabular-nums text-[10px] font-semibold"
              style={{ color: on ? 'var(--text)' : 'var(--text-faint)' }}
            >
              {bin.count}
            </span>
            <div
              // 4px rounded data-end, anchored to the baseline.
              style={{
                width: '100%',
                height: h,
                background: `rgb(${color} / ${on ? 0.95 : 0.7})`,
                borderRadius: '4px 4px 2px 2px',
              }}
            />
            <span
              className="text-center text-[9px] leading-tight"
              style={{ color: 'var(--text-faint)' }}
            >
              {bin.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
