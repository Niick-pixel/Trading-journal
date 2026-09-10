import { listTrades } from '@/db/trades';
import { GRADE_COLOR } from '@/lib/grade';
import { reasonAccent } from '@/lib/layout';
import { aggregate, byGradeBucket, byMacroTime, rByReason, rByTargetType } from '@/lib/stats';
import { Panel, RateBars, SignedBars, type BarRow } from '@/components/stats/Bars';
import { TitleBar } from '@/components/shell/TitleBar';

export const dynamic = 'force-dynamic';

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const r = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}R`;

export default function StatsPage() {
  const trades = listTrades();
  const all = aggregate(trades);

  const reasonRows: BarRow[] = rByReason(trades).map((g) => ({
    label: g.key,
    value: g.stats.totalR,
    display: r(g.stats.totalR),
    meta: `· ${g.stats.count}`,
    accent: reasonAccent(g.key),
  }));

  const targetRows: BarRow[] = rByTargetType(trades).map((g) => ({
    label: g.key,
    value: g.stats.totalR,
    display: r(g.stats.totalR),
    meta: `· ${g.stats.count}`,
    highlight: g.key === 'Diagonal trendline',
  }));

  const gradeRows: BarRow[] = byGradeBucket(trades).map((g) => ({
    label: g.key,
    value: (g.stats.winRate ?? 0) * 100,
    display: pct(g.stats.winRate),
    meta: `· ${g.stats.taken} taken`,
    accent: GRADE_COLOR[g.key as keyof typeof GRADE_COLOR],
  }));

  const macroRows: BarRow[] = byMacroTime(trades).map((g) => ({
    label: g.key,
    value: (g.stats.winRate ?? 0) * 100,
    display: pct(g.stats.winRate),
    meta: `· ${g.stats.taken} taken · ${r(g.stats.totalR)}`,
    accent: g.key === 'Inside macro' ? 'var(--accent)' : 'var(--outcome-neutral)',
  }));

  return (
    <div className="flex h-dvh flex-col">
      <TitleBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[62rem] px-6 pb-20 pt-4">
          <header className="mb-7">
            <h1 className="text-[22px] font-semibold tracking-tight">Stats</h1>
            {/* "0 taken · — win rate · 0.0R" says nothing the empty state below
                doesn't say better. */}
            {trades.length > 0 && (
              <p className="mt-1 text-[13px]" style={{ color: 'var(--text-dim)' }}>
                {all.taken} taken · {pct(all.winRate)} win rate · {r(all.totalR)}
                {all.passed > 0 && ` · ${all.passed} passed`}
              </p>
            )}
          </header>

          {trades.length === 0 ? (
            <div className="glass rounded-[24px] p-8 text-center text-[13px]" style={{ color: 'var(--text-dim)' }}>
              Nothing to measure yet.
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="R by reason" note="Worst first. This is the list that changes how you trade.">
                <SignedBars rows={reasonRows} />
              </Panel>

              <Panel title="R by target type" note="Diagonal trendline is highlighted — it is the one you asked to watch.">
                <SignedBars rows={targetRows} />
              </Panel>

              <Panel title="Win rate by grade" note="Does your grading actually predict outcomes? If these bars do not descend, it does not.">
                <RateBars rows={gradeRows} />
              </Panel>

              <Panel title="Macro windows" note="Inside :50–:10 and :20–:40, against everything else.">
                <RateBars rows={macroRows} />
              </Panel>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
