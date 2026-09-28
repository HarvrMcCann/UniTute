import { NonRetriableError } from "inngest";
import type { CoursePlan } from "@/lib/generation/assemble";
import { GenerationError } from "@/lib/generation/claude";
import {
  generateLessonContent,
  generateOutline,
  loadCourseInputs,
  saveGeneratedCourse,
  setProgress,
} from "@/lib/generation/pipeline";
import type { LessonContent } from "@/lib/generation/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "./client";

/*
 * Builds a course from its extracted files: one outline step, one step per lesson
 * (two units at a time; lessons within a unit run in order so they share Claude's
 * prompt cache), then one save step. Each step is retried on its own.
 */

const PARALLEL_UNITS = 2;

/** Non-retryable generation failures stop immediately instead of burning retries. */
async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof GenerationError && !error.retryable) throw new NonRetriableError(error.message);
    throw error;
  }
}

export const generateCourse = inngest.createFunction(
  {
    id: "generate-course",
    triggers: [{ event: "course/generate.requested" }],
    concurrency: { limit: 1, key: "event.data.courseId" },
    retries: 3,
    onFailure: async ({ event, error }) => {
      const courseId = (event.data.event.data as { courseId: string }).courseId;
      await setProgress(createAdminClient(), courseId, null, {
        status: "failed",
        generation_error: error.message.slice(0, 500),
      });
    },
  },
  async ({ event, step }) => {
    const { courseId } = event.data as { courseId: string };

    const plan = await step.run("outline", () =>
      guard(async () => {
        const admin = createAdminClient();
        const inputs = await loadCourseInputs(admin, courseId);
        const plan = await generateOutline(admin, inputs);
        const total = plan.units.reduce((n, u) => n + u.lessons.length, 0);
        await setProgress(admin, courseId, { stage: "lessons", total, lessonTitles: plan.units.flatMap((u) => u.lessons.map((l) => l.title)) });
        return plan;
      }),
    ) as CoursePlan;

    const contents: Record<string, LessonContent> = {};
    for (let i = 0; i < plan.units.length; i += PARALLEL_UNITS) {
      const batch = plan.units.slice(i, i + PARALLEL_UNITS);
      await Promise.all(
        batch.map(async (unit) => {
          for (const lesson of unit.lessons) {
            contents[lesson.id] = (await step.run(`lesson ${lesson.id}`, () =>
              guard(async () => {
                const admin = createAdminClient();
                const inputs = await loadCourseInputs(admin, courseId);
                return generateLessonContent(admin, inputs, plan, unit.id, lesson.id);
              }),
            )) as LessonContent;
          }
        }),
      );
    }

    await step.run("save course", () =>
      guard(async () => {
        const admin = createAdminClient();
        await setProgress(admin, courseId, { stage: "saving" });
        const inputs = await loadCourseInputs(admin, courseId);
        await saveGeneratedCourse(admin, inputs, plan, contents);
        await setProgress(admin, courseId, null, { generation_error: null });
      }),
    );

    return { lessons: Object.keys(contents).length };
  },
);
