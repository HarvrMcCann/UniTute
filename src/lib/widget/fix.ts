import type { SupabaseClient } from "@supabase/supabase-js";
import type { Block } from "@/lib/course/schema";
import { repairWidget } from "@/lib/generation/pipeline";
import { hasErrors, lintWidget } from "./lint";

/*
 * Fixing one interactive after a course is built: the owner describes what's wrong (or the
 * automatic check finds it), Claude rewrites the widget and the lesson's block is updated in place.
 * The block keeps its ID. Uses the admin client, so callers must check ownership (and credit) first.
 */

/** Claude calls for fixes are logged in generation_usage with this step prefix. */
export const FIX_STEP_PREFIX = "fix ";
export const MAX_REPORT_CHARS = 1000;

/** `apiCostUsd` is what the Claude call cost, whether or not the fix worked. */
export type FixResult = ({ ok: true } | { ok: false; reason: string }) & { apiCostUsd: number };

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
  let apiCostUsd = 0;
  const fail = (reason: string): FixResult => ({ ok: false, reason, apiCostUsd });
  if (error || !lesson) return fail("Lesson not found.");

  const index = lesson.blocks.findIndex((b) => b.id === input.blockId && b.type === "widget");
  if (index < 0) return fail("Interactive not found.");
  const block = lesson.blocks[index] as Extract<Block, { type: "widget" }>;

  const report = input.report?.trim().slice(0, MAX_REPORT_CHARS) || undefined;
  const problems = lintWidget(block.html);
  if (!problems.length && !report) return fail("Describe what's wrong so Claude knows what to fix.");

  const repaired = await repairWidget(
    admin,
    input.courseId,
    `${FIX_STEP_PREFIX}${input.lessonKey} ${block.id}`,
    { title: block.title, brief: `Lesson: ${lesson.title}\n${block.description}`, html: block.html, problems, userReport: report },
    "medium",
    (usd) => (apiCostUsd += usd),
  );
  if (!repaired) return fail("Claude couldn't produce a fix this time. Try again in a minute.");
  const after = lintWidget(repaired.html);
  if (hasErrors(after)) return fail("The fixed version still had errors, so the original was kept. Try again, or describe the problem differently.");

  const blocks = lesson.blocks.slice();
  blocks[index] = { ...block, html: repaired.html, height: Math.min(1200, Math.max(120, Math.round(repaired.height))) };
  const { error: saveError } = await admin.from("lessons").update({ blocks }).eq("id", lesson.id);
  if (saveError) return fail("Couldn't save the fix.");
  return { ok: true, apiCostUsd };
}
