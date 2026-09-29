import { z } from "zod";
import type { LessonBlockDraft, LessonContent, LessonQuestionDraft } from "./schemas";

/*
 * The lesson format Claude actually fills in. Structured outputs compile the schema into a
 * grammar with a size limit; a union of a dozen block shapes exceeded it. So on the wire a
 * block is ONE flat object (a `type` plus nullable fields), and the same for questions.
 * fromWire() converts to the internal union types (LessonContent), dropping blocks that lack
 * what their type needs; assemble.ts then validates and repairs as usual.
 */

const BLOCK_TYPES = [
  "text",
  "heading",
  "callout",
  "definition",
  "workedExample",
  "code",
  "math",
  "summary",
  "check",
  "plot",
  "diagram",
  "interactive",
] as const;

const str = z.string().nullable();
// Small option lists are plain strings here (enums inflate the compiled grammar, which has a size
// limit); pick() maps them onto the allowed values in fromWire.
const axis = z.object({ label: z.string(), min: z.number(), max: z.number(), scale: z.string().describe('"linear" or "log"') });

const wireBlock = z.object({
  type: z.enum(BLOCK_TYPES),
  text: str.describe(
    "text: markdown. heading: the heading. callout/definition: markdown body. interactive: fallback explanation shown if it can't be built.",
  ),
  title: str.describe("callout, plot or interactive title"),
  variant: str.describe('callout only: "keyIdea", "tip", "warning" or "example"'),
  term: str.describe("definition only"),
  problem: str.describe("workedExample only"),
  steps: z.array(z.string()).nullable().describe("workedExample steps, or summary points"),
  answer: str.describe("workedExample only"),
  code: str.describe("code block source, or a math block's LaTeX, or a diagram's <svg>"),
  language: str.describe("code language; for a diagram, its alt text"),
  caption: str,
  questionRef: str.describe("check only: a question's ref"),
  plot: z
    .object({
      x: axis,
      y: axis,
      params: z.array(z.object({ name: z.string(), label: z.string(), min: z.number(), max: z.number(), step: z.number(), value: z.number() })),
      series: z.array(z.object({ label: z.string(), expr: z.string(), style: z.string().describe('"line" or "stem"') })),
    })
    .nullable()
    .describe("plot only"),
  brief: str.describe("interactive only: the full build spec"),
  relevance: str.describe('heading only: "core", "supporting" or "extension" (null if the lesson has no relevance)'),
});

const wireQuestion = z.object({
  ref: z.string(),
  type: z.enum(["multipleChoice", "shortAnswer", "ordering"]),
  conceptKey: z.string(),
  prompt: z.string(),
  explanation: z.string(),
  options: z.array(z.string()).nullable().describe("multipleChoice: the options. ordering: items in the CORRECT order"),
  answerIndex: z.number().int().nullable().describe("multipleChoice only"),
  modelAnswer: str.describe("shortAnswer only"),
  markingGuide: str.describe("shortAnswer only"),
});

export const lessonWireSchema = z.object({
  blocks: z.array(wireBlock),
  questions: z.array(wireQuestion),
  flashcards: z.array(z.object({ front: z.string(), back: z.string() })),
  formulas: z.array(z.object({ name: z.string(), latex: z.string(), note: z.string() })),
});

export type LessonWire = z.infer<typeof lessonWireSchema>;
type WireBlock = z.infer<typeof wireBlock>;

const EMPTY: Omit<WireBlock, "type"> = {
  text: null,
  title: null,
  variant: null,
  term: null,
  problem: null,
  steps: null,
  answer: null,
  code: null,
  language: null,
  caption: null,
  questionRef: null,
  plot: null,
  brief: null,
  relevance: null,
};

/** Maps a free-text option onto an allowed value (case-insensitive), or the fallback. */
function pick<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T;
function pick<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: null): T | null;
function pick<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T | null): T | null {
  const v = (value ?? "").trim().toLowerCase();
  return allowed.find((a) => a.toLowerCase() === v) ?? fallback;
}

const VARIANTS = ["keyIdea", "tip", "warning", "example"] as const;
const RELEVANCE = ["core", "supporting", "extension"] as const;
const SCALES = ["linear", "log"] as const;
const STYLES = ["line", "stem"] as const;

function blockFromWire(b: WireBlock): LessonBlockDraft | null {
  const has = (s: string | null): s is string => typeof s === "string" && s.trim().length > 0;
  switch (b.type) {
    case "text":
      return has(b.text) ? { type: "text", markdown: b.text } : null;
    case "heading":
      return has(b.text) ? { type: "heading", text: b.text, relevance: pick(b.relevance, RELEVANCE, null) } : null;
    case "callout":
      return has(b.text) ? { type: "callout", variant: pick(b.variant, VARIANTS, "tip"), title: b.title, markdown: b.text } : null;
    case "definition":
      return has(b.term) && has(b.text) ? { type: "definition", term: b.term, markdown: b.text } : null;
    case "workedExample":
      return has(b.problem) && has(b.answer) && b.steps?.length ? { type: "workedExample", problem: b.problem, steps: b.steps, answer: b.answer } : null;
    case "code":
      return has(b.code) ? { type: "code", language: b.language ?? "text", code: b.code, caption: b.caption } : null;
    case "math":
      return has(b.code) ? { type: "math", latex: b.code, caption: b.caption } : null;
    case "summary":
      return b.steps?.length ? { type: "summary", points: b.steps } : null;
    case "check":
      return has(b.questionRef) ? { type: "check", questionRef: b.questionRef } : null;
    case "plot":
      return b.plot
        ? {
            type: "plot",
            title: b.title,
            caption: b.caption,
            x: { ...b.plot.x, scale: pick(b.plot.x.scale, SCALES, "linear") },
            y: { ...b.plot.y, scale: pick(b.plot.y.scale, SCALES, "linear") },
            params: b.plot.params,
            series: b.plot.series.map((s) => ({ ...s, style: pick(s.style, STYLES, "line") })),
          }
        : null;
    case "diagram":
      return has(b.code) ? { type: "diagram", svg: b.code, alt: b.language ?? b.caption ?? "Diagram", caption: b.caption } : null;
    case "interactive":
      return has(b.brief) ? { type: "interactive", title: b.title ?? "Try it", brief: b.brief, fallback: b.text ?? "" } : null;
  }
}

