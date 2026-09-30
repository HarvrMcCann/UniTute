/*
 * Knowledge level per concept (PLAN.md). Pure functions so they can be tested and used on both
 * the server (saving answers) and the client (showing levels).
 *
 *   score_new = score + (result - score) / (attempts + 2)
 *
 * result is 0-1 (partial credit allowed). Early answers move the score a lot, later ones fine-tune
 * it. A level the user sets by hand (override) shows until their next answer on that concept, which
 * then starts from the override instead of the old measured score.
 */

export type MasteryState = { score: number; attempts: number; override: number | null };

export type MasteryLevel = "unseen" | "low" | "mid" | "high";

/** A question only moves mastery again once this long has passed since it was last answered. */
export const RECOUNT_AFTER_MS = 24 * 60 * 60 * 1000;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function applyAnswer(prev: MasteryState | null, result: number): MasteryState {
  const attempts = prev?.attempts ?? 0;
  const start = prev ? (prev.override ?? prev.score) : 0;
  return { score: clamp01(start + (clamp01(result) - start) / (attempts + 2)), attempts: attempts + 1, override: null };
}

/** What to show: the user's own setting if they made one, otherwise the measured score. */
export const effectiveScore = (m: MasteryState | null | undefined): number | null =>
  !m || (m.attempts === 0 && m.override === null) ? null : (m.override ?? m.score);

export function levelOf(score: number | null): MasteryLevel {
  if (score === null) return "unseen";
  return score < 0.4 ? "low" : score < 0.75 ? "mid" : "high";
}

/** Whether a new answer to a question counts toward mastery, given when it was last answered. */
export const countsTowardMastery = (lastAnsweredAt: Date | null, now = new Date()) =>
  lastAnsweredAt === null || now.getTime() - lastAnsweredAt.getTime() >= RECOUNT_AFTER_MS;

/**
 * Partial credit for an ordering question: the share of neighbouring pairs in the right order.
 * `order` lists item indices as placed, where the correct order is 0, 1, 2...
 */
export function orderingScore(order: number[]): number {
  if (order.length < 2) return 1;
  let right = 0;
  for (let i = 0; i < order.length - 1; i++) if (order[i] < order[i + 1]) right++;
  return right / (order.length - 1);
}

/**
 * A lesson's level: the average over its concepts, counting untested ones as 0, so a lesson only
 * shows as mastered when all of it has been tested. Null when none of its concepts has a level yet.
 */
export function averageScore(scores: (number | null)[]): number | null {
  if (!scores.length || scores.every((s) => s === null)) return null;
  return scores.reduce<number>((sum, s) => sum + (s ?? 0), 0) / scores.length;
}

/** Plain text for the tutor (phase 7), e.g. "Fourier series: 0.72 (8 answers)". */
export function masterySummaryLine(name: string, m: MasteryState | null): string {
  const score = effectiveScore(m);
  if (score === null) return `${name}: not tested yet`;
  const answers = `${m!.attempts} answer${m!.attempts === 1 ? "" : "s"}`;
  return `${name}: ${score.toFixed(2)} (${answers}${m!.override !== null ? ", set by the student" : ""})`;
}
