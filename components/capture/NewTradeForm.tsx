'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DIRECTIONS, HTF_BIASES, INSTRUMENTS, OUTCOMES, PREMIUM_DISCOUNTS, REASONS,
  RUBRIC, SESSIONS, SETUP_TYPES, TARGET_TYPES,
  type Direction, type HtfBias, type Instrument, type Outcome, type PremiumDiscount,
  type Reason, type Session, type SetupType, type TargetType,
} from '@/lib/domain';
import { GRADE_MAX } from '@/lib/grade';
import { macroWindowFor } from '@/lib/macro';
import { spring, riseIn } from '@/lib/motion';
import { reasonAccent } from '@/lib/layout';
import { MIN_EXPLANATION, type Trade } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Disclosure } from '@/components/ui/Disclosure';
import { Field, Input } from '@/components/ui/Field';
import { GradeBadge } from '@/components/ui/GradeBadge';
import { RubricSlider } from '@/components/ui/RubricSlider';
import { Select } from '@/components/ui/Select';
import { TogglePill } from '@/components/ui/TogglePill';
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

  const [sweep, setSweep] = useState(trade?.sweep_before_entry ?? false);
  const [singularGap, setSingularGap] = useState(trade?.singular_gap ?? false);
  const [targetUnswept, setTargetUnswept] = useState(trade?.target_unswept ?? false);
  const [smt, setSmt] = useState(trade?.smt ?? false);

  const [candleStrength, setCandleStrength] = useState(trade?.candle_strength ?? 0);
  const [inversionSpeed, setInversionSpeed] = useState(trade?.inversion_speed ?? 0);
  const [riskReward, setRiskReward] = useState(trade?.risk_reward ?? 0);

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

  // Macro time derives from the timestamp; an explicit toggle wins and is
  // remembered as an override so a later date edit doesn't silently undo it.
  const derivedWindow = useMemo(() => macroWindowFor(date), [date]);
  const [macroOverride, setMacroOverride] = useState<boolean | null>(
    trade && !trade.macro_time_auto ? trade.macro_time : null,
  );
  const macroTime = macroOverride ?? derivedWindow !== null;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = candleStrength + inversionSpeed + riskReward;
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
      sweep_before_entry: sweep, singular_gap: singularGap, target_unswept: targetUnswept,
      premium_discount: premiumDiscount, target_type: targetType, smt,
      candle_strength: candleStrength, inversion_speed: inversionSpeed, risk_reward: riskReward,
      contracts: num(contracts), risk_dollars: num(riskDollars), stop_points: num(stopPoints),
      outcome, r_multiple: num(rMultiple),
      explanation: explanation.trim(), lesson: lesson.trim() || null,
    }));

    try {
      const res = await fetch(editing ? `/api/trades/${trade!.id}` : '/api/trades', {
        method: editing ? 'PUT' : 'POST',
        body,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save the trade.');
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the trade.');
      setSubmitting(false);
    }
  }

  return (
    <motion.div {...riseIn} transition={spring} className="glass rounded-[28px] p-7 sm:p-9">
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold">{editing ? 'Edit trade' : 'New trade'}</h1>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--text-dim)' }}>
          {editing
            ? 'Paste a new chart to replace the screenshot, or leave it as it is.'
            : 'Name the motive before the data. That is the whole point.'}
        </p>
      </div>

      <div className="space-y-8">
        {/* 1 — the chart, first. */}
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

        {/* 4 — context, as pills. */}
        <Field label="Context">
          <div className="flex flex-wrap gap-2.5">
            <TogglePill checked={sweep} onChange={setSweep} label="Sweep before entry"
              hint="Was liquidity swept near the gap?" />
            <TogglePill checked={singularGap} onChange={setSingularGap} label="Singular gap"
              hint="Rule 1 — one clean obvious gap, not stacked." />
            <TogglePill checked={targetUnswept} onChange={setTargetUnswept} label="Target unswept"
              hint="Rule 4 — the next high/low was still unswept." />
            <TogglePill checked={smt} onChange={setSmt} label="SMT divergence" accent="var(--accent)" />
          </div>
        </Field>

        {/* 5 — grading, with the live badge. */}
        <div>
          <span className="mb-4 block text-[11px] font-medium uppercase tracking-[0.07em]"
            style={{ color: 'var(--text-faint)' }}>
            Grade
          </span>

          <div className="mb-6">
            <GradeBadge total={total} max={GRADE_MAX} size="lg" showPrompt />
          </div>

          <div className="space-y-5">
            <RubricSlider label={RUBRIC.candle_strength.label} hint={RUBRIC.candle_strength.hint}
              value={candleStrength} max={RUBRIC.candle_strength.max} onChange={setCandleStrength} accent={accent} />
            <RubricSlider label={RUBRIC.inversion_speed.label} hint={RUBRIC.inversion_speed.hint}
              value={inversionSpeed} max={RUBRIC.inversion_speed.max} onChange={setInversionSpeed} accent={accent} />
            <RubricSlider label={RUBRIC.risk_reward.label} hint={RUBRIC.risk_reward.hint}
              value={riskReward} max={RUBRIC.risk_reward.max} onChange={setRiskReward} accent={accent} />
          </div>
        </div>

        {/* 6 — everything else. */}
        <Disclosure label="Details">
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
                {macroOverride !== null
                  ? 'Set by hand — it will not follow the timestamp.'
                  : derivedWindow
                    ? `Derived from the entry time (${derivedWindow}).`
                    : 'Derived from the entry time — outside both macro windows.'}
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
              <Field label="Outcome"><Select value={outcome} onChange={setOutcome} options={OUTCOMES} /></Field>
              <Field label="R multiple" hint="Signed, e.g. 2.4 or -1. Leave blank to settle later.">
                <Input type="number" step="0.1" inputMode="decimal" placeholder="—"
                  value={rMultiple} onChange={(e) => setRMultiple(e.target.value)} />
              </Field>
              <Field label="Contracts">
                <Input type="number" step="1" min="0" placeholder="—" value={contracts} onChange={(e) => setContracts(e.target.value)} />
              </Field>
              <Field label="Risk ($)">
                <Input type="number" step="1" min="0" placeholder="—" value={riskDollars} onChange={(e) => setRiskDollars(e.target.value)} />
              </Field>
              <Field label="Stop (points)" className="sm:col-span-2">
                <Input type="number" step="0.25" min="0" placeholder="—" value={stopPoints} onChange={(e) => setStopPoints(e.target.value)} />
              </Field>
            </div>

            <Field label="Lesson" hint="Optional — what you would do differently.">
              <ExplanationField value={lesson} onChange={setLesson} required={false} minRows={3}
                placeholder="What would you do differently?" />
            </Field>
          </div>
        </Disclosure>
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
            transition={spring} className="mt-4 text-[12px]" style={{ color: 'rgb(var(--outcome-loss))' }}>
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
