import { z } from "zod";

/**
 * Course JSON schema: the single source of truth for the course format.
 * The classroom renders it, AI generation (phase 5) must produce it, and it is
 * split into the units / lessons / concepts / questions tables when saved.
 *
 * IDs are unique across the whole course and never change once created,
 * because tutor anchors, progress and bug reports point at them.
 */

const id = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}-[a-z0-9-]+$`), `must look like "${prefix}-something"`);

const markdown = z.string().min(1);

// ---------- Concepts ----------

export const conceptSchema = z.object({
  id: id("c"),
  name: z.string().min(1),
  description: z.string().min(1),
});

// ---------- Blocks ----------

const blockBase = {
  id: id("b"),
  conceptIds: z.array(z.string()).optional(),
};

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ ...blockBase, type: z.literal("text"), markdown }),
  z.object({ ...blockBase, type: z.literal("heading"), text: z.string().min(1) }),
  z.object({
    ...blockBase,
    type: z.literal("callout"),
    variant: z.enum(["keyIdea", "tip", "warning", "example"]),
    title: z.string().optional(),
    markdown,
  }),
  z.object({ ...blockBase, type: z.literal("definition"), term: z.string().min(1), markdown }),
  z.object({
    ...blockBase,
    type: z.literal("workedExample"),
    problem: markdown,
    steps: z.array(markdown).min(1),
    answer: markdown,
  }),
  z.object({
    ...blockBase,
    type: z.literal("code"),
    language: z.string().min(1),
    code: z.string().min(1),
    caption: z.string().optional(),
  }),
  z.object({ ...blockBase, type: z.literal("math"), latex: z.string().min(1), caption: z.string().optional() }),
  z.object({ ...blockBase, type: z.literal("summary"), points: z.array(markdown).min(1) }),
  z.object({ ...blockBase, type: z.literal("check"), questionId: z.string() }),
]);

// ---------- Questions ----------

const questionBase = {
  id: id("q"),
  conceptId: z.string(),
  prompt: markdown,
  explanation: markdown,
};

export const questionSchema = z.discriminatedUnion("type", [
  z.object({
    ...questionBase,
    type: z.literal("multipleChoice"),
    options: z.array(markdown).min(2).max(6),
    answerIndex: z.number().int().nonnegative(),
  }),
  z.object({
    ...questionBase,
    type: z.literal("shortAnswer"),
    modelAnswer: markdown,
    markingGuide: markdown,
  }),
  z.object({
    ...questionBase,
    type: z.literal("ordering"),
    /** Stored in the correct order; shuffled when shown. */
    items: z.array(markdown).min(2).max(8),
  }),
]);

// ---------- Structure ----------

export const lessonSchema = z.object({
  id: id("l"),
  title: z.string().min(1),
  summary: z.string().min(1),
  estMinutes: z.number().int().positive(),
  conceptIds: z.array(z.string()),
  blocks: z.array(blockSchema).min(1),
  questions: z.array(questionSchema),
});

export const unitSchema = z.object({
  id: id("u"),
  title: z.string().min(1),
  summary: z.string().min(1),
  week: z.number().int().positive().nullable(),
  lessons: z.array(lessonSchema).min(1),
});

const courseShape = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  university: z.string().optional(),
  courseCode: z.string().optional(),
  year: z.number().int().optional(),
  lengthMode: z.enum(["cram", "recommended", "deep"]),
  summary: z.string().min(1),
  concepts: z.array(conceptSchema),
  units: z.array(unitSchema).min(1),
});

/** Cross-reference rules that a plain shape check can't express. */
export const courseSchema = courseShape.superRefine((course, ctx) => {
  const seen = new Set<string>();
  const unique = (value: string, path: (string | number)[]) => {
    if (seen.has(value)) ctx.addIssue({ code: "custom", message: `duplicate id "${value}"`, path });
    seen.add(value);
  };

  const conceptIds = new Set(course.concepts.map((c) => c.id));
  const knownConcept = (value: string, path: (string | number)[]) => {
    if (!conceptIds.has(value)) ctx.addIssue({ code: "custom", message: `unknown concept "${value}"`, path });
  };

  course.concepts.forEach((c, i) => unique(c.id, ["concepts", i, "id"]));

  course.units.forEach((unit, u) => {
    unique(unit.id, ["units", u, "id"]);

    unit.lessons.forEach((lesson, l) => {
      const at = ["units", u, "lessons", l];
      unique(lesson.id, [...at, "id"]);
      lesson.conceptIds.forEach((c, i) => knownConcept(c, [...at, "conceptIds", i]));

      const placements = new Map<string, number>();
      lesson.blocks.forEach((block, b) => {
        unique(block.id, [...at, "blocks", b, "id"]);
        block.conceptIds?.forEach((c, i) => knownConcept(c, [...at, "blocks", b, "conceptIds", i]));
        if (block.type === "check") {
          placements.set(block.questionId, (placements.get(block.questionId) ?? 0) + 1);
        }
      });

      const questionIds = new Set<string>();
      lesson.questions.forEach((q, i) => {
        const qAt = [...at, "questions", i];
        unique(q.id, [...qAt, "id"]);
        questionIds.add(q.id);
        knownConcept(q.conceptId, [...qAt, "conceptId"]);
        if (placements.get(q.id) !== 1) {
          ctx.addIssue({
            code: "custom",
            message: `question "${q.id}" must appear in exactly one check block (found ${placements.get(q.id) ?? 0})`,
            path: qAt,
          });
        }
        if (q.type === "multipleChoice" && q.answerIndex >= q.options.length) {
          ctx.addIssue({ code: "custom", message: "answerIndex is out of range", path: [...qAt, "answerIndex"] });
        }
      });

      for (const questionId of placements.keys()) {
        if (!questionIds.has(questionId)) {
          ctx.addIssue({
            code: "custom",
            message: `check block points at unknown question "${questionId}"`,
            path: [...at, "blocks"],
          });
        }
      }
    });
  });
});

export type Course = z.infer<typeof courseSchema>;
export type Concept = z.infer<typeof conceptSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Block = z.infer<typeof blockSchema>;
export type BlockOf<T extends Block["type"]> = Extract<Block, { type: T }>;
export type Question = z.infer<typeof questionSchema>;
export type QuestionOf<T extends Question["type"]> = Extract<Question, { type: T }>;
