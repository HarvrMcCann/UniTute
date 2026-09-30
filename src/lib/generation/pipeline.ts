import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveCourse } from "@/lib/course/save";
import { assembleCourse, planFromOutline, type CoursePlan, type LengthMode, type PlannedUnit } from "./assemble";
import { callStructured, GENERATION_MODEL, type Usage } from "./claude";
import { courseOutlineText, LESSON_SYSTEM, lessonRequest, OUTLINE_SYSTEM, outlinePrompt, WIDGET_SYSTEM, widgetRepairRequest, widgetRequest } from "./prompts";
import { describeProblems, hasErrors, lintWidget, type WidgetProblem } from "@/lib/widget/lint";
import { outlineSchema, widgetBuildSchema, type LessonContent, type LessonResult, type WidgetBuild } from "./schemas";
import { fromWire, lessonWireSchema, parseLessonWire } from "./wire";

/*
 * The steps of course generation as plain async functions (admin client in, data out),
 * so the Inngest job and local test scripts share them.
 */

const BUCKET = "source-files";
/** Send PDFs to Claude as documents (diagrams, correct maths) while the request stays well under 32 MB. */
const MAX_PDF_BYTES_PER_FILE = 15 * 1024 * 1024;
const MAX_PDF_BYTES_PER_REQUEST = 22 * 1024 * 1024; // base64 adds a third
const MAX_PDF_PAGES_PER_REQUEST = 500;

export type SourceFileMeta = {
  id: string;
  filename: string;
  box: "content" | "objectives";
  week: number | null;
  kind: "pdf" | "pptx" | "docx";
  storage_path: string;
  size_bytes: number | null;
  page_count: number | null;
  status: string;
};

export type CourseInputs = {
  courseId: string;
  title: string;
  notes: string;
  lengthMode: LengthMode;
  ownerId: string | null;
  university: string | null;
  courseCode: string | null;
  year: number | null;
  files: SourceFileMeta[];
};

export async function loadCourseInputs(admin: SupabaseClient, courseId: string): Promise<CourseInputs> {
  const [course, files] = await Promise.all([
    admin.from("courses").select("id, title, notes, length_mode, owner_id, university, course_code, year").eq("id", courseId).single(),
    admin
      .from("source_files")
      .select("id, filename, box, week, kind, storage_path, size_bytes, page_count, status")
      .eq("course_id", courseId)
      .eq("status", "done")
      .order("week", { nullsFirst: false })
      .order("filename"),
  ]);
  if (course.error) throw new Error(`load course: ${course.error.message}`);
  if (files.error) throw new Error(`load files: ${files.error.message}`);
  if (files.data.length === 0) throw new Error("This course has no readable files");
  const c = course.data;
  return {
    courseId,
    title: c.title,
    notes: c.notes ?? "",
    lengthMode: c.length_mode,
    ownerId: c.owner_id,
    university: c.university,
    courseCode: c.course_code,
    year: c.year,
    files: files.data as SourceFileMeta[],
  };
}

async function extractedTexts(admin: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const { data, error } = await admin.from("source_files").select("id, extracted_text").in("id", ids);
  if (error) throw new Error(`load text: ${error.message}`);
  return new Map(data.map((r) => [r.id as string, (r.extracted_text as string | null) ?? ""]));
}

export async function logUsage(admin: SupabaseClient, courseId: string, step: string, usage: Usage, durationMs: number) {
  const { error } = await admin
    .from("generation_usage")
    .insert({ course_id: courseId, step, model: GENERATION_MODEL, duration_ms: durationMs, ...usage });
  if (error) console.warn(`usage log failed for ${step}: ${error.message}`);
}

export async function setProgress(admin: SupabaseClient, courseId: string, progress: Record<string, unknown> | null, extra: Record<string, unknown> = {}) {
  await admin.from("courses").update({ generation_progress: progress, updated_at: new Date().toISOString(), ...extra }).eq("id", courseId);
}

// ---------- Outline ----------

