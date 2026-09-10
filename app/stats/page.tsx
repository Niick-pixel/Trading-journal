import { listTrades } from '@/db/trades';
import { INSTRUMENTS, REASON_HUE, SESSIONS, SETUP_TYPES } from '@/lib/domain';
import { GRADE_COLOR } from '@/lib/grade';
import { reasonAccent } from '@/lib/layout';
import {
  aggregate, byGradeBucket, byMacroTime, edge, groupByField, losingReasons,
  money, rByReason, rByTargetType,
} from '@/lib/stats';
import { Line, Panel, RateBars, SignedBars, Stat, type BarRow } from '@/components/stats/Bars';
import { TitleBar } from '@/components/shell/TitleBar';

export const dynamic = 'force-dynamic';

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const r = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}R`);
const r2 = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}R`);
const usd = (v: number) =>
  `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function StatsPage() {
  const trades = listTrades();
  const all = aggregate(trades);
  const m = money(trades);
  const e = edge(trades);
  const leaks = losingReasons(trades);

  const reasonRows: BarRow[] = rByReason(trades).map((g) => ({
    label: g.key, value: g.stats.totalR, display: r(g.stats.totalR),
    meta: `· ${g.stats.count}`, accent: reasonAccent(g.key),
  }));

  const targetRows: BarRow[] = rByTargetType(trades).map((g) => ({
    label: g.key, value: g.stats.totalR, display: r(g.stats.totalR),
    meta: `· ${g.stats.count}`, highlight: g.key === 'Diagonal trendline',
  }));

  const gradeRows: BarRow[] = byGradeBucket(trades).map((g) => ({
    label: g.key, value: (g.stats.winRate ?? 0) * 100, display: pct(g.stats.winRate),
    meta: `· ${g.stats.taken} taken`, accent: GRADE_COLOR[g.key as keyof typeof GRADE_COLOR],
  }));

  const macroRows: BarRow[] = byMacroTime(trades).map((g) => ({
    label: g.key, value: (g.stats.winRate ?? 0) * 100, display: pct(g.stats.winRate),
    meta: `· ${g.stats.taken} · ${r(g.stats.totalR)}`,
    accent: g.key === 'Inside macro' ? 'var(--accent)' : 'var(--outcome-neutral)',
  }));

  const sessionRows: BarRow[] = groupByField(trades, (t) => t.session, SESSIONS)
    .sort((a, b) => a.stats.totalR - b.stats.totalR)
    .map((g) => ({
      label: g.key, value: g.stats.totalR, display: r(g.stats.totalR),
      meta: `· ${pct(g.stats.winRate)} · ${g.stats.taken}`,
    }));

  const setupRows: BarRow[] = groupByField(trades, (t) => t.setup_type, SETUP_TYPES)
    .sort((a, b) => a.stats.totalR - b.stats.totalR)
    .map((g) => ({
      label: g.key, value: g.stats.totalR, display: r(g.stats.totalR),
      meta: `· ${pct(g.stats.winRate)} · ${g.stats.taken}`,
    }));

  const instrumentRows: BarRow[] = groupByField(trades, (t) => t.instrument, INSTRUMENTS)
    .sort((a, b) => a.stats.totalR - b.stats.totalR)
    .map((g) => ({
      label: g.key, value: g.stats.totalR, display: r(g.stats.totalR),
      meta: `· ${pct(g.stats.winRate)} · ${g.stats.taken}`,
    }));

  // Every row here is a loss, so they all take the loss colour. Tinting them by
  // reason hue put a green bar in a panel about what is costing you.
  const leakRows: BarRow[] = leaks.map((l) => ({
    label: l.reason, value: -l.rLost, display: `−${l.rLost.toFixed(1)}R`,
    meta: `· ${l.losses} loss${l.losses === 1 ? '' : 'es'}`,
  }));

  return (
    <div className="flex h-dvh flex-col">
      <TitleBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[68rem] px-6 pb-20 pt-4">
          <header className="mb-6">
            <h1 className="text-[22px] font-semibold tracking-tight">Stats</h1>
          </header>

          {trades.length === 0 ? (
            <div className="glass rounded-[24px] p-8 text-center text-[13px]" style={{ color: 'var(--text-dim)' }}>
              Nothing to measure yet.
            </div>
          ) : (
            <div className="space-y-5">
              {/* The headline row. */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Net P&L"
                  value={m.priced ? usd(m.net) : '—'}
                  sub={m.priced ? `${usd(m.won)} won · ${usd(m.lost)} lost` : 'No risk amounts recorded yet'}
                  tone={m.net > 0 ? 'win' : m.net < 0 ? 'loss' : null}
                />
                <Stat
                  label="Net R"
                  value={r(all.totalR)}
                  sub={`+${e.rWon.toFixed(1)}R won · −${e.rLost.toFixed(1)}R lost`}
                  tone={all.totalR > 0 ? 'win' : all.totalR < 0 ? 'loss' : null}
                />
                <Stat
                  label="Win rate"
                  value={pct(all.winRate)}
                  sub={`${all.wins}W · ${all.losses}L · ${all.breakeven + all.scratched} flat`}
                />
                <Stat
                  label="Expectancy"
                  value={r2(e.expectancy)}
                  sub="Average R per trade taken"
                  tone={(e.expectancy ?? 0) > 0 ? 'win' : (e.expectancy ?? 0) < 0 ? 'loss' : null}
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="The edge" note="Whether the wins are big enough to pay for the losses.">
                  <Line label="Profit factor" value={e.profitFactor == null ? '—' : e.profitFactor.toFixed(2)}
                    tone={(e.profitFactor ?? 0) >= 1 ? 'win' : 'loss'} />
                  <Line label="Average win" value={r(e.avgWinR)} tone="win" />
                  <Line label="Average loss" value={e.avgLossR == null ? '—' : `−${e.avgLossR.toFixed(1)}R`} tone="loss" />
                  <Line label="Best trade" value={r(e.bestR)} tone="win" />
                  <Line label="Worst trade" value={r(e.worstR)} tone="loss" />
                  <Line label="Longest win streak" value={String(e.longestWinStreak)} />
                  <Line label="Longest loss streak" value={String(e.longestLossStreak)} />
                </Panel>

                <Panel title="Money" note={m.priced < all.taken
                  ? `${m.priced} of ${all.taken} taken trades recorded a risk amount — the rest are excluded here.`
                  : 'Risk in dollars against R returned.'}>
                  <Line label="Gross won" value={usd(m.won)} tone="win" />
                  <Line label="Gross lost" value={usd(m.lost)} tone="loss" />
                  <Line label="Net" value={usd(m.net)} tone={m.net >= 0 ? 'win' : 'loss'} />
                  <Line label="Total risked" value={usd(m.totalRisked)} />
                  <Line label="Biggest win" value={usd(m.biggestWin)} tone="win" />
                  <Line label="Biggest loss" value={usd(-m.biggestLoss)} tone="loss" />
                  <Line label="Return on risk"
                    value={m.totalRisked ? `${((m.net / m.totalRisked) * 100).toFixed(1)}%` : '—'}
                    tone={m.net >= 0 ? 'win' : 'loss'} />
                </Panel>

                <Panel title="What is costing you" note="Reasons ranked by R actually lost — losses only, so a reason that both makes and loses a lot cannot hide behind its wins.">
                  {leakRows.length ? <SignedBars rows={leakRows} /> : (
                    <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>No losses recorded yet.</p>
                  )}
                </Panel>

                <Panel title="R by reason" note="Net, worst first. This is the list that changes how you trade.">
                  <SignedBars rows={reasonRows} />
                </Panel>

                <Panel title="R by target type" note="Diagonal trendline is highlighted — it is the one you asked to watch.">
                  <SignedBars rows={targetRows} />
                </Panel>

                <Panel title="R by setup" note="Which parts of the model actually pay.">
                  <SignedBars rows={setupRows} />
                </Panel>

                <Panel title="R by session" note="When you are at your best, and when you should be shut.">
                  <SignedBars rows={sessionRows} />
                </Panel>

                <Panel title="R by instrument">
                  <SignedBars rows={instrumentRows} />
                </Panel>

                <Panel title="Win rate by grade" note="Does your grading predict outcomes? If these bars do not descend, it does not.">
                  <RateBars rows={gradeRows} />
                </Panel>

                <Panel title="Macro windows" note="Inside :50–:10 and :20–:40, against everything else.">
                  <RateBars rows={macroRows} />
                </Panel>
              </div>

              {all.passed > 0 && (
                <p className="pt-1 text-center text-[11px]" style={{ color: 'var(--text-faint)' }}>
                  {all.passed} setup{all.passed === 1 ? '' : 's'} passed on — journalled, but never counted in any
                  number above.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
