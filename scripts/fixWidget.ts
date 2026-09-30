/**
 * Checks a course's interactives, and fixes one with Claude (the same path as the in-app "Fix" button,
 * without the daily limit).
 *
 *   npm run fix-widget -- <courseId>                                  # list interactives + check results (free)
 *   npm run fix-widget -- <courseId> <lessonKey> <blockId> ["what's wrong"]   # SPENDS ANTHROPIC CREDIT (~US$0.10-0.20)
 */
import { createAdminClient } from "../src/lib/supabase/admin";
import type { Block } from "../src/lib/course/schema";
import { fixWidget } from "../src/lib/widget/fix";
import { describeProblems, lintWidget } from "../src/lib/widget/lint";

async function main() {
  const [courseId, lessonKey, blockId, report] = process.argv.slice(2);
  if (!courseId) throw new Error("Usage: npm run fix-widget -- <courseId> [<lessonKey> <blockId> [report]]");
  const admin = createAdminClient();

  if (!lessonKey || !blockId) {
    const { data, error } = await admin.from("lessons").select("key, blocks").eq("course_id", courseId).order("position");
    if (error) throw new Error(error.message);
    for (const lesson of data as { key: string; blocks: Block[] }[]) {
      for (const block of lesson.blocks) {
        if (block.type !== "widget") continue;
        const problems = lintWidget(block.html);
        console.log(`${lesson.key} ${block.id}  "${block.title}"  ${problems.length ? "\n" + describeProblems(problems) : "ok"}`);
      }
    }
    return;
  }

  const started = Date.now();
  const result = await fixWidget(admin, { courseId, lessonKey, blockId, report });
  console.log(result.ok ? `fixed in ${Math.round((Date.now() - started) / 1000)}s` : `not fixed: ${result.reason}`);
  if (!result.ok) process.exitCode = 1;
}

main();
