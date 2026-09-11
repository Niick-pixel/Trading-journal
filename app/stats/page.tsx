import { listTrades } from '@/db/trades';
import { INSTRUMENTS, REASON_HUE, SESSIONS, SETUP_TYPES } from '@/lib/domain';
import { GRADE_COLOR } from '@/lib/grade';
import { reasonAccent } from '@/lib/layout';
import {
  aggregate, byGradeBucket, byMacroTime, checklistEdge, discipline, edge, gradeHonesty,
  groupByField, hesitation, losingReasons, money, rByReason, rByTargetType,
} from '@/lib/stats';
import { Line, Panel, RateBars, SignedBars, Stat, type BarRow } from '@/components/stats/Bars';
import { TitleBar } from '@/components/shell/TitleBar';

export const dynamic = 'force-dynamic';

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
// A typographic minus, not a hyphen — it matches the digit width, so a column
// of R values lines up instead of stepping in and out by a pixel.
const signed = (v: number, dp: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(dp)}R`;
const r = (v: number | null) => (v == null ? '—' : signed(v, 1));
const r2 = (v: number | null) => (v == null ? '—' : signed(v, 2));
const usd = (v: number) =>
  `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function StatsPage() {
  const trades = listTrades();
  const all = aggregate(trades);
  const m = money(trades);
  const e = edge(trades);
  const leaks = losingReasons(trades);
  const d = discipline(trades);
  const honesty = gradeHonesty(trades);
  const hes = hesitation(trades);

  const reasonRows: BarRow[] = rByReason(trades).map((g) => ({
    label: g.key, value: g.stats.totalR, display: r(g.stats.totalR),
    meta: `· ${g.stats.count}`, swatch: reasonAccent(g.key),
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
    swatch: reasonAccent(l.reason),
  }));

  // Rule-following against rule-breaking. Two bars, because the comparison is
  // the whole point — a rule-breaking total on its own means nothing.
  const disciplineRows: BarRow[] = [
    { label: 'Followed the rules', stats: d.followed },
    { label: 'Broke a rule', stats: d.broken },
  ]
    .filter((row) => row.stats.count > 0)
    .map(({ label, stats }) => ({
      label,
      value: stats.totalR,
      display: r(stats.totalR),
      meta: `· ${stats.taken} taken · ${pct(stats.winRate)}`,
    }));

  // Negative, because R you did not take is R you did not make — a green bar
  // here would read as a win.
  const skipRows: BarRow[] = hes.byReason.map((g) => ({
    label: g.reason, value: -g.rLeft, display: g.rLeft ? `−${g.rLeft.toFixed(1)}R` : '—',
    meta: `· ${g.count} skipped`,
  }));

  // Only items with trades on both sides can be compared at all.
  const itemRows: BarRow[] = checklistEdge(trades)
    .filter((i) => i.lift != null)
    .sort((a, b) => (b.lift as number) - (a.lift as number))
    .map((i) => ({
      label: `${i.label} (${i.points})`,
      value: i.lift as number,
      display: r2(i.lift),
      meta: `· ${i.withCount} with · ${i.withoutCount} without`,
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

              {/* The plan's own three questions. They measure you, not the
                  market, which is why they sit apart from everything above. */}
              <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                  title="Discipline"
                  note="The premise of the plan is that the edge is in the rules. If breaking them nets positive, that premise needs an answer — not a shrug."
                >
                  {disciplineRows.length ? <SignedBars rows={disciplineRows} /> : (
                    <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                      Nothing marked as a rule break yet.
                    </p>
                  )}
                  <div className="mt-3">
                    <Line
                      label="R from rule breaks"
                      value={r(d.costOfBreaking)}
                      tone={d.costOfBreaking >= 0 ? 'win' : 'loss'}
                    />
                    <Line
                      label="Taken without a trigger"
                      value={d.untriggered.taken ? `${d.untriggered.taken} · ${r(d.untriggered.totalR)}` : 'None'}
                      tone={d.untriggered.taken ? 'loss' : 'win'}
                    />
                  </div>
                  {d.untriggered.taken > 0 && (
                    <p className="mt-2.5 text-[11px] leading-snug" style={{ color: 'rgb(var(--outcome-loss))' }}>
                      Phase 3 never fired on {d.untriggered.taken} trade
                      {d.untriggered.taken === 1 ? '' : 's'} you took. By the plan those entries do not exist.
                    </p>
                  )}
                </Panel>

                <Panel
                  title="Grade honesty"
                  note="The score at entry against the re-grade after the close. A pattern of dropping means the boxes are being ticked to reach a number."
                >
                  {honesty.regraded === 0 ? (
                    <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                      No trades re-graded yet. Without a re-grade there is nothing to check the checklist against.
                    </p>
                  ) : (
                    <>
                      <Line label="Re-graded" value={`${honesty.regraded} of ${all.count}`} />
                      <Line label="Graded too kindly" value={String(honesty.inflated)}
                        tone={honesty.inflated ? 'loss' : 'win'} />
                      <Line label="Held up" value={String(honesty.matched)} tone="win" />
                      <Line label="Graded too harshly" value={String(honesty.understated)} />
                      <Line
                        label="Average re-grade"
                        value={honesty.averageDrop == null ? '—' : honesty.averageDrop === 0
                          ? 'Unchanged'
                          : `${Math.abs(honesty.averageDrop).toFixed(1)} steps ${honesty.averageDrop > 0 ? 'lower' : 'higher'}`}
                        tone={(honesty.averageDrop ?? 0) > 0 ? 'loss' : 'win'}
                      />
                      {honesty.worst.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {honesty.worst.map((w) => (
                            <div key={w.trade.id} className="flex items-baseline justify-between gap-3 text-[11px]">
                              <span className="truncate" style={{ color: 'var(--text-dim)' }}>
                                {new Date(w.trade.date).toLocaleDateString()} · {w.trade.reason}
                              </span>
                              <span className="shrink-0 tabular-nums" style={{ color: 'rgb(var(--outcome-loss))' }}>
                                {w.from} → {w.to}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </Panel>

                <Panel
                  title="What hesitating cost"
                  note="A skipped setup that would have won is a real loss that never reaches the P&L — which is exactly why it goes unexamined."
                >
                  {hes.skipped === 0 ? (
                    <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                      No setups passed on yet.
                    </p>
                  ) : (
                    <>
                      <Line label="Setups skipped" value={String(hes.skipped)} />
                      <Line label="Actually checked afterwards"
                        value={`${hes.checked} of ${hes.skipped}`}
                        tone={hes.checked === hes.skipped ? 'win' : null} />
                      <Line label="Would have won" value={String(hes.wouldHaveWon)} tone="loss" />
                      <Line label="Would have lost" value={String(hes.wouldHaveLost)} tone="win" />
                      <Line label="R left on the table"
                        value={hes.rLeft ? `−${hes.rLeft.toFixed(1)}R` : '0.0R'}
                        tone={hes.rLeft ? 'loss' : 'win'} />
                      <Line label="R the skips saved you"
                        value={`+${hes.rAvoided.toFixed(1)}R`} tone="win" />
                      {skipRows.length > 0 && (
                        <div className="mt-3">
                          <SignedBars rows={skipRows} />
                        </div>
                      )}
                      {hes.checked < hes.skipped && (
                        <p className="mt-2.5 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
                          {hes.skipped - hes.checked} skipped setup
                          {hes.skipped - hes.checked === 1 ? ' has' : 's have'} never been checked. Until they are,
                          the number above is the floor, not the cost.
                        </p>
                      )}
                    </>
                  )}
                </Panel>

                <Panel
                  title="Is each box earning its weight?"
                  note="Average R with the box ticked, minus average R without it. A 20-point item with no lift, or a 5-point item with a large one, is an argument that the weights are wrong."
                >
                  {itemRows.length ? <SignedBars rows={itemRows} /> : (
                    <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                      Not enough trades yet — each box needs trades on both sides of it to be compared.
                    </p>
                  )}
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
