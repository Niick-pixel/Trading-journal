'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ACCOUNTS, CHECKLIST_KEYS, CONTEXT_FLAGS, CONTEXT_GROUPS, DIRECTIONS, HTF_BIASES, INSTRUMENTS,
  OUTCOMES, PREMIUM_DISCOUNTS, REASONS, REGRADES, SESSIONS, SETUP_TYPES,
  SKIP_REASONS, TARGET_TYPES, TRADE_STATUSES,
  type Account, type ChecklistKey, type ContextFlag, type Direction, type HtfBias,
  type Instrument, type MistakeTag, type Outcome, type PremiumDiscount, type Regrade,
  type SkipReason, type Reason, type Session, type SetupType, type TargetType,
  type TradeStatus, type Tri,
} from '@/lib/domain';
import { GRADE_MAX, checklistScore, triggerFired } from '@/lib/grade';
import { macroWindowFor } from '@/lib/macro';
import { press, spring, springSoft, riseIn } from '@/lib/motion';
import { reasonAccent } from '@/lib/layout';
import { MIN_EXPLANATION, type Trade } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { GradeBadge } from '@/components/ui/GradeBadge';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { OUTCOME_COLOR } from '@/components/whiteboard/TradeNode';
import { TogglePill } from '@/components/ui/TogglePill';
import { TriState } from '@/components/ui/TriState';
import { TagPicker } from '@/components/ui/TagPicker';
import { Checklist } from './Checklist';
import { ExplanationField } from './ExplanationField';
import { ScreenshotDropzone } from './ScreenshotDropzone';

