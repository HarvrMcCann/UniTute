import type { Lesson } from "@/lib/course/schema";
import type { LessonContent } from "./schemas";

/**
 * Converts a finished lesson back into the shape Claude writes (no IDs, question refs,
 * nulls for absent optionals). Used to show Claude a real example lesson, and in tests.
 */
export function lessonToDraft(lesson: Lesson): LessonContent {
  const refOf = new Map(lesson.questions.map((q, i) => [q.id, `q${i + 1}`]));
  return {
    blocks: lesson.blocks.map((b) => {
      switch (b.type) {
        case "text":
          return { type: "text", markdown: b.markdown };
        case "heading":
          return { type: "heading", text: b.text };
        case "callout":
          return { type: "callout", variant: b.variant, title: b.title ?? null, markdown: b.markdown };
        case "definition":
          return { type: "definition", term: b.term, markdown: b.markdown };
        case "workedExample":
          return { type: "workedExample", problem: b.problem, steps: b.steps, answer: b.answer };
        case "code":
          return { type: "code", language: b.language, code: b.code, caption: b.caption ?? null };
        case "math":
          return { type: "math", latex: b.latex, caption: b.caption ?? null };
        case "summary":
          return { type: "summary", points: b.points };
        case "check":
          return { type: "check", questionRef: refOf.get(b.questionId)! };
      }
    }),
    questions: lesson.questions.map((q) => {
      const base = { ref: refOf.get(q.id)!, conceptKey: q.conceptId.slice(2), prompt: q.prompt, explanation: q.explanation };
      switch (q.type) {
        case "multipleChoice":
          return { ...base, type: "multipleChoice", options: q.options, answerIndex: q.answerIndex };
        case "shortAnswer":
          return { ...base, type: "shortAnswer", modelAnswer: q.modelAnswer, markingGuide: q.markingGuide };
        case "ordering":
          return { ...base, type: "ordering", items: q.items };
      }
    }),
  };
}
