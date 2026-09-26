"use server";

import { revalidatePath } from "next/cache";
import type { Theme } from "@/lib/theme";
import { createClient, getUser } from "@/lib/supabase/server";

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