/** `datetime-local` wants 'YYYY-MM-DDTHH:mm' in local time, not an ISO string. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function NewTradeForm({ trade }: { trade?: Trade }) {
  const editing = Boolean(trade);
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState<Reason | null>(trade?.reason ?? null);
  const [explanation, setExplanation] = useState(trade?.explanation ?? '');

  // One record rather than a useState per flag — there are eleven now, and a
  // new one should cost a line in CONTEXT_GROUPS, not four scattered edits.
  const [context, setContext] = useState<Record<ContextFlag, boolean>>(() =>
    Object.fromEntries(
      CONTEXT_FLAGS.map((f) => [f, trade ? Boolean(trade[f]) : false]),
    ) as Record<ContextFlag, boolean>,
  );
  const setFlag = (flag: ContextFlag, value: boolean) =>
    setContext((prev) => ({ ...prev, [flag]: value }));

  const [checks, setChecks] = useState<Record<ChecklistKey, boolean>>(() =>
    Object.fromEntries(
      CHECKLIST_KEYS.map((k) => [k, trade ? Boolean(trade[k]) : false]),
    ) as Record<ChecklistKey, boolean>,
  );
  const setCheck = (key: ChecklistKey, value: boolean) =>
    setChecks((prev) => ({ ...prev, [key]: value }));

  // Tri-state, starting unanswered. This used to default to `true`, so every
  // trade ever saved claimed full rule adherence whether or not the question
  // had been looked at. Nothing on this form starts in the affirmative now.
  const [followedRules, setFollowedRules] = useState<Tri>(trade?.followed_rules ?? null);
  const [regrade, setRegrade] = useState<Regrade | null>(trade?.regrade ?? null);
  const [mistakeTags, setMistakeTags] = useState<MistakeTag[]>(trade?.mistake_tags ?? []);
  const [account, setAccount] = useState<Account>(trade?.account ?? 'Backtest (FX Replay)');
  const [accountLabel, setAccountLabel] = useState(trade?.account_label ?? '');
  const [status, setStatus] = useState<TradeStatus>(trade?.status ?? 'Settled');
  const [riskPercent, setRiskPercent] = useState(trade?.risk_percent?.toString() ?? '');
  const [entryTime, setEntryTime] = useState(trade?.entry_time ?? '');
  const [exitTime, setExitTime] = useState(trade?.exit_time ?? '');
  const [maeR, setMaeR] = useState(trade?.mae_r?.toString() ?? '');
  const [mfeR, setMfeR] = useState(trade?.mfe_r?.toString() ?? '');
  const [reached1R, setReached1R] = useState<Tri>(trade?.reached_1r ?? null);
  const [confidence, setConfidence] = useState<number | null>(trade?.confidence_at_entry ?? null);
  const [wouldBeR, setWouldBeR] = useState(trade?.would_be_r?.toString() ?? '');
  const [entryPrice, setEntryPrice] = useState(trade?.entry_price?.toString() ?? '');
  const [takeProfit, setTakeProfit] = useState(trade?.take_profit?.toString() ?? '');
  const [stopLoss, setStopLoss] = useState(trade?.stop_loss?.toString() ?? '');
  const [wouldHaveHitTp, setWouldHaveHitTp] = useState<boolean | null>(trade?.would_have_hit_tp ?? null);
  const [rLeftOnTable, setRLeftOnTable] = useState(trade?.r_left_on_table?.toString() ?? '');
  const [skipReason, setSkipReason] = useState<SkipReason | null>(trade?.skip_reason ?? null);

  const [date, setDate] = useState(() => (trade ? toLocalInput(new Date(trade.date)) : toLocalInput(new Date())));
  const [instrument, setInstrument] = useState<Instrument>(trade?.instrument ?? 'NQ');
  const [direction, setDirection] = useState<Direction>(trade?.direction ?? 'Long');
  const [session, setSession] = useState<Session>(trade?.session ?? 'NY AM');
  const [setupType, setSetupType] = useState<SetupType>(trade?.setup_type ?? 'iFVG');
  const [htfBias, setHtfBias] = useState<HtfBias>(trade?.htf_bias ?? 'With bias');
  const [premiumDiscount, setPremiumDiscount] = useState<PremiumDiscount>(trade?.premium_discount ?? 'Discount');
  const [targetType, setTargetType] = useState<TargetType>(trade?.target_type ?? 'Horizontal liquidity pool');
  const [outcome, setOutcome] = useState<Outcome>(trade?.outcome ?? 'Win');
  const [contracts, setContracts] = useState(trade?.contracts?.toString() ?? '');
  const [riskDollars, setRiskDollars] = useState(trade?.risk_dollars?.toString() ?? '');
  const [stopPoints, setStopPoints] = useState(trade?.stop_points?.toString() ?? '');
  const [rMultiple, setRMultiple] = useState(trade?.r_multiple?.toString() ?? '');
  const [lesson, setLesson] = useState(trade?.lesson ?? '');

  /*
    The entry time is still checked against the macro windows, but the answer
    is offered rather than asserted.
    This pill used to arrive pre-ticked whenever the clock happened to be
    inside a window, which put an unasked-for claim on the record — the same
    class of bug as followed_rules defaulting to yes. Nothing on this form
    starts affirmative now; the derived window is shown as a sentence you can
    act on instead.
  */
  const derivedWindow = useMemo(() => macroWindowFor(date), [date]);
  const [macroOverride, setMacroOverride] = useState<boolean | null>(
    trade ? trade.macro_time : null,
  );
  const macroTime = macroOverride ?? false;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape leaves the form the same way it closes the detail panel. Nothing is
  // saved on the way out — a half-written trade is not a trade.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === 'Escape' && !typing) window.location.href = '/';
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const total = checklistScore(checks);
  const fired = triggerFired(checks);
  const planned = status === 'Planned';
  const accent = reason ? reasonAccent(reason) : 'var(--accent)';
  const explanationOk = explanation.trim().length >= MIN_EXPLANATION;
  const canSubmit = (Boolean(file) || editing) && Boolean(reason) && explanationOk && !submitting;

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  async function submit() {
    if (!canSubmit || !reason) return;
    setSubmitting(true);
    setError(null);

    const body = new FormData();
    // On an edit, sending no file means "keep the screenshot you already have".
    if (file) body.append('screenshot', file);
    body.append('trade', JSON.stringify({
      date, instrument, direction, session,
      macro_time: macroTime, macro_time_auto: macroOverride === null,
      reason, setup_type: setupType, htf_bias: htfBias,
      ...context,
      premium_discount: premiumDiscount, target_type: targetType,
      ...checks,
      followed_rules: followedRules,
      regrade,
      // The legacy single tag is carried through untouched so an edit never
      // erases a value written under the old taxonomy.
      mistake_tag: trade?.mistake_tag ?? null,
      mistake_tags: mistakeTags,
      account, account_label: accountLabel.trim() || null,
      status,
      // Freeze the score as it stands now if this is being planned before the
      // outcome is known; a one-shot entry has no pre-outcome grade to keep.
      grade_at_entry: status === 'Planned' ? total : (trade?.grade_at_entry ?? total),
      // True unless this record was opened as a Plan and settled later.
      graded_post_hoc: trade ? trade.graded_post_hoc : status !== 'Planned',
      entry_price: num(entryPrice), take_profit: num(takeProfit), stop_loss: num(stopLoss),
      would_have_hit_tp: wouldHaveHitTp,
      r_left_on_table: num(rLeftOnTable),
      skip_reason: skipReason,
      contracts: num(contracts), risk_dollars: num(riskDollars), risk_percent: num(riskPercent),
      stop_points: num(stopPoints),
      entry_time: entryTime || null, exit_time: exitTime || null,
      mae_r: num(maeR), mfe_r: num(mfeR), mae_points: null, mfe_points: null,
      reached_1r: reached1R,
      confidence_at_entry: confidence,
      would_be_r: num(wouldBeR),
      playbook_id: null,
      // A plan has no result. Storing one would be inventing a trade.
      outcome: planned ? 'Not taken' : outcome,
      r_multiple: planned ? null : num(rMultiple),
      explanation: explanation.trim(), lesson: lesson.trim() || null,
    }));

    try {
      const res = await fetch(editing ? `/api/trades/${trade!.id}` : '/api/trades', {
        method: editing ? 'PUT' : 'POST',
        body,
      });
      if (!res.ok) {
        // A 500 returns an HTML page, not JSON — falling straight through to a
        // generic message hid the real cause once already.
        const body = await res.text();
        let detail = body.slice(0, 300);
        try {
          detail = JSON.parse(body).error ?? detail;
        } catch { /* not JSON; show the raw beginning of the response */ }
        throw new Error(`${detail} (HTTP ${res.status})`);
      }
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the trade.');
      setSubmitting(false);
    }
  }

  return (
    <motion.div {...riseIn} transition={spring} className="glass rounded-[28px] p-7 sm:p-9">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold">{editing ? 'Edit trade' : 'New trade'}</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--text-dim)' }}>
            {editing
              ? 'Paste a new chart to replace the screenshot, or leave it as it is.'
              : 'Name the motive before the data. That is the whole point.'}
          </p>
        </div>

        {/* The board is still behind this card; there was no way back to it
            without saving or using the browser's own history. */}
        <motion.button
          type="button"
          aria-label="Close without saving"
          title="Close without saving (Esc)"
          onClick={() => { window.location.href = '/'; }}
          whileTap={press}
          whileHover={{ scale: 1.06 }}
          transition={spring}
          className="grid size-8 shrink-0 place-items-center rounded-full"
          style={{
            background: 'var(--glass-fill)',
            border: '1px solid var(--glass-stroke)',
            color: 'var(--text-dim)',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor"
              strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </motion.button>
      </div>

      <div className="space-y-8">
        {/* 1 — how it ended. You already know this before you start typing, and
            burying it behind a disclosure made it the last thing recorded. */}
        {/*
          Account first, because it is the one field that must never be wrong:
          backtest R and live R summing into one number would make every other
          figure in the app a lie.
        */}
        <div className="mb-7 grid gap-5 sm:grid-cols-2">
          <Field label="Account" hint="Backtest R and live R never sum into the same number.">
            <Select value={account} onChange={setAccount} options={ACCOUNTS} />
          </Field>
          <Field label="Account label" hint="Optional — which prop firm, which phase.">
            <Input placeholder="—" value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} />
          </Field>
        </div>

        {/*
          Two-stage logging is available, never required. 'Settled' stays the
          default so a finished trade can still be written in one pass.
        */}
        <Field
          label="Stage"
          hint="Planned hides the outcome until you settle it, and freezes the grade you gave it before you knew."
          className="mb-7"
        >
          <Segmented value={status} onChange={setStatus} options={TRADE_STATUSES} />
        </Field>

        {/* A Planned trade has no outcome yet, so it is not asked for. */}
        <AnimatePresence initial={false}>
          {planned ? (
            <motion.p
              key="planned"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={springSoft}
              className="overflow-hidden text-[12px] leading-relaxed"
              style={{ color: 'var(--text-faint)' }}
            >
              Planned — the outcome is hidden until you settle it. The score you give it now is kept
              as the entry grade, so hindsight cannot quietly rewrite it.
            </motion.p>
          ) : (
            <motion.div
              key="outcome"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={springSoft}
              className="overflow-hidden"
            >
              <Field label="How did it end">
                <Segmented
                  value={outcome}
                  onChange={setOutcome}
                  options={OUTCOMES}
                  accentFor={(o) => OUTCOME_COLOR[o]}
                  labelFor={(o) => (o === 'Not taken' ? 'Passed' : o)}
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2 — the chart. */}
        <ScreenshotDropzone
          file={file}
          onFile={setFile}
          existingUrl={trade ? `/api/screenshots/${trade.screenshot_path}` : null}
        />

        {/* 2 — reason, before anything else. */}
        <Field label="Why did you take it" hint="Answer honestly. Nothing else in this app works if this is wrong.">
          <Select
            value={reason}
            onChange={setReason}
            options={REASONS}
            placeholder="Name your motive…"
            accentFor={(r) => reasonAccent(r as Reason)}
          />
        </Field>

        {/* 3 — the writing. */}
        <Field label="Explanation">
          <ExplanationField
            value={explanation}
            onChange={setExplanation}
            placeholder="What did you see, what did you expect, and what made you click the button?"
          />
        </Field>

        {/* 4 — context, as pills, in two groups. */}
        <div className="space-y-5">
          {CONTEXT_GROUPS.map((group) => (
            <Field key={group.label} label={group.label}>
              <div className="flex flex-wrap gap-2.5">
                {group.flags.map((flag) => (
                  <TogglePill
                    key={flag.key}
                    checked={context[flag.key]}
                    onChange={(next) => setFlag(flag.key, next)}
                    label={flag.label}
                    hint={flag.hint}
                  />
                ))}
              </div>
            </Field>
          ))}
        </div>

        {/* 5 — the checklist, with the live score. */}
        <div>
          <span className="mb-4 block text-[11px] font-medium uppercase tracking-[0.07em]"
            style={{ color: 'var(--text-faint)' }}>
            Checklist
          </span>

          <div className="mb-6">
            <GradeBadge total={total} max={GRADE_MAX} size="lg" showPrompt triggerFired={fired} />
          </div>

          <Checklist answers={checks} onChange={setCheck} accent={accent} />

          {/*
            Recorded here, beside the score, because it only measures anything
            if it is set before the outcome is known. Answered afterwards it is
            just the result wearing a different hat.
          */}
          <div className="mt-6">
            <Field label="Confidence at entry" hint="Optional. Only worth anything if you set it before you knew.">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <motion.button
                    key={n}
                    type="button"
                    aria-pressed={confidence === n}
                    onClick={() => setConfidence(confidence === n ? null : n)}
                    whileTap={press}
                    transition={spring}
                    animate={{
                      borderColor: confidence === n ? `rgb(${accent} / 0.6)` : 'var(--glass-stroke)',
                      background: confidence === n ? `rgb(${accent} / 0.12)` : 'var(--glass-fill)',
                    }}
                    className="flex-1 rounded-[12px] border py-2 text-[13px] font-medium"
                    style={{ color: confidence === n ? `rgb(${accent})` : 'var(--text-faint)' }}
                  >
                    {'★'.repeat(n)}
                  </motion.button>
                ))}
              </div>
            </Field>
          </div>
        </div>

        {/* 6 — the rest. Not hidden behind a disclosure any more: every one of
            these is part of the record, and a collapsed section is a section
            that quietly stays empty. */}
        <div>
          <span className="mb-4 block text-[11px] font-medium uppercase tracking-[0.07em]"
            style={{ color: 'var(--text-faint)' }}>
            Details
          </span>
          <div className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Date & time">
                <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Session">
                <Select value={session} onChange={setSession} options={SESSIONS} />
              </Field>
            </div>

            <div>
              <TogglePill
                checked={macroTime}
                onChange={(next) => setMacroOverride(next === (derivedWindow !== null) ? null : next)}
                label={derivedWindow ? `Macro time (${derivedWindow})` : 'Macro time'}
                accent="var(--accent)"
              />
              <p className="mt-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                {derivedWindow
                  ? `The entry time falls inside the ${derivedWindow} macro — tick it if that mattered.`
                  : 'The entry time is outside both macro windows.'}
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Instrument"><Select value={instrument} onChange={setInstrument} options={INSTRUMENTS} /></Field>
              <Field label="Direction"><Select value={direction} onChange={setDirection} options={DIRECTIONS} /></Field>
              <Field label="Setup type"><Select value={setupType} onChange={setSetupType} options={SETUP_TYPES} /></Field>
              <Field label="HTF bias"><Select value={htfBias} onChange={setHtfBias} options={HTF_BIASES} /></Field>
              <Field label="Premium / discount"><Select value={premiumDiscount} onChange={setPremiumDiscount} options={PREMIUM_DISCOUNTS} /></Field>
              <Field label="Target type"><Select value={targetType} onChange={setTargetType} options={TARGET_TYPES} /></Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="R multiple" hint="Signed, e.g. 2.4 or -1. Leave blank to settle later.">
                <Input type="number" step="0.1" inputMode="decimal" placeholder="—"
                  value={rMultiple} onChange={(e) => setRMultiple(e.target.value)} />
              </Field>
              <Field label="Contracts">
                <Input type="number" step="1" min="0" placeholder="—" value={contracts} onChange={(e) => setContracts(e.target.value)} />
              </Field>
              {/*
                Dollars and percent are separate fields on purpose. A percentage
                typed into the dollars box is not a small mistake: P&L is
                risk x R, so a "-1.57" entered there turned a -1.9R loss into a
                +$2.98 win. Negative values are now dropped on save.
              */}
              <Field label="Risk ($)" hint="Dollars risked. Not a percentage.">
                <Input type="number" step="1" min="0" placeholder="—" value={riskDollars}
                  onChange={(e) => setRiskDollars(e.target.value)} />
              </Field>
              <Field label="Risk (%)" hint="Optional — percent of the account.">
                <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="—"
                  value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} />
              </Field>
              <Field label="Stop (points)" hint="Optional — it is on the screenshot." className="sm:col-span-2">
                <Input type="number" step="0.25" min="0" placeholder="—" value={stopPoints} onChange={(e) => setStopPoints(e.target.value)} />
              </Field>
            </div>

            {/* All optional — the chart already shows them. */}
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Entry" hint="Optional"><Input type="number" step="0.01" inputMode="decimal" placeholder="—"
                value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} /></Field>
              <Field label="Take profit" hint="Optional"><Input type="number" step="0.01" inputMode="decimal" placeholder="—"
                value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} /></Field>
              <Field label="Stop loss" hint="Optional"><Input type="number" step="0.01" inputMode="decimal" placeholder="—"
                value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} /></Field>
            </div>

            {/*
              Excursion. How far it went against me before it worked, and how
              far in my favour before it turned — the fastest way to learn
              whether the stop is too tight or the target too greedy, which no
              win rate will ever tell me.
            */}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Entry time" hint="Optional"><Input type="time" value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)} /></Field>
              <Field label="Exit time" hint="Optional"><Input type="time" value={exitTime}
                onChange={(e) => setExitTime(e.target.value)} /></Field>
              <Field label="MAE (R)" hint="Worst it went against you. Negative.">
                <Input type="number" step="0.1" inputMode="decimal" placeholder="—"
                  value={maeR} onChange={(e) => setMaeR(e.target.value)} />
              </Field>
              <Field label="MFE (R)" hint="Best it got before it turned.">
                <Input type="number" step="0.1" inputMode="decimal" placeholder="—"
                  value={mfeR} onChange={(e) => setMfeR(e.target.value)} />
              </Field>
            </div>

            <TriState
              value={reached1R}
              onChange={setReached1R}
              label="Reached +1R before the stop?"
              hint="If most of your losers did, the problem is management rather than selection."
            />

            {/* After the close: the honest part. */}
            <Field label="Honest re-grade" hint="After the close, and allowed to be harsher than before it.">
              <Select value={regrade} onChange={setRegrade} options={REGRADES} placeholder="Not re-graded yet" />
            </Field>

            <Field
              label="What went wrong"
              hint="Pick every one that applies. A bad trade usually has three."
            >
              <TagPicker value={mistakeTags} onChange={setMistakeTags} />
            </Field>

            <TriState
              value={followedRules}
              onChange={setFollowedRules}
              label="Followed ALL rules"
              hint="Max 2 trades, stop after 2 losses, no revenge, size within 1%. Leave it unset rather than guessing — stats read the checklist, not this answer."
            />

            {/* Only meaningful for a setup you passed on — the plan calls this
                the most important thing in the whole file. */}
            <AnimatePresence>
              {outcome === 'Not taken' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={springSoft}
                  className="overflow-hidden"
                >
                  <div className="space-y-5 pt-1">
                    <Field label="Would it have hit TP?" hint="Go back and check. Guessing defeats the point.">
                      <Segmented
                        value={wouldHaveHitTp === null ? 'Unknown' : wouldHaveHitTp ? 'Yes' : 'No'}
                        onChange={(v) => setWouldHaveHitTp(v === 'Unknown' ? null : v === 'Yes')}
                        options={['Yes', 'No', 'Unknown'] as const}
                        accentFor={(v) => (v === 'Yes' ? 'var(--outcome-win)' : v === 'No' ? 'var(--outcome-loss)' : 'var(--outcome-neutral)')}
                      />
                    </Field>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="What it would have paid (R)" hint="Go and check. A guess here is worse than a blank.">
                        <Input type="number" step="0.1" inputMode="decimal" placeholder="—"
                          value={wouldBeR} onChange={(e) => setWouldBeR(e.target.value)} />
                      </Field>
                      <Field label="R left on the table">
                        <Input type="number" step="0.1" inputMode="decimal" placeholder="—"
                          value={rLeftOnTable} onChange={(e) => setRLeftOnTable(e.target.value)} />
                      </Field>
                      <Field label="Real reason" hint="Not the story — the reason.">
                        <Select value={skipReason} onChange={setSkipReason} options={SKIP_REASONS} placeholder="Why really?" />
                      </Field>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Field label="Lesson" hint="Optional — what you would do differently.">
              <ExplanationField value={lesson} onChange={setLesson} required={false} minRows={3}
                placeholder="What would you do differently?" />
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-9 flex items-center justify-between gap-5">
        <div className="min-w-0 text-[12px]" style={{ color: 'var(--text-faint)' }}>
          <AnimatePresence mode="wait">
            <motion.span
              key={!file && !editing ? 'file' : !reason ? 'reason' : !explanationOk ? 'expl' : 'ready'}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={spring} className="block truncate"
            >
              {!file && !editing ? 'A screenshot is required.'
                : !reason ? 'Name your motive to continue.'
                : !explanationOk ? `${MIN_EXPLANATION - explanation.trim().length} more characters of explanation.`
                : 'Ready.'}
            </motion.span>
          </AnimatePresence>
        </div>

        <Button variant="primary" accent={accent} disabled={!canSubmit} onClick={submit} className="shrink-0">
          {submitting ? 'Saving…' : editing ? 'Save changes' : 'Save trade'}
        </Button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={spring}
            className="mt-4 whitespace-pre-wrap break-words rounded-[14px] p-3 text-[12px] leading-relaxed"
            style={{ color: 'rgb(var(--outcome-loss))', background: 'rgb(var(--outcome-loss) / 0.10)' }}>
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
