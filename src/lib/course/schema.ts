import { z } from "zod";
import { compile, ExpressionError } from "@/lib/plot/expression";

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

export const plotAxisSchema = z.object({
  label: z.string(),
  min: z.number(),
  max: z.number(),
  scale: z.enum(["linear", "log"]),
});

/** A slider the student drags; its `name` can be used in series expressions. */
export const plotParamSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string(),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  value: z.number(),
});

/** `expr` is a formula in x and the params, e.g. "-10*log10(1 + (x*tau)^2)"; see lib/plot/expression.ts. */
export const plotSeriesSchema = z.object({
  label: z.string(),
  expr: z.string().min(1),
  style: z.enum(["line", "stem"]),
});

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
  // Graph of one or more formulas, optionally with sliders for parameters. Drawn by the app.
  z.object({
    ...blockBase,
    type: z.literal("plot"),
    title: z.string().optional(),
    caption: z.string().optional(),
    x: plotAxisSchema,
    y: plotAxisSchema,
    params: z.array(plotParamSchema).max(4),
    series: z.array(plotSeriesSchema).min(1).max(5),
  }),
  // A static SVG drawing (circuit, block diagram, labelled sketch). Shown as an image, so it can't run code.
  z.object({ ...blockBase, type: z.literal("diagram"), svg: z.string().min(1), alt: z.string().min(1), caption: z.string().optional() }),
  // A self-contained interactive (simulation, builder, explorable) written by Claude, run in a sandboxed iframe.
  z.object({
    ...blockBase,
    type: z.literal("widget"),
    title: z.string().min(1),
    description: markdown,
    html: z.string().min(1),
    height: z.number().int().min(120).max(1200),
  }),
]);

// ---------- Unit study tools (gathered per unit from each lesson) ----------

export const flashcardSchema = z.object({ front: markdown, back: markdown });
export const formulaSchema = z.object({ name: z.string().min(1), latex: z.string().min(1), note: z.string() });

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
  flashcards: z.array(flashcardSchema).default([]),
  formulas: z.array(formulaSchema).default([]),
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
        if (block.type === "plot") {
          plotProblems(block).forEach((message) => ctx.addIssue({ code: "custom", message, path: [...at, "blocks", b] }));
        }
        if (block.type === "widget" && block.html.length > WIDGET_MAX_CHARS) {
          ctx.addIssue({ code: "custom", message: "widget html is too large", path: [...at, "blocks", b, "html"] });
        }
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

export const WIDGET_MAX_CHARS = 120_000;
const RESERVED_NAMES = new Set(["x", "pi", "e"]);

/** Everything wrong with a plot block (empty when it's fine). Used by the validator and by generation. */
export function plotProblems(plot: Pick<PlotBlock, "x" | "y" | "params" | "series">): string[] {
  const problems: string[] = [];
  for (const [name, axis] of [["x", plot.x], ["y", plot.y]] as const) {
    if (!(axis.min < axis.max)) problems.push(`${name} axis min must be below max`);
    if (axis.scale === "log" && axis.min <= 0) problems.push(`${name} axis is logarithmic, so min must be above 0`);
  }
  const names = new Set<string>();
  for (const p of plot.params) {
    if (RESERVED_NAMES.has(p.name) || names.has(p.name)) problems.push(`parameter name "${p.name}" is reserved or repeated`);
    names.add(p.name);
    if (!(p.min < p.max) || p.value < p.min || p.value > p.max) problems.push(`parameter "${p.name}" has an invalid range`);
  }
  for (const s of plot.series) {
    try {
      compile(s.expr, ["x", ...names]);
    } catch (error) {
      problems.push(`series "${s.label}": ${error instanceof ExpressionError ? error.message : "invalid formula"}`);
    }
  }
  return problems;
}

export type Course = z.infer<typeof courseSchema>;
export type PlotBlock = z.infer<typeof blockSchema> & { type: "plot" };
export type Flashcard = z.infer<typeof flashcardSchema>;
export type Formula = z.infer<typeof formulaSchema>;
export type Concept = z.infer<typeof conceptSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Block = z.infer<typeof blockSchema>;
export type BlockOf<T extends Block["type"]> = Extract<Block, { type: T }>;
export type Question = z.infer<typeof questionSchema>;
export type QuestionOf<T extends Question["type"]> = Extract<Question, { type: T }>;
