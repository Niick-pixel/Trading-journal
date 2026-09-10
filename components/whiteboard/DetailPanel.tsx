'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OUTCOMES, RUBRIC, type Outcome } from '@/lib/domain';
import { GRADE_MAX } from '@/lib/grade';
import { spring, springSoft } from '@/lib/motion';
import type { Trade } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { GradeBadge } from '@/components/ui/GradeBadge';
import { Select } from '@/components/ui/Select';
import { OUTCOME_COLOR } from './TradeNode';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{label}</span>
      <span className="text-right text-[12px]">{value}</span>
    </div>
  );
}

/**
 * A grouped surface for a run of rows. Two columns of label/value pairs sitting
 * on bare background read as one long run-on list — the left column's values
 * end up hard against the right column's labels. Grouping each column onto its
 * own surface separates them by elevation instead of by a rule.
 */
function Group({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[16px] px-4 py-2"
      style={{ background: 'var(--glass-fill)', border: '1px solid var(--glass-stroke)' }}
    >
      {children}
    </div>
  );
}

function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px]"
      style={{ color: on ? 'rgb(var(--grade-aplus))' : 'var(--text-faint)' }}>
      <span className="grid size-[14px] place-items-center rounded-full text-[8px]"
        style={{ background: on ? 'rgb(var(--grade-aplus) / 0.18)' : 'var(--glass-fill)' }}>
        {on ? '✓' : '·'}
      </span>
      {label}
    </span>
  );
}

interface DetailPanelProps {
  trade: Trade | null;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Springs out of the node it came from via a shared layoutId, so the card you
 * clicked visibly becomes the panel. Escape or a click on the scrim collapses
 * it back into the node.
 */
export function DetailPanel({ trade, onClose, onChanged }: DetailPanelProps) {
  const [settling, setSettling] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>('Win');
  const [rMultiple, setRMultiple] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!trade) return;
    setOutcome(trade.outcome);
    setRMultiple(trade.r_multiple == null ? '' : String(trade.r_multiple));
    setSettling(false);
    setConfirmDelete(false);
  }, [trade]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function settle() {
    if (!trade) return;
    setBusy(true);
    await fetch(`/api/trades/${trade.id}/settle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, r_multiple: rMultiple.trim() === '' ? null : Number(rMultiple) }),
    });
    setBusy(false);
    onChanged();
    onClose();
  }

  async function remove() {
    if (!trade) return;
    setBusy(true);
    await fetch(`/api/trades/${trade.id}`, { method: 'DELETE' });
    setBusy(false);
    onChanged();
    onClose();
  }

  return (
    <AnimatePresence>
      {trade && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={spring}
            onClick={onClose}
            className="fixed inset-0 z-40"
            // A modal scrim darkens in both themes — that is what makes the
            // panel read as lifted off the board.
            style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(6px)' }}
          />

          <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-6">
            <motion.div
              layoutId={`trade-${trade.id}`}
              transition={springSoft}
              className="glass pointer-events-auto max-h-full w-full max-w-[54rem] overflow-y-auto rounded-[28px]"
              style={{
                borderColor: `rgb(${OUTCOME_COLOR[trade.outcome]} / 0.45)`,
                boxShadow: `var(--shadow-panel), 0 0 60px -16px rgb(${OUTCOME_COLOR[trade.outcome]} / 0.5)`,
                // A reading surface, not a window: the board behind this panel
                // was bleeding through the explanation text.
                background: 'color-mix(in srgb, var(--bg-raised) 88%, transparent)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/screenshots/${trade.screenshot_path}`} alt="Chart"
                className="max-h-[46vh] w-full object-contain" style={{ background: 'var(--letterbox)' }} />

              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.06 }}
                className="p-7"
              >
                <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold tracking-tight">{trade.reason}</h2>
                    <p className="mt-1 text-[12px]" style={{ color: 'var(--text-dim)' }}>
                      {new Date(trade.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      {' · '}{trade.instrument} {trade.direction} · {trade.session}
                      {trade.macro_time && ' · macro'}
                    </p>
                  </div>
                  <GradeBadge total={trade.grade_total} max={GRADE_MAX} size="md" />
                </div>

                <p className="mb-6 whitespace-pre-wrap text-[13px] leading-relaxed">{trade.explanation}</p>

                {trade.lesson && (
                  <div className="mb-6 rounded-[16px] p-4"
                    style={{ background: 'var(--glass-fill)', border: '1px solid var(--glass-stroke)' }}>
                    <div className="mb-1.5 text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
                      Lesson
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{trade.lesson}</p>
                  </div>
                )}

                <div className="mb-6 flex flex-wrap gap-x-4 gap-y-2">
                  <Check on={trade.sweep_before_entry} label="Sweep before entry" />
                  <Check on={trade.singular_gap} label="Singular gap" />
                  <Check on={trade.target_unswept} label="Target unswept" />
                  <Check on={trade.smt} label="SMT divergence" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Group>
                    <Row label="Setup" value={trade.setup_type} />
                    <Row label="HTF bias" value={trade.htf_bias} />
                    <Row label="Premium / discount" value={trade.premium_discount} />
                    <Row label="Target" value={trade.target_type} />
                  </Group>
                  <Group>
                    <Row label={RUBRIC.candle_strength.label} value={`${trade.candle_strength} / ${RUBRIC.candle_strength.max}`} />
                    <Row label={RUBRIC.inversion_speed.label} value={`${trade.inversion_speed} / ${RUBRIC.inversion_speed.max}`} />
                    <Row label={RUBRIC.risk_reward.label} value={`${trade.risk_reward} / ${RUBRIC.risk_reward.max}`} />
                    <Row label="Contracts / risk / stop"
                      value={`${trade.contracts ?? '—'} · $${trade.risk_dollars ?? '—'} · ${trade.stop_points ?? '—'}pt`} />
                  </Group>
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-3">
                  <AnimatePresence mode="wait">
                    {settling ? (
                      <motion.div key="settle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} transition={spring} className="flex flex-1 flex-wrap items-center gap-3">
                        <div className="w-44"><Select value={outcome} onChange={setOutcome} options={OUTCOMES} /></div>
                        <Input
                          type="number" step="0.1" placeholder="R multiple" value={rMultiple}
                          onChange={(e) => setRMultiple(e.target.value)}
                          accent="var(--outcome-win)"
                          className="w-32"
                        />
                        <Button variant="primary" accent="var(--outcome-win)" onClick={settle} disabled={busy}>
                          {busy ? 'Saving…' : 'Save'}
                        </Button>
                        <Button onClick={() => setSettling(false)}>Cancel</Button>
                      </motion.div>
                    ) : (
                      <motion.div key="actions" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} transition={spring} className="flex flex-1 flex-wrap items-center gap-3">
                        <span className="tabular-nums text-[13px] font-semibold"
                          style={{ color: `rgb(${OUTCOME_COLOR[trade.outcome]})` }}>
                          {trade.outcome}
                          {trade.r_multiple != null && ` · ${trade.r_multiple > 0 ? '+' : ''}${trade.r_multiple.toFixed(1)}R`}
                        </span>
                        <Button onClick={() => setSettling(true)}>Settle outcome</Button>
                        <a href={`/new?edit=${trade.id}`} className="outline-none">
                          <Button tabIndex={-1}>Edit</Button>
                        </a>
                        <div className="ml-auto">
                          {confirmDelete ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Delete this trade?</span>
                              <Button variant="danger" onClick={remove} disabled={busy}>Delete</Button>
                              <Button onClick={() => setConfirmDelete(false)}>Keep</Button>
                            </div>
                          ) : (
                            <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