export async function generateOutline(admin: SupabaseClient, inputs: CourseInputs): Promise<CoursePlan> {
  const texts = await extractedTexts(admin, inputs.files.map((f) => f.id));
  const prompt = outlinePrompt({
    courseTitle: inputs.title,
    notes: inputs.notes,
    lengthMode: inputs.lengthMode,
    sources: inputs.files.map((f) => ({ id: f.id, filename: f.filename, box: f.box, week: f.week, text: texts.get(f.id) ?? "" })),
  });

  const { data } = await callStructured({
    system: OUTLINE_SYSTEM,
    content: [{ type: "text", text: prompt }],
    schema: outlineSchema,
    maxTokens: 32_000,
    effort: "high",
    onUsage: (usage, ms) => logUsage(admin, inputs.courseId, "outline", usage, ms),
  });

  return planFromOutline(data, {
    courseId: inputs.courseId,
    lengthMode: inputs.lengthMode,
    knownFileIds: new Set(inputs.files.map((f) => f.id)),
    fallbackTitle: inputs.title,
  });
}

// ---------- Lessons ----------

/** The files a unit's lessons draw on. Every lesson in the unit gets the same set, so the cache is shared. */
export function unitSourceIds(unit: PlannedUnit, files: SourceFileMeta[]): string[] {
  const chosen = new Set(unit.lessons.flatMap((l) => l.sourceFileIds));
  if (chosen.size === 0 && unit.week !== null) files.filter((f) => f.week === unit.week).forEach((f) => chosen.add(f.id));
  if (chosen.size === 0) files.filter((f) => f.box === "content").forEach((f) => chosen.add(f.id));
  // Stable order (week, then name) keeps the cached prefix byte-identical across lessons.
  return files.filter((f) => chosen.has(f.id)).map((f) => f.id);
}

async function sourceDocuments(admin: SupabaseClient, files: SourceFileMeta[]): Promise<Anthropic.ContentBlockParam[]> {
  let pdfBytes = 0;
  let pdfPages = 0;
  const asPdf = new Set<string>();
  for (const f of files) {
    const size = f.size_bytes ?? Infinity;
    const pages = f.page_count ?? 50;
    if (f.kind === "pdf" && size <= MAX_PDF_BYTES_PER_FILE && pdfBytes + size <= MAX_PDF_BYTES_PER_REQUEST && pdfPages + pages <= MAX_PDF_PAGES_PER_REQUEST) {
      asPdf.add(f.id);
      pdfBytes += size;
      pdfPages += pages;
    }
  }
  const texts = await extractedTexts(admin, files.filter((f) => !asPdf.has(f.id)).map((f) => f.id));

  return Promise.all(
    files.map(async (f): Promise<Anthropic.ContentBlockParam> => {
      const title = `${f.filename}${f.week ? ` (week ${f.week})` : ""}${f.box === "objectives" ? " [learning objectives]" : ""}`;
      if (asPdf.has(f.id)) {
        const { data, error } = await admin.storage.from(BUCKET).download(f.storage_path);
        if (error || !data) throw new Error(`download ${f.filename}: ${error?.message}`);
        const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
        return { type: "document", title, source: { type: "base64", media_type: "application/pdf", data: base64 } };
      }
      return { type: "document", title, source: { type: "text", media_type: "text/plain", data: texts.get(f.id) || "(no text)" } };
    }),
  );
}

export async function generateLessonContent(
  admin: SupabaseClient,
  inputs: CourseInputs,
  plan: CoursePlan,
  unitId: string,
  lessonId: string,
  /** Retries run at "low" so a slow first attempt still finishes within the platform's time limit. */
  effort: "low" | "medium" = "medium",
): Promise<LessonContent> {
  const unit = plan.units.find((u) => u.id === unitId)!;
  const lesson = unit.lessons.find((l) => l.id === lessonId)!;
  const ids = new Set(unitSourceIds(unit, inputs.files));
  const docs = await sourceDocuments(admin, inputs.files.filter((f) => ids.has(f.id)));

  // Cache layout: system (all courses) | outline + this unit's documents (all lessons in the unit) | lesson request
  const last = docs.length - 1;
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: `<course_outline>\n${courseOutlineText(plan)}\n</course_outline>\n\nSource files for this unit follow.` },
    ...docs.map((d, i) => (i === last ? { ...d, cache_control: { type: "ephemeral" as const } } : d)),
    { type: "text", text: lessonRequest(plan, lesson) },
  ];

  const { data } = await callStructured({
    system: LESSON_SYSTEM,
    content,
    schema: lessonWireSchema,
    maxTokens: 32_000,
    effort,
    onUsage: (usage, ms) => logUsage(admin, inputs.courseId, `lesson ${lesson.id}`, usage, ms),
    parse: (json) => {
      const result = parseLessonWire(json);
      if (result?.dropped) console.warn(`lesson ${lesson.id}: dropped ${result.dropped} malformed item(s)`);
      return result?.lesson ?? null;
    },
  });
  return fromWire(data);
}

