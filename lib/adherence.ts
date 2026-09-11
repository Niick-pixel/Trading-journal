import { TAKE_IT_THRESHOLD } from './domain';

/**
 * Everything the derivation needs, and nothing else — so it can be computed
 * from a saved row, from a half-filled form, or from an imported record.
 */
export interface AdherenceInput {
  trigger_fired: boolean;
  checklist_score: number;
  mistake_tags: string[];
}

/**
 * Whether the rules were actually followed, computed rather than asked.
 *
 * Self-reporting is the weakest data in the journal: it is answered at the
 * moment I am least able to be objective, about the thing I am least willing
 * to be objective about. The checklist and the mistake tags already contain
 * the answer, so take it from them.
 *
 * All three have to hold. A trade can score 100 and still be a rule break if
 * the trigger never fired, and it can have fired with a 95 and still be a rule
 * break if I moved the stop afterwards.
 */
export function derivedAdherence(t: AdherenceInput): boolean {
  return t.trigger_fired
    && t.checklist_score >= TAKE_IT_THRESHOLD
    && t.mistake_tags.length === 0;
}

/**
 * The gap between what I said and what the record shows.
 *
 * 'overclaimed' is the one that matters: I said I followed every rule and the
 * checklist disagrees. That number falling over time is real progress, and it
 * is the only measure here that cannot be gamed by being harder on myself —
 * being harsh shows up as 'underclaimed' instead.
 */
export interface AdherenceGap {
  /** Trades where the question was actually answered. */
  answered: number;
  agreed: number;
  /** Said yes, the checklist says no. */
  overclaimed: number;
  /** Said no, the checklist says yes. */
  underclaimed: number;
  /** Never answered — not counted in the gap, but worth seeing. */
  unanswered: number;
  /** overclaimed / answered. Null until something has been answered. */
  overclaimRate: number | null;
}

export function adherenceGap(
  trades: Array<{ followed_rules: boolean | null } & AdherenceInput>,
): AdherenceGap {
  let agreed = 0;
  let overclaimed = 0;
  let underclaimed = 0;
  let unanswered = 0;

  for (const t of trades) {
    if (t.followed_rules === null) { unanswered += 1; continue; }
    const derived = derivedAdherence(t);
    if (t.followed_rules === derived) agreed += 1;
    else if (t.followed_rules) overclaimed += 1;
    else underclaimed += 1;
  }

  const answered = agreed + overclaimed + underclaimed;
  return {
    answered,
    agreed,
    overclaimed,
    underclaimed,
    unanswered,
    overclaimRate: answered ? overclaimed / answered : null,
  };
}
