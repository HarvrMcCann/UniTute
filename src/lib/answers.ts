import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyAnswer, countsTowardMastery, type MasteryState } from "@/lib/mastery";

/*
 * Saving an answer: one attempts row, and (if it counts) the concept's mastery updated with the
 * PLAN.md formula. Runs with the user's own client, so RLS keeps everything to their own rows.
 */

export type MarkedBy = "auto" | "self" | "ai";

export type SavedAnswer = { mastery: MasteryState; counted: boolean };

type MasteryRow = { score: number; attempts: number; user_override: number | null };

export const toState = (row: MasteryRow): MasteryState => ({
  score: Number(row.score),
  attempts: row.attempts,
  override: row.user_override === null ? null : Number(row.user_override),
});

export async function saveAnswer(
  supabase: SupabaseClient,
  userId: string,
  answer: { questionDbId: string; conceptDbId: string; score: number; markedBy: MarkedBy; response?: string; feedback?: string },
): Promise<SavedAnswer | null> {
  const score = Math.min(1, Math.max(0, Number.isFinite(answer.score) ? answer.score : 0));

  const { data: last } = await supabase
    .from("attempts")
    .select("answered_at")
    .eq("user_id", userId)
    .eq("question_id", answer.questionDbId)
    .order("answered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("attempts").insert({
    user_id: userId,
    question_id: answer.questionDbId,
    correct: score >= 0.99,
    score,
    marked_by: answer.markedBy,
    response: answer.response?.slice(0, 4000) ?? null,
    feedback: answer.feedback ?? null,
  });
  if (error) {
    console.warn("Couldn't record attempt:", error.message);
    return null;
  }

  const { data: row } = await supabase
    .from("mastery")
    .select("score, attempts, user_override")
    .eq("user_id", userId)
    .eq("concept_id", answer.conceptDbId)
    .maybeSingle<MasteryRow>();
  const current = row ? toState(row) : null;

  if (!countsTowardMastery(last ? new Date(last.answered_at) : null)) {
    return { mastery: current ?? { score: 0, attempts: 0, override: null }, counted: false };
  }

  const next = applyAnswer(current, score);
  const { error: masteryError } = await supabase.from("mastery").upsert({
    user_id: userId,
    concept_id: answer.conceptDbId,
    score: next.score,
    attempts: next.attempts,
    user_override: null,
    updated_at: new Date().toISOString(),
  });
  if (masteryError) console.warn("Couldn't update mastery:", masteryError.message);
  return { mastery: next, counted: true };
}
