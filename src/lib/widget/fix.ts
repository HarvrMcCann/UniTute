import type { SupabaseClient } from "@supabase/supabase-js";
import type { Block } from "@/lib/course/schema";
import { repairWidget } from "@/lib/generation/pipeline";
import { hasErrors, lintWidget } from "./lint";

/*
 * Fixing one interactive after a course is built: the owner describes what's wrong (or the
 * automatic check finds it), Claude rewrites the widget and the lesson's block is updated in place.
 * The block keeps its ID. Uses the admin client, so callers must check ownership first.
 */

/** Claude calls for fixes are logged in generation_usage with this step prefix (used for the daily limit). */
export const FIX_STEP_PREFIX = "fix ";
export const FIXES_PER_DAY = 5;
export const MAX_REPORT_CHARS = 1000;

export type FixResult = { ok: true } | { ok: false; reason: string };

export async function fixesToday(admin: SupabaseClient, courseId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("generation_usage")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .like("step", `${FIX_STEP_PREFIX}%`)
    .gte("created_at", since);
  return count ?? 0;
}

export async function fixWidget(
  admin: SupabaseClient,
  input: { courseId: string; lessonKey: string; blockId: string; report?: string },
): Promise<FixResult> {
  const { data: lesson, error } = await admin
    .from("lessons")
    .select("id, title, blocks")
    .eq("course_id", input.courseId)
    .eq("key", input.lessonKey)
    .maybeSingle<{ id: string; title: string; blocks: Block[] }>();
  if (error || !lesson) return { ok: false, reason: "Lesson not found." };

  const index = lesson.blocks.findIndex((b) => b.id === input.blockId && b.type === "widget");
  if (index < 0) return { ok: false, reason: "Interactive not found." };
  const block = lesson.blocks[index] as Extract<Block, { type: "widget" }>;

  const report = input.report?.trim().slice(0, MAX_REPORT_CHARS) || undefined;
  const problems = lintWidget(block.html);
  if (!problems.length && !report) return { ok: false, reason: "Describe what's wrong so Claude knows what to fix." };

  const repaired = await repairWidget(
    admin,
    input.courseId,
    `${FIX_STEP_PREFIX}${input.lessonKey} ${block.id}`,
    { title: block.title, brief: `Lesson: ${lesson.title}\n${block.description}`, html: block.html, problems, userReport: report },
    "medium",
  );
  if (!repaired) return { ok: false, reason: "Claude couldn't produce a fix this time. Try again in a minute." };
  const after = lintWidget(repaired.html);
  if (hasErrors(after)) return { ok: false, reason: "The fixed version still had errors, so the original was kept. Try again, or describe the problem differently." };

  const blocks = lesson.blocks.slice();
  blocks[index] = { ...block, html: repaired.html, height: Math.min(1200, Math.max(120, Math.round(repaired.height))) };
  const { error: saveError } = await admin.from("lessons").update({ blocks }).eq("id", lesson.id);
  if (saveError) return { ok: false, reason: "Couldn't save the fix." };
  return { ok: true };
}
