import { GRADE_MAX, RUBRIC_KEYS, type RubricKey } from './domain';

export const GRADE_LETTERS = ['A+', 'A', 'B+', 'B', 'C', 'F'] as const;
export type GradeLetter = (typeof GRADE_LETTERS)[number];

/** 9-10 = A+, 8 = A, 7 = B+, 6 = B, 5 = C, <=4 = F. */
export function gradeLetter(total: number): GradeLetter {
  if (total >= 9) return 'A+';
  if (total === 8) return 'A';
  if (total === 7) return 'B+';
  if (total === 6) return 'B';
  if (total === 5) return 'C';
  return 'F';
}

export function gradeTotal(scores: Record<RubricKey, number>): number {
  return RUBRIC_KEYS.reduce((sum, k) => sum + (scores[k] ?? 0), 0);
}

/** The threshold that turns the live badge amber during capture. */
export const BELOW_STANDARD_AT = 5;
export const BELOW_STANDARD_PROMPT = 'Below your standard. Why did you take it?';

export function isBelowStandard(total: number): boolean {
  return total <= BELOW_STANDARD_AT;
}

/**
 * A+ mint, A green, B amber, C orange, F red — as CSS variables, because the
 * pastel that reads on near-black is invisible on white. See app/globals.css.
 */
export const GRADE_COLOR: Record<GradeLetter, string> = {
  'A+': 'var(--grade-aplus)',
  A: 'var(--grade-a)',
  'B+': 'var(--grade-bplus)',
  B: 'var(--grade-b)',
  C: 'var(--grade-c)',
  F: 'var(--grade-f)',
};

/** Buckets for "does my grading actually predict outcomes?" on the stats page. */
export const GRADE_BUCKETS = [
  { label: 'A+', test: (t: number) => t >= 9 },
  { label: 'A', test: (t: number) => t === 8 },
  { label: 'B+', test: (t: number) => t === 7 },
  { label: 'B', test: (t: number) => t === 6 },
  { label: 'C', test: (t: number) => t === 5 },
  { label: 'F', test: (t: number) => t <= 4 },
] as const;

export { GRADE_MAX };