function questionFromWire(q: LessonWire["questions"][number]): LessonQuestionDraft {
  const base = { ref: q.ref, conceptKey: q.conceptKey, prompt: q.prompt, explanation: q.explanation };
  switch (q.type) {
    case "multipleChoice":
      return { ...base, type: "multipleChoice", options: q.options ?? [], answerIndex: q.answerIndex ?? -1 };
    case "shortAnswer":
      return { ...base, type: "shortAnswer", modelAnswer: q.modelAnswer ?? "", markingGuide: q.markingGuide ?? "" };
    case "ordering":
      return { ...base, type: "ordering", items: q.options ?? [] };
  }
}

export function fromWire(w: LessonWire): LessonContent {
  return {
    blocks: w.blocks.map(blockFromWire).filter((b): b is LessonBlockDraft => b !== null),
    questions: w.questions.map(questionFromWire),
    flashcards: w.flashcards,
    formulas: w.formulas,
  };
}

/** The reverse, for showing Claude an example lesson in exactly the format it writes. */
export function toWire(c: LessonContent): LessonWire {
  return {
    blocks: c.blocks.map((b): WireBlock => {
      switch (b.type) {
        case "text":
          return { ...EMPTY, type: "text", text: b.markdown };
        case "heading":
          return { ...EMPTY, type: "heading", text: b.text, relevance: b.relevance };
        case "callout":
          return { ...EMPTY, type: "callout", variant: b.variant, title: b.title, text: b.markdown };
        case "definition":
          return { ...EMPTY, type: "definition", term: b.term, text: b.markdown };
        case "workedExample":
          return { ...EMPTY, type: "workedExample", problem: b.problem, steps: b.steps, answer: b.answer };
        case "code":
          return { ...EMPTY, type: "code", code: b.code, language: b.language, caption: b.caption };
        case "math":
          return { ...EMPTY, type: "math", code: b.latex, caption: b.caption };
        case "summary":
          return { ...EMPTY, type: "summary", steps: b.points };
        case "check":
          return { ...EMPTY, type: "check", questionRef: b.questionRef };
        case "plot":
          return { ...EMPTY, type: "plot", title: b.title, caption: b.caption, plot: { x: b.x, y: b.y, params: b.params, series: b.series } };
        case "diagram":
          return { ...EMPTY, type: "diagram", code: b.svg, language: b.alt, caption: b.caption };
        case "interactive":
          return { ...EMPTY, type: "interactive", title: b.title, brief: b.brief, text: b.fallback };
      }
    }),
    questions: c.questions.map((q) => {
      const base = { ref: q.ref, type: q.type, conceptKey: q.conceptKey, prompt: q.prompt, explanation: q.explanation };
      const none = { options: null, answerIndex: null, modelAnswer: null, markingGuide: null };
      switch (q.type) {
        case "multipleChoice":
          return { ...base, ...none, options: q.options, answerIndex: q.answerIndex };
        case "shortAnswer":
          return { ...base, ...none, modelAnswer: q.modelAnswer, markingGuide: q.markingGuide };
        case "ordering":
          return { ...base, ...none, options: q.items };
      }
    }),
    flashcards: c.flashcards,
    formulas: c.formulas,
  };
}

const flashcardItem = z.object({ front: z.string(), back: z.string() });
const formulaItem = z.object({ name: z.string(), latex: z.string(), note: z.string() });

/**
 * Validates a lesson item by item: a block, question, card or formula that doesn't fit the
 * format is dropped (and counted) instead of failing the whole lesson. Null if nothing usable.
 */
export function parseLessonWire(json: unknown): { lesson: LessonWire; dropped: number } | null {
  if (!json || typeof json !== "object") return null;
  const raw = json as Record<string, unknown>;
  let dropped = 0;
  const keep = <T>(items: unknown, schema: z.ZodType<T>): T[] =>
    (Array.isArray(items) ? items : []).flatMap((item) => {
      const r = schema.safeParse(item);
      if (!r.success) dropped++;
      return r.success ? [r.data] : [];
    });

  const lesson: LessonWire = {
    blocks: keep(raw.blocks, wireBlock),
    questions: keep(raw.questions, wireQuestion),
    flashcards: keep(raw.flashcards, flashcardItem),
    formulas: keep(raw.formulas, formulaItem),
  };
  return lesson.blocks.length > 0 ? { lesson, dropped } : null;
}