// ---------- Interactives ----------

/** The interactive blocks a lesson asked for, in order (their builds line up with this list). */
export function interactiveRequests(content: LessonContent) {
  return content.blocks.flatMap((b) => (b.type === "interactive" ? [b] : []));
}

/**
 * Builds one interactive from its brief. On the final attempt it never throws: a failed build
 * returns null and the lesson shows the brief's fallback explanation instead. Earlier attempts
 * throw, so the job retries (at lower effort, which is faster).
 */
export async function buildWidget(
  admin: SupabaseClient,
  inputs: CourseInputs,
  plan: CoursePlan,
  lessonId: string,
  index: number,
  request: { title: string; brief: string },
  opts: { effort: "low" | "medium"; finalAttempt: boolean } = { effort: "medium", finalAttempt: true },
): Promise<WidgetBuild | null> {
  const lesson = plan.units.flatMap((u) => u.lessons).find((l) => l.id === lessonId)!;
  const label = `widget ${lessonId} #${index + 1}`;
  try {
    const { data } = await callStructured({
      system: WIDGET_SYSTEM,
      content: [
        {
          type: "text",
          text: widgetRequest({ courseTitle: plan.title, lessonTitle: lesson.title, lessonPlan: lesson.plan, title: request.title, brief: request.brief }),
        },
      ],
      schema: widgetBuildSchema,
      maxTokens: 32_000,
      effort: opts.effort,
      onUsage: (usage, ms) => logUsage(admin, inputs.courseId, label, usage, ms),
    });
    const problems = lintWidget(data.html);
    if (!problems.length) return data;

    // One repair round. Warnings alone don't justify failing: keep the original if the repair doesn't help.
    console.warn(`${label}: repairing
${describeProblems(problems)}`);
    const repaired = await repairWidget(admin, inputs.courseId, label, { ...request, html: data.html, problems }, opts.effort);
    if (repaired && !hasErrors(lintWidget(repaired.html))) return repaired;
    if (!hasErrors(problems)) return data;
    throw new Error(`still broken after repair: ${problems.map((p) => p.message).join(" ")}`);
  } catch (error) {
    console.warn(`${label} failed: ${error instanceof Error ? error.message : error}`);
    if (!opts.finalAttempt) throw error;
    return null;
  }
}

/**
 * Asks Claude to fix a widget, given the automatic check's findings and optionally a student's
 * description of what's wrong. Returns null if the call fails. Used during generation and, later,
 * by the "fix this interactive" request.
 */
export async function repairWidget(
  admin: SupabaseClient,
  courseId: string,
  label: string,
  input: { title: string; brief: string; html: string; problems: WidgetProblem[]; userReport?: string },
  effort: "low" | "medium",
): Promise<WidgetBuild | null> {
  try {
    const { data } = await callStructured({
      system: WIDGET_SYSTEM,
      content: [{ type: "text", text: widgetRepairRequest({ ...input, problems: describeProblems(input.problems) }) }],
      schema: widgetBuildSchema,
      maxTokens: 32_000,
      effort,
      onUsage: (usage, ms) => logUsage(admin, courseId, `${label} repair`, usage, ms),
    });
    return data.html.trim() ? data : null;
  } catch (error) {
    console.warn(`${label} repair failed: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

// ---------- Save ----------

export async function saveGeneratedCourse(
  admin: SupabaseClient,
  inputs: CourseInputs,
  plan: CoursePlan,
  contents: Record<string, LessonResult>,
): Promise<void> {
  const course = assembleCourse(plan, contents, {
    university: inputs.university ?? undefined,
    courseCode: inputs.courseCode ?? undefined,
    year: inputs.year ?? undefined,
  });
  await saveCourse(admin, course, { ownerId: inputs.ownerId, isSample: false, status: "ready" });
}
