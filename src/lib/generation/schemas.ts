import { z } from "zod";

/*
 * What Claude fills in (structured outputs). Deliberately simpler than the stored course
 * schema: no IDs (our code assigns them), no optional fields (nullable instead), so the
 * JSON schema sent to the API stays within structured-output limits. assemble.ts turns
 * these into a validated Course.
 */

// ---------- Outline pass ----------

export const outlineSchema = z.object({
  title: z.string().describe("Course title, e.g. the unit's name as students know it"),
  summary: z.string().describe("Two sentences on what the course covers"),
  concepts: z
    .array(
      z.object({
        key: z.string().describe("Short lowercase-hyphenated identifier, unique, e.g. 'bode-plots'"),
        name: z.string(),
        description: z.string().describe("One sentence"),
      }),
    )
    .describe("The distinct ideas the course teaches; mastery is tracked per concept"),
  units: z.array(
    z.object({
      title: z.string(),
      summary: z.string().describe("One or two sentences"),
      week: z.number().int().nullable().describe("Teaching week this unit covers, or null"),
      lessons: z.array(
        z.object({
          title: z.string(),
          summary: z.string().describe("One sentence a student sees in the lesson header"),
          estMinutes: z.number().int(),
          conceptKeys: z.array(z.string()).describe("Keys from `concepts` this lesson teaches"),
          sourceFileIds: z.array(z.string()).describe("IDs of the source files this lesson draws on"),
          plan: z
            .string()
            .describe("What this lesson must teach, in order: key points, examples, what to check. For the lesson writer."),
        }),
      ),
    }),
  ),
});

export type Outline = z.infer<typeof outlineSchema>;

// ---------- Lesson pass ----------

const markdown = z.string();

const lessonBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), markdown }),
  z.object({ type: z.literal("heading"), text: z.string() }),
  z.object({
    type: z.literal("callout"),
    variant: z.enum(["keyIdea", "tip", "warning", "example"]),
    title: z.string().nullable(),
    markdown,
  }),
  z.object({ type: z.literal("definition"), term: z.string(), markdown }),
  z.object({ type: z.literal("workedExample"), problem: markdown, steps: z.array(markdown), answer: markdown }),
  z.object({ type: z.literal("code"), language: z.string(), code: z.string(), caption: z.string().nullable() }),
  z.object({ type: z.literal("math"), latex: z.string(), caption: z.string().nullable() }),
  z.object({ type: z.literal("summary"), points: z.array(markdown) }),
  z.object({ type: z.literal("check"), questionRef: z.string().describe("The `ref` of a question in `questions`") }),
]);

const questionBase = {
  ref: z.string().describe("Short local reference, e.g. 'q1'"),
  conceptKey: z.string(),
  prompt: markdown,
  explanation: markdown,
};

const lessonQuestionSchema = z.discriminatedUnion("type", [
  z.object({ ...questionBase, type: z.literal("multipleChoice"), options: z.array(markdown), answerIndex: z.number().int() }),
  z.object({ ...questionBase, type: z.literal("shortAnswer"), modelAnswer: markdown, markingGuide: markdown }),
  z.object({
    ...questionBase,
    type: z.literal("ordering"),
    items: z.array(markdown).describe("In the CORRECT order; the app shuffles them"),
  }),
]);

export const lessonContentSchema = z.object({
  blocks: z.array(lessonBlockSchema),
  questions: z.array(lessonQuestionSchema),
});

export type LessonContent = z.infer<typeof lessonContentSchema>;
export type LessonBlockDraft = z.infer<typeof lessonBlockSchema>;
export type LessonQuestionDraft = z.infer<typeof lessonQuestionSchema>;
