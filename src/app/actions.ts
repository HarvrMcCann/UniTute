"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Theme } from "@/lib/theme";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveAnswer } from "@/lib/answers";
import { adjustCredit, creditCost, getCredit, MIN_CREDIT_USD } from "@/lib/credits";
import type { MasteryState } from "@/lib/mastery";
import { markShortAnswer, VERDICT_SCORE, type Verdict } from "@/lib/marking";
import { fixWidget, MAX_REPORT_CHARS, type FixResult } from "@/lib/widget/fix";
import type { ChatMessage } from "@/lib/tutor/protocol";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

/** Remembers the theme on the profile when signed in (the browser keeps it in localStorage too). */
export async function saveTheme(theme: Theme) {
  if (theme !== "dark" && theme !== "light") return;
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ theme }).eq("id", user.id);
}

export type ProgressUpdate = {
  courseId: string;
  lessonDbId: string;
  lastBlockId?: string;
  completed?: boolean;
};

/**
 * Saves lesson progress for the signed-in user. Runs on the server so lesson pages don't
 * ship the Supabase browser library. RLS still checks the row belongs to this user.
 */
export async function saveProgress(update: ProgressUpdate) {
  const user = await getUser();
  if (!user) return;
  const row: Record<string, string> = {
    user_id: user.id,
    lesson_id: update.lessonDbId,
    course_id: update.courseId,
    updated_at: new Date().toISOString(),
  };
  if (update.lastBlockId) row.last_block_id = update.lastBlockId;
  if (update.completed) row.completed_at = new Date().toISOString();

  const supabase = await createClient();
  const { error } = await supabase.from("lesson_progress").upsert(row);
  if (error) console.warn("Couldn't save progress:", error.message);
}

// ---------- Answers and mastery ----------

type QuestionRow = { id: string; key: string; concept_id: string; type: string; prompt: string; answer: { modelAnswer?: string; markingGuide?: string } | null };

async function loadQuestion(questionDbId: string): Promise<QuestionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("questions")
    .select("id, key, concept_id, type, prompt, answer")
    .eq("id", questionDbId)
    .maybeSingle<QuestionRow>();
  return data;
}

export type AnswerInput = {
  questionDbId: string;
  /** 0-1: first-try result for multiple choice, neighbouring pairs for ordering, self-mark for short answer. */
  score: number;
  markedBy: "auto" | "self";
  response?: string;
};

/**
 * Records a finished knowledge check and updates the concept's mastery. Returns the new mastery
 * (null when signed out or on failure). Scores are the learner's own, so they're trusted.
 */
export async function recordAnswer(input: AnswerInput): Promise<MasteryState | null> {
  const user = await getUser();
  if (!user) return null;
  const question = await loadQuestion(input.questionDbId);
  if (!question) return null;
  const saved = await saveAnswer(await createClient(), user.id, {
    questionDbId: question.id,
    conceptDbId: question.concept_id,
    score: Number(input.score),
    markedBy: input.markedBy === "self" ? "self" : "auto",
    response: typeof input.response === "string" ? input.response : undefined,
  });
  return saved?.mastery ?? null;
}

export type MarkResult =
  | { ok: true; verdict: Verdict; feedback: string; mastery: MasteryState | null; credit: number }
  | { ok: false; reason: string; needsCredit?: boolean };

/** Marks a short answer with Claude Haiku, charged to the learner's credit. */
export async function markAnswer(input: { questionDbId: string; response: string }): Promise<MarkResult> {
  const user = await getUser();
  if (!user) return { ok: false, reason: "Sign in to have your answers marked." };
  const response = String(input.response ?? "").trim().slice(0, 2000);
  if (!response) return { ok: false, reason: "Write an answer first." };

  const supabase = await createClient();
  if ((await getCredit(supabase, user.id)) < MIN_CREDIT_USD) {
    return { ok: false, reason: "You're out of credit, so mark this one yourself.", needsCredit: true };
  }
  const question = await loadQuestion(input.questionDbId);
  if (!question || question.type !== "shortAnswer" || !question.answer?.modelAnswer) return { ok: false, reason: "Question not found." };

  let marked;
  try {
    marked = await markShortAnswer({
      prompt: question.prompt,
      modelAnswer: question.answer.modelAnswer,
      markingGuide: question.answer.markingGuide ?? "",
      response,
    });
  } catch (error) {
    console.warn("AI marking failed:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "The marker isn't available right now, so mark this one yourself." };
  }

  const credit = await adjustCredit(createAdminClient(), user.id, -creditCost(marked.apiCostUsd), `mark ${question.key}`);
  const saved = await saveAnswer(supabase, user.id, {
    questionDbId: question.id,
    conceptDbId: question.concept_id,
    score: VERDICT_SCORE[marked.verdict],
    markedBy: "ai",
    response,
    feedback: marked.feedback,
  });
  return { ok: true, verdict: marked.verdict, feedback: marked.feedback, mastery: saved?.mastery ?? null, credit: credit ?? 0 };
}

/**
 * Sets (0-1) or clears (null) the learner's own level for a concept. It shows until their next
 * answer on that concept, which then starts from it.
 */
export async function setMasteryOverride(input: { conceptDbId: string; value: number | null }): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  const value = input.value === null ? null : Math.min(1, Math.max(0, Number(input.value)));
  if (value !== null && !Number.isFinite(value)) return false;

  const supabase = await createClient();
  const { data: concept } = await supabase.from("concepts").select("id").eq("id", input.conceptDbId).maybeSingle();
  if (!concept) return false;
  const { error } = await supabase
    .from("mastery")
    .upsert({ user_id: user.id, concept_id: concept.id, user_override: value, updated_at: new Date().toISOString() });
  if (error) console.warn("Couldn't save level:", error.message);
  return !error;
}

