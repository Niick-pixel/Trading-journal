import {
  CHECKLIST_ITEMS, GRADE_MAX, TAKE_IT_THRESHOLD, TRIGGER_KEYS, type ChecklistKey,
} from './domain';

/** What gradeLetter() can return. The checklist's bands produce exactly these. */
export const GRADE_LETTERS = ['A+', 'A', 'B', 'C', 'F'] as const;
export type GradeLetter = (typeof GRADE_LETTERS)[number];

/**
 * Letter from the 100-point checklist score.
 *
 * 70 is the line the plan draws: at or above it, with the trigger fired, the
 * trade is a commitment rather than a decision.
 */
export function gradeLetter(score: number): GradeLetter {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'F';
}

export function checklistScore(answers: Partial<Record<ChecklistKey, boolean>>): number {
  return CHECKLIST_ITEMS.reduce((sum, item) => sum + (answers[item.key] ? item.points : 0), 0);
}

/** Both Phase 3 answers. Without them the entry does not exist. */
export function triggerFired(answers: Partial<Record<ChecklistKey, boolean>>): boolean {
  return TRIGGER_KEYS.every((key) => Boolean(answers[key]));
}

export const BELOW_STANDARD_AT = TAKE_IT_THRESHOLD;
export const BELOW_STANDARD_PROMPT = 'Below 70. This is not a trade — why are you taking it?';
export const NO_TRIGGER_PROMPT = 'Phase 3 has not fired. This is a setup still forming, not an entry.';

export function isBelowStandard(score: number): boolean {
  return score < TAKE_IT_THRESHOLD;
}

/**
 * A+ mint, A green, B amber, C orange, F red — as CSS variables, because the
 * pastel that reads on near-black is invisible on white. See app/globals.css.
 */
export const GRADE_COLOR: Record<GradeLetter, string> = {
  'A+': 'var(--grade-aplus)',
  A: 'var(--grade-a)',
  B: 'var(--grade-b)',
  C: 'var(--grade-c)',
  F: 'var(--grade-f)',
};

/**
 * Buckets for the plan's own question: is my grading actually predictive? If A+
 * trades do not outperform B trades, the checklist needs changing — not your
 * confidence.
 */
export const GRADE_BUCKETS = [
  { label: 'A+', test: (s: number) => s >= 90 },
  { label: 'A', test: (s: number) => s >= 80 && s < 90 },
  { label: 'B', test: (s: number) => s >= 70 && s < 80 },
  { label: 'C', test: (s: number) => s >= 50 && s < 70 },
  { label: 'F', test: (s: number) => s < 50 },
] as const;

export { GRADE_MAX };
