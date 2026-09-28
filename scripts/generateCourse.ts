/**
 * Runs course generation for one course directly (no Inngest), printing timings and cost.
 * For development: tuning prompts and checking each step fits Vercel's 300s limit.
 *
 * Usage: npm run generate -- <courseId> [cram|recommended|deep] [--outline-only]
 * Spends real Anthropic credit.
 */
import { createAdminClient } from "../src/lib/supabase/admin";
import { estimateCostUsd, type Usage } from "../src/lib/generation/claude";
import {
  generateLessonContent,
  generateOutline,
  loadCourseInputs,
  saveGeneratedCourse,
  setProgress,
} from "../src/lib/generation/pipeline";
import type { LessonContent } from "../src/lib/generation/schemas";

async function main() {
  const [courseId, mode, flag] = process.argv.slice(2);
  if (!courseId) throw new Error("Usage: npm run generate -- <courseId> [cram|recommended|deep] [--outline-only]");
  const admin = createAdminClient();

  if (mode) await admin.from("courses").update({ length_mode: mode }).eq("id", courseId).throwOnError();
  await setProgress(admin, courseId, { stage: "outline" }, { status: "generating", generation_error: null });
  const inputs = await loadCourseInputs(admin, courseId);
  console.log(`"${inputs.title}": ${inputs.files.length} files, length ${inputs.lengthMode}`);

  let t = Date.now();
  const plan = await generateOutline(admin, inputs);
  const lessons = plan.units.flatMap((u) => u.lessons);
  console.log(`\nOutline in ${((Date.now() - t) / 1000).toFixed(0)}s: ${plan.units.length} units, ${lessons.length} lessons, ${plan.concepts.length} concepts`);
  for (const u of plan.units) {
    console.log(`  ${u.title}${u.week ? ` (week ${u.week})` : ""}`);
    for (const l of u.lessons) console.log(`    - ${l.title} [${l.estMinutes} min, ${l.sourceFileIds.length} files]`);
  }
  if (flag === "--outline-only") {
    await setProgress(admin, courseId, null, { status: "extracted" });
    return report(admin, courseId);
  }

  await setProgress(admin, courseId, { stage: "lessons", total: lessons.length });
  const contents: Record<string, LessonContent> = {};
  for (const unit of plan.units) {
    for (const lesson of unit.lessons) {
      t = Date.now();
      contents[lesson.id] = await generateLessonContent(admin, inputs, plan, unit.id, lesson.id);
      const c = contents[lesson.id];
      console.log(`  ${lesson.title}: ${((Date.now() - t) / 1000).toFixed(0)}s, ${c.blocks.length} blocks, ${c.questions.length} questions`);
    }
  }

  await setProgress(admin, courseId, { stage: "saving" });
  await saveGeneratedCourse(admin, inputs, plan, contents);
  await setProgress(admin, courseId, null, { generation_error: null });
  console.log("\nSaved. Open /course/" + courseId);
  await report(admin, courseId);
}

async function report(admin: ReturnType<typeof createAdminClient>, courseId: string) {
  const { data } = await admin.from("generation_usage").select("*").eq("course_id", courseId).order("created_at");
  const rows = (data ?? []) as (Usage & { step: string; duration_ms: number })[];
  console.log("\nstep                                       in      out  cacheW  cacheR    secs    $");
  for (const r of rows) {
    console.log(
      `${r.step.slice(0, 40).padEnd(40)} ${String(r.input_tokens).padStart(6)} ${String(r.output_tokens).padStart(8)} ${String(r.cache_creation_input_tokens).padStart(7)} ${String(r.cache_read_input_tokens).padStart(7)} ${String(Math.round(r.duration_ms / 1000)).padStart(7)} ${estimateCostUsd(r).toFixed(3)}`,
    );
  }
  const total = rows.reduce((s, r) => s + estimateCostUsd(r), 0);
  console.log(`Total: US$${total.toFixed(2)} over ${rows.length} calls`);
}

main().catch(async (e) => {
  console.error(e);
  const courseId = process.argv[2];
  if (courseId) await setProgress(createAdminClient(), courseId, null, { status: "failed", generation_error: String(e?.message ?? e).slice(0, 500) });
  process.exitCode = 1;
});