// ---------- Interactives ----------

/** Credit needed before starting a fix (a fix typically costs US$0.05-0.20 of credit). */
const MIN_FIX_CREDIT_USD = 0.2;

export type FixInteractiveInput = { courseId: string; lessonKey: string; blockId: string; report: string };
export type FixInteractiveResult = { ok: true } | { ok: false; reason: string };

/** The course owner asks Claude to fix one interactive, describing what's wrong. Charged to their credit. */
export async function fixInteractive(input: FixInteractiveInput): Promise<FixInteractiveResult> {
  const user = await getUser();
  if (!user) return { ok: false, reason: "Sign in to fix interactives." };
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("owner_id").eq("id", input.courseId).maybeSingle();
  if (!course || course.owner_id !== user.id) return { ok: false, reason: "Only the course's owner can fix its interactives." };
  if ((await getCredit(supabase, user.id)) < MIN_FIX_CREDIT_USD) {
    return { ok: false, reason: "You need at least $0.20 of credit to fix an interactive." };
  }

  const admin = createAdminClient();
  const result: FixResult = await fixWidget(admin, {
    courseId: input.courseId,
    lessonKey: input.lessonKey,
    blockId: input.blockId,
    report: String(input.report ?? "").slice(0, MAX_REPORT_CHARS),
  });
  // Only successful fixes are charged; a failed attempt is on us.
  if (!result.ok) return { ok: false, reason: result.reason };
  await adjustCredit(admin, user.id, -creditCost(result.apiCostUsd), `fix ${input.lessonKey} ${input.blockId}`);
  revalidatePath(`/course/${input.courseId}/${input.lessonKey}`);
  return { ok: true };
}

// ---------- Tutor ----------

/** The signed-in student's recent tutor chat in a course (oldest first). */
export async function getTutorHistory(courseId: string): Promise<ChatMessage[]> {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("tutor_messages")
    .select("id, role, content, lesson_key, anchor_block_id")
    .eq("user_id", user.id)
    .eq("course_id", String(courseId))
    .order("created_at", { ascending: false })
    .limit(40);
  return (data ?? []).reverse().map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    lessonKey: m.lesson_key,
    anchorBlockId: m.anchor_block_id,
  }));
}

// ---------- Bug reports ----------

export async function reportProblem(input: { courseId: string; lessonKey: string; blockId: string | null; note: string }): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  const note = String(input.note ?? "").trim().slice(0, 2000);
  if (!note) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("bug_reports").insert({
    user_id: user.id,
    course_id: String(input.courseId),
    lesson_key: String(input.lessonKey).slice(0, 200),
    block_id: input.blockId ? String(input.blockId).slice(0, 200) : null,
    note,
  });
  if (error) console.warn("Couldn't save bug report:", error.message);
  return !error;
}

// ---------- Sharing ----------

/**
 * Turns the course's share link on (a new random token) or off. Only the owner can (RLS on
 * courses). Turning it off stops new people joining; people who already joined keep access.
 */
export async function setShareLink(courseId: string, enabled: boolean): Promise<{ token: string | null } | null> {
  const user = await getUser();
  if (!user) return null;
  const token = enabled ? randomBytes(12).toString("base64url") : null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .update({ share_token: token })
    .eq("id", String(courseId))
    .eq("owner_id", user.id)
    .select("id");
  if (error || !data?.length) return null;
  return { token };
}
