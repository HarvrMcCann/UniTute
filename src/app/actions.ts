"use server";

import { revalidatePath } from "next/cache";
import type { Theme } from "@/lib/theme";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FIXES_PER_DAY, fixesToday, fixWidget, MAX_REPORT_CHARS, type FixResult } from "@/lib/widget/fix";

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

/**
 * Records a finished knowledge check. `correct` means right on the first try
 * (revealing the answer, or getting it right after a mistake, counts as not correct).
 */
export async function recordAttempt(questionDbId: string, correct: boolean) {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("attempts")
    .insert({ user_id: user.id, question_id: questionDbId, correct: Boolean(correct) });
  if (error) console.warn("Couldn't record attempt:", error.message);
}

export type FixInteractiveInput = { courseId: string; lessonKey: string; blockId: string; report: string };

/**
 * The course owner asks Claude to fix one interactive, describing what's wrong. Limited per course
 * per day (a stand-in until paid credits exist). Costs roughly US$0.05-0.20 per fix.
 */
export async function fixInteractive(input: FixInteractiveInput): Promise<FixResult> {
  const user = await getUser();
  if (!user) return { ok: false, reason: "Sign in to fix interactives." };
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("owner_id").eq("id", input.courseId).maybeSingle();
  if (!course || course.owner_id !== user.id) return { ok: false, reason: "Only the course's owner can fix its interactives." };

  const admin = createAdminClient();
  if ((await fixesToday(admin, input.courseId)) >= FIXES_PER_DAY) {
    return { ok: false, reason: `You've used today's ${FIXES_PER_DAY} fixes for this course. Try again tomorrow.` };
  }
  const result = await fixWidget(admin, {
    courseId: input.courseId,
    lessonKey: input.lessonKey,
    blockId: input.blockId,
    report: String(input.report ?? "").slice(0, MAX_REPORT_CHARS),
  });
  if (result.ok) revalidatePath(`/course/${input.courseId}/${input.lessonKey}`);
  return result;
}
